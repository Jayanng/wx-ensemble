'use strict';

/**
 * wx-ensemble aggregation engine.
 *
 * HONESTY CONTRACT
 * ----------------
 * This engine computes a DESCRIPTIVE multi-model spread. It is not a calibrated
 * probabilistic forecast and must not be described as one. What it reports:
 *
 *   - every member value, with its source and its missing-ness made explicit
 *   - min, max, median, mean, sample standard deviation, interquartile range
 *   - agreement_ratio: how tightly the members cluster
 *   - a confidence label that is DERIVED from the spread, and is labelled as derived
 *
 * What it never does:
 *   - interpolate a missing member value
 *   - fill a gap with a neighbouring hour
 *   - coerce null to zero
 *   - report a band when fewer than MIN_MEMBERS produced data
 *
 * A single model cannot express uncertainty. If we only have one reading, the
 * honest answer is that uncertainty is unquantified, and that is what we return.
 */

const MIN_MEMBERS = 2;

const { normaliseSeries, toUtcHourBucket, HOUR_MS } = require('./time');

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function median(sorted) {
  const n = sorted.length;
  if (n === 0) return null;
  const mid = n >> 1;
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function quantile(sorted, q) {
  const n = sorted.length;
  if (n === 0) return null;
  if (n === 1) return sorted[0];
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function round(v, dp) {
  if (v === null || v === undefined) return null;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

/**
 * Aggregate the members available at ONE time point.
 * `entries` is [{ source, value }] where value may be null.
 */
function aggregatePoint(entries) {
  const present = [];
  const missing = [];

  for (const e of entries) {
    if (isNum(e.value)) {
      present.push({ source: e.source, value: e.value });
    } else {
      // A missing reading is reported, never silently dropped or filled.
      missing.push({ source: e.source, reason: e.missingReason || 'upstream returned no numeric value' });
    }
  }

  const values = present.map((p) => p.value).sort((a, b) => a - b);
  const n = values.length;

  const base = {
    members_present: n,
    members_missing: missing.length,
    values: present.map((p) => ({ source: p.source, celsius: round(p.value, 2) })),
    missing: missing,
  };

  if (n === 0) {
    return {
      ...base,
      status: 'UNAVAILABLE',
      reason: 'No upstream model produced a numeric value for this time point.',
      min_celsius: null,
      max_celsius: null,
      median_celsius: null,
      mean_celsius: null,
      stddev_celsius: null,
      iqr_celsius: null,
      spread_celsius: null,
      agreement_ratio: null,
      confidence: 'unquantified',
      confidence_basis: 'derived_from_spread',
    };
  }

  if (n < MIN_MEMBERS) {
    // No band is reported. The single reading is still published, but only in
    // `values[]` where it is named and sourced. Every BAND statistic is null,
    // because a band requires more than one member to exist at all. Reporting
    // min, max, median and mean here would manufacture a one-element "band"
    // that reads as perfect agreement, and reporting spread 0 would claim the
    // models agree when only one of them spoke.
    return {
      ...base,
      status: 'INSUFFICIENT_EVIDENCE',
      reason: `Only ${n} of ${entries.length} upstream models returned a value. A single model cannot express uncertainty, so no band is reported. The reading that exists is listed in values[].`,
      min_celsius: null,
      max_celsius: null,
      median_celsius: null,
      mean_celsius: null,
      stddev_celsius: null,
      iqr_celsius: null,
      spread_celsius: null,
      agreement_ratio: null,
      confidence: 'unquantified',
      confidence_basis: 'derived_from_spread',
    };
  }

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1
    ? values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1)
    : 0;
  const stddev = Math.sqrt(variance);
  const med = median(values);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const spread = values[n - 1] - values[0];

  // Agreement: fraction of members inside one standard deviation of the median.
  //
  // This metric is DEGENERATE below three members and must not be published
  // there. For n = 2 the distance from each point to the median is always
  // 0.5 * delta, while the sample standard deviation is delta / sqrt(2), about
  // 0.707 * delta. Since 0.5 <= 0.707, both points always fall inside, so
  // agreement_ratio is 1.0 for ANY two values, even 0 C and 100 C. Publishing
  // that would claim total agreement between models that are wildly split.
  //
  // With n = 3 or more the fraction becomes discriminating.
  let agreement;
  if (n < 3) {
    agreement = null;
  } else if (stddev === 0) {
    agreement = 1;
  } else {
    const inside = values.filter((v) => Math.abs(v - med) <= stddev).length;
    agreement = inside / n;
  }

  // Confidence is a LABEL derived from the observed spread. It is not a
  // probability and is labelled as derived everywhere it appears.
  let confidence;
  if (spread <= 1.0) confidence = 'high';
  else if (spread <= 2.5) confidence = 'moderate';
  else if (spread <= 5.0) confidence = 'low';
  else confidence = 'very_low';

  return {
    ...base,
    status: 'OBSERVED',
    reason: null,
    min_celsius: round(values[0], 2),
    max_celsius: round(values[n - 1], 2),
    median_celsius: round(med, 2),
    mean_celsius: round(mean, 2),
    stddev_celsius: round(stddev, 2),
    iqr_celsius: round(q3 - q1, 2),
    spread_celsius: round(spread, 2),
    agreement_ratio: round(agreement, 3),
    confidence,
    confidence_basis: 'derived_from_spread',
  };
}

/**
 * Build the full response object.
 *
 * `modelSeries` is a flat list of { source, label, values: [{time, celsius}] }.
 */
function buildEnsemble({ latitude, longitude, hours, requestedAtUtc, modelSeries, sourceErrors }) {
  // Upstreams emit timestamps in different formats and precisions. Normalise
  // every reading to the UTC hour bucket BEFORE alignment, or the same hour
  // from two sources is treated as two different time points and the ensemble
  // silently degenerates into single-member refusals. See src/time.js.
  const normalised = [];
  const unplaceable = [];
  for (const series of modelSeries) {
    const r = normaliseSeries(series.values);
    for (const u of r.unplaceable) {
      unplaceable.push({ source: series.source, original_time: u.original });
    }
    normalised.push({ ...series, values: r.values });
  }

  // Align on the window the caller asked for: `hours` whole hours starting at
  // the current UTC hour. Sources return different windows (Open-Meteo starts
  // at midnight of the forecast day, Met.no starts at "now"), so slicing the
  // first N entries of each array produces disjoint sets that never combine.
  // The window is derived from the clock, and every source is filtered to it.
  const windowStart = toUtcHourBucket(requestedAtUtc);
  const windowKeys = [];
  if (windowStart !== null) {
    const startMs = Date.parse(windowStart);
    for (let i = 0; i < hours; i += 1) {
      windowKeys.push(new Date(startMs + i * HOUR_MS).toISOString().replace('.000Z', 'Z'));
    }
  }
  const windowSet = new Set(windowKeys);

  for (const series of normalised) {
    series.values = (series.values || []).filter((v) => windowSet.has(v.time));
  }

  // Align on the union of timestamps, in order of first appearance.
  const timeIndex = windowKeys.length
    ? windowKeys
    : (() => {
        const idx = [];
        const seen = new Set();
        for (const series of normalised) {
          for (const v of series.values || []) {
            if (!seen.has(v.time)) {
              seen.add(v.time);
              idx.push(v.time);
            }
          }
        }
        idx.sort();
        return idx;
      })();

  const points = timeIndex.map((time) => {
    const entries = normalised.map((s) => {
      const hit = (s.values || []).find((v) => v.time === time);
      // Distinguish an outage from a gap. A source that failed entirely should
      // not read as "did not report this time point", which suggests a normal
      // hole in an otherwise healthy series.
      let missingReason;
      if (hit) {
        missingReason = hit.celsius === null ? 'source returned a null for this time' : null;
      } else if (s.error) {
        missingReason = `source failed: ${s.error}`;
      } else {
        missingReason = 'source did not report this time point';
      }
      return {
        source: s.source,
        value: hit ? hit.celsius : null,
        missingReason,
      };
    });
    return { time, ...aggregatePoint(entries) };
  });

  const usable = points.filter((p) => p.status === 'OBSERVED');
  // agreement_ratio is null for points with fewer than three members, so it can
  // only be averaged over the points that actually have one. Summing a null
  // would coerce it to zero and drag the mean down for a reason that never
  // happened.
  const withAgreement = usable.filter((p) => typeof p.agreement_ratio === 'number');
  const overall = usable.length
    ? {
        mean_of_medians_celsius: round(
          usable.reduce((a, p) => a + p.median_celsius, 0) / usable.length, 2),
        widest_spread_celsius: round(Math.max(...usable.map((p) => p.spread_celsius)), 2),
        narrowest_spread_celsius: round(Math.min(...usable.map((p) => p.spread_celsius)), 2),
        mean_agreement_ratio: withAgreement.length
          ? round(withAgreement.reduce((a, p) => a + p.agreement_ratio, 0) / withAgreement.length, 3)
          : null,
        agreement_sample_size: withAgreement.length,
        points_with_band: usable.length,
        points_refused: points.length - usable.length,
      }
    : {
        mean_of_medians_celsius: null,
        widest_spread_celsius: null,
        narrowest_spread_celsius: null,
        mean_agreement_ratio: null,
        agreement_sample_size: 0,
        points_with_band: 0,
        points_refused: points.length,
      };

  return {
    schema: 'wx-ensemble/v1',
    generated_at_utc: requestedAtUtc,
    location: { latitude, longitude },
    horizon_hours: hours,
    method: {
      description:
        'Descriptive multi-model ensemble spread. Every member value is reported ' +
        'alongside its source. The band is the observed disagreement between independent ' +
        'national forecasting centres, not a calibrated probability.',
      min_members_required: MIN_MEMBERS,
      interpolation: 'none. A missing member value is reported as missing and excluded from statistics.',
      confidence_basis: 'derived_from_spread',
      deterministic_aggregation: true,
    },
    // Reported against the WINDOW the caller asked for, not against every
    // slice the upstream happens to have sent. The field is named for what it
    // counts: forecast time points, not "members", which would suggest
    // ensemble members at a single moment.
    sources: normalised.map((s) => ({
      source: s.source,
      label: s.label,
      forecast_points_in_window: (s.values || []).filter((v) => isNum(v.celsius)).length,
      error: s.error || null,
    })),
    source_errors: sourceErrors || [],
    // Readings whose timestamp could not be parsed. They are reported, never
    // silently placed at a convenient time.
    unplaceable_readings: unplaceable,
    summary: overall,
    points,
  };
}

module.exports = {
  MIN_MEMBERS,
  aggregatePoint,
  buildEnsemble,
  median,
  quantile,
};
