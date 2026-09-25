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

test('Brain3D.astro imports three.js lazily and only behind the gate', () => {
  const src = readFileSync(new URL('../src/components/Brain3D.astro', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /^\s*import \* as THREE from 'three';/m, 'eager value import is back');
  assert.match(src, /^\s*import type \* as THREE from 'three';/m);
  assert.match(src, /const THREE = await import\('three'\);/);
  assert.match(src, /shouldLoadBrain3D\(\{/);
  assert.match(src, /requestIdleCallback/);
  assert.match(src, /powerPreference: 'default'/);
  assert.doesNotMatch(src, /^\s*initBrain3D\(\);$/m, 'unconditional start is back');
});
