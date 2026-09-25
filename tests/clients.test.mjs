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
