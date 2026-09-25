// Submits the live sitemap's URLs to IndexNow (shared with Bing, Yandex,
// Seznam, Naver and others), using the key file already served from public/.
// Run by .github/workflows/indexnow.yml after a successful production deploy.
//
//   node scripts/indexnow.mjs            fetch the live sitemap and submit it
//   node scripts/indexnow.mjs --dry-run  print the payload, submit nothing
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://cerebruspulse.xyz';
export const ENDPOINT = 'https://api.indexnow.org/indexnow';
const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MAX_URLS = 10000; // IndexNow limit per request

/** The IndexNow key: the one public/<key>.txt whose content is exactly <key>. */
export function findKey(publicDir = PUBLIC_DIR) {
  const keys = readdirSync(publicDir)
    .filter((f) => /^[A-Za-z0-9-]{8,128}\.txt$/.test(f))
    .map((f) => ({ key: f.slice(0, -'.txt'.length), content: readFileSync(join(publicDir, f), 'utf8').trim() }))
    .filter(({ key, content }) => key === content)
    .map(({ key }) => key);
  if (keys.length !== 1) throw new Error(`expected one IndexNow key file in ${publicDir}, found ${keys.length}`);
  return keys[0];
}

const XML_ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

/** Every <loc> in a sitemap or sitemap index. */
export function parseLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) =>
    m[1].replace(/&(?:amp|lt|gt|quot|apos);/g, (e) => XML_ENTITIES[e])
  );
}

function sameHost(url, host) {
  try {
    return new URL(url).host === host;
  } catch {
    return false;
  }
}

/** The IndexNow request body: this host's URLs only, de-duplicated. */
export function buildPayload({ site = SITE, key, urls }) {
  const host = new URL(site).host;
  const urlList = [...new Set(urls)].filter((u) => sameHost(u, host));
  if (urlList.length === 0) throw new Error(`no ${host} URLs to submit`);
  if (urlList.length > MAX_URLS) throw new Error(`${urlList.length} URLs exceeds the IndexNow limit of ${MAX_URLS}`);
  return { host, key, keyLocation: `${site}/${key}.txt`, urlList };
}

/** IndexNow answers 200 or 202 on success; anything else is a failure. */
export function describeResponse(status) {
  const known = {
    200: 'OK: URLs submitted',
    202: 'Accepted: URLs received, key validation pending',
    400: 'Bad request: invalid format',
    403: 'Forbidden: key not valid (key file missing or content mismatch)',
    422: 'Unprocessable: URLs do not belong to the host, or the key does not match',
    429: 'Too many requests',
  };
  return { ok: status === 200 || status === 202, message: known[status] || `Unexpected HTTP ${status}` };
}

async function fetchText(url, fetchImpl) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return res.text();
}

/** URLs from the site's sitemap index and each same-host child sitemap. */
export async function collectSitemapUrls({ site = SITE, fetchImpl = fetch } = {}) {
  const host = new URL(site).host;
  const children = parseLocs(await fetchText(`${site}/sitemap-index.xml`, fetchImpl)).filter((u) => sameHost(u, host));
  const urls = [];
  for (const child of children) urls.push(...parseLocs(await fetchText(child, fetchImpl)));
  return urls;
}

async function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const payload = buildPayload({ key: findKey(), urls: await collectSitemapUrls() });
  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  const { ok, message } = describeResponse(res.status);
  console.log(`IndexNow: HTTP ${res.status} ${message} (${payload.urlList.length} URLs)`);
  return ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`IndexNow: ${err.message}`);
      process.exit(1);
    }
  );
}
