'use strict';

/**
 * Tests for wx-ensemble.
 *
 * Run: node --test test/
 *
 * The assertions here encode the honesty contract. If a test that forbids
 * interpolation ever fails, the service is fabricating data and must not ship.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { aggregatePoint, buildEnsemble, median, quantile, MIN_MEMBERS } = require('../src/ensemble');
const { parseRequest } = require('../src/server');

test('median handles odd and even counts', () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('quantile is interpolating between neighbours', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(quantile([1, 2, 3, 4], 0), 1);
  assert.equal(quantile([1, 2, 3, 4], 1), 4);
});

// --- the anti-fabrication contract ----------------------------------------

test('a missing member value is reported as missing, never filled', () => {
  const out = aggregatePoint([
    { source: 'a', value: 10.0 },
    { source: 'b', value: null, missingReason: 'upstream 500' },
    { source: 'c', value: 12.0 },
  ]);
  assert.equal(out.members_present, 2);
  assert.equal(out.members_missing, 1);
  assert.equal(out.missing.length, 1);
  assert.equal(out.missing[0].source, 'b');
  assert.equal(out.missing[0].reason, 'upstream 500');
  // The stats must exclude the missing member, not treat it as 0.
  assert.equal(out.median_celsius, 11.0);
  assert.equal(out.status, 'OBSERVED');
});

test('a missing member is NOT coerced to zero', () => {
  const out = aggregatePoint([
    { source: 'a', value: 20.0 },
    { source: 'b', value: null },
    { source: 'c', value: 22.0 },
  ]);
  assert.notEqual(out.mean_celsius, (20 + 0 + 22) / 3);
  assert.equal(out.mean_celsius, 21.0);
});

test('with fewer than MIN_MEMBERS the engine refuses to report a band', () => {
  const out = aggregatePoint([
    { source: 'a', value: 10.0 },
    { source: 'b', value: null },
    { source: 'c', value: null },
    { source: 'd', value: null },
  ]);
  assert.equal(out.members_present, 1);
  assert.equal(out.status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(out.agreement_ratio, null);
  assert.equal(out.stddev_celsius, null);
  assert.equal(out.confidence, 'unquantified');
  assert.match(out.reason, /cannot express uncertainty/i);
});

test('with zero members the engine reports UNAVAILABLE with a reason', () => {
  const out = aggregatePoint([
    { source: 'a', value: null },
    { source: 'b', value: null },
  ]);
  assert.equal(out.status, 'UNAVAILABLE');
  assert.equal(out.min_celsius, null);
  assert.equal(out.max_celsius, null);
  assert.ok(out.reason && out.reason.length > 10);
});

test('spread and agreement reflect real disagreement', () => {
  const out = aggregatePoint([
    { source: 'a', value: 10.0 },
    { source: 'b', value: 12.0 },
    { source: 'c', value: 14.0 },
    { source: 'd', value: 16.0 },
  ]);
  assert.equal(out.spread_celsius, 6.0);
  assert.equal(out.min_celsius, 10.0);
  assert.equal(out.max_celsius, 16.0);
  assert.equal(out.mean_celsius, 13.0);
  assert.equal(out.confidence, 'very_low');
});

test('identical members produce total agreement and a high confidence label', () => {
  const out = aggregatePoint([
    { source: 'a', value: 11.5 },
    { source: 'b', value: 11.5 },
    { source: 'c', value: 11.5 },
  ]);
  assert.equal(out.spread_celsius, 0);
  assert.equal(out.agreement_ratio, 1);
  assert.equal(out.stddev_celsius, 0);
  assert.equal(out.confidence, 'high');
});

test('confidence is always labelled as derived, never as a probability', () => {
  const out = aggregatePoint([
    { source: 'a', value: 1 },
    { source: 'b', value: 2 },
    { source: 'c', value: 3 },
  ]);
  assert.equal(out.confidence_basis, 'derived_from_spread');
});

// --- request validation ----------------------------------------------------

test('parseRequest rejects a missing body', () => {
  const r = parseRequest('');
  assert.equal(r.ok, false);
  assert.match(r.error, /empty/i);
});

test('parseRequest rejects non-object JSON', () => {
  assert.equal(parseRequest('[1,2]').ok, false);
  assert.equal(parseRequest('"str"').ok, false);
  assert.equal(parseRequest('42').ok, false);
});

test('parseRequest rejects out-of-range coordinates', () => {
  assert.equal(parseRequest(JSON.stringify({ latitude: 91, longitude: 0 })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ latitude: 0, longitude: 181 })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ latitude: 'x', longitude: 0 })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ latitude: NaN, longitude: 0 })).ok, false);
});

test('parseRequest rejects a non-integer or out-of-range horizon', () => {
  assert.equal(parseRequest(JSON.stringify({ latitude: 0, longitude: 0, hours: 0 })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ latitude: 0, longitude: 0, hours: 25 })).ok, false);
  assert.equal(parseRequest(JSON.stringify({ latitude: 0, longitude: 0, hours: 2.5 })).ok, false);
});

test('parseRequest accepts a valid payload and defaults the horizon to 6', () => {
  const r = parseRequest(JSON.stringify({ latitude: 51.5, longitude: -0.12 }));
  assert.equal(r.ok, true);
  assert.equal(r.value.hours, 6);
  assert.equal(r.value.latitude, 51.5);
});

// --- response shape --------------------------------------------------------

test('buildEnsemble aligns every source on the same clock-derived window', () => {
  // Source a starts at the window start, source b reports only the second hour.
  // The window is 2 hours from 2026-10-09T00:00:00Z, so keys are 00:00 and 01:00.
  const out = buildEnsemble({
    latitude: 1,
    longitude: 2,
    hours: 2,
    requestedAtUtc: '2026-10-09T00:00:00.000Z',
    modelSeries: [
      {
        source: 'a', label: 'A', error: null,
        values: [
          { time: '2026-10-09T00:00:00Z', celsius: 10 },
          { time: '2026-10-09T01:00:00Z', celsius: 11 },
        ],
      },
      {
        source: 'b', label: 'B', error: null,
        values: [{ time: '2026-10-09T01:00:00Z', celsius: 13 }],
      },
    ],
    sourceErrors: [],
  });

  assert.equal(out.points.length, 2);
  assert.equal(out.points[0].time, '2026-10-09T00:00:00Z');
  assert.equal(out.points[1].time, '2026-10-09T01:00:00Z');
  // First hour has only source a -> too few members to express uncertainty.
  assert.equal(out.points[0].status, 'INSUFFICIENT_EVIDENCE');
  // Second hour has both sources -> band reported.
  assert.equal(out.points[1].status, 'OBSERVED');
  assert.equal(out.points[1].members_present, 2);
});

test('buildEnsemble drops readings outside the requested window rather than misplacing them', () => {
  const out = buildEnsemble({
    latitude: 1,
    longitude: 2,
    hours: 1,
    requestedAtUtc: '2026-10-09T00:00:00.000Z',
    modelSeries: [
      {
        source: 'a', label: 'A', error: null,
        values: [
          // Midnight of the PREVIOUS day. Must not leak into this window.
          { time: '2026-10-08T00:00:00Z', celsius: -99 },
          { time: '2026-10-09T00:00:00Z', celsius: 10 },
        ],
      },
      {
        source: 'b', label: 'B', error: null,
        values: [
          { time: '2026-10-08T00:00:00Z', celsius: -98 },
          { time: '2026-10-09T00:00:00Z', celsius: 12 },
        ],
      },
    ],
    sourceErrors: [],
  });
  assert.equal(out.points.length, 1);
  assert.equal(out.points[0].time, '2026-10-09T00:00:00Z');
  assert.equal(out.points[0].members_present, 2);
  assert.equal(out.points[0].min_celsius, 10);
  assert.equal(out.points[0].max_celsius, 12);
  // The stale values must not appear anywhere.
  const flat = JSON.stringify(out);
  assert.ok(!flat.includes('-99'));
  assert.ok(!flat.includes('-98'));
});

test('buildEnsemble counts a source that reports a different hour as missing, not as data', () => {
  const out = buildEnsemble({
    latitude: 1, longitude: 2, hours: 1,
    requestedAtUtc: '2026-10-09T00:00:00.000Z',
    modelSeries: [
      { source: 'a', label: 'A', error: null, values: [{ time: '2026-10-09T00:00:00Z', celsius: 10 }] },
      // Reports an hour outside the window entirely.
      { source: 'b', label: 'B', error: null, values: [{ time: '2026-10-09T05:00:00Z', celsius: 20 }] },
    ],
    sourceErrors: [],
  });
  assert.equal(out.points[0].members_present, 1);
  assert.equal(out.points[0].status, 'INSUFFICIENT_EVIDENCE');
});

test('buildEnsemble states its method and forbids interpolation', () => {
  const out = buildEnsemble({
    latitude: 1, longitude: 2, hours: 1,
    requestedAtUtc: '2026-10-09T00:00:00.000Z',
    modelSeries: [{ source: 'a', label: 'A', values: [{ time: 'T', celsius: 5 }], error: null }],
    sourceErrors: [],
  });
  assert.equal(out.method.interpolation.startsWith('none'), true);
  assert.equal(out.method.confidence_basis, 'derived_from_spread');
  assert.equal(out.method.min_members_required, MIN_MEMBERS);
});

test('every response object carries the schema', () => {
  const out = buildEnsemble({
    latitude: 1, longitude: 2, hours: 1,
    requestedAtUtc: '2026-10-09T00:00:00.000Z',
    modelSeries: [],
    sourceErrors: [],
  });
  assert.equal(out.schema, 'wx-ensemble/v1');
});
