// F012: Astro must use the same trailing-slash policy as Vercel, or every
// generated canonical, og:url, sidebar link and sitemap entry 308-redirects.
// The built output is checked in dist.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test("astro.config.mjs sets trailingSlash: 'never'", () => {
  assert.match(read('astro.config.mjs'), /^\s*trailingSlash:\s*'never',/m);
});

test('vercel.json strips trailing slashes, matching the Astro config', () => {
  assert.equal(JSON.parse(read('vercel.json')).trailingSlash, false);
});

test('the Starlight head override drops the canonical and og:url on the 404 page', () => {
  const head = read('src/components/StarlightHead.astro');
  assert.match(head, /route\.id === '404'/);
  assert.match(head, /rel === 'canonical'/);
  assert.match(head, /property === 'og:url'/);
});
