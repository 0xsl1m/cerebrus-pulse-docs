// F001: the TypeScript docs installed x402-fetch 1.x, an x402 v1 client that
// pays with an X-PAYMENT header. The gateway runs x402 v2 and reads only
// PAYMENT-SIGNATURE, so every TypeScript caller signed a payment and got a
// second 402. F005: `pip install "x402[svm]"` now resolves solana 0.40, which
// removed the module x402's Solana signer imports.
//
// The snippets themselves were checked outside this suite: the TypeScript
// blocks type-check (tsc --strict) against @x402/fetch, @x402/evm and
// @x402/svm 2.27.0, and the Python setup blocks run offline against x402
// 2.24.0 with solana 0.36.12 and solders 0.27.1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const docPages = () => walk(join(ROOT, 'src', 'content', 'docs')).filter((p) => p.endsWith('.mdx'));
const codeBlocks = (text, lang) =>
  [...text.replace(/\r\n/g, '\n').matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map((m) => m[1]);

test('no page installs or imports the x402 v1 TypeScript client', () => {
  for (const page of docPages()) {
    const text = readFileSync(page, 'utf8');
    for (const code of [...codeBlocks(text, 'bash'), ...codeBlocks(text, 'typescript')]) {
      assert.doesNotMatch(code, /npm install[^\n]*\bx402-fetch\b/, page);
      assert.doesNotMatch(code, /from ["']x402-fetch["']|from ["']x402["']|createSigner\(/, page);
    }
  }
});

test('TypeScript examples pay through the x402 v2 fetch client', () => {
  const guide = readFileSync(join(ROOT, 'src/content/docs/guides/typescript-sdk.mdx'), 'utf8');
  const code = codeBlocks(guide, 'typescript').join('\n');
  assert.match(code, /from "@x402\/fetch"/);
  assert.match(code, /from "@x402\/evm"/);
  assert.match(code, /from "@x402\/svm"/);
  assert.match(code, /network: "eip155:8453"/);
  assert.match(code, /network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"/);
  assert.match(code, /spendControls/);
});

test('X-PAYMENT is only ever named as the header that is not accepted', () => {
  for (const page of docPages()) {
    for (const line of readFileSync(page, 'utf8').split(/\r?\n/)) {
      if (!/X-PAYMENT/i.test(line)) continue;
      assert.match(line, /not accept|x402-fetch|v1/i, `${page}: ${line}`);
    }
  }
});

test('every Solana pip install pins solana below 0.37', () => {
  let seen = 0;
  for (const page of docPages()) {
    for (const code of codeBlocks(readFileSync(page, 'utf8'), 'bash')) {
      for (const line of code.split('\n')) {
        if (!/pip install[^\n]*x402\[svm\]/.test(line)) continue;
        seen++;
        assert.match(line, /"solana>=0\.36,<0\.37"/, `${page}: ${line}`);
        assert.match(line, /"solders>=0\.27,<0\.28"/, `${page}: ${line}`);
      }
    }
  }
  assert.ok(seen >= 3, `only ${seen} Solana install lines found`);
});

// F037: there were no pages for the published packages (the MCP server, the
// cerebrus-pulse Python client, the LangChain tools), and the Python client's
// PyPI documentation link pointed at a page about the raw x402 SDK.
const GUIDES = {
  'guides/mcp-server': [/uvx cerebrus-pulse-mcp|"command": "uvx"/, /CEREBRUS_WALLET_KEY/, /CEREBRUS_MAX_PAYMENT_USD/, /0\.5\.2 or later/],
  'guides/python-client': [/pip install cerebrus-pulse/, /CerebrusPulse\(wallet_key=/, /PaymentBlocked/, /0\.4\.0 or later/],
  'guides/langchain': [/pip install langchain-cerebrus-pulse/, /tool\(client=client\)/, /create_agent/, /0\.4\.0 or later/],
};

test('each published client package has a guide in the sidebar', () => {
  const config = readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8');
  for (const [slug, patterns] of Object.entries(GUIDES)) {
    assert.match(config, new RegExp(`slug: '${slug}'`), slug);
    const page = readFileSync(join(ROOT, 'src/content/docs', `${slug}.mdx`), 'utf8');
    for (const p of patterns) assert.match(page, p, `${slug}: ${p}`);
  }
  assert.match(config, /label: 'Python \(raw x402\)', slug: 'guides\/python-sdk'/);
});

test('client guides map every tool or method to a real paid endpoint, without typing prices', () => {
  const prices = JSON.parse(readFileSync(join(ROOT, 'src/data/prices.json'), 'utf8'));
  const paths = new Set(prices.routes.map((r) => r.path));
  for (const slug of Object.keys(GUIDES)) {
    const page = readFileSync(join(ROOT, 'src/content/docs', `${slug}.mdx`), 'utf8');
    const linked = [...page.matchAll(/\[`GET (\/[^`]+)`\]\(\/api\//g)].map((m) => m[1]);
    assert.ok(linked.length >= 13, `${slug} maps only ${linked.length} endpoints`);
    for (const path of linked) assert.ok(paths.has(path), `${slug}: ${path}`);
    assert.doesNotMatch(page, /\|\s*\$0\.\d+\s*\|/, `${slug} types a price`);
  }
});

test('the landing integration cards open the guides', () => {
  const metrics = readFileSync(join(ROOT, 'src/components/Metrics.astro'), 'utf8');
  for (const href of ['/guides/mcp-server', '/guides/python-client', '/guides/typescript-sdk', '/guides/langchain']) {
    assert.match(metrics, new RegExp(`href="${href}"`), href);
  }
});
