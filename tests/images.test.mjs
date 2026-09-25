// F050: 3.4 MB of PNG key art shown at 16-22% opacity, and a 373 KB
// 553x558 logo rendered at 32-170 px on the landing and on every docs page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const KB = 1024;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Every "/images/<file>" string in the site source.
function referencedImages() {
  const refs = new Set();
  for (const file of walk(join(ROOT, 'src'))) {
    if (!/\.(astro|mdx?|css|js|ts)$/.test(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/\/images\/([\w.-]+\.(?:png|jpe?g|webp|avif|svg|gif))/g)) {
      refs.add(m[1]);
    }
  }
  return refs;
}

test('every referenced /images file exists', () => {
  const refs = referencedImages();
  assert.ok(refs.size >= 6, `only ${refs.size} image references found`);
  for (const name of refs) {
    assert.ok(existsSync(join(ROOT, 'public', 'images', name)), `public/images/${name} is missing`);
  }
});

test('page images stay within a per-file budget', () => {
  for (const name of referencedImages()) {
    const size = statSync(join(ROOT, 'public', 'images', name)).size;
    assert.ok(size <= 160 * KB, `${name} is ${Math.round(size / KB)} KB`);
  }
});

test('the section key art ships as WebP, not multi-megabyte PNG', () => {
  const refs = referencedImages();
  for (const art of ['neural-field', 'market-cortex', 'pulse-band']) {
    assert.ok(refs.has(`${art}.webp`), `${art}.webp is not referenced`);
    assert.ok(!refs.has(`${art}.png`), `${art}.png is still referenced`);
    assert.ok(!existsSync(join(ROOT, 'public', 'images', `${art}.png`)), `${art}.png still deploys`);
  }
});

test('landing logos use resized WebP with explicit dimensions', () => {
  const files = ['src/layouts/Landing.astro', 'src/components/Hero.astro', 'src/components/Footer.astro'];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    assert.doesNotMatch(src, /\/images\/pulse-logo\.png/, `${f} still uses the 373 KB logo`);
    for (const tag of src.match(/<img[^>]*pulse-logo[^>]*>/g) || []) {
      assert.match(tag, /width="\d+"/, `${f}: ${tag}`);
      assert.match(tag, /height="\d+"/, `${f}: ${tag}`);
    }
  }
});

test('the Starlight logo points at a small asset', () => {
  const config = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8');
  const m = config.match(/logo:\s*\{\s*src:\s*'([^']+)'/);
  assert.ok(m, 'logo.src not found in astro.config.mjs');
  const size = statSync(join(ROOT, m[1])).size;
  assert.ok(size <= 16 * KB, `${m[1]} is ${Math.round(size / KB)} KB`);
});

test('unreferenced X/Twitter art is not deployed', () => {
  for (const name of ['x-banner.png', 'x-profile.png', 'x-profile.svg']) {
    assert.ok(!existsSync(join(ROOT, 'public', 'images', name)), `public/images/${name} still deploys`);
  }
});
