// F006 (free endpoints): /health and /coins were documented with fields the
// gateway does not return (timestamp_iso) and without the ones it does
// (payments, ledger, feeds, ...).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gatewayDir, parseCoins, readGatewayFile } from '../scripts/sync-gateway.mjs';
import { ROOT } from './lib.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const fieldsOf = (mdx) => [...mdx.matchAll(/^\| `([a-z0-9_]+)` \|/gm)].map((m) => m[1]);
const haveGateway = existsSync(join(gatewayDir(), 'service', 'server.py'));

test('the /coins example lists exactly the engine allowlist', () => {
  const coins = JSON.parse(read('src/data/coins.json'));
  const page = read('src/content/docs/api/coins.mdx');
  const example = page.match(/"coins": \[([\s\S]*?)\]/)[1];
  assert.deepEqual([...example.matchAll(/"([A-Z0-9]+)"/g)].map((m) => m[1]), coins.coins);
  assert.match(page, new RegExp(`"count": ${coins.count}`));
  assert.deepEqual(fieldsOf(page), ['coins', 'count', 'meta']);
});

test('the coin parser reads the registry', () => {
  const parsed = parseCoins(
    'COIN_ALLOWLIST = frozenset([\n    "SOL", "BTC",\n    "PEPE",\n])\nHL_NAME_MAP = {\n    "PEPE": "kPEPE",\n}\n'
  );
  assert.deepEqual(parsed.coins, ['BTC', 'PEPE', 'SOL']);
  assert.deepEqual(parsed.hyperliquid_names, { PEPE: 'kPEPE' });
});

test('/health documents every field the gateway returns', { skip: haveGateway ? false : 'no gateway checkout' }, () => {
  const server = readGatewayFile(gatewayDir(), 'service/server.py');
  const body = server.match(/@app\.get\("\/health"\)\nasync def health\(\):\n([\s\S]*?)\n\n\n/)[1];
  const returned = [...body.slice(body.indexOf('return {')).matchAll(/^\s+"(\w+)":/gm)].map((m) => m[1]);
  assert.ok(returned.length >= 10, 'could not read the /health response');
  assert.deepEqual(fieldsOf(read('src/content/docs/api/health.mdx')), returned);
});
