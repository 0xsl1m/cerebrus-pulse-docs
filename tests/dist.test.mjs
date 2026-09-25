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

// ── F046: GSAP is bundled, not loaded from a CDN ──────────────────────────

test('F046: the landing page loads no third-party script', { skip }, () => {
  const html = read(join(DIST, 'index.html'));
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net/);
  assert.doesNotMatch(html, /<script[^>]*src="https?:/);
  assert.match(html, /<noscript><style>\[data-reveal\]/);
});

test('F046: GSAP ScrollTrigger ships in a same-origin bundle', { skip }, () => {
  const js = walk(join(DIST, '_astro')).filter((p) => p.endsWith('.js'));
  assert.ok(js.some((p) => /ScrollTrigger/.test(read(p))), 'no bundle contains ScrollTrigger');
});

// ── F049: three.js is a lazy chunk ────────────────────────────────────────

test('F049: the landing page does not load three.js up front', { skip }, () => {
  const html = read(join(DIST, 'index.html'));
  const eager = [...html.matchAll(/<(?:script|link)[^>]*(?:src|href)="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]);
  assert.ok(eager.length > 0, 'no module scripts found on the landing page');
  // Follow static imports too: a chunk pulled in by `import ... from` is
  // just as eager as the entry script itself.
  const seen = new Set();
  const queue = eager.map((src) => join(DIST, src));
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const js = read(file);
    assert.doesNotMatch(js, /THREE\.WebGLRenderer/, `${rel(file)} loads three.js eagerly`);
    for (const m of js.matchAll(/\b(?:import|export)\s*(?!\()(?:[^"';()]*?from\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g)) {
      queue.push(join(file, '..', m[1]));
    }
  }
  const lazy = walk(join(DIST, '_astro')).filter(
    (p) => p.endsWith('.js') && /THREE\.WebGLRenderer/.test(read(p))
  );
  assert.equal(lazy.length, 1, 'expected exactly one lazy three.js chunk');
});
