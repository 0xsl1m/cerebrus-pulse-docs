// F080: the payments guide told Base payers to hold ETH for gas. In the x402
// exact scheme the payer signs an EIP-3009 authorization (Base) or a
// transaction the facilitator pays the fee for (Solana); the facilitator
// submits it. The payer needs USDC only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

test('no page tells a payer to hold ETH or SOL for gas', () => {
  const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'public'))].filter((p) =>
    /\.(mdx|astro|json|txt|yaml)$/.test(p)
  );
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /ETH (on Base )?(for|—|-) ?gas|for gas fees|ETH per tx|USDC and ETH/i, file);
  }
});

test('the payments guide says the payer needs USDC only', () => {
  const guide = readFileSync(join(ROOT, 'src/content/docs/guides/x402-payments.mdx'), 'utf8');
  assert.match(guide, /\*\*Payer gas\*\* \| None/);
  assert.match(guide, /nothing else: no ETH and no SOL/);
  assert.match(guide, /no card or account-based way to pay/);
});
