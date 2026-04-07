import { describe, it, expect } from 'vitest';
import {
  htmlToPlainText,
  hasHtmlArtifacts,
  maxConsecutiveSameWord,
  normalizeInputForParsing,
  sanitizeInstructionText,
  filterAndValidateSteps,
  rawInstructionNeedsRepair,
} from '../public/lib/pattern-parse.mjs';

describe('htmlToPlainText (DOM)', () => {
  it('extracts anchor text without leaving \">\" fragments (Purl-style glossary link)', () => {
    const html =
      '<p>Mark the row with <a href="/glossary/#stitch-marker">stitch marker</a> or yarn.</p>';
    const t = htmlToPlainText(html);
    expect(t).not.toMatch(/">/);
    expect(t).not.toMatch(/<\//);
    expect(t.toLowerCase()).toContain('stitch marker');
  });
});

describe('normalizeInputForParsing', () => {
  it('strips HTML from pasted page content before model sees it', () => {
    const pasted = `<div class="pattern"><a href="/glossary/#stitch-marker">stitch marker</a></div>`;
    const out = normalizeInputForParsing(pasted);
    expect(out).not.toMatch(/">/);
    expect(out.toLowerCase()).toContain('stitch marker');
  });
});

describe('Banner Scarf–style garbage', () => {
  it('sanitizes broken anchor artifacts and passes validation', () => {
    const bad =
      'Mark the previous row with a stitch marker">stitch marker">removable stitch marker">stitch marker or yarn.';
    const cleaned = sanitizeInstructionText(bad);
    expect(cleaned).not.toMatch(/">/);
    expect(hasHtmlArtifacts(cleaned)).toBe(false);
  });

  it('filterAndValidateSteps: no step may contain \">\" after pipeline', () => {
    const steps = [
      {
        id: 1,
        type: 'normal',
        section: 'Setup',
        instruction:
          'Mark with stitch marker">stitch marker">stitch marker">removable stitch marker or scrap yarn.',
      },
    ];
    const { steps: out } = filterAndValidateSteps(steps);
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      expect(s.instruction).not.toMatch(/">/);
    }
  });

  it('no word repeats more than twice consecutively after sanitize', () => {
    const s = sanitizeInstructionText(
      'Place a stitch marker stitch marker stitch marker at the edge.'
    );
    expect(maxConsecutiveSameWord(s)).toBeLessThanOrEqual(2);
  });

  it('sanitizes ">[term] bracket-style PDF hyperlink artifacts', () => {
    const bad =
      'Cast on 236 stitches using the long-tail cast on">[long-tail cast on]">[cast on] method.';
    const cleaned = sanitizeInstructionText(bad);
    expect(cleaned).not.toMatch(/">/);
    expect(cleaned).not.toMatch(/\[/);
    expect(hasHtmlArtifacts(cleaned)).toBe(false);
  });

  it('sanitizes chained ">[term] artifacts (knit">[knit] style)', () => {
    const bad =
      'Set-Up Row (right side">[right side]): knit">[knit] to the last 2 stitches, knit">[knit]">[knit] front and back.';
    const cleaned = sanitizeInstructionText(bad);
    expect(cleaned).not.toMatch(/">/);
    expect(cleaned).not.toMatch(/\[/);
    expect(hasHtmlArtifacts(cleaned)).toBe(false);
    expect(cleaned.toLowerCase()).toContain('right side');
    expect(cleaned.toLowerCase()).toContain('knit');
  });

  it('sanitizes nested ">[long phrase">[short phrase] greedy artifacts', () => {
    const bad =
      'Mark with a stitch marker">[stitch marker]">[removable stitch marker">[stitch marker] or yarn.';
    const cleaned = sanitizeInstructionText(bad);
    expect(cleaned).not.toMatch(/">/);
    expect(cleaned).not.toMatch(/\[/);
    expect(hasHtmlArtifacts(cleaned)).toBe(false);
    expect(cleaned.toLowerCase()).toContain('stitch marker');
  });

  it('sanitizes no-bracket chained artifacts: A">B">C">D keeps only A', () => {
    // This is the format seen in the Banner Scarf mobile screenshot
    const bad =
      'Mark the previous row with a stitch marker">stitch marker">removable stitch marker">stitch marker">stitch marker">stitch marker">removable stitch marker">stitch marker or piece of scrap yarn.';
    const cleaned = sanitizeInstructionText(bad);
    expect(cleaned).not.toMatch(/">/);
    expect(hasHtmlArtifacts(cleaned)).toBe(false);
    // Should not have excessive repetition
    expect(maxConsecutiveSameWord(cleaned)).toBeLessThanOrEqual(2);
    expect(cleaned.toLowerCase()).toContain('stitch marker');
    expect(cleaned.toLowerCase()).toContain('scrap yarn');
  });

  it('sanitizes curly-quote variants \u201C>[term] (LLM sometimes uses smart quotes)', () => {
    const bad =
      'Cast on 7 stitches\u201D>[stitches] using the long-tail cast on\u201C>[long-tail cast on\u201C>[cast on] method.';
    const cleaned = sanitizeInstructionText(bad);
    expect(cleaned).not.toMatch(/["\u201C\u201D]>/);
    expect(cleaned).not.toMatch(/\[/);
    expect(hasHtmlArtifacts(cleaned)).toBe(false);
  });

  it('removes markdown **bold** and does not leave ** in output', () => {
    const s = sanitizeInstructionText('Knit the next **stitch** with care.');
    expect(s).not.toContain('**');
    expect(s.toLowerCase()).toContain('stitch');
  });

  it('rawInstructionNeedsRepair detects ** and broken anchor junk', () => {
    expect(rawInstructionNeedsRepair('plain knit row.')).toBe(false);
    expect(rawInstructionNeedsRepair('use **yarn** here')).toBe(true);
    expect(rawInstructionNeedsRepair('marker">stitch')).toBe(true);
  });
});
