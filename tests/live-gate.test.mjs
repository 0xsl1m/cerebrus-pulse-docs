// Review (sync-gateway.mjs:99): the generated docs describe the gateway the
// sync read (API 1.4.0, unreleased), production serves 1.3.0, and a push to
// main is a production deploy. A production build now checks the live /health
// version first. No network: the API is replaced by a stub fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkLiveVersion, DEFAULT_API_URL, gateReason, PRICES_FILE } from '../scripts/live-version-gate.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

function stubFetch(status, body, calls = []) {
  return async (url, init) => {
    calls.push(url);
    assert.ok(init.signal, 'the request has a timeout');
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}

test('the gate runs on production builds and on demand, never on local or preview builds', () => {
  assert.equal(gateReason({ VERCEL_ENV: 'production' }, []), 'VERCEL_ENV=production');
  assert.equal(gateReason({}, ['--force']), '--force');
  assert.equal(gateReason({}, []), null);
  assert.equal(gateReason({ VERCEL_ENV: 'preview' }, []), null);
  assert.equal(gateReason({ VERCEL_ENV: 'production', CEREBRUS_SKIP_LIVE_VERSION_GATE: '1' }, []), null);
  assert.equal(gateReason({ VERCEL_ENV: 'production', CEREBRUS_SKIP_LIVE_VERSION_GATE: '0' }, []), 'VERCEL_ENV=production');
});

test('the Vercel build runs the gate before anything is built', () => {
  assert.equal(vercel.buildCommand, 'npm run build');
  assert.match(pkg.scripts.prebuild, /^node scripts\/live-version-gate\.mjs && /);
  assert.equal(pkg.scripts['check:live'], 'node scripts/live-version-gate.mjs --force');
});

test('docs for an undeployed API version fail the gate', async () => {
  const calls = [];
  const res = await checkLiveVersion({ documented: '1.4.0', fetchImpl: stubFetch(200, { status: 'ok', version: '1.3.0' }, calls) });
  assert.equal(res.ok, false);
  assert.match(res.message, /describe API 1\.4\.0, but https:\/\/api\.cerebruspulse\.xyz\/health reports 1\.3\.0/);
  assert.match(res.message, /CEREBRUS_SKIP_LIVE_VERSION_GATE=1/);
  assert.deepEqual(calls, [`${DEFAULT_API_URL}/health`]);
});

test('docs for the deployed version pass', async () => {
  const res = await checkLiveVersion({
    documented: '1.4.0',
    apiUrl: 'https://gw.example/',
    fetchImpl: stubFetch(200, { version: '1.4.0' }),
  });
  assert.deepEqual(res, { ok: true, message: 'the docs and https://gw.example/health are both on API 1.4.0' });
});

test('an unreachable or unreadable API fails closed', async () => {
  const down = await checkLiveVersion({ documented: '1.4.0', fetchImpl: stubFetch(503, {}) });
  assert.equal(down.ok, false);
  assert.match(down.message, /HTTP 503/);

  const refused = await checkLiveVersion({
    documented: '1.4.0',
    fetchImpl: async () => {
      throw new Error('connect ECONNREFUSED');
    },
  });
  assert.equal(refused.ok, false);
  assert.match(refused.message, /ECONNREFUSED/);

  const noVersion = await checkLiveVersion({ documented: '1.4.0', fetchImpl: stubFetch(200, { status: 'ok' }) });
  assert.equal(noVersion.ok, false);
  assert.match(noVersion.message, /returned no version/);
});

test('the documented version is the api_version the docs were generated for', () => {
  const prices = JSON.parse(readFileSync(PRICES_FILE, 'utf8'));
  assert.match(prices.api_version, /^\d+\.\d+\.\d+$/);
});
