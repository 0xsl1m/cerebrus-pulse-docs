// F049: the three.js brain was a 527 KB bundle imported eagerly on every
// landing view, including by reduced-motion visitors who only ever saw one
// static frame of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMinWidth, shouldLoadBrain3D } from '../src/scripts/brain3d-gate.js';

const base = { reducedMotion: false, saveData: false, viewportWidth: 1366, minWidth: 0 };

test('loads by default on every viewport width', () => {
  assert.equal(shouldLoadBrain3D(base), true);
  assert.equal(shouldLoadBrain3D({ ...base, viewportWidth: 390 }), true);
});

test('skips for reduced-motion and save-data visitors', () => {
  assert.equal(shouldLoadBrain3D({ ...base, reducedMotion: true }), false);
  assert.equal(shouldLoadBrain3D({ ...base, saveData: true }), false);
});

test('honours an optional minimum viewport width', () => {
  assert.equal(shouldLoadBrain3D({ ...base, viewportWidth: 767, minWidth: 768 }), false);
  assert.equal(shouldLoadBrain3D({ ...base, viewportWidth: 768, minWidth: 768 }), true);
  assert.equal(shouldLoadBrain3D({ ...base, viewportWidth: NaN, minWidth: 768 }), false);
});

test('PUBLIC_BRAIN3D_MIN_WIDTH parsing: unset or invalid means no minimum', () => {
  assert.equal(parseMinWidth(undefined), 0);
  assert.equal(parseMinWidth(''), 0);
  assert.equal(parseMinWidth('abc'), 0);
  assert.equal(parseMinWidth('-5'), 0);
  assert.equal(parseMinWidth('768'), 768);
});

test('Brain3D.astro loads the scene (and three.js) lazily, only behind the gate', () => {
  const src = readFileSync(new URL('../src/components/Brain3D.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from 'three'/, 'the component must not import three.js itself');
  assert.doesNotMatch(src, /brain3d-scene['"];?\s*$/m, 'the scene module must not be imported statically');
  assert.match(src, /import\('\.\.\/scripts\/brain3d-scene'\)/);
  assert.match(src, /shouldLoadBrain3D\(\{/);
  assert.match(src, /requestIdleCallback/);
  assert.doesNotMatch(src, /^\s*initBrain3D\(\);$/m, 'unconditional start is back');
});

test('the scene module keeps a static namespace import so three.js stays tree-shaken', () => {
  // `const THREE = await import('three')` keeps the whole namespace
  // (725 KB instead of 527 KB); a static import inside the lazily loaded
  // module lets the bundler drop unused three.js code as before.
  const scene = readFileSync(new URL('../src/scripts/brain3d-scene.ts', import.meta.url), 'utf8');
  assert.match(scene, /^import \* as THREE from 'three';$/m);
  assert.doesNotMatch(scene, /import\('three'\)/);
  assert.match(scene, /^export function initBrain3D\(\) \{$/m);
  assert.match(scene, /powerPreference: 'default'/);
  assert.match(scene, /setPixelRatio\(Math\.min\(window\.devicePixelRatio, 1\.5\)\)/);
});
