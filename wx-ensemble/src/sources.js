'use strict';

/**
 * Upstream weather model fetchers for wx-ensemble.
 *
 * HARD RULE: never invent a value. If a source fails or omits a reading, return
 * `null` for that reading and let the engine widen the band or refuse. There is
 * no interpolation anywhere in this file.
 *
 * Every source is free and needs no API key. Probed live 2026-10-09.
 */

const USER_AGENT = 'wx-ensemble/1.0 (pocket-network-service)';

/**
 * NWS reports Fahrenheit. This is the only unit conversion in the codebase and
 * it is extracted and exported so it can be tested directly rather than left as
 * an untested inline expression buried in a network fetcher.
 *
 * Returns null for anything that is not a finite number. Never coerces.
 */
function fahrenheitToCelsius(raw) {
  return typeof raw === 'number' && Number.isFinite(raw) ? (raw - 32) * 5 / 9 : null;
}

/** The six national models Open-Meteo serves in one free call. */
const OPEN_METEO_MODELS = [
  'icon_seamless',      // Deutscher Wetterdienst (Germany)
  'gfs_seamless',       // NOAA / NCEP (United States)
  'ecmwf_ifs025',       // ECMWF (Europe)
  'gem_seamless',       // Environment and Climate Change Canada
  'meteofrance_seamless', // Meteo-France
  'jma_seamless',       // Japan Meteorological Agency
];

/**
 * Fetch the Open-Meteo multi-model ensemble.
 * Returns { ok, models: [{ id, label, values: [ { time, celsius } ] }], error }.
 */
async function fetchOpenMeteo(lat, lon, signal) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    // temperature_2m ONLY. An earlier version also requested wind_speed_10m and
    // precipitation_probability, downloaded them on every call and never parsed
    // them. The README says plainly that this service is temperature only, so
    // asking for fields it does not model was both wasted bandwidth and a
    // mismatch between the contract and the request.
    hourly: 'temperature_2m',
    models: OPEN_METEO_MODELS.join(','),
    forecast_days: '2',
    timezone: 'UTC',
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) {
    return { ok: false, models: [], error: `open-meteo HTTP ${res.status}` };
  }
  const body = await res.json();

  // Open-Meteo returns one flat hourly block with per-model keys:
  //   temperature_2m_icon_seamless, temperature_2m_gfs_seamless, ...
  //
  // Do NOT slice to `hours` here. Open-Meteo's series starts at midnight of the
  // forecast day while Met.no's starts at "now", so taking the first N entries
  // of each produces disjoint sets. Return everything the upstream gives us and
  // let buildEnsemble select the requested clock window. That keeps one place
  // authoritative for which hours are in scope.
  const hourly = body.hourly || {};
  const times = hourly.time || [];
  const slice = times;

  const models = [];
  for (const modelId of OPEN_METEO_MODELS) {
    const tKey = `temperature_2m_${modelId}`;
    const series = hourly[tKey];
    if (!Array.isArray(series)) {
      // Model returned nothing. That is a missing reading, NOT a zero.
      models.push({ id: modelId, label: modelId, values: null, error: 'no series returned' });
      continue;
    }
    const values = slice.map((time, i) => {
      const raw = series[i];
      return {
        time,
        // Explicit null for a missing point. Never coerced to 0.
        celsius: typeof raw === 'number' && Number.isFinite(raw) ? raw : null,
      };
    });
    models.push({ id: modelId, label: modelId, values, error: null });
  }

  return { ok: true, models, error: null, endpoint: 'api.open-meteo.com' };
}

/**
 * Fetch the Norwegian Meteorological Institute (Met.no) as an independent cross-check.
 * Free, no key, requires a descriptive User-Agent.
 */
async function fetchMetNo(lat, lon, signal) {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  try {
    const res = await fetch(url, {
      signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) {
      return { ok: false, values: null, error: `met.no HTTP ${res.status}` };
    }
    const body = await res.json();
    const timeseries = (body.properties && body.properties.timeseries) || [];
    // Do NOT slice to `hours` here. The requested window is applied centrally in
    // buildEnsemble so every source is trimmed by the same clock.
    const values = timeseries.map((entry) => {
      const t = entry.data && entry.data.instant && entry.data.instant.details;
      const raw = t && t.air_temperature;
      return {
        time: entry.time,
        celsius: typeof raw === 'number' && Number.isFinite(raw) ? raw : null,
      };
    });
    return { ok: true, values, error: null, endpoint: 'api.met.no' };
  } catch (err) {
    return { ok: false, values: null, error: `met.no ${err.name || 'error'}` };
  }
}

/**
 * Fetch NOAA/NWS HOURLY point forecast for US coordinates as a third
 * independent source.
 *
 * Returns inCoverage:false outside the US, which is correct behaviour and not an
 * error. Only a 404 from the /points lookup means "outside coverage". A 5xx is
 * an upstream fault and must be reported as one, not disguised as a coverage
 * exclusion, or a NWS outage at a valid US coordinate would be presented as
 * "expected, not a fault".
 *
 * IMPORTANT: `properties.forecast` returns 6 or 12 hour AGGREGATE periods
 * (an overnight low, an afternoon high). Those are not instantaneous readings,
 * and putting them in an hourly ensemble compares a 12 hour extreme against
 * other models' hourly values, which corrupts every statistic downstream.
 * `properties.forecastHourly` returns genuine hourly temperatures.
 */
async function fetchNws(lat, lon, signal) {
  try {
    const pointUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const pointRes = await fetch(pointUrl, {
      signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    });
    if (!pointRes.ok) {
      // 404 is "this point is not in the NWS grid", which is expected outside
      // the United States. Anything else is a fault at an in-coverage point.
      const notCovered = pointRes.status === 404;
      return {
        ok: false,
        values: null,
        error: `nws points HTTP ${pointRes.status}`,
        inCoverage: !notCovered,
      };
    }
    const point = await pointRes.json();
    const forecastUrl = point.properties && point.properties.forecastHourly;
    if (!forecastUrl) {
      return { ok: false, values: null, error: 'nws no hourly forecast url', inCoverage: true };
    }
    const fcRes = await fetch(forecastUrl, {
      signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    });
    if (!fcRes.ok) {
      return { ok: false, values: null, error: `nws forecast HTTP ${fcRes.status}`, inCoverage: true };
    }
    const fc = await fcRes.json();
    const periods = (fc.properties && fc.properties.periods) || [];
    // Do not slice to `hours` here; the central window filter decides which
    // hours are in scope.
    const values = periods.map((p) => {
      const raw = p.temperature;
      return {
        time: p.startTime,
        // NWS reports Fahrenheit. Convert, and label the unit honestly.
        celsius: fahrenheitToCelsius(raw),
        sourceUnit: 'F',
      };
    });
    return { ok: true, values, error: null, endpoint: 'api.weather.gov', inCoverage: true };
  } catch (err) {
    // A thrown error is a FAULT, not a coverage exclusion. Timeouts, DNS
    // failures and socket resets happen at coordinates that are perfectly well
    // covered, and reporting them as "outside coverage" hides a real outage.
    // Only an HTTP 404 from the /points lookup establishes non-coverage.
    return { ok: false, values: null, error: `nws ${err.name || 'error'}`, inCoverage: true };
  }
}

module.exports = {
  OPEN_METEO_MODELS,
  fahrenheitToCelsius,
  fetchOpenMeteo,
  fetchMetNo,
  fetchNws,
};
