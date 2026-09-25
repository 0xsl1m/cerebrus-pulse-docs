// F008: the A2A guide said message/send takes an x402 payment and delivers the
// data as a task artifact, showed a "completed" payment-required task, priced
// six skills wrongly and linked a spec repo that 404s. The gateway's in-band
// A2A payment could never complete and is now off (gateway fix/phase0):
// message/send answers a paid skill with the HTTP endpoint and its x402 v2
// terms, and payment happens over HTTP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, siteFiles } from './lib.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('the A2A guide sends payment over HTTP, not inside A2A', () => {
  const guide = read('src/content/docs/guides/a2a-agents.mdx');
  assert.match(guide, /A2A does \*\*not\*\* take payment in-band/);
  assert.match(guide, /`input-required`/);
  assert.match(guide, /`http\.method`, `http\.url`/);
  assert.match(guide, /`PAYMENT-SIGNATURE`/);
  assert.match(guide, /<SkillPrices \/>/);
  assert.doesNotMatch(guide, /"state": "completed"/);
  assert.doesNotMatch(guide, /github\.com\/google\/a2a-spec/);
});

test('no page says A2A itself takes or settles payment', () => {
  for (const file of siteFiles('src')) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /USDC via x402 on Base or Solana \|/, file);
    assert.doesNotMatch(text, /consumes skills via JSON-RPC with x402 payment/, file);
    assert.doesNotMatch(text, />Auto-pay</, file);
    assert.doesNotMatch(text, /delivered as a structured A2A task artifact/, file);
  }
});

test('the agent card says how A2A payment works and describes the skills as the engine computes them', () => {
  const card = JSON.parse(read('public/.well-known/agent-card.json'));
  assert.match(card.extensions.x402.a2a_payment, /takes no payment/);
  const prose = card.skills.map((s) => s.description).join('\n');
  assert.doesNotMatch(prose, /MACD|1W\b|Bid-ask spread|discount/);
});
