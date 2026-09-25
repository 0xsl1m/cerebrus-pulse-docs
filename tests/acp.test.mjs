// F009: the ACP guide used an SDK API that does not exist (new AcpClient({
// walletKey }), createJob, waitForJob), said payment is in VIRTUAL (ACP fares
// are USDC on Base), and sold "1/3/5+ model synthesis" that the v2 provider
// delivers as plain engine JSON. ACP prices also differed from page to page.
// The offerings now come from the provider's own definitions (src/data/acp.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAcp } from '../scripts/sync-gateway.mjs';
import { acpRange, acpTableMarkdown } from '../src/lib/acp.mjs';
import { ROOT, siteFiles } from './lib.mjs';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('offerings are read from the provider: endpoint, timeframes, USDC budget', () => {
  const acp = parseAcp(read('tests/fixtures/gateway/acp-v2/provider_loop.py'));
  assert.deepEqual(acp.offerings, [
    { name: 'cerebrus_lite', service_key: 'cerebrus_lite', endpoint: 'pulse', timeframes: ['1h', '4h'], budget_usdc: '0.25' },
    { name: 'cerebrus_premium', service_key: 'cerebrus_premium', endpoint: 'bundle', timeframes: ['15m', '1d'], budget_usdc: '2.50' },
  ]);
  assert.equal(acp.currency, 'USDC');
  assert.deepEqual(acpRange(acp), { min: '0.25', max: '2.50' });
  assert.match(acpTableMarkdown(acp), /\| `cerebrus_lite` \| the \/pulse output \(1h, 4h\) \| \$0\.25 \|/);
});

test('the ACP guide uses the real SDK, says USDC, and says ACP is paused', () => {
  const guide = read('src/content/docs/guides/acp-agents.mdx');
  assert.match(guide, /AcpContractClientV2\.build\(/);
  assert.match(guide, /browseAgents\(/);
  assert.match(guide, /initiateJob\(/);
  assert.match(guide, /payAndAcceptRequirement\(\)/);
  assert.match(guide, /USDC on Base/);
  assert.match(guide, /:::caution\[Paused\]/);
  assert.match(guide, /<AcpOfferings \/>/);
  assert.doesNotMatch(guide, /walletKey|createJob|waitForJob|models_requested/);
});

test('no page sells multi-model synthesis or prices ACP in VIRTUAL', () => {
  for (const file of siteFiles('src', 'public/.well-known')) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\bVIRTUAL\b/, `${file}: ACP fares are USDC`);
    assert.doesNotMatch(text, /\b[135]\+? models?\b|multi-model|adversarial deliberation|AI-synthesized/i, file);
    assert.doesNotMatch(text, /acp\.discover\(/, file);
  }
});

test('the landing takes ACP prices from the data file', () => {
  for (const file of ['src/components/PricingTable.astro', 'src/components/HowItWorks.astro', 'src/components/StructuredData.astro']) {
    assert.doesNotMatch(read(file), /\$(0\.10|0\.25|0\.50|0\.75|2\.00|2\.50)\b|"(0\.25|0\.75|2\.50)"/, file);
  }
});
