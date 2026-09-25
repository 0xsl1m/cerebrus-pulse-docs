// F036 (founder decision D8): the landing page showed performance figures no
// one has measured ("<200ms Avg Response", "p95 under 500ms", "99.9% Uptime",
// "Monitored 24/7"), a "Most Popular" tier on a product with no sales, and
// "battle-tested" / "institutional-grade" / "enterprise-grade" copy. The
// coverage tiles now show counts read from src/data. Kept in its own commit so
// it can be dropped if the founder decides otherwise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, siteFiles } from './lib.mjs';

test('no page claims an unmeasured metric or unearned popularity', () => {
  for (const file of siteFiles('src', 'public')) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(
      text,
      /&lt;200ms|<200ms|~200–500ms|p95 under|99\.9%|Monitored 24\/7|Most Popular|battle-tested|institutional-grade|enterprise-grade|sub-second responses/i,
      file
    );
  }
});

test('the coverage tiles count from the data files', () => {
  const metrics = readFileSync(join(ROOT, 'src/components/Metrics.astro'), 'utf8');
  assert.match(metrics, /data-countup=\{coins\.count\}/);
  assert.match(metrics, /data-countup=\{prices\.routes\.length\}/);
  assert.doesNotMatch(metrics, /data-countup="(200|99\.9|15|50)"/);
});
