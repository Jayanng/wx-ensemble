'use strict';

/**
 * Invariant tests for the anti-fabrication contract.
 *
 * These exist because the original suite passed even while the engine published
 * spread_celsius 0 on a single-member refusal: the assertion was simply not
 * written. Every claim the README makes about what the service does NOT do is
 * asserted here, so a regression fails the build rather than shipping.
 */

const test = require('node:test');
const assert = require('node:assert');

const { aggregatePoint, buildEnsemble, MIN_MEMBERS } = require('../src/ensemble');
const { parseRequest } = require('../src/server');

// ---------------------------------------------------------------------------
// refusal publishes NO band statistics
// ---------------------------------------------------------------------------

test('a single-member refusal publishes no band statistics at all', () => {
  const out = aggregatePoint([
    { source: 'a', value: 10.0 },
    { source: 'b', value: null },
    { source: 'c', value: null },
  ]);

  assert.equal(out.status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(out.members_present, 1);

  // The band statistics must all be null. Any number here would read as a
  // measurement the service does not have.
  assert.equal(out.min_celsius, null, 'min must be null on refusal');
  assert.equal(out.max_celsius, null, 'max must be null on refusal');
  assert.equal(out.median_celsius, null, 'median must be null on refusal');
  assert.equal(out.mean_celsius, null, 'mean must be null on refusal');
  assert.equal(out.stddev_celsius, null, 'stddev must be null on refusal');
  assert.equal(out.iqr_celsius, null, 'iqr must be null on refusal');
  assert.equal(out.spread_celsius, null, 'spread must be null on refusal, never 0');
  assert.equal(out.agreement_ratio, null, 'agreement must be null on refusal');
  assert.equal(out.confidence, 'unquantified');

  // The reading that DOES exist is still published, named and sourced.
  assert.equal(out.values.length, 1);
  assert.equal(out.values[0].source, 'a');
  assert.equal(out.values[0].celsius, 10);
});

test('a refusal never reports a spread of zero', () => {
  // The specific historical bug: spread_celsius was 0 for a single member,
  // which reads as "every model agrees perfectly" when only one spoke.
  const out = aggregatePoint([{ source: 'only', value: 21.5 }]);
  assert.notEqual(out.spread_celsius, 0);
  assert.equal(out.spread_celsius, null);
});

test('a total outage reports UNAVAILABLE and publishes nothing numeric', () => {
  const out = aggregatePoint([
    { source: 'a', value: null },
    { source: 'b', value: null },
  ]);
  assert.equal(out.status, 'UNAVAILABLE');
  for (const k of ['min_celsius', 'max_celsius', 'median_celsius', 'mean_celsius',
                   'stddev_celsius', 'iqr_celsius', 'spread_celsius', 'agreement_ratio']) {
    assert.equal(out[k], null, `${k} must be null when nothing reported`);
  }
  assert.equal(out.values.length, 0);
  assert.equal(out.missing.length, 2);
});

// ---------------------------------------------------------------------------
// agreement_ratio is degenerate below three members
// ---------------------------------------------------------------------------

test('agreement_ratio is null for exactly two members, however far apart', () => {
  // 0 C and 100 C: wildly split, yet the old formula returned 1.0.
  const out = aggregatePoint([
    { source: 'a', value: 0 },
    { source: 'b', value: 100 },
  ]);
  assert.equal(out.status, 'OBSERVED');
  assert.equal(out.members_present, 2);
  assert.equal(out.agreement_ratio, null,
    'two members can never disagree under this metric, so it must not be published');
});

test('agreement_ratio is published for three or more members', () => {
  const out = aggregatePoint([
    { source: 'a', value: 10 },
    { source: 'b', value: 10.1 },
    { source: 'c', value: 10.2 },
    { source: 'd', value: 10.15 },
  ]);
  assert.equal(out.status, 'OBSERVED');
  assert.equal(typeof out.agreement_ratio, 'number');
  assert.ok(out.agreement_ratio >= 0 && out.agreement_ratio <= 1);
});

test('agreement_ratio is null below MIN_MEMBERS and the threshold is 2', () => {
  assert.equal(MIN_MEMBERS, 2);
  const out = aggregatePoint([{ source: 'a', value: 5 }]);
  assert.equal(out.agreement_ratio, null);
});

// ---------------------------------------------------------------------------
// summary never coerces null agreement to zero
// ---------------------------------------------------------------------------

test('mean_agreement_ratio ignores points that have no agreement value', () => {
  // Two points: one with THREE members (agreement exists), one with TWO
  // (agreement is null and must not be counted as zero).
  //
  // The fixture must actually produce that split. An earlier version gave both
  // points two members, so mean_agreement_ratio came back null, the assertions
  // sat inside `if (typeof ... === 'number')`, and the test passed without
  // asserting anything at all.
  const series = [
    {
      source: 's1', label: 'S1',
      values: [
        { time: '2026-01-01T00:00:00Z', celsius: 10 },
        { time: '2026-01-01T01:00:00Z', celsius: 10 },
      ],
    },
    {
      source: 's2', label: 'S2',
      values: [{ time: '2026-01-01T00:00:00Z', celsius: 11 }],
    },
    {
      // Third member for hour 0 only, so hour 0 has three members.
      source: 's3', label: 'S3',
      values: [{ time: '2026-01-01T00:00:00Z', celsius: 10.5 }],
    },
    {
      // And a second member for hour 1, so hour 1 has exactly two.
      source: 's4', label: 'S4',
      values: [{ time: '2026-01-01T01:00:00Z', celsius: 12 }],
    },
  ];

  const out = buildEnsemble({
    latitude: 0, longitude: 0, hours: 2,
    requestedAtUtc: '2026-01-01T00:00:00Z',
    modelSeries: series, sourceErrors: [],
  });

  const withBand = out.points.filter((p) => p.status === 'OBSERVED');
  assert.equal(withBand.length, 2, 'both points should carry a band');

  // The two-member point must publish no agreement at all.
  const two = withBand.find((p) => p.members_present === 2);
  assert.ok(two, 'fixture must produce a two-member point');
  assert.equal(two.agreement_ratio, null);

  // The three-member point must publish one.
  const three = withBand.find((p) => p.members_present === 3);
  assert.ok(three, 'fixture must produce a three-member point');
  assert.equal(typeof three.agreement_ratio, 'number');

  // Unconditional. If these sit behind a type check the test proves nothing.
  assert.equal(typeof out.summary.mean_agreement_ratio, 'number',
    'the mean must be a number, not null');
  assert.ok(out.summary.mean_agreement_ratio > 0);
  assert.ok(out.summary.mean_agreement_ratio <= 1);
  assert.equal(out.summary.agreement_sample_size, 1,
    'only the three-member point may contribute');
  // The mean must equal that one point's value exactly, not be diluted.
  assert.equal(out.summary.mean_agreement_ratio, three.agreement_ratio);
});

// ---------------------------------------------------------------------------
// a failed source is still a member, reported as missing
// ---------------------------------------------------------------------------

test('a source with no values is counted as missing at every point, not dropped', () => {
  const series = [
    { source: 's1', label: 'S1', values: [{ time: '2026-01-01T00:00:00Z', celsius: 10 }] },
    // A source that failed entirely: values null.
    { source: 's2', label: 'S2', values: null, error: 'upstream down' },
  ];

  const out = buildEnsemble({
    latitude: 0, longitude: 0, hours: 1,
    requestedAtUtc: '2026-01-01T00:00:00Z',
    modelSeries: series, sourceErrors: [{ source: 's2', error: 'upstream down' }],
  });

  assert.equal(out.points.length, 1);
  const p = out.points[0];
  // s2 must appear as missing, so members_missing reflects the real outage.
  assert.equal(p.members_missing, 1, 'the failed source must be reported missing');
  assert.equal(p.missing.length, 1);
  assert.equal(p.missing[0].source, 's2');
  assert.equal(p.status, 'INSUFFICIENT_EVIDENCE');
  // Both sources are described in the sources list.
  assert.equal(out.sources.length, 2);
});

test('a failed source reports an outage reason, not a silent gap', () => {
  const out = buildEnsemble({
    latitude: 0, longitude: 0, hours: 1,
    requestedAtUtc: '2026-01-01T00:00:00Z',
    modelSeries: [
      { source: 'ok', label: 'OK', values: [{ time: '2026-01-01T00:00:00Z', celsius: 10 }] },
      { source: 'broken', label: 'Broken', values: null, error: 'upstream HTTP 503' },
    ],
    sourceErrors: [{ source: 'broken', error: 'upstream HTTP 503' }],
  });

  const p = out.points[0];
  const m = p.missing.find((x) => x.source === 'broken');
  assert.ok(m, 'the failed source must be listed as missing');
  assert.match(m.reason, /failed/i,
    'an outage must not read as "did not report this time point"');
  assert.match(m.reason, /503/, 'the underlying cause should be carried through');
});

test('a bare second-precision timestamp is read as UTC, not host local', () => {
  // Date.parse("YYYY-MM-DDTHH:MM:SS") with no zone is specified to parse as
  // HOST LOCAL time. On a UTC+8 box that silently shifts the reading by eight
  // hours and splits the ensemble. Only a trailing Z makes it unambiguous.
  const { toUtcHourBucket } = require('../src/time');
  assert.equal(toUtcHourBucket('2026-10-09T16:00:00'), '2026-10-09T16:00:00Z');
  assert.equal(toUtcHourBucket('2026-10-09T16:00'), '2026-10-09T16:00:00Z');
  assert.equal(toUtcHourBucket('2026-10-09T16:00:00Z'), '2026-10-09T16:00:00Z');
  assert.equal(toUtcHourBucket('2026-10-09T16:00:00+02:00'), '2026-10-09T14:00:00Z');
});

test('agreement does not lose a boundary member to floating point rounding', () => {
  // Three evenly spaced values. Each is exactly one sample stddev from the
  // median, so agreement must be 1.0. Without an epsilon the largest is
  // excluded and the metric reports 0.667.
  const out = aggregatePoint([
    { source: 'a', value: 10.1 },
    { source: 'b', value: 10.2 },
    { source: 'c', value: 10.3 },
  ]);
  assert.equal(out.status, 'OBSERVED');
  assert.equal(out.agreement_ratio, 1);
});

test('unplaceable readings keep the value, not just the timestamp', () => {
  const out = buildEnsemble({
    latitude: 0, longitude: 0, hours: 1,
    requestedAtUtc: '2026-01-01T00:00:00Z',
    modelSeries: [{
      source: 's1', label: 'S1',
      values: [
        { time: '2026-01-01T00:00:00Z', celsius: 10 },
        { time: 'not-a-time', celsius: 42.5 },
      ],
    }],
    sourceErrors: [],
  });
  assert.equal(out.unplaceable_readings.length, 1);
  assert.equal(out.unplaceable_readings[0].original_time, 'not-a-time');
  assert.equal(out.unplaceable_readings[0].celsius, 42.5,
    'the reading must survive so it is evidence, not deleted');
});

test('a source outside its geographic coverage is not reported as an outage', () => {
  const out = buildEnsemble({
    latitude: 0, longitude: 0, hours: 1,
    requestedAtUtc: '2026-01-01T00:00:00Z',
    modelSeries: [
      { source: 'ok', label: 'OK', values: [{ time: '2026-01-01T00:00:00Z', celsius: 10 }] },
      { source: 'regional', label: 'Regional', values: null, outOfCoverage: true, error: 'nws points HTTP 404' },
    ],
    sourceErrors: [],
  });
  const m = out.points[0].missing.find((x) => x.source === 'regional');
  assert.ok(m);
  assert.match(m.reason, /coverage/i);
  assert.doesNotMatch(m.reason, /failed/i,
    'a coverage boundary must not read as a source failure');
});

test('the confidence label is reproducible from the published thresholds', () => {
  // The breakpoints are a convention. If they are published in the response
  // they must actually BE the ones used, or the disclosure is worse than none.
  const out = buildEnsemble({
    latitude: 0, longitude: 0, hours: 4,
    requestedAtUtc: '2026-01-01T00:00:00Z',
    modelSeries: [
      // point 0: tight spread -> high
      // point 1: wide spread  -> low
      { source: 'a', label: 'A', values: [
        { time: '2026-01-01T00:00:00Z', celsius: 10.0 },
        { time: '2026-01-01T01:00:00Z', celsius: 10.0 },
        { time: '2026-01-01T02:00:00Z', celsius: 0.0 },
        { time: '2026-01-01T03:00:00Z', celsius: 0.0 },
      ]},
      { source: 'b', label: 'B', values: [
        { time: '2026-01-01T00:00:00Z', celsius: 10.2 },
        { time: '2026-01-01T01:00:00Z', celsius: 10.2 },
        { time: '2026-01-01T02:00:00Z', celsius: 4.0 },
        { time: '2026-01-01T03:00:00Z', celsius: 4.0 },
      ]},
    ],
    sourceErrors: [],
  });

  const t = out.method.confidence_thresholds_celsius;
  assert.ok(t, 'the thresholds must be published in the response');
  assert.equal(t.high_at_or_below, 1.0);
  assert.equal(t.moderate_at_or_below, 2.5);
  assert.equal(t.low_at_or_below, 5.0);

  for (const p of out.points) {
    assert.equal(p.confidence_basis, 'derived_from_spread');
    if (p.status !== 'OBSERVED') continue;
    const s = p.spread_celsius;
    const expected =
      s <= t.high_at_or_below ? 'high'
      : s <= t.moderate_at_or_below ? 'moderate'
      : s <= t.low_at_or_below ? 'low'
      : 'very_low';
    assert.equal(p.confidence, expected,
      `spread ${s} must map to ${expected} using the published thresholds`);
  }
});

test('the Fahrenheit conversion is exact and refuses non-numbers', () => {
  // The only unit conversion in the codebase. It was previously an inline
  // expression inside a network fetcher and was never asserted anywhere.
  const { fahrenheitToCelsius } = require('../src/sources');

  assert.equal(fahrenheitToCelsius(32), 0, 'freezing point');
  assert.equal(fahrenheitToCelsius(212), 100, 'boiling point');
  assert.equal(fahrenheitToCelsius(-40), -40, 'the scales cross at -40');
  // 77 F is exactly 25 C.
  assert.equal(fahrenheitToCelsius(77), 25);

  // Non-numbers must come back null and never become 0.
  assert.equal(fahrenheitToCelsius(null), null);
  assert.equal(fahrenheitToCelsius(undefined), null);
  assert.equal(fahrenheitToCelsius('32'), null);
  assert.equal(fahrenheitToCelsius(NaN), null);
  assert.equal(fahrenheitToCelsius(Infinity), null);
});

test('the moderate confidence breakpoint is exercised, not just high and very_low', () => {
  // The thresholds are published. Every band of them must be reachable or the
  // disclosure proves less than it appears to.
  const t = { high: 1.0, moderate: 2.5, low: 5.0 };
  const cases = [
    // [member a, member b, expected label]
    [10.0, 10.5, 'high'],        // spread 0.5
    [10.0, 12.0, 'moderate'],    // spread 2.0  <- the untested band
    [10.0, 14.0, 'low'],         // spread 4.0  <- also previously untested
    [10.0, 17.0, 'very_low'],    // spread 7.0
  ];

  for (const [a, b, expected] of cases) {
    const out = aggregatePoint([
      { source: 'x', value: a },
      { source: 'y', value: b },
      { source: 'z', value: (a + b) / 2 },
    ]);
    assert.equal(out.status, 'OBSERVED');
    assert.equal(out.confidence, expected,
      `spread ${out.spread_celsius} must label as ${expected}`);
  }

  // And the boundaries themselves must be inclusive as documented.
  const atBoundary = aggregatePoint([
    { source: 'x', value: 10 },
    { source: 'y', value: 12.5 },
    { source: 'z', value: 11.25 },
  ]);
  assert.equal(atBoundary.spread_celsius, 2.5);
  assert.equal(atBoundary.confidence, 'moderate',
    'the boundary value must fall in the band that names it, at_or_below');
});

// ---------------------------------------------------------------------------
// request validation matches the OpenAPI contract
// ---------------------------------------------------------------------------

test('an unrecognised request field is rejected, not silently ignored', () => {
  // openapi.json says additionalProperties:false. A caller who misspells "hours"
  // must be told, not quietly given the default horizon.
  const r = parseRequest(JSON.stringify({ latitude: 1, longitude: 2, hour: 3 }));
  assert.equal(r.ok, false);
  assert.match(r.error, /Unrecognised field/);
  assert.match(r.error, /hour/);
});

test('every documented field is still accepted', () => {
  const r = parseRequest(JSON.stringify({ latitude: 1, longitude: 2, hours: 3 }));
  assert.equal(r.ok, true);
  assert.equal(r.value.hours, 3);
});

test('hours defaults to 6 and bounds are enforced', () => {
  assert.equal(parseRequest(JSON.stringify({ latitude: 1, longitude: 2 })).value.hours, 6);
  assert.equal(parseRequest(JSON.stringify({ latitude: 1, longitude: 2, hours: 0 })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ latitude: 1, longitude: 2, hours: 25 })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ latitude: 1, longitude: 2, hours: 1.5 })).ok, false);
});

test('out of range coordinates are rejected', () => {
  assert.equal(parseRequest(JSON.stringify({ latitude: 91, longitude: 0 })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ latitude: 0, longitude: 181 })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ latitude: 'x', longitude: 0 })).ok, false);
});

// ---------------------------------------------------------------------------
// sources[] describes the window, not the whole upstream payload
// ---------------------------------------------------------------------------

test('sources reports forecast points inside the requested window only', () => {
  const longSeries = [];
  for (let i = 0; i < 48; i += 1) {
    longSeries.push({
      time: new Date(Date.parse('2026-01-01T00:00:00Z') + i * 3600_000).toISOString().replace('.000Z', 'Z'),
      celsius: 10,
    });
  }
  const out = buildEnsemble({
    latitude: 0, longitude: 0, hours: 2,
    requestedAtUtc: '2026-01-01T00:00:00Z',
    modelSeries: [
      { source: 's1', label: 'S1', values: longSeries },
      { source: 's2', label: 'S2', values: longSeries },
    ],
    sourceErrors: [],
  });

  assert.equal(out.points.length, 2, 'the window is 2 hours');
  for (const s of out.sources) {
    assert.equal(s.forecast_points_in_window, 2,
      'a 48-slice upstream must report 2 points for a 2 hour window, not 48');
    assert.equal(s.members_returned, undefined,
      'the old ambiguous field name must be gone');
  }
});
