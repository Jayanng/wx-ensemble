'use strict';

/**
 * wx-ensemble — a Pocket Network service.
 *
 * POCKET SERVICE CONTRACT (docs.pocket.network)
 *   1. Every response is a JSON object. Never bare text, never a bare array.
 *   2. All inputs arrive in the body. No path params, no query params, no auth.
 *   3. No caller authentication of any kind.
 *   4. Respond within the session. Budget measured at 615s; this service targets < 15s.
 *   5. Serve identity and probe endpoints.
 *
 * A8 CONTENT QUALITY (Agentic Portal audit)
 *   - a human-readable display name             -> set on chain
 *   - an identity probe that pins the service ID -> GET /v1/identity
 *   - a functional probe beyond health/version   -> POST /v1/ensemble with a probe payload
 *   - a machine-readable, service-specific spec  -> GET /openapi.json
 *
 * The service never fabricates. Missing upstream data produces UNAVAILABLE or
 * INSUFFICIENT_EVIDENCE with a stated reason.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { fetchOpenMeteo, fetchMetNo, fetchNws, OPEN_METEO_MODELS } = require('./sources');
const { buildEnsemble, aggregatePoint, MIN_MEMBERS } = require('./ensemble');

const SERVICE_ID = 'wx-ensemble';
const SERVICE_VERSION = '1.0.0';
const SCHEMA = 'wx-ensemble/v1';
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

/** Upstream budget. Well inside the 615s session + grace window. */
const UPSTREAM_TIMEOUT_MS = 12_000;

const OPENAPI_PATH = path.join(__dirname, '..', 'openapi.json');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, obj) {
  // Contract 1: the response body is always a JSON object.
  const body = Buffer.from(JSON.stringify(obj, null, 2));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    // There is no auth in this service, so there is nothing to challenge.
    'x-service-id': SERVICE_ID,
    'x-service-schema': SCHEMA,
  });
  res.end(body);
}

function readBody(req, limitBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error('request body exceeds 64 KiB'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function badRequest(reason, details) {
  return {
    schema: SCHEMA,
    status: 'REJECTED',
    reason,
    details: details || null,
    generated_at_utc: new Date().toISOString(),
  };
}

/**
 * Largest number of members that actually reported at any band point.
 * Used so the summary line describes the evidence that exists, not the number
 * of models that happen to be configured.
 */
function maxBandMembers(points) {
  let max = 0;
  for (const p of points || []) {
    if (p && p.status === 'OBSERVED' && typeof p.members_present === 'number') {
      if (p.members_present > max) max = p.members_present;
    }
  }
  return max;
}

/**
 * Validate the request payload. Returns { ok, value } or { ok:false, error }.
 * Contract 2: every input arrives in the body.
 */
function parseRequest(raw) {
  if (!raw || !raw.trim()) {
    return { ok: false, error: 'Request body is empty. All inputs must arrive in the JSON body.' };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Request body is not valid JSON.' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }

  // openapi.json declares additionalProperties:false on EnsembleRequest. Honour
  // it: silently ignoring an unknown key means a caller can misspell "hours" as
  // "hour", get the default of 6 back with no complaint, and act on a horizon
  // they did not ask for.
  const allowed = ['latitude', 'longitude', 'hours'];
  const unknown = Object.keys(parsed).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Unrecognised field(s): ${unknown.join(', ')}. Allowed fields are ${allowed.join(', ')}.`,
    };
  }

  const { latitude, longitude } = parsed;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { ok: false, error: 'latitude must be a finite number between -90 and 90.' };
  }
  if (typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: 'longitude must be a finite number between -180 and 180.' };
  }

  let hours = 6;
  if (parsed.hours !== undefined) {
    if (!Number.isInteger(parsed.hours) || parsed.hours < 1 || parsed.hours > 24) {
      return { ok: false, error: 'hours must be an integer between 1 and 24.' };
    }
    hours = parsed.hours;
  }

  return { ok: true, value: { latitude, longitude, hours } };
}

// ---------------------------------------------------------------------------
// the core call
// ---------------------------------------------------------------------------

async function handleEnsemble(payload) {
  const requestedAtUtc = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  const sourceErrors = [];
  let openMeteo = { ok: false, models: [], error: 'not attempted' };
  let metno = { ok: false, values: null, error: 'not attempted' };
  let nws = { ok: false, values: null, error: 'not attempted', inCoverage: false };

  try {
    // Fetch all sources concurrently. A failure in one is recorded, not fatal.
    [openMeteo, metno, nws] = await Promise.all([
      fetchOpenMeteo(payload.latitude, payload.longitude, controller.signal)
        .catch((e) => ({ ok: false, models: [], error: `open-meteo ${e.name || 'error'}` })),
      fetchMetNo(payload.latitude, payload.longitude, controller.signal)
        .catch((e) => ({ ok: false, values: null, error: `met.no ${e.name || 'error'}` })),
      fetchNws(payload.latitude, payload.longitude, controller.signal)
        // Same reasoning as sources.js: a rejected promise is a fault, and must
        // not be flattened into "outside coverage".
        .catch((e) => ({ ok: false, values: null, error: `nws ${e.name || 'error'}`, inCoverage: true })),
    ]);
  } finally {
    clearTimeout(timer);
  }

  // Flatten every model into a series of { source, label, values }.
  //
  // A source that FAILED MUST still appear here, with values null. Dropping it
  // would shrink the denominator and make points look better evidenced than they
  // are: a caller would see members_missing 0 and an empty missing[] while six
  // of eight configured models were actually down. A failure is a member with no
  // data, and it is reported as missing at every time point.
  const modelSeries = [];
  const seen = new Set();

  for (const m of openMeteo.models || []) {
    modelSeries.push({
      source: `open-meteo:${m.id}`,
      label: m.label,
      values: m.values,
      error: m.error,
    });
    seen.add(m.id);
    if (m.error) sourceErrors.push({ source: `open-meteo:${m.id}`, error: m.error });
  }
  // If the whole Open-Meteo call failed, `models` is empty. Register every
  // configured model explicitly so the outage is visible per model.
  for (const modelId of OPEN_METEO_MODELS) {
    if (seen.has(modelId)) continue;
    modelSeries.push({
      source: `open-meteo:${modelId}`,
      label: modelId,
      values: null,
      error: openMeteo.error || 'open-meteo did not return this model',
    });
    sourceErrors.push({
      source: `open-meteo:${modelId}`,
      error: openMeteo.error || 'open-meteo did not return this model',
    });
  }

  modelSeries.push({
    source: 'met.no',
    label: 'Norwegian Meteorological Institute',
    values: metno.ok ? metno.values : null,
    error: metno.ok ? null : metno.error,
  });
  if (!metno.ok) sourceErrors.push({ source: 'met.no', error: metno.error });

  modelSeries.push({
    source: 'noaa-nws',
    label: 'NOAA National Weather Service',
    values: nws.ok ? nws.values : null,
    error: nws.ok ? null : nws.error,
    // Being outside the NWS grid is a geographic boundary, not an upstream
    // fault. It must not be recorded in source_errors, which is defined as
    // "every upstream failure" and empty when all sources succeeded.
    outOfCoverage: !nws.ok && nws.inCoverage === false,
  });
  if (!nws.ok && nws.inCoverage !== false) {
    sourceErrors.push({ source: 'noaa-nws', error: nws.error });
  }

  const ensemble = buildEnsemble({
    latitude: payload.latitude,
    longitude: payload.longitude,
    hours: payload.hours,
    requestedAtUtc,
    modelSeries,
    sourceErrors,
  });

  const overallStatus =
    ensemble.summary.points_with_band > 0 ? 'OK' : 'UNAVAILABLE';

  // Report how many models ACTUALLY spoke at a band point, not how many are
  // configured. Saying "from 8 upstream sources" when two of them were down
  // overstates the evidence behind the band.
  const maxMembersAtPoint = maxBandMembers(ensemble.points);
  const configuredCount = modelSeries.length;

  return {
    schema: SCHEMA,
    status: overallStatus,
    // Contract: words like "error" must not appear early in a success body.
    summary_line:
      overallStatus === 'OK'
        ? `${ensemble.summary.points_with_band} time point(s) carry a multi-model band from up to ${maxMembersAtPoint} of ${configuredCount} configured upstream sources.`
        : 'No time point reached the minimum number of upstream models.',
    generated_at_utc: requestedAtUtc,
    latency_ms: Date.now() - Date.parse(requestedAtUtc),
    service: { id: SERVICE_ID, version: SERVICE_VERSION },
    ...ensemble,
  };
}

// ---------------------------------------------------------------------------
// identity + probe
// ---------------------------------------------------------------------------

function identityPayload() {
  return {
    schema: SCHEMA,
    status: 'OK',
    service: {
      id: SERVICE_ID,
      version: SERVICE_VERSION,
      // NOT "calibrated". The spread is descriptive. Calling it calibrated would
      // claim a probabilistic property the engine explicitly does not have.
      display_name: 'Ensemble Weather Forecast With Multi-Model Spread',
      network: 'pocket-beta',
      chain_id: 'pocket-lego-testnet',
      owner_address: 'pokt1hs0p9ceh2dkw4h5lk555cjgjjft8ya45uamt7g',
    },
    contract: {
      transport: 'REST',
      response_is_json_object: true,
      inputs_in_body: true,
      requires_authentication: false,
      deterministic_aggregation: true,
    },
    probes: {
      identity: '/v1/identity',
      functional: '/v1/probe',
      liveness: '/healthz',
      specification: '/openapi.json',
    },
    generated_at_utc: new Date().toISOString(),
  };
}

/**
 * Functional probe. This is deliberately MORE than a health check: it runs a
 * real ensemble call against a fixed coordinate and asserts the response shape,
 * so a supplier can prove their backend is actually working before staking.
 */
async function functionalProbe() {
  // A fixed, well-known coordinate. London.
  const started = Date.now();
  let result;
  try {
    result = await handleEnsemble({ latitude: 51.5074, longitude: -0.1278, hours: 2 });
  } catch (err) {
    return {
      schema: SCHEMA,
      status: 'FAILED',
      probe: 'functional',
      reason: `ensemble call threw ${err.name || 'error'}`,
      // The OpenAPI Probe schema requires `checks`. A failure response is still
      // a response and must honour the contract it publishes.
      checks: [{ name: 'execution', pass: false }],
      generated_at_utc: new Date().toISOString(),
    };
  }

  // These checks must test that the service actually WORKED, not merely that a
  // response object came back. A probe that returns OK while every upstream is
  // down is worse than no probe: it certifies a broken deployment.
  const pointsWithBand = (result.summary && result.summary.points_with_band) || 0;
  const checks = [
    { name: 'schema_is_v1', pass: result.schema === SCHEMA },
    { name: 'response_is_object', pass: typeof result === 'object' && !Array.isArray(result) },
    { name: 'has_points_array', pass: Array.isArray(result.points) && result.points.length > 0 },
    { name: 'points_carry_status', pass: result.points.every((p) => typeof p.status === 'string') },
    // The call must have produced at least one real band. Without this the
    // probe reports OK against an entirely refused response.
    { name: 'produced_a_real_band', pass: pointsWithBand > 0 },
    { name: 'status_is_ok', pass: result.status === 'OK' },
    // Every band point must carry at least MIN_MEMBERS named values, and every
    // refusal must carry a reason. This is the anti-fabrication invariant.
    {
      name: 'band_points_meet_min_members',
      pass: (result.points || [])
        .filter((p) => p.status === 'OBSERVED')
        .every((p) => Array.isArray(p.values) && p.values.length >= MIN_MEMBERS),
    },
    // The refusal assertions must NOT be vacuous. Filtering the live response
    // for refusals yields an empty array whenever every point is OBSERVED, and
    // `[].every(...)` is true, so those checks would silently pass forever
    // without testing anything. Instead a refusal is FORCED with a synthetic
    // single-member input, so the invariant is exercised on every probe run.
    {
      name: 'synthetic_refusal_publishes_no_band_statistics',
      pass: (() => {
        const r = aggregatePoint([
          { source: 'synthetic', value: 1 },
          { source: 'absent', value: null },
        ]);
        return r.status === 'INSUFFICIENT_EVIDENCE'
          && r.min_celsius === null
          && r.max_celsius === null
          && r.median_celsius === null
          && r.mean_celsius === null
          && r.stddev_celsius === null
          && r.iqr_celsius === null
          && r.spread_celsius === null
          && r.agreement_ratio === null
          && r.confidence === 'unquantified';
      })(),
    },
    {
      name: 'synthetic_refusal_carrys_a_reason',
      pass: (() => {
        const r = aggregatePoint([{ source: 'only', value: 5 }]);
        return typeof r.reason === 'string' && r.reason.length > 0;
      })(),
    },
    // And the live refusals, if any occurred, must obey the same rules. This
    // check is still worth having, but it is not the only thing standing
    // between a regression and a shipped fabrication.
    {
      name: 'live_refusals_carry_a_reason',
      pass: (result.points || [])
        .filter((p) => p.status !== 'OBSERVED')
        .every((p) => typeof p.reason === 'string' && p.reason.length > 0),
    },
    { name: 'no_interpolation_field', pass: result.method && result.method.interpolation === 'none. A missing member value is reported as missing and excluded from statistics.' },
    { name: 'min_members_documented', pass: result.method && result.method.min_members_required === MIN_MEMBERS },
    { name: 'latency_within_session', pass: (Date.now() - started) < 615_000 },
  ];

  return {
    schema: SCHEMA,
    status: checks.every((c) => c.pass) ? 'OK' : 'FAILED',
    probe: 'functional',
    description:
      'Executes a real ensemble call for a fixed coordinate and asserts the response ' +
      'shape. This is a functional probe, not a liveness check.',
    latency_ms: Date.now() - started,
    upstream_sources_seen: (result.sources || []).length,
    checks,
    generated_at_utc: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// routing
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];

  try {
    if (req.method === 'GET' && (url === '/healthz' || url === '/health')) {
      // Liveness ONLY. No service name, no schema, nothing that identifies the
      // service. A health endpoint that echoes the name lets a name-squatter
      // pass a probe by copying a string, and it leaks identity to any scanner.
      // Identity is served by /v1/identity, which is checked separately.
      return sendJson(res, 200, {
        status: 'ok',
        generated_at_utc: new Date().toISOString(),
      });
    }

    if (req.method === 'GET' && url === '/v1/identity') {
      return sendJson(res, 200, identityPayload());
    }

    if (req.method === 'GET' && url === '/openapi.json') {
      // Serve the file BYTES verbatim, not a re-serialised copy. The on-chain
      // service card publishes a sha256 of this document, and JSON.stringify of
      // a parsed object does not reproduce the original bytes (indentation,
      // key order and number formatting all shift). Re-serialising would make
      // the published hash unverifiable against what is actually served.
      let raw;
      try {
        raw = fs.readFileSync(OPENAPI_PATH);
        JSON.parse(raw.toString('utf8')); // confirm it is valid JSON before serving
      } catch {
        return sendJson(res, 503, {
          schema: SCHEMA,
          status: 'UNAVAILABLE',
          reason: 'The machine-readable specification is not present on this deployment.',
        });
      }
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': raw.length,
        'cache-control': 'no-store',
      });
      return res.end(raw);
    }

    if (req.method === 'GET' && url === '/v1/probe') {
      const probe = await functionalProbe();
      return sendJson(res, probe.status === 'OK' ? 200 : 503, probe);
    }

    // The relay path. The RelayMiner forwards to the backend ROOT and carries
    // the target path inside the RelayRequest payload, so both forms are
    // accepted here.
    //
    // This is NOT a public bypass, though it looks like one. The backend is
    // bound to 127.0.0.1 so only the relayer can reach it, and nginx refuses
    // non-GET on "/" from outside (limit_except GET deny all). Removing the "/"
    // alias entirely breaks every relay with "proto: illegal wireType", because
    // the relayer then receives a 404 where it expects a relay response.
    if (req.method === 'POST' && (url === '/v1/ensemble' || url === '/')) {
      let raw;
      try {
        raw = await readBody(req);
      } catch (err) {
        return sendJson(res, 413, badRequest(err.message));
      }
      const parsed = parseRequest(raw);
      if (!parsed.ok) {
        return sendJson(res, 400, badRequest('The request payload is not acceptable.', parsed.error));
      }
      const result = await handleEnsemble(parsed.value);
      return sendJson(res, 200, result);
    }

    // GET / is the endpoint URL a person will paste into a browser. Without
    // this it falls through to the relay handler and returns
    // "invalid relay request: body must be a valid RelayRequest protobuf",
    // which is correct but tells a first-time visitor nothing. This describes
    // the service and says plainly how the call is actually made.
    if (req.method === 'GET' && url === '/') {
      return sendJson(res, 200, {
        schema: SCHEMA,
        status: 'OK',
        service: {
          id: SERVICE_ID,
          name: 'Ensemble Weather Forecast With Multi-Model Spread',
          version: SERVICE_VERSION,
        },
        what_it_does:
          'Reports how much independent national forecasting centres disagree about ' +
          'temperature for a coordinate over the next 24 hours. Every member value is ' +
          'published next to its source. A missing value is reported as missing and is ' +
          'never interpolated, back-filled or coerced to zero.',
        readable_here: {
          '/openapi.json': 'the machine readable contract',
          '/v1/identity': 'identity probe, pins the service id',
          '/v1/probe': 'functional probe, runs a real ensemble call and asserts the shape',
          '/healthz': 'liveness only',
        },
        calls_are_relayed: {
          target: 'POST /v1/ensemble',
          why:
            'This is a Pocket Network service. The ensemble call is a metered relay, so it ' +
            'must arrive as a signed Pocket RelayRequest. A plain browser request cannot ' +
            'make it, and that rejection is the network working as designed.',
          how: [
            'Send a signed relay through any Pocket gateway serving this service.',
            'Or use the pocket-ap CLI, which signs for you:',
          ],
          example:
            'pocket-ap call --config pocket-ap.yaml --network beta --service wx-ensemble ' +
            '--rpc-type rest -X POST --path /v1/ensemble ' +
            "--data '{\"latitude\":51.5074,\"longitude\":-0.1278,\"hours\":12}'",
          signing_reference:
            'https://github.com/pokt-network/pocket-relay-miner/tree/main/examples/relay-signing',
        },
        network: 'pocket-beta',
        chain_id: 'pocket-lego-testnet',
        repository: 'https://github.com/Jayanng/wx-ensemble',
        generated_at_utc: new Date().toISOString(),
      });
    }

    // Anything else: a JSON object, never an HTML error page.
    return sendJson(res, 404, {
      schema: SCHEMA,
      status: 'REJECTED',
      reason: `No route matches ${req.method} ${url}.`,
      routes: {
        'POST /v1/ensemble': 'the ensemble call; all inputs in the JSON body',
        'GET /v1/identity': 'identity probe, pins the service id',
        'GET /v1/probe': 'functional probe, runs a real ensemble call',
        'GET /openapi.json': 'machine-readable OpenAPI 3.x specification',
        'GET /healthz': 'liveness',
      },
    });
  } catch (err) {
    // A thrown error is still a JSON object on the wire.
    return sendJson(res, 500, {
      schema: SCHEMA,
      status: 'UNAVAILABLE',
      reason: 'The service could not complete this request.',
      detail: String(err && err.message ? err.message : err).slice(0, 300),
      generated_at_utc: new Date().toISOString(),
    });
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    process.stdout.write(
      `${SERVICE_ID} ${SERVICE_VERSION} listening on http://${HOST}:${PORT}\n`);
  });
}

module.exports = { server, handleEnsemble, parseRequest, functionalProbe, SERVICE_ID, SCHEMA };
