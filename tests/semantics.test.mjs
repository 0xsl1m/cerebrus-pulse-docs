// F002, F034, F035: beyond the field tables (tests/schemas.test.mjs), the
// guides and the landing page described the data wrongly: funding as 8-hourly,
// open interest in USD, the confluence score as a confidence, the regime in
// upper case, correlation as "30-day rolling", staleness as ">2 hours". These
// phrasings must not come back anywhere a reader or an LLM would take them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, WRONG, siteFiles } from './lib.mjs';

test('no page repeats a known misdescription of the data', () => {
  for (const file of siteFiles('src')) {
    const text = readFileSync(file, 'utf8');
    for (const [pattern, why] of WRONG) assert.doesNotMatch(text, pattern, `${file}: ${why}`);
  }
});

test('the quickstart and the landing terminal show real engine output', () => {
  const quickstart = readFileSync(join(ROOT, 'src/content/docs/quickstart.mdx'), 'utf8');
  assert.match(quickstart, /<ResponseExample endpoint="pulse" \/>/);
  const hero = readFileSync(join(ROOT, 'src/components/Hero.astro'), 'utf8');
  assert.match(hero, /examples\.examples\.pulse/);
  assert.doesNotMatch(hero, /98765\.43/);
});
