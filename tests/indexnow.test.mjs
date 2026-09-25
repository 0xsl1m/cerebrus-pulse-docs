// F044: the IndexNow key file was published but nothing ever submitted.
// No network: the live sitemap is replaced by a stub fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ENDPOINT,
  buildPayload,
  collectSitemapUrls,
  describeResponse,
  findKey,
  parseLocs,
} from '../scripts/indexnow.mjs';

const KEY = '7d153dafcc9347b8ae75fe31836c00a7';

test('finds the key file already served from public/', () => {
  assert.equal(findKey(), KEY);
  const served = readFileSync(new URL(`../public/${KEY}.txt`, import.meta.url), 'utf8');
  assert.equal(served.trim(), KEY); // IndexNow requires the file to contain the key
});

test('ignores .txt files whose content is not their own name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'indexnow-'));
  try {
    writeFileSync(join(dir, 'abcdef0123456789.txt'), 'something else');
    assert.throws(() => findKey(dir), /found 0/);
    writeFileSync(join(dir, 'fedcba9876543210.txt'), 'fedcba9876543210\n');
    assert.equal(findKey(dir), 'fedcba9876543210');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('parses sitemap <loc> entries and decodes XML entities', () => {
  const xml = `<?xml version="1.0"?><urlset>
    <url><loc>https://cerebruspulse.xyz</loc></url>
    <url><loc> https://cerebruspulse.xyz/api/pulse </loc></url>
    <url><loc>https://cerebruspulse.xyz/a?x=1&amp;y=2</loc></url></urlset>`;
  assert.deepEqual(parseLocs(xml), [
    'https://cerebruspulse.xyz',
    'https://cerebruspulse.xyz/api/pulse',
    'https://cerebruspulse.xyz/a?x=1&y=2',
  ]);
});

test('payload keeps only this host, de-duplicated, with the key location', () => {
  const payload = buildPayload({
    key: KEY,
    urls: [
      'https://cerebruspulse.xyz/overview',
      'https://cerebruspulse.xyz/overview',
      'https://evil.example/overview',
      'not a url',
      'https://cerebruspulse.xyz/api/pulse',
    ],
  });
  assert.deepEqual(payload, {
    host: 'cerebruspulse.xyz',
    key: KEY,
    keyLocation: `https://cerebruspulse.xyz/${KEY}.txt`,
    urlList: ['https://cerebruspulse.xyz/overview', 'https://cerebruspulse.xyz/api/pulse'],
  });
  assert.throws(() => buildPayload({ key: KEY, urls: ['https://other.example/'] }), /no cerebruspulse\.xyz URLs/);
});

test('only 200 and 202 count as success', () => {
  assert.equal(describeResponse(200).ok, true);
  assert.equal(describeResponse(202).ok, true);
  for (const status of [400, 403, 422, 429, 500]) assert.equal(describeResponse(status).ok, false);
  assert.match(describeResponse(403).message, /key/);
});

test('collects URLs from the sitemap index and its same-host children', async () => {
  const pages = {
    'https://cerebruspulse.xyz/sitemap-index.xml':
      '<sitemapindex><sitemap><loc>https://cerebruspulse.xyz/sitemap-0.xml</loc></sitemap>' +
      '<sitemap><loc>https://elsewhere.example/sitemap.xml</loc></sitemap></sitemapindex>',
    'https://cerebruspulse.xyz/sitemap-0.xml':
      '<urlset><url><loc>https://cerebruspulse.xyz</loc></url><url><loc>https://cerebruspulse.xyz/overview</loc></url></urlset>',
  };
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    return url in pages
      ? { ok: true, status: 200, text: async () => pages[url] }
      : { ok: false, status: 404, text: async () => '' };
  };
  const urls = await collectSitemapUrls({ fetchImpl });
  assert.deepEqual(urls, ['https://cerebruspulse.xyz', 'https://cerebruspulse.xyz/overview']);
  assert.ok(!requested.includes('https://elsewhere.example/sitemap.xml'));
  assert.equal(ENDPOINT, 'https://api.indexnow.org/indexnow');
});

test('the workflow runs only on a successful production deploy, and only when enabled', () => {
  const wf = readFileSync(new URL('../.github/workflows/indexnow.yml', import.meta.url), 'utf8');
  assert.match(wf, /^on:\s*\n\s+deployment_status:/m);
  assert.match(wf, /vars\.INDEXNOW_ENABLED == 'true'/);
  assert.match(wf, /github\.event\.deployment_status\.state == 'success'/);
  assert.match(wf, /github\.event\.deployment\.environment == 'Production'/);
  assert.match(wf, /^permissions:\s*\n\s+contents: read\s*$/m);
  assert.match(wf, /run: node scripts\/indexnow\.mjs\s*$/m);
  assert.doesNotMatch(wf, /secrets\./);
});
