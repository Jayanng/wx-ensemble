'use strict';

/**
 * Timestamp normalisation tests.
 *
 * The bug these prevent: two sources reporting the same hour in different
 * string formats were treated as different time points, so the ensemble never
 * combined them and silently degraded into single-member refusals.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { toUtcHourBucket, normaliseSeries, HOUR_MS } = require('../src/time');

test('Open-Meteo hour-precision and Met.no second-precision resolve to the same bucket', () => {
  const a = toUtcHourBucket('2026-10-09T16:00');
  const b = toUtcHourBucket('2026-10-09T16:00:00Z');
  assert.equal(a, b);
  assert.equal(a, '2026-10-09T16:00:00Z');
});

test('a bare timestamp without a zone is treated as UTC, not host-local', () => {
  assert.equal(toUtcHourBucket('2026-10-09T00:00'), '2026-10-09T00:00:00Z');
});

test('a local offset is converted to the correct UTC hour', () => {
  // 2026-10-09T16:00:00-04:00 is 20:00 UTC.
  assert.equal(toUtcHourBucket('2026-10-09T16:00:00-04:00'), '2026-10-09T20:00:00Z');
});

test('minutes are bucketed down to the hour', () => {
  assert.equal(toUtcHourBucket('2026-10-09T16:59:59Z'), '2026-10-09T16:00:00Z');
  assert.equal(toUtcHourBucket('2026-10-09T16:00:01Z'), '2026-10-09T16:00:00Z');
});

test('an unparseable timestamp returns null and is never guessed', () => {
  assert.equal(toUtcHourBucket('not-a-time'), null);
  assert.equal(toUtcHourBucket(''), null);
  assert.equal(toUtcHourBucket(null), null);
  assert.equal(toUtcHourBucket(undefined), null);
  assert.equal(toUtcHourBucket(12345), null);
});

test('normaliseSeries drops unplaceable readings and reports them separately', () => {
  const r = normaliseSeries([
    { time: '2026-10-09T16:00', celsius: 10 },
    { time: 'garbage', celsius: 99 },
    { time: '2026-10-09T16:00:00Z', celsius: 11 },
    { time: '2026-10-09T17:30:00Z', celsius: 12 },
  ]);
  assert.equal(r.values.length, 3);
  assert.equal(r.unplaceable.length, 1);
  assert.equal(r.unplaceable[0].original, 'garbage');
  // The unplaceable reading is NOT in the values, so it cannot pollute stats.
  assert.ok(!r.values.some((v) => v.celsius === 99));
  // The two 16:00 forms both land in the same bucket.
  assert.equal(r.values[0].time, '2026-10-09T16:00:00Z');
  assert.equal(r.values[1].time, '2026-10-09T16:00:00Z');
  assert.equal(r.values[2].time, '2026-10-09T17:00:00Z');
});

test('normaliseSeries preserves the original upstream timestamp for audit', () => {
  const r = normaliseSeries([{ time: '2026-10-09T16:37:00Z', celsius: 5 }]);
  assert.equal(r.values[0].time, '2026-10-09T16:00:00Z');
  assert.equal(r.values[0].sourceTime, '2026-10-09T16:37:00Z');
});

test('hour constant is exactly one hour', () => {
  assert.equal(HOUR_MS, 3600000);
});
