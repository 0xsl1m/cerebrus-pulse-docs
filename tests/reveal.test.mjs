// F046: GSAP came from a floating CDN tag (gsap@3, no SRI), and every
// [data-reveal] block (54 on the live page, pricing included) stayed at
// opacity 0 if that script was blocked or JavaScript was off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const landing = read('src/layouts/Landing.astro');

test('gsap is an exact-pinned npm dependency', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies.gsap, '3.15.0');
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.packages['node_modules/gsap'].version, '3.15.0');
});

test('the landing layout bundles GSAP instead of loading it from a CDN', () => {
  assert.doesNotMatch(landing, /cdn\.jsdelivr\.net/);
  assert.doesNotMatch(landing, /<script[^>]*src="https?:/);
  assert.match(landing, /import \{ gsap \} from 'gsap';/);
  assert.match(landing, /import \{ ScrollTrigger \} from 'gsap\/ScrollTrigger';/);
});

test('without JavaScript, reveal blocks are shown by a <noscript> style', () => {
  assert.match(
    landing,
    /<noscript><style>\[data-reveal\]\{opacity:1!important;transform:none!important;\}<\/style><\/noscript>/
  );
});

test('the reveal engine marks itself ready on both code paths', () => {
  const marks = landing.match(/setAttribute\('data-reveal-ready', ''\)/g) || [];
  assert.equal(marks.length, 2, 'reduced-motion branch and end of setup');
});

// Run the real inline failsafe from Landing.astro against a minimal DOM.
function runFailsafe({ engineReady }) {
  const block = landing.match(/<script is:inline>\s*(\/\/ Failsafe[\s\S]*?)<\/script>/);
  assert.ok(block, 'failsafe inline script not found');
  const listeners = {};
  const els = [0, 1, 2].map(() => {
    const classes = new Set();
    return { classList: { add: (c) => classes.add(c) }, classes };
  });
  const document = {
    documentElement: { hasAttribute: (n) => engineReady && n === 'data-reveal-ready' },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    querySelectorAll: (sel) => (sel === '[data-reveal]' ? els : []),
  };
  vm.runInNewContext(block[1], { document });
  assert.equal(typeof listeners.DOMContentLoaded, 'function');
  listeners.DOMContentLoaded();
  return els.map((el) => el.classes.has('revealed'));
}

test('failsafe reveals everything when the engine never ran', () => {
  assert.deepEqual(runFailsafe({ engineReady: false }), [true, true, true]);
});

test('failsafe leaves the page to GSAP when the engine is ready', () => {
  assert.deepEqual(runFailsafe({ engineReady: true }), [false, false, false]);
});
