// F047: the site sent no nosniff, Referrer-Policy, Permissions-Policy,
// framing protection or CSP. The CSP ships as Report-Only: an enforcing CSP
// can break Starlight's inline scripts and styles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

function headersFor(source) {
  const rule = (vercel.headers || []).find((r) => r.source === source);
  assert.ok(rule, `no headers rule for ${source}`);
  return Object.fromEntries(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

function directives(csp) {
  return Object.fromEntries(
    csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const [name, ...values] = d.split(/\s+/);
      return [name, values];
    })
  );
}

const all = headersFor('/(.*)');

test('baseline security headers apply to every path', () => {
  assert.match(all['strict-transport-security'], /^max-age=(\d+)/);
  assert.ok(Number(all['strict-transport-security'].match(/max-age=(\d+)/)[1]) >= 31536000);
  // includeSubDomains waits until every subdomain is confirmed HTTPS-only.
  assert.doesNotMatch(all['strict-transport-security'], /includeSubDomains|preload/);
  assert.equal(all['x-content-type-options'], 'nosniff');
  assert.equal(all['referrer-policy'], 'strict-origin-when-cross-origin');
  for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
    assert.match(all['permissions-policy'], new RegExp(`\\b${feature}=\\(\\)`));
  }
});

test('framing is blocked by an enforced header', () => {
  // frame-ancestors inside a Report-Only policy only reports, so the
  // enforcing control is X-Frame-Options.
  assert.equal(all['x-frame-options'], 'DENY');
});

test('the CSP is report-only, never enforcing', () => {
  assert.equal(all['content-security-policy'], undefined);
  for (const rule of vercel.headers) {
    for (const { key } of rule.headers) {
      assert.notEqual(key.toLowerCase(), 'content-security-policy', `enforcing CSP on ${rule.source}`);
    }
  }
  assert.ok(all['content-security-policy-report-only']);
});

test('the report-only CSP covers what the site actually loads', () => {
  const d = directives(all['content-security-policy-report-only']);
  assert.deepEqual(d['default-src'], ["'self'"]);
  assert.deepEqual(d['frame-ancestors'], ["'none'"]);
  assert.deepEqual(d['object-src'], ["'none'"]);
  assert.deepEqual(d['base-uri'], ["'self'"]);
  // Astro/Starlight inline scripts; Pagefind search compiles WebAssembly.
  assert.ok(d['script-src'].includes("'unsafe-inline'"));
  assert.ok(d['script-src'].includes("'wasm-unsafe-eval'"));
  // GSAP is bundled now (F046): no third-party script origin is allowed.
  assert.ok(d['script-src'].every((s) => !s.startsWith('http')), d['script-src'].join(' '));
  assert.ok(d['style-src'].includes('https://fonts.googleapis.com'));
  assert.ok(d['font-src'].includes('https://fonts.gstatic.com'));
  // Live demo (LiveDemo.astro) and the PyPI version badge (Hero.astro).
  assert.ok(d['connect-src'].includes('https://api.cerebruspulse.xyz'));
  assert.ok(d['connect-src'].includes('https://pypi.org'));
});
