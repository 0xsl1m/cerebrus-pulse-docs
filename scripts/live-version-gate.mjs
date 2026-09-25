// Refuses a production build of docs that describe an API version the live
// gateway does not run (review: sync-gateway.mjs:99).
//
// src/data/ and public/openapi.yaml are generated from the gateway source the
// sync read, which can be a release that is not deployed yet (API 1.4.0 on
// fix/phase0 while production serves 1.3.0). A push to main is a production
// deploy on Vercel, so pushing those docs early would publish hourly funding
// annualization, /health fields and A2A quote fields the live API does not
// have. A production build therefore first reads GET /health and fails unless
// its "version" is the api_version the docs were generated for; Vercel then
// keeps serving the previous deployment.
//
//   node scripts/live-version-gate.mjs          checks only when VERCEL_ENV=production (prebuild)
//   node scripts/live-version-gate.mjs --force  checks now: run it before pushing to main
//
// CEREBRUS_SKIP_LIVE_VERSION_GATE=1 skips the check (an API outage, or a
// deliberate deploy); CEREBRUS_API_URL checks another gateway.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRICES_FILE = fileURLToPath(new URL('../src/data/prices.json', import.meta.url));
export const DEFAULT_API_URL = 'https://api.cerebruspulse.xyz';

/** Why the gate runs, or null when it does not. */
export function gateReason(env = process.env, argv = []) {
  if (env.CEREBRUS_SKIP_LIVE_VERSION_GATE === '1') return null;
  if (argv.includes('--force')) return '--force';
  if (env.VERCEL_ENV === 'production') return 'VERCEL_ENV=production';
  return null;
}

/** {ok, message}: whether the live /health reports the documented API version. */
export async function checkLiveVersion({ documented, apiUrl = DEFAULT_API_URL, fetchImpl = fetch, timeoutMs = 15000 }) {
  const url = `${apiUrl.replace(/\/+$/, '')}/health`;
  const fix =
    'Deploy that gateway first, or resync the docs to the deployed one ' +
    '(CEREBRUS_GATEWAY_REF=<deployed ref> npm run sync:gateway). ' +
    'CEREBRUS_SKIP_LIVE_VERSION_GATE=1 overrides.';
  let live;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    live = (await res.json()).version;
  } catch (err) {
    return { ok: false, message: `could not read the live API version from ${url} (${err.message}). ${fix}` };
  }
  if (typeof live !== 'string' || !live) {
    return { ok: false, message: `${url} returned no version. ${fix}` };
  }
  if (live !== documented) {
    return { ok: false, message: `the docs describe API ${documented}, but ${url} reports ${live}. ${fix}` };
  }
  return { ok: true, message: `the docs and ${url} are both on API ${live}` };
}

async function main(argv) {
  const reason = gateReason(process.env, argv);
  if (!reason) {
    console.log('live-version-gate: skipped (not a production build; --force checks now)');
    return 0;
  }
  const documented = JSON.parse(readFileSync(PRICES_FILE, 'utf8')).api_version;
  const { ok, message } = await checkLiveVersion({
    documented,
    apiUrl: process.env.CEREBRUS_API_URL || DEFAULT_API_URL,
  });
  (ok ? console.log : console.error)(`live-version-gate (${reason}): ${message}`);
  return ok ? 0 : 1;
}

// process.exitCode, not process.exit(): exiting while fetch's socket is still
// closing trips a libuv assertion on Windows and loses the exit code.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(`live-version-gate: ${err.message}`);
      process.exitCode = 1;
    }
  );
}
