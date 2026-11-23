import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkName, summarize, validateName, LANGUAGE_CODES, NOTICE } from '../src/check.mjs';

test('covers the same 25 languages as the website', () => {
  assert.equal(LANGUAGE_CODES.length, 25);
  assert.deepEqual(LANGUAGE_CODES.slice(0, 3), ['en', 'de', 'nl']);
});

test('Pajero is Rename with a red Spanish flag, masked', () => {
  const r = checkName('Pajero');
  assert.equal(r.verdict, 'Rename');
  const es = r.languages.find((l) => l.code === 'es');
  const f = es.flags.find((x) => x.severity === 'red');
  assert.ok(f, 'red Spanish flag');
  assert.equal(f.masked, true);
  assert.equal(f.word, 'p****o');
  const words = r.languages.flatMap((l) => l.flags.filter((x) => x.masked).map((x) => x.word));
  assert.ok(words.every((w) => w.includes('*')), 'masked flags never carry the plain word');
});

test('MR2 is caught when spelled aloud in French', () => {
  const r = checkName('MR2');
  const fr = r.languages.find((l) => l.code === 'fr');
  assert.equal(fr.flags[0].match, 'spelled aloud');
  assert.match(fr.flags[0].spokenAs, /deux/);
});

test('Nova is Clear and carries the myth note', () => {
  const r = checkName('Nova');
  assert.equal(r.verdict, 'Clear');
  assert.equal(r.flaggedLanguages.length, 0);
  assert.equal(r.myths[0].grade, 'Myth');
});

test('languages filter limits the per-language section, not the verdict', () => {
  const all = checkName('Fitta');
  const some = checkName('Fitta', ['sv', 'ja']);
  assert.equal(some.verdict, all.verdict);
  assert.equal(some.fitIndex, all.fitIndex);
  assert.deepEqual(some.languages.map((l) => l.code), ['sv', 'ja']);
  assert.equal(some.languagesReported, 2);
});

test('rejects bad input', () => {
  assert.ok(validateName('').error);
  assert.ok(validateName('x'.repeat(41)).error);
  assert.ok(validateName('---').error);
  assert.throws(() => checkName('Brio', ['xx']), /Unknown language/);
});

test('every result and summary says the flags are automated, not native-speaker judgments', () => {
  const r = checkName('Sparkbite');
  assert.equal(r.method, NOTICE);
  assert.match(NOTICE, /not native-speaker judgments/);
  assert.match(summarize(r), /not native-speaker judgments/);
});
