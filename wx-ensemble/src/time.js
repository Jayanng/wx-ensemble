'use strict';

/**
 * Timestamp normalisation.
 *
 * Upstreams disagree on format:
 *   Open-Meteo  -> "2026-10-09T00:00"       (hour precision, no zone suffix)
 *   Met.no      -> "2026-10-09T16:00:00Z"   (second precision, UTC)
 *   NOAA / NWS  -> "2026-10-09T16:00:00-04:00" (offset local time)
 *
 * Aligning on the raw string would treat the same hour from two sources as two
 * different time points, which silently destroys the ensemble. Every timestamp
 * is normalised to the UTC hour bucket in full ISO 8601 before alignment.
 *
 * If a timestamp cannot be parsed, it is returned as null and the caller must
 * treat that reading as unplaceable, NOT place it at some convenient time.
 */

const HOUR_MS = 60 * 60 * 1000;

/**
 * Normalise any upstream timestamp to the UTC hour bucket: "YYYY-MM-DDTHH:00:00Z".
 * Returns null when the input cannot be parsed. Never guesses.
 */
function toUtcHourBucket(iso) {
  if (typeof iso !== 'string' || !iso.trim()) return null;

  let raw = iso.trim();
  // A bare "YYYY-MM-DDTHH:MM" or "YYYY-MM-DDTHH:MM:SS" has no zone. The
  // upstream request pins timezone=UTC, so this is UTC. Mark it explicitly
  // rather than assuming the host timezone.
  //
  // Both precisions must be handled. Date.parse on a bare second-precision
  // string is specified to parse as HOST LOCAL time, so on a UTC+8 box
  // "2026-10-09T16:00:00" would silently land eight hours away and split the
  // ensemble. Only a trailing Z makes it unambiguous.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    raw = raw.length === 16 ? `${raw}:00Z` : `${raw}Z`;
  }

  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;

  // Bucket down to the hour in UTC.
  const bucket = Math.floor(t / HOUR_MS) * HOUR_MS;
  return new Date(bucket).toISOString().replace('.000Z', 'Z');
}

/**
 * Normalise a series of { time, ... } readings in place-safe fashion.
 * Readings whose time cannot be parsed are DROPPED from the series and
 * reported separately, because a reading we cannot place is a reading we
 * must not use.
 */
function normaliseSeries(values) {
  const out = [];
  const unplaceable = [];
  for (const v of values || []) {
    const bucket = toUtcHourBucket(v.time);
    if (bucket === null) {
      unplaceable.push({ original: v.time, value: v.celsius ?? null });
      continue;
    }
    out.push({ ...v, time: bucket, sourceTime: v.time });
  }
  return { values: out, unplaceable };
}

module.exports = { toUtcHourBucket, normaliseSeries, HOUR_MS };
