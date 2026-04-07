/**
 * KnitWise pattern text quality — DOM-based HTML stripping (no regex tag removal).
 * Used by app.html and Vitest (jsdom provides DOMParser).
 */

/** @returns {boolean} */
export function looksLikeHtml(raw) {
  const s = String(raw || '');
  return /<[a-z!?/]/i.test(s) || (/<[^>]+>/.test(s) && /[<>]/.test(s));
}

/**
 * Convert HTML (full document or fragment) to plain text using the browser DOM.
 * @param {string} html
 * @returns {string}
 */
export function htmlToPlainText(html) {
  const s = String(html || '');
  if (!s.trim()) return '';
  const wrapped = looksLikeHtml(s) ? s : `<div>${escapeForTextParse(s)}</div>`;
  const doc = new DOMParser().parseFromString(wrapped, 'text/html');
  const body = doc.body;
  if (!body) return collapseWhitespace(s);
  const err = body.querySelector('parsererror');
  if (err) {
    const tmp = document.createElement('div');
    tmp.textContent = s;
    return collapseWhitespace(tmp.textContent || '');
  }
  return collapseWhitespace(body.textContent || '');
}

function escapeForTextParse(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function stripMarkdownBold(s) {
  return String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1');
}

/** Remove paired single-asterisk emphasis (*word*) when it looks like markdown, not row markers. */
export function stripSingleAsteriskEmphasis(s) {
  return String(s || '').replace(/\*([^*\n]{1,40})\*/g, '$1');
}

/**
 * True if the raw model string still needs a targeted cleanup pass (before/after polish).
 */
export function rawInstructionNeedsRepair(text) {
  const t = String(text || '');
  if (!t) return false;
  if (/\*\*/.test(t)) return true;
  if (/">/.test(t) || /'>\s*/.test(t)) return true;
  if (hasHtmlArtifacts(t)) return true;
  return false;
}

export function collapseWhitespace(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Collapse consecutive duplicate words (copy-paste / parsing artifacts).
 */
export function dedupeConsecutiveTokens(text) {
  const parts = String(text || '').split(/(\s+)/);
  const out = [];
  let lastNorm = null;
  for (const p of parts) {
    if (/^\s+$/.test(p)) {
      out.push(p);
      continue;
    }
    const norm = p.toLowerCase().replace(/[^a-z0-9]/gi, '');
    if (norm && norm === lastNorm) continue;
    lastNorm = norm || lastNorm;
    out.push(p);
  }
  return collapseWhitespace(out.join(''));
}

/**
 * Collapse repeated two-word runs (e.g. "stitch marker stitch marker stitch marker" → "stitch marker").
 */
export function dedupeConsecutiveBigrams(text) {
  let s = String(text || '');
  if (!s.trim()) return s;
  for (let n = 0; n < 24; n++) {
    const next = s.replace(/\b(\S+\s+\S+)\s+\1\b/gi, '$1');
    if (next === s) break;
    s = next;
  }
  return collapseWhitespace(s);
}

/** Non-negotiable HTML / markup artifacts — step must not be shown if still present after cleaning. */
export function hasHtmlArtifacts(text) {
  const t = String(text || '');
  if (!t) return false;
  if (/["\u201C\u201D]>/.test(t)) return true;
  if (/<\//.test(t) || /\/>/.test(t)) return true;
  if (/&lt;|&gt;|&amp;|&#\d+;|&#x[0-9a-f]+;/i.test(t)) return true;
  if (/<[a-z!?/]/i.test(t)) return true;
  return false;
}

export function maxConsecutiveSameWord(text) {
  const words = String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean);
  let max = 1;
  let cur = 1;
  let last = null;
  for (const w of words) {
    if (w === last) {
      cur++;
      max = Math.max(max, cur);
    } else {
      last = w;
      cur = 1;
    }
  }
  return max;
}

export function maxWordFrequency(text) {
  const words = String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ''))
    .filter(Boolean);
  const m = new Map();
  let max = 0;
  for (const w of words) {
    const n = (m.get(w) || 0) + 1;
    m.set(w, n);
    max = Math.max(max, n);
  }
  return max;
}

/**
 * Normalize pasted / fetched pattern text before sending to the model.
 */
export function normalizeInputForParsing(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (looksLikeHtml(s)) return htmlToPlainText(s);
  return s;
}

/**
 * Instruction cleanup: DOM-based HTML extraction when tags exist; never regex-strip tags.
 */
export function sanitizeInstructionText(text) {
  if (!text) return '';
  let s = String(text);
  if (looksLikeHtml(s)) {
    s = htmlToPlainText(s);
  }
  do {
    var prevS = s;
    s = stripMarkdownBold(s);
  } while (s !== prevS);
  s = stripSingleAsteriskEmphasis(s);
  // Normalize curly/smart quotes to straight BEFORE artifact stripping so all
  // passes below match regardless of whether the LLM used " or \u201C/\u201D.
  s = s
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  // Strip PDF hyperlink artifact chains.
  // Pass 1 — bracket format: term">[term]">[nested term">[inner]] (] is a natural stop)
  //   e.g.  knit">[knit]">[knit]                       → knit
  //         cast on">[Cast on]">[long-tail co">[co]     → cast on
  s = String(s)
    .replace(/(?:">\[[^\]]*\])+/g, '')
    .replace(/(?:'>\[[^\]]*\])+/g, '');
  // Pass 2 — exact A">A collapse: remove ">\1 when the same phrase appears on both sides.
  //   Handles 1-5 word phrases of letters/hyphens only (no digits). Runs in a loop because
  //   one pass may expose a new duplicate (e.g. A">A">B">A → A">B">A after pass 1 → A">A).
  //   Works for any phrase length, so 3-word terms like "holding yarn double">holding yarn double"
  //   are collapsed without relying on bigram deduplication.
  for (let _p2 = 0; _p2 < 12; _p2++) {
    const _before = s;
    s = s.replace(/\b([a-zA-Z][a-zA-Z-]*(?:\s+[a-zA-Z][a-zA-Z-]*){0,4})">\1/gi, '$1');
    s = s.replace(/\b([a-zA-Z][a-zA-Z-]*(?:\s+[a-zA-Z][a-zA-Z-]*){0,4})'>\1/gi, '$1');
    if (s === _before) break;
  }
  // Pass 3 — chain interior (non-exact): strip ">TERM when another "> follows immediately.
  //   Letters/spaces/hyphens only so digits stop the match and protect sentence content.
  //   e.g.  co">long-tail co">co  →  co">co  (then pass 4 + dedup handles the final item)
  s = s
    .replace(/(?:">[a-zA-Z][a-zA-Z\s-]{0,35}(?=">))+/g, '')
    .replace(/(?:'>[a-zA-Z][a-zA-Z\s-]{0,35}(?='>))+/g, '');
  // Pass 4 — strip any remaining single "> / '> artifact (final chain item or isolated)
  s = s.replace(/">\s*/g, ' ').replace(/'>\s*/g, ' ');
  s = collapseWhitespace(s);
  s = dedupeConsecutiveTokens(s);
  s = dedupeConsecutiveBigrams(s);
  s = s
    .replace(/([.,;:!?])\1+/g, '$1')
    .replace(/^\s*(And|But|Or)\s+/i, '');
  s = collapseWhitespace(s);
  if (!s) return '';
  s = s.replace(/^([a-z])/, (m) => m.toUpperCase());
  if (!/[.!?]$/.test(s)) s = s.replace(/\s*$/, '') + '.';
  return s;
}

export function validateInstructionPlainText(text, options = {}) {
  const minLen = options.minLen ?? 10;
  const maxRepeat = options.maxWordRepeat ?? 10;
  const maxConsec = options.maxConsecutiveSameWord ?? 2;
  const reasons = [];
  if (!text || String(text).trim().length < minLen) {
    reasons.push(`instruction_too_short (min ${minLen})`);
  }
  if (hasHtmlArtifacts(text)) {
    reasons.push('html_artifacts');
  }
  if (maxWordFrequency(text) > maxRepeat) {
    reasons.push(`word_repeated_more_than_${maxRepeat}_times`);
  }
  if (maxConsecutiveSameWord(text) > maxConsec) {
    reasons.push(`consecutive_word_repeat_gt_${maxConsec}`);
  }
  return { ok: reasons.length === 0, reasons };
}

function minLenForStep(step) {
  const t = step && step.type;
  if (t === 'repeat' || t === 'length') return 5;
  return 10;
}

/**
 * @param {Array<{ id?: number, instruction?: string, type?: string, [k: string]: unknown }>} steps
 * @returns {{ steps: typeof steps, log: object }}
 */
export function filterAndValidateSteps(steps, options = {}) {
  const log = {
    patternId: options.patternId || null,
    passed: 0,
    rejected: [],
    warnings: [],
    polish: options.polishLog || null,
    repair: options.repairLog || null,
  };
  if (!Array.isArray(steps)) {
    log.warnings.push('steps_not_array');
    return { steps: [], log };
  }
  const out = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const raw = step.instruction || '';
    const cleaned = sanitizeInstructionText(raw);
    const v = validateInstructionPlainText(cleaned, {
      ...options,
      minLen: minLenForStep(step),
    });
    if (!v.ok) {
      log.rejected.push({
        index: i,
        id: step.id,
        label: step.label,
        reasons: v.reasons,
        preview: cleaned.slice(0, 120),
      });
      continue;
    }
    log.passed++;
    out.push({ ...step, instruction: cleaned });
  }
  if (typeof console !== 'undefined' && console.info) {
    console.info('[KnitWise parse]', JSON.stringify(log));
  }
  return { steps: out, log };
}
