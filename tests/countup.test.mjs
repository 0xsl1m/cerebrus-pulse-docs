// F043: the homepage count-ups rendered "-1249.8% Uptime" in headless
// renderers, because progress was measured from performance.now() and never
// clamped at 0 while rAF handed back an earlier timestamp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUNTUP_MS, countupProgress, easeOutQuart } from '../src/scripts/countup.js';

test('progress is clamped to [0, 1]', () => {
  assert.equal(countupProgress(-1214.5, 0), 0); // frame stamped before t0
  assert.equal(countupProgress(0, 0), 0);
  assert.equal(countupProgress(COUNTUP_MS / 2, 0), 0.5);
  assert.equal(countupProgress(COUNTUP_MS, 0), 1);
  assert.equal(countupProgress(COUNTUP_MS * 5, 0), 1);
  assert.equal(countupProgress(NaN, 0), 0);
  assert.equal(countupProgress(10, 0, 0), 1);
});

test('easing maps [0, 1] onto [0, 1] and ends exactly on the target', () => {
  assert.equal(easeOutQuart(0), 0);
  assert.equal(easeOutQuart(1), 1);
  assert.equal(99.9 * easeOutQuart(1), 99.9);
});

// Replays the Metrics.astro tick loop the way a headless renderer drives it:
// rAF timestamps far behind performance.now() and a snapshot at any frame.
function replay(target, frames) {
  let t0;
  const shown = [];
  for (const t of frames) {
    if (t0 === undefined) t0 = t;
    const p = countupProgress(t, t0, COUNTUP_MS);
    shown.push(target * easeOutQuart(p));
    if (p >= 1) break;
  }
  return shown;
}

test('no frame ever shows a negative or overshooting value', () => {
  const skewed = Array.from({ length: 200 }, (_, i) => -1214.5 + i * 16);
  for (const target of [200, 99.9, 50, 15]) {
    const shown = replay(target, skewed);
    for (const v of shown) {
      assert.ok(v >= 0 && v <= target, `target ${target} showed ${v}`);
    }
    for (let i = 1; i < shown.length; i++) assert.ok(shown[i] >= shown[i - 1]);
    assert.equal(shown.at(-1), target);
  }
});

test('Metrics.astro anchors the clock to the first frame, not performance.now()', () => {
  const src = readFileSync(new URL('../src/components/Metrics.astro', import.meta.url), 'utf8');
  assert.match(src, /from '\.\.\/scripts\/countup\.js'/);
  assert.match(src, /if \(t0 === undefined\) t0 = t;/);
  assert.doesNotMatch(src, /performance\.now\(\)/);
  // Reduced motion keeps the static final value instead of animating.
  assert.match(src, /if \(reduced \|\| !isFinite\(target\)\) return;/);
});
