// Checks on the built site. They run only after `npm run build`; without a
// dist/ folder every test here is skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const SITE = 'https://cerebruspulse.xyz';
const skip = existsSync(DIST) ? false : 'dist/ not built';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const htmlFiles = () => walk(DIST).filter((p) => p.endsWith('.html'));
const read = (p) => readFileSync(p, 'utf8');
const rel = (p) => p.slice(DIST.length).replace(/\\/g, '/');

function attr(html, re) {
  const m = html.match(re);
  return m ? m[1] : undefined;
}
const canonicalOf = (html) => attr(html, /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/);
const ogUrlOf = (html) => attr(html, /<meta[^>]*property="og:url"[^>]*content="([^"]*)"/);

// ── F012: trailing slashes ────────────────────────────────────────────────

test('F012: docs canonical and og:url have no trailing slash', { skip }, () => {
  const html = read(join(DIST, 'overview', 'index.html'));
  assert.equal(canonicalOf(html), SITE + '/overview');
  assert.equal(ogUrlOf(html), SITE + '/overview');
});

test('F012: no page declares a slash-suffixed canonical', { skip }, () => {
  for (const file of htmlFiles()) {
    const c = canonicalOf(read(file));
    if (c === undefined || c === SITE || c === SITE + '/') continue;
    assert.ok(!c.endsWith('/'), `${rel(file)} canonical ${c}`);
  }
});

test('F012: the 404 page declares no canonical or og:url', { skip }, () => {
  const html = read(join(DIST, '404.html'));
  assert.equal(canonicalOf(html), undefined);
  assert.equal(ogUrlOf(html), undefined);
});

test('F012: sitemap URLs have no trailing slash and omit /404', { skip }, () => {
  const xml = read(join(DIST, 'sitemap-0.xml'));
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 20, `only ${locs.length} sitemap URLs`);
  for (const loc of locs) {
    if (loc === SITE || loc === SITE + '/') continue;
    assert.ok(!loc.endsWith('/'), loc);
    assert.ok(!loc.includes('/404'), loc);
  }
});

test('F012: internal page links have no trailing slash', { skip }, () => {
  for (const file of htmlFiles()) {
    for (const m of read(file).matchAll(/href="(\/[^"#?]*)"/g)) {
      const href = m[1];
      if (href === '/') continue;
      assert.ok(!href.endsWith('/'), `${rel(file)} links to ${href}`);
    }
  }
});
