// Turns the website's engine output into the check_name tool result: a compact
// structured object plus a short text summary an assistant can quote.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('./engine.cjs');

export const LANGUAGES = engine.LANGS.map((l) => ({ code: l.code, name: l.name }));
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const LEXICON_SIZE = engine.LEXICON.length;
export const SITE = 'https://earshot.quentin.software';
export const NOTICE =
  'Automated flags from a rule-based lexicon and written sound rules, not native-speaker judgments. '
  + 'A flag can be a false positive, and slang the lexicon lacks is missed. Not trademark clearance or legal advice.';

const BAND_LABEL = { green: 'clear', amber: 'review', red: 'at risk' };

export function validateName(raw) {
  const name = typeof raw === 'string' ? raw.normalize('NFC').trim().replace(/\s+/g, ' ') : '';
  if (!name || name.length > 40) return { error: 'The name must be 1 to 40 characters.' };
  if (/[\u0000-\u001f\u007f]/.test(name)) return { error: 'The name contains control characters.' };
  if (!/[\p{L}\p{N}]/u.test(name)) return { error: 'The name needs at least one letter or digit.' };
  return { name };
}

// languages: optional list of codes to report on; the verdict and fit index always cover all 25.
export function checkName(rawName, languages) {
  const v = validateName(rawName);
  if (v.error) throw new Error(v.error);
  const wanted = languages?.length ? new Set(languages) : null;
  if (wanted) {
    const bad = [...wanted].filter((c) => !LANGUAGE_CODES.includes(c));
    if (bad.length) throw new Error('Unknown language code(s): ' + bad.join(', ') + '. Supported: ' + LANGUAGE_CODES.join(', ') + '.');
  }
  const a = engine.analyze(v.name);
  const langs = a.langs
    .filter((l) => !wanted || wanted.has(l.code))
    .map((l) => ({
      code: l.code,
      language: l.name,
      fit: l.score,
      band: BAND_LABEL[l.band],
      pronounceability: l.ease,
      flags: l.hits.map((h) => ({
        severity: h.sev,
        word: h.display, // strong words are masked, as on the website
        masked: h.masked,
        category: h.catLabel,
        meaning: h.mean,
        match: engine.TYPE_LABEL[h.type],
        ...(h.spoken ? { spokenAs: h.spoken } : {}),
        ...(h.note ? { note: h.note } : {}),
      })),
      pronunciationNotes: l.issues.map((i) => i.text),
      ...(l.reads ? { likelyHeardAs: l.reads } : {}),
    }));
  const flagged = langs.filter((l) => l.flags.length);
  return {
    name: a.name,
    verdict: a.verdict,
    fitIndex: a.idx,
    summary: a.reason,
    languagesChecked: LANGUAGES.length,
    languagesReported: langs.length,
    highestRisk: a.free.slice(0, 3).map((c) => LANGUAGES.find((l) => l.code === c).name),
    flaggedLanguages: flagged.map((l) => l.language),
    languages: langs,
    myths: a.myths.map((m) => ({ title: m.title, grade: m.grade, claim: m.claim, evidence: m.evidence, take: m.take })),
    scripts: a.scripts.map((s) => ({ script: s.label, code: s.code, text: s.text, direction: s.dir, note: s.note })),
    method: NOTICE,
    source: SITE,
  };
}

export function summarize(r) {
  const lines = [`${r.name}: ${r.verdict} (fit index ${r.fitIndex}/100, ${r.languagesChecked} languages screened).`, r.summary];
  const flagged = r.languages.filter((l) => l.flags.length);
  if (flagged.length) {
    lines.push('', 'Automated flags:');
    for (const l of flagged) {
      for (const f of l.flags) {
        lines.push(`- ${l.language} [${f.severity}] ${f.match} "${f.word}"${f.spokenAs ? ' (' + f.spokenAs + ')' : ''}: ${f.meaning}`);
      }
    }
  } else {
    const scope = r.languagesReported === r.languagesChecked ? 'any of the 25 languages' : 'the requested languages';
    lines.push('', `No automated flags in ${scope} (lexicon of ${LEXICON_SIZE} entries).`);
  }
  const hard = r.languages.filter((l) => l.pronounceability < 70).map((l) => `${l.language} ${l.pronounceability}`);
  if (hard.length) lines.push(`Hard to pronounce (score under 70): ${hard.join(', ')}.`);
  for (const m of r.myths) lines.push(`Myth check (${m.grade}): ${m.title}. ${m.take}`);
  lines.push('', r.method, `Interactive check: ${r.source}`);
  return lines.join('\n');
}
