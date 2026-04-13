/**
 * KnitWise — Calculator domain module.
 * Pure functions; no DOM, no side effects.
 */

// ── Unit helpers ──────────────────────────────────────────────────────────────

/** Convert a length value from one unit to another. */
export function convertUnit(value, from, to) {
  if (from === to) return value;
  if (from === 'cm' && to === 'in') return value / 2.54;
  if (from === 'in' && to === 'cm') return value * 2.54;
  return value;
}

/** Round a raw stitch count according to strategy. */
export function roundStitches(n, strategy = 'nearest') {
  if (strategy === 'up') return Math.ceil(n);
  if (strategy === 'down') return Math.floor(n);
  return Math.round(n);
}

// ── Cast-on ───────────────────────────────────────────────────────────────────

/**
 * Compute stitch cast-on count from gauge + target width.
 *
 * @param {object} p
 * @param {number} p.gaugeStitches   stitches measured in gauge swatch
 * @param {number} p.swatchSize      size of swatch (e.g. 10 for 10 cm, 4 for 4 in)
 * @param {string} p.swatchUnit      'cm' | 'in'
 * @param {number} p.targetWidth     desired finished width
 * @param {string} p.targetUnit      'cm' | 'in'
 * @param {number} [p.ease=0]        ease in targetUnit (positive = more room)
 * @param {string} [p.roundStrategy] 'nearest' | 'up' | 'down'
 * @returns {{ valid: boolean, stitches?: number, effectiveWidth?: number,
 *             stitchesPerUnit?: number, raw?: number, error?: string }}
 */
export function calcCastOn({
  gaugeStitches,
  swatchSize,
  swatchUnit,
  targetWidth,
  targetUnit,
  ease = 0,
  roundStrategy = 'nearest',
}) {
  if (!Number.isFinite(gaugeStitches) || gaugeStitches <= 0)
    return { valid: false, error: 'Gauge stitches must be a positive number.' };
  if (!Number.isFinite(swatchSize) || swatchSize <= 0)
    return { valid: false, error: 'Swatch size must be a positive number.' };
  if (!Number.isFinite(targetWidth) || targetWidth <= 0)
    return { valid: false, error: 'Target width must be a positive number.' };

  const swatchInTargetUnit = convertUnit(swatchSize, swatchUnit, targetUnit);
  const stitchesPerUnit = gaugeStitches / swatchInTargetUnit;
  const effectiveWidth = targetWidth + ease;
  const raw = stitchesPerUnit * effectiveWidth;
  const stitches = roundStitches(raw, roundStrategy);

  return { valid: true, stitches, effectiveWidth, stitchesPerUnit, raw };
}

/**
 * Plain-language explanation for a cast-on result.
 *
 * @param {object} inputs  same shape as calcCastOn input
 * @param {object} result  return value of calcCastOn
 * @returns {{ summary: string, detail: string, rounding: string|null }}
 */
export function explainCastOn(inputs, result) {
  if (!result.valid) return { summary: result.error, detail: '', rounding: null };

  const { gaugeStitches, swatchSize, swatchUnit, targetWidth, targetUnit, ease = 0 } = inputs;
  const u = targetUnit;
  const swatchLabel = `${gaugeStitches} sts per ${swatchSize} ${swatchUnit}`;
  const easeNote =
    ease !== 0
      ? ` with ${ease > 0 ? '+' : ''}${ease}\u202f${u} ease (${result.effectiveWidth}\u202f${u} total)`
      : '';

  const summary = `Cast on ${result.stitches} stitches.`;
  const detail =
    `Your gauge is ${swatchLabel}. ` +
    `For a ${targetWidth}\u202f${u} width${easeNote}, that's ` +
    `${result.stitchesPerUnit.toFixed(2)}\u202fsts/${u} \u00d7 ${result.effectiveWidth}\u202f${u} ` +
    `= ${result.raw.toFixed(1)} stitches.`;
  const rounding =
    result.stitches !== result.raw
      ? `${result.raw.toFixed(1)} rounded to ${result.stitches}.`
      : null;

  return { summary, detail, rounding };
}

// ── Shaping distribution ──────────────────────────────────────────────────────

/**
 * Distribute shaping events (increases or decreases) evenly across rows.
 *
 * The algorithm places wider-spaced events first, giving the most gradual
 * shaping at the beginning — the standard knitting convention.
 *
 * @param {object} p
 * @param {number} p.totalShaping            total stitches to shape (positive integer)
 * @param {number} p.overRows                rows available (positive integer)
 * @param {boolean} [p.bothSides=false]      work both sides each shaping row (×2 sts per event)
 * @param {'decrease'|'increase'} [p.direction='decrease']
 * @returns {{ valid: boolean, events?: number, baseSpacing?: number, extra?: number,
 *             schedule?: number[], direction?: string, bothSides?: boolean,
 *             totalShaping?: number, overRows?: number, error?: string }}
 */
export function calcShaping({
  totalShaping,
  overRows,
  bothSides = false,
  direction = 'decrease',
}) {
  if (!Number.isFinite(totalShaping) || totalShaping <= 0 || !Number.isInteger(totalShaping))
    return { valid: false, error: 'Total stitches must be a positive whole number.' };
  if (!Number.isFinite(overRows) || overRows <= 0 || !Number.isInteger(overRows))
    return { valid: false, error: 'Number of rows must be a positive whole number.' };

  const events = bothSides ? Math.ceil(totalShaping / 2) : totalShaping;

  if (events > overRows) {
    return {
      valid: false,
      error:
        `${events} shaping row${events !== 1 ? 's' : ''} needed but only ${overRows} ` +
        `row${overRows !== 1 ? 's' : ''} available. ` +
        `Reduce the stitch count or increase the row count.`,
    };
  }

  const baseSpacing = Math.floor(overRows / events);
  const extra = overRows % events; // these slots get spacing + 1

  const schedule = [];
  let cursor = 0;
  for (let i = 0; i < events; i++) {
    cursor += i < extra ? baseSpacing + 1 : baseSpacing;
    schedule.push(cursor);
  }

  return {
    valid: true,
    events,
    baseSpacing,
    extra,
    schedule,
    direction,
    bothSides,
    totalShaping,
    overRows,
  };
}

/**
 * Plain-language explanation for a shaping result.
 *
 * @param {object} inputs  same shape as calcShaping input
 * @param {object} result  return value of calcShaping
 * @returns {{ summary: string, detail: string, plan: number[], planNote: string|null }}
 */
export function explainShaping(inputs, result) {
  if (!result.valid) return { summary: result.error, detail: '', plan: [], planNote: null };

  const dir = result.direction === 'decrease' ? 'Decrease' : 'Increase';
  const sideNote = result.bothSides ? ' (1 st each side)' : '';

  let summary;
  if (result.extra === 0) {
    summary =
      `${dir} every ${result.baseSpacing} rows, ` +
      `${result.events} time${result.events !== 1 ? 's' : ''}${sideNote}.`;
  } else {
    const parts = [];
    if (result.extra > 0) {
      const n = result.extra;
      parts.push(`every ${result.baseSpacing + 1} rows ${n} time${n !== 1 ? 's' : ''}`);
    }
    const remaining = result.events - result.extra;
    if (remaining > 0) {
      parts.push(`every ${result.baseSpacing} rows ${remaining} time${remaining !== 1 ? 's' : ''}`);
    }
    summary = `${dir} ${parts.join(', then ')}${sideNote}.`;
  }

  const detail =
    `${result.totalShaping} stitches ${result.direction}d over ${result.overRows} rows ` +
    `= ${result.events} shaping event${result.events !== 1 ? 's' : ''}` +
    (result.bothSides ? ', each working both sides simultaneously' : '') +
    `.`;

  const maxShow = 16;
  const plan = result.schedule.slice(0, maxShow);
  const planNote =
    result.schedule.length > maxShow
      ? `Showing first ${maxShow} of ${result.schedule.length} shaping rows.`
      : null;

  return { summary, detail, plan, planNote };
}
