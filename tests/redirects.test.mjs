// F038: every /demo response linked https://cerebruspulse.xyz/subscribe for
// "free signal alerts", and that page was a 404. The gateway now points
// people at GitHub Discussions and no longer promises alerts; responses
// already cached or copied still carry the old link, so the site redirects it
// to the same place. Temporary (307): a real page may replace it later.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const DISCUSSIONS = 'https://github.com/0xsl1m/cerebrus-pulse-mcp/discussions';

test('/subscribe redirects to GitHub Discussions, temporarily', () => {
  const rule = (vercel.redirects || []).find((r) => r.source === '/subscribe');
  assert.ok(rule, 'no redirect for /subscribe');
  assert.equal(rule.destination, DISCUSSIONS);
  assert.equal(rule.permanent, false);
});

test('no page of the site shadows the redirect', () => {
  for (const page of ['src/pages/subscribe.astro', 'src/pages/subscribe.md', 'src/content/docs/subscribe.mdx']) {
    assert.ok(!existsSync(fileURLToPath(new URL(`../${page}`, import.meta.url))), page);
  }
});
