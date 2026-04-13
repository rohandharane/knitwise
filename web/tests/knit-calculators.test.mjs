import { describe, it, expect } from 'vitest';
import {
  convertUnit,
  roundStitches,
  calcCastOn,
  explainCastOn,
  calcShaping,
  explainShaping,
} from '../public/lib/knit-calculators.mjs';

// ── convertUnit ───────────────────────────────────────────────────────────────

describe('convertUnit', () => {
  it('cm to in', () => expect(convertUnit(10, 'cm', 'in')).toBeCloseTo(3.937, 2));
  it('in to cm', () => expect(convertUnit(4, 'in', 'cm')).toBeCloseTo(10.16, 2));
  it('same unit passthrough', () => expect(convertUnit(5, 'cm', 'cm')).toBe(5));
});

// ── roundStitches ─────────────────────────────────────────────────────────────

describe('roundStitches', () => {
  it('nearest: rounds 0.5 up', () => expect(roundStitches(10.5)).toBe(11));
  it('nearest: rounds 0.4 down', () => expect(roundStitches(10.4)).toBe(10));
  it('up: always ceilings', () => expect(roundStitches(10.1, 'up')).toBe(11));
  it('down: always floors', () => expect(roundStitches(10.9, 'down')).toBe(10));
  it('exact integer unchanged', () => expect(roundStitches(12, 'nearest')).toBe(12));
});

// ── calcCastOn ────────────────────────────────────────────────────────────────

describe('calcCastOn', () => {
  it('exact division', () => {
    const r = calcCastOn({ gaugeStitches: 20, swatchSize: 10, swatchUnit: 'cm', targetWidth: 50, targetUnit: 'cm' });
    expect(r.valid).toBe(true);
    expect(r.stitches).toBe(100);
  });

  it('rounds to nearest by default', () => {
    // 21 sts / 10 cm * 10 cm = 21 exactly
    const r = calcCastOn({ gaugeStitches: 21, swatchSize: 10, swatchUnit: 'cm', targetWidth: 10, targetUnit: 'cm' });
    expect(r.stitches).toBe(21);
  });

  it('with positive ease', () => {
    const r = calcCastOn({ gaugeStitches: 22, swatchSize: 10, swatchUnit: 'cm', targetWidth: 40, targetUnit: 'cm', ease: 2 });
    expect(r.valid).toBe(true);
    expect(r.effectiveWidth).toBe(42);
    expect(r.stitches).toBe(Math.round(22 / 10 * 42));
  });

  it('with negative ease', () => {
    const r = calcCastOn({ gaugeStitches: 20, swatchSize: 10, swatchUnit: 'cm', targetWidth: 40, targetUnit: 'cm', ease: -2 });
    expect(r.valid).toBe(true);
    expect(r.effectiveWidth).toBe(38);
    expect(r.stitches).toBe(76);
  });

  it('cross-unit: inch gauge, cm target', () => {
    // 20 sts / 4in → target 40cm
    const r = calcCastOn({ gaugeStitches: 20, swatchSize: 4, swatchUnit: 'in', targetWidth: 40, targetUnit: 'cm' });
    expect(r.valid).toBe(true);
    expect(r.stitches).toBeGreaterThan(0);
    // 4in ≈ 10.16cm → ~19.7 sts/10cm → ~78.7 sts → 79
    expect(r.stitches).toBe(79);
  });

  it('round up strategy', () => {
    const r = calcCastOn({ gaugeStitches: 21, swatchSize: 10, swatchUnit: 'cm', targetWidth: 15, targetUnit: 'cm', roundStrategy: 'up' });
    expect(r.stitches).toBe(Math.ceil(r.raw));
  });

  it('round down strategy', () => {
    const r = calcCastOn({ gaugeStitches: 21, swatchSize: 10, swatchUnit: 'cm', targetWidth: 15, targetUnit: 'cm', roundStrategy: 'down' });
    expect(r.stitches).toBe(Math.floor(r.raw));
  });

  it('invalid: zero gauge stitches', () => {
    const r = calcCastOn({ gaugeStitches: 0, swatchSize: 10, swatchUnit: 'cm', targetWidth: 40, targetUnit: 'cm' });
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('invalid: negative target width', () => {
    const r = calcCastOn({ gaugeStitches: 20, swatchSize: 10, swatchUnit: 'cm', targetWidth: -5, targetUnit: 'cm' });
    expect(r.valid).toBe(false);
  });

  it('invalid: NaN gauge', () => {
    const r = calcCastOn({ gaugeStitches: NaN, swatchSize: 10, swatchUnit: 'cm', targetWidth: 40, targetUnit: 'cm' });
    expect(r.valid).toBe(false);
  });
});

// ── explainCastOn ─────────────────────────────────────────────────────────────

describe('explainCastOn', () => {
  it('summary contains stitch count', () => {
    const inputs = { gaugeStitches: 22, swatchSize: 10, swatchUnit: 'cm', targetWidth: 40, targetUnit: 'cm', ease: 0 };
    const result = calcCastOn(inputs);
    const exp = explainCastOn(inputs, result);
    expect(exp.summary).toContain(String(result.stitches));
  });

  it('detail mentions ease when non-zero', () => {
    const inputs = { gaugeStitches: 22, swatchSize: 10, swatchUnit: 'cm', targetWidth: 40, targetUnit: 'cm', ease: 4 };
    const result = calcCastOn(inputs);
    const exp = explainCastOn(inputs, result);
    expect(exp.detail).toMatch(/ease/i);
  });

  it('no rounding note when result is exact', () => {
    const inputs = { gaugeStitches: 20, swatchSize: 10, swatchUnit: 'cm', targetWidth: 10, targetUnit: 'cm', ease: 0 };
    const result = calcCastOn(inputs);
    const exp = explainCastOn(inputs, result);
    expect(result.raw).toBe(20);
    expect(exp.rounding).toBeNull();
  });

  it('returns error as summary on invalid result', () => {
    const inputs = { gaugeStitches: 0, swatchSize: 10, swatchUnit: 'cm', targetWidth: 40, targetUnit: 'cm' };
    const result = calcCastOn(inputs);
    const exp = explainCastOn(inputs, result);
    expect(exp.summary).toBeTruthy();
    expect(exp.detail).toBe('');
  });
});

// ── calcShaping ───────────────────────────────────────────────────────────────

describe('calcShaping', () => {
  it('even distribution', () => {
    const r = calcShaping({ totalShaping: 12, overRows: 60, bothSides: false });
    expect(r.valid).toBe(true);
    expect(r.events).toBe(12);
    expect(r.baseSpacing).toBe(5);
    expect(r.extra).toBe(0);
    expect(r.schedule).toHaveLength(12);
    expect(r.schedule[11]).toBe(60);
  });

  it('schedule sums correctly for even case', () => {
    const r = calcShaping({ totalShaping: 6, overRows: 18 });
    expect(r.valid).toBe(true);
    expect(r.schedule[0]).toBe(3);
    expect(r.schedule[5]).toBe(18);
  });

  it('uneven distribution', () => {
    const r = calcShaping({ totalShaping: 12, overRows: 62, bothSides: false });
    expect(r.valid).toBe(true);
    expect(r.baseSpacing).toBe(5);
    expect(r.extra).toBe(2); // 2 events at spacing 6, 10 at spacing 5
    expect(r.schedule[11]).toBe(62);
  });

  it('uneven: schedule ends at overRows', () => {
    const r = calcShaping({ totalShaping: 7, overRows: 30, bothSides: false });
    expect(r.valid).toBe(true);
    expect(r.schedule[r.events - 1]).toBe(30);
  });

  it('both sides halves event count', () => {
    const r = calcShaping({ totalShaping: 24, overRows: 60, bothSides: true });
    expect(r.valid).toBe(true);
    expect(r.events).toBe(12);
  });

  it('odd totalShaping with both sides rounds events up', () => {
    const r = calcShaping({ totalShaping: 25, overRows: 60, bothSides: true });
    expect(r.valid).toBe(true);
    expect(r.events).toBe(13);
  });

  it('increase direction is preserved', () => {
    const r = calcShaping({ totalShaping: 8, overRows: 24, direction: 'increase' });
    expect(r.valid).toBe(true);
    expect(r.direction).toBe('increase');
  });

  it('default direction is decrease', () => {
    const r = calcShaping({ totalShaping: 6, overRows: 18 });
    expect(r.direction).toBe('decrease');
  });

  it('invalid: not enough rows', () => {
    const r = calcShaping({ totalShaping: 30, overRows: 10 });
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('invalid: non-integer totalShaping', () => {
    const r = calcShaping({ totalShaping: 12.5, overRows: 60 });
    expect(r.valid).toBe(false);
  });

  it('invalid: non-integer overRows', () => {
    const r = calcShaping({ totalShaping: 12, overRows: 60.5 });
    expect(r.valid).toBe(false);
  });

  it('invalid: zero totalShaping', () => {
    const r = calcShaping({ totalShaping: 0, overRows: 20 });
    expect(r.valid).toBe(false);
  });

  it('single event: schedule is [overRows]', () => {
    const r = calcShaping({ totalShaping: 1, overRows: 10 });
    expect(r.valid).toBe(true);
    expect(r.schedule).toEqual([10]);
  });

  it('events == overRows: decrease every row', () => {
    const r = calcShaping({ totalShaping: 5, overRows: 5 });
    expect(r.valid).toBe(true);
    expect(r.baseSpacing).toBe(1);
    expect(r.extra).toBe(0);
    expect(r.schedule).toEqual([1, 2, 3, 4, 5]);
  });
});

// ── explainShaping ────────────────────────────────────────────────────────────

describe('explainShaping', () => {
  it('even: summary says "every N rows, M times"', () => {
    const r = calcShaping({ totalShaping: 6, overRows: 18 });
    const exp = explainShaping({}, r);
    expect(exp.summary).toMatch(/every 3 rows, 6 times/i);
  });

  it('uneven: summary has two intervals', () => {
    const r = calcShaping({ totalShaping: 12, overRows: 62 });
    const exp = explainShaping({}, r);
    expect(exp.summary).toMatch(/every 6 rows/i);
    expect(exp.summary).toMatch(/every 5 rows/i);
  });

  it('increase direction in summary', () => {
    const r = calcShaping({ totalShaping: 4, overRows: 12, direction: 'increase' });
    const exp = explainShaping({}, r);
    expect(exp.summary).toMatch(/Increase/);
  });

  it('both sides noted in summary', () => {
    const r = calcShaping({ totalShaping: 12, overRows: 30, bothSides: true });
    const exp = explainShaping({}, r);
    expect(exp.summary).toMatch(/each side/i);
  });

  it('plan is non-empty for valid result', () => {
    const r = calcShaping({ totalShaping: 6, overRows: 18 });
    const exp = explainShaping({}, r);
    expect(exp.plan.length).toBeGreaterThan(0);
  });

  it('plan capped at 16 rows', () => {
    const r = calcShaping({ totalShaping: 30, overRows: 90 });
    const exp = explainShaping({}, r);
    expect(exp.plan.length).toBe(16);
    expect(exp.planNote).toBeTruthy();
  });

  it('no planNote when schedule <= 16', () => {
    const r = calcShaping({ totalShaping: 10, overRows: 30 });
    const exp = explainShaping({}, r);
    expect(exp.planNote).toBeNull();
  });

  it('error summary on invalid result', () => {
    const r = calcShaping({ totalShaping: 30, overRows: 10 });
    const exp = explainShaping({}, r);
    expect(exp.summary).toBeTruthy();
    expect(exp.plan).toEqual([]);
  });
});
