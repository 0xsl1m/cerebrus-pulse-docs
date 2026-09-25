// F010: prices were typed by hand into about fifteen places, and 9 of the 12 on
// the overview disagreed with what the gateway charges. They now come from
// src/data/prices.json, which scripts/sync-gateway.mjs generates from the
// gateway's payment routes (X402_ROUTES) and SKILL_MAP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPrices,
  expectedFiles,
  gatewayDir,
  parseRoutes,
  withGeneratedCardFields,
} from '../scripts/sync-gateway.mjs';
import { endpointRows, priceRange, skillRows, sumPrices } from '../src/lib/pricing.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURE = fileURLToPath(new URL('./fixtures/gateway/', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const prices = JSON.parse(read('src/data/prices.json'));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ── The generator ─────────────────────────────────────────────────────────

test('routes are priced from the config, else from the route fallback', () => {
  const fixture = buildPrices(FIXTURE);
  assert.equal(fixture.api_version, '9.9.9');
  assert.deepEqual(
    fixture.routes.map((r) => [r.route, r.path, r.endpoint, r.price]),
    [
      ['GET /pulse/:coin', '/pulse/{coin}', 'pulse', '0.025'],
      ['GET /cex-dex/:token', '/cex-dex/{token}', 'cex-dex', '0.015'],
      ['GET /arb', '/arb', 'arb', '0.02'],
    ]
  );
  assert.deepEqual(
    fixture.skills.map((s) => [s.id, s.path, s.needs_coin, s.price]),
    [
      ['confluence-analysis', '/pulse/{coin}', true, '0.025'],
      ['market-stress', '/arb', false, '0.02'],
    ]
  );
});

test('a route the parser cannot read fails loudly instead of disappearing', () => {
  const server = readFileSync(join(FIXTURE, 'service', 'server.py'), 'utf8').replace(
    'accepts=make_option(prices.get("arb", "0.015")),',
    'accepts=make_option(price_for("arb")),'
  );
  assert.throws(() => parseRoutes(server, {}), /parsed 2 of 3 routes/);
});

test('src/data/prices.json has every paid route, priced', () => {
  assert.equal(prices.routes.length, 13);
  assert.equal(new Set(prices.routes.map((r) => r.endpoint)).size, 13);
  for (const r of prices.routes) assert.match(r.price, /^\d+\.\d+$/, r.path);
  for (const s of prices.skills) {
    assert.equal(s.price, prices.routes.find((r) => r.endpoint === s.endpoint).price, s.id);
  }
  assert.equal(endpointRows(prices).length, 13);
  assert.equal(skillRows(prices).length, prices.skills.length);
  assert.deepEqual(priceRange(prices), { min: '0.01', max: '0.06' });
  assert.equal(sumPrices('0.025', '0.01', '0.01'), '0.045');
});

test('the generated files match the gateway source', {
  skip: existsSync(join(gatewayDir(), 'service', 'server.py')) ? false : 'no gateway checkout',
}, () => {
  for (const [path, content] of Object.entries(expectedFiles())) {
    assert.equal(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'), content, `${path} is stale: npm run sync:gateway`);
  }
});

// ── Where prices are shown ────────────────────────────────────────────────

const ENDPOINT_IN_ROW = /`(?:GET )?\/([a-z-]+)(?:\/\{[a-z]+\})?`/g;
const SKILL_IN_ROW = new RegExp('`(' + prices.skills.map((s) => s.id).join('|') + ')`', 'g');
const PRICE_IN_ROW = /\$(\d+\.\d+)/g;

test('every price in a docs table row is the price the gateway charges', () => {
  const pages = walk(join(ROOT, 'src', 'content', 'docs')).filter((p) => p.endsWith('.mdx'));
  let checked = 0;
  for (const page of pages) {
    for (const line of readFileSync(page, 'utf8').split(/\r?\n/)) {
      if (!line.startsWith('|')) continue;
      const found = [...line.matchAll(PRICE_IN_ROW)].map((m) => m[1]);
      if (!found.length) continue;
      const skills = [...line.matchAll(SKILL_IN_ROW)].map((m) => m[1]);
      const endpoints = [...line.matchAll(ENDPOINT_IN_ROW)].map((m) => m[1]);
      const route = skills.length
        ? prices.skills.find((s) => s.id === skills[0])
        : prices.routes.find((r) => r.endpoint === endpoints[0]);
      if (!route) continue;
      assert.equal(found[0], route.price, `${page}: ${line}`);
      checked++;
    }
  }
  assert.ok(checked >= 13, `only ${checked} priced rows found`);
});

test('the landing page takes every x402 price from the data file', () => {
  for (const file of [
    'src/components/PricingTable.astro',
    'src/components/Hero.astro',
    'src/components/HowItWorks.astro',
    'src/components/StructuredData.astro',
    'src/pages/index.astro',
  ]) {
    const text = read(file);
    assert.doesNotMatch(text, /\$0\.0\d+/, `${file} types an x402 price`);
    assert.doesNotMatch(text, /"price":\s*"0\.0\d+"/, `${file} types an x402 price`);
  }
});

test('the A2A agent card is priced from the payment routes, and agent.json is the same card', () => {
  const card = JSON.parse(read('public/.well-known/agent-card.json'));
  assert.deepEqual(JSON.parse(read('public/.well-known/agent.json')), card);
  assert.deepEqual(withGeneratedCardFields(card, prices), card);
  assert.equal(card.version, prices.api_version);
  assert.deepEqual(
    card.skills.map((s) => s.id).sort(),
    prices.skills.map((s) => s.id).sort()
  );
});

test('ai-plugin.json quotes the charged price for every endpoint it names', () => {
  const plugin = JSON.parse(read('public/.well-known/ai-plugin.json'));
  const quoted = [...plugin.description_for_model.matchAll(/GET \/([a-z-]+)[^ ]* \(\$(\d+\.\d+)\)/g)];
  assert.equal(quoted.length, 13);
  for (const [, endpoint, price] of quoted) {
    assert.equal(price, prices.routes.find((r) => r.endpoint === endpoint).price, endpoint);
  }
});
