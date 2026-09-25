// F033: the bundle was sold as 9%, 17% and 20% cheaper, and as containing the
// /spread analysis. It holds the /pulse output, 24h /funding and /sentiment,
// which cost $0.045 bought separately against its $0.05. The docs now state
// that arithmetic, computed from the prices, and claim no discount.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleMath } from '../src/lib/pricing.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const prices = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'prices.json'), 'utf8'));

function withPrices(overrides) {
  return {
    ...prices,
    routes: prices.routes.map((r) => (r.endpoint in overrides ? { ...r, price: overrides[r.endpoint] } : r)),
  };
}

test('at the charged prices the bundle costs more than its parts', () => {
  const math = bundleMath(prices);
  assert.equal(math.bundle, '0.05');
  assert.equal(math.separately, '0.045');
  assert.equal(math.cheaper, false);
  assert.match(math.sentence, /costs \$0\.005 more than buying them separately/);
  assert.match(math.sentence, /\/pulse \$0\.025 \+ \/funding \$0\.01 \+ \/sentiment \$0\.01 = \$0\.045/);
  assert.match(math.sentence, /does not include the \/spread analysis/);
});

test('a real saving, and only a real one, is stated as a saving', () => {
  assert.match(bundleMath(withPrices({ bundle: '0.04' })).sentence, /costs \$0\.005 \(11\.1%\) less/);
  assert.match(bundleMath(withPrices({ bundle: '0.045' })).sentence, /costs the same as buying them separately/);
});

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

test('no page claims a bundle discount or calls the bundle the best value', () => {
  const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'public'))].filter((p) =>
    /\.(mdx|astro|json|txt|yaml)$/.test(p)
  );
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\d+% (discount|cheaper)|discount_pct|best value/i, file);
    assert.doesNotMatch(text, /bundle[^.\n]*(it's cheaper|costs less|saves money)/i, file);
  }
});
