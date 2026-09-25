// F048 / F039: the lockfile must carry the non-breaking security fixes.
// vite GHSA-fx2h-pf6j-xcff affects <=6.4.2 and is first patched in 6.4.3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

function cmp(a, b) {
  const pa = a.split(/[.-]/).slice(0, 3).map(Number);
  const pb = b.split(/[.-]/).slice(0, 3).map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function lockedVersions(name) {
  const suffix = 'node_modules/' + name;
  return Object.entries(lock.packages)
    .filter(([path]) => path === suffix || path.endsWith('/' + suffix))
    .map(([path, meta]) => [path, meta.version]);
}

const floors = {
  vite: '6.4.3',
  astro: '5.18.2',
  postcss: '8.5.28',
  '@astrojs/sitemap': '3.7.4',
};

for (const [name, floor] of Object.entries(floors)) {
  test(`every locked ${name} is >= ${floor}`, () => {
    const found = lockedVersions(name);
    assert.ok(found.length > 0, `${name} is not in package-lock.json`);
    for (const [path, version] of found) {
      assert.ok(cmp(version, floor) >= 0, `${path} is ${version}, below ${floor}`);
    }
  });
}
