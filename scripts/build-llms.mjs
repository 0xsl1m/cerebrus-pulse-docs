// Builds public/llms.txt and public/llms-full.txt (F007, F042).
//
// Both were hand-written and had drifted: llms-full.txt still carried
// fabricated SDK code (`from x402.client import Client`, `new x402Client({
// walletKey })` from "x402"), wrong prices, the 8-hour funding convention and
// VIRTUAL-priced ACP, and neither mentioned the free /demo, the MCP server or
// A2A. Now:
//   llms.txt       a summary in the llms.txt link-list format, with prices,
//                  skills, ACP tiers and coins read from src/data/.
//   llms-full.txt  every docs page in sidebar order, converted from the MDX
//                  sources, with components expanded from the same data. The
//                  pages are the single source; this file cannot say more.
//
//   node scripts/build-llms.mjs           write both files
//   node scripts/build-llms.mjs --check   exit 1 if either is out of date
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acpTableMarkdown } from '../src/lib/acp.mjs';
import { exampleCaption } from '../src/lib/examples.mjs';
import {
  bundleMath,
  endpointTableMarkdown,
  priceOf,
  priceRange,
  skillTableMarkdown,
  usd,
} from '../src/lib/pricing.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SITE = 'https://cerebruspulse.xyz';
const API = 'https://api.cerebruspulse.xyz';
export const LLMS_FILE = join(ROOT, 'public', 'llms.txt');
export const LLMS_FULL_FILE = join(ROOT, 'public', 'llms-full.txt');

const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const json = (p) => JSON.parse(read(p));

export function loadData() {
  return {
    prices: json('src/data/prices.json'),
    examples: json('src/data/response-examples.json'),
    acp: json('src/data/acp.json'),
    coins: json('src/data/coins.json'),
  };
}

/** Docs page slugs in sidebar order, from astro.config.mjs. */
export function sidebarSlugs(config = read('astro.config.mjs')) {
  return [...config.matchAll(/slug: '([^']+)'/g)].map((m) => m[1]);
}

const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];

/** One MDX page as plain markdown: frontmatter, imports and components resolved. */
export function mdxToMarkdown(source, data) {
  const { prices, examples, acp } = data;
  let text = source.replace(/\r\n/g, '\n');
  const front = text.match(/^---\n([\s\S]*?)\n---\n/);
  const title = front?.[1].match(/^title: (.+)$/m)?.[1].trim();
  if (front) text = text.slice(front[0].length);
  text = text.replace(/^import .*\n/gm, '');

  const components = {
    PriceBadge: (tag) => `**Price:** ${usd(priceOf(prices, attr(tag, 'endpoint')))} USDC per call`,
    Price: (tag) => usd(priceOf(prices, attr(tag, 'endpoint'))),
    PriceRange: () => {
      const { min, max } = priceRange(prices);
      return `${usd(min)}–${usd(max)}`;
    },
    EndpointPrices: () => endpointTableMarkdown(prices),
    SkillPrices: () => skillTableMarkdown(prices),
    AcpOfferings: () => acpTableMarkdown(acp),
    BundleMath: () => bundleMath(prices).sentence,
    ResponseExample: (tag) => {
      const endpoint = attr(tag, 'endpoint');
      return `_${exampleCaption(examples, endpoint)}_\n\n\`\`\`json\n${JSON.stringify(examples.examples[endpoint], null, 2)}\n\`\`\``;
    },
    Badge: () => '',
  };
  // Components are replaced outside fenced code only; code is left verbatim.
  let inFence = false;
  text = text
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(/<([A-Z]\w*)\b[^<>]*\/>/g, (tag, name) => {
        if (!(name in components)) throw new Error(`no markdown for <${name} /> (${title})`);
        return components[name](tag);
      });
    })
    .join('\n');

  // Tabs: each tab becomes a bold label; its content loses the 4-space indent
  const out = [];
  let inTab = false;
  for (const line of text.split('\n')) {
    if (/^\s*<\/?Tabs>\s*$/.test(line)) continue;
    const tab = line.match(/^\s*<TabItem label="([^"]+)">\s*$/);
    if (tab) {
      out.push(`**${tab[1]}:**`, '');
      inTab = true;
      continue;
    }
    if (/^\s*<\/TabItem>\s*$/.test(line)) {
      inTab = false;
      continue;
    }
    out.push(inTab ? line.replace(/^ {4}/, '') : line);
  }
  text = out.join('\n');

  // Asides (:::note[Title] ... :::) become blockquotes
  text = text.replace(/^:::(\w+)(?:\[([^\]]*)\])?\n([\s\S]*?)\n:::$/gm, (_, kind, label, body) => {
    const head = `> **${label || kind[0].toUpperCase() + kind.slice(1)}:**`;
    return [head, ...body.split('\n').map((l) => (l ? `> ${l}` : '>'))].join('\n');
  });

  text = text.replace(/\\([{}])/g, '$1').replace(/\{'\{(\w+)\}'\}/g, '{$1}');
  // Site-relative links are absolute here: the file is read outside the site
  text = text.replace(/\]\(\/(?!\/)/g, `](${SITE}/`);
  if (/<[A-Z]\w*[\s>]/.test(text)) throw new Error(`unconverted component left in ${title}`);
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function buildLlmsFull(data = loadData(), slugs = sidebarSlugs()) {
  const header = [
    '# Cerebrus Pulse — full documentation',
    '',
    `> Every page of ${SITE}, in sidebar order, generated from the docs sources by scripts/build-llms.mjs.`,
    '> Response examples are real engine output. Informational only, not financial advice.',
    '',
    `Summary: ${SITE}/llms.txt · OpenAPI: ${SITE}/openapi.yaml and ${API}/openapi.json`,
  ].join('\n');
  const pages = slugs.map((slug) => {
    const body = mdxToMarkdown(read(`src/content/docs/${slug}.mdx`), data);
    return `---\n\nSource: ${SITE}/${slug}\n\n${body}`;
  });
  return `${header}\n\n${pages.join('\n\n')}\n`;
}

export function buildLlms(data = loadData()) {
  const { prices, acp, coins } = data;
  const { min, max } = priceRange(prices);
  const acpBudgets = acp.offerings.map((o) => Number(o.budget_usdc));
  const lines = [
    '# Cerebrus Pulse',
    '',
    `> Pay-per-call crypto market data for AI agents: multi-timeframe technical analysis, hourly funding, open`,
    `> interest, liquidation models and more for ${coins.count} Hyperliquid perpetuals. No account or API key: each call`,
    `> costs ${usd(min)}–${usd(max)} in USDC, paid over the x402 protocol (v2) on Base or Solana. Informational`,
    '> only, not financial advice.',
    '',
    '## Try it free',
    '',
    `- [Free demo](${API}/demo/BTC): \`GET /demo/{coin}\` returns the full /pulse analysis (1h, 4h) for BTC or ETH, cached 60 s, 3 requests a minute, no wallet.`,
    `- [Coin list](${API}/coins): \`GET /coins\`, free.`,
    `- [Health](${API}/health): \`GET /health\`, free.`,
    '',
    '## How payment works',
    '',
    'An unpaid request to a paid endpoint returns HTTP 402 with the x402 v2 terms in the base64 `PAYMENT-REQUIRED`',
    'header. An x402 v2 client (Python `x402`, TypeScript `@x402/fetch`) signs a USDC payment and retries with the',
    '`PAYMENT-SIGNATURE` header; the receipt comes back in `PAYMENT-RESPONSE`. The payer needs USDC only, no ETH',
    'or SOL for gas. x402 v1 clients (`x402-fetch` 1.x, the `X-PAYMENT` header) are not accepted. A request refused',
    'with a 4xx or failing with a 5xx is not charged.',
    '',
    `- [x402 payments guide](${SITE}/guides/x402-payments): the flow, networks, wallets and spend caps.`,
    '',
    '## Paid endpoints',
    '',
    endpointTableMarkdown(prices),
    '',
    'Units: funding rates are per hour (Hyperliquid pays hourly); open interest is counted in contracts, not USD;',
    '`confluence.score` is a bullish vote share from 0 to 1, not a confidence; prices are per `price_unit`',
    '(PEPE is the 1000-token `kPEPE` market).',
    '',
    bundleMath(prices).sentence,
    '',
    '## Integrations',
    '',
    `- [MCP server](${SITE}/guides/mcp-server): \`uvx --from "cerebrus-pulse-mcp>=0.5.2" cerebrus-pulse-mcp\` for Claude, Cursor or any MCP client; pays inside spend limits.`,
    `- [Python client](${SITE}/guides/python-client): \`pip install "cerebrus-pulse[pay]>=0.4.0"\`, typed methods that pay inside spend limits.`,
    `- [LangChain tools](${SITE}/guides/langchain): \`pip install "langchain-cerebrus-pulse[pay]>=0.4.0"\`.`,
    `- [Python with x402](${SITE}/guides/python-sdk): the raw x402 SDK (\`pip install "x402[evm]" httpx eth-account\`).`,
    `- [TypeScript with x402](${SITE}/guides/typescript-sdk): \`npm install @x402/fetch @x402/evm viem\`.`,
    `- [A2A](${SITE}/guides/a2a-agents): an A2A agent card and \`message/send\`; A2A names the HTTP endpoint and its x402 terms, and payment happens over HTTP.`,
    `- [ACP](${SITE}/guides/acp-agents): Virtuals Protocol jobs paid in USDC ($${Math.min(...acpBudgets).toFixed(2)}–$${Math.max(...acpBudgets).toFixed(2)}), delivering the same engine JSON. Paused.`,
    '',
    '## A2A skills',
    '',
    skillTableMarkdown(prices),
    '',
    '## Machine-readable',
    '',
    `- [OpenAPI (docs site)](${SITE}/openapi.yaml): generated from the payment routes and real engine output.`,
    `- [OpenAPI (API)](${API}/openapi.json): the gateway's own copy.`,
    `- [x402 manifest](${API}/.well-known/x402): priced endpoint catalog.`,
    `- [A2A agent card](${API}/.well-known/agent-card.json): skills and prices.`,
    `- [Full documentation](${SITE}/llms-full.txt): every docs page in one file.`,
    '',
    '## Docs',
    '',
    `- [Overview](${SITE}/overview): what the API is and every endpoint with its price.`,
    `- [Quickstart](${SITE}/quickstart): the free demo, then a first paid call in Python or TypeScript.`,
    `- [Response Schemas](${SITE}/reference/response-schemas): units, the common meta block and every enum.`,
    `- [Rate Limits & Errors](${SITE}/reference/rate-limits): 12 requests a minute per IP, error formats.`,
    `- [x402 vs A2A vs ACP](${SITE}/reference/x402-vs-acp): the three ways in.`,
    ...prices.routes.map((r) => `- [GET ${r.path}](${SITE}/api/${r.endpoint}): ${usd(r.price)} USDC.`),
    '',
    '## Supported coins',
    '',
    `${coins.coins.join(', ')} (${coins.count}; PEPE trades as kPEPE). Live list: ${API}/coins.`,
    '',
    '## Disclaimer',
    '',
    'Cerebrus Pulse provides market data and technical indicators for informational purposes only. Nothing it',
    'returns is financial, investment or trading advice.',
    '',
  ];
  return lines.join('\n');
}

export function expectedFiles(data = loadData()) {
  return { [LLMS_FILE]: buildLlms(data), [LLMS_FULL_FILE]: buildLlmsFull(data) };
}

function main(argv) {
  const check = argv.includes('--check');
  let stale = 0;
  for (const [path, content] of Object.entries(expectedFiles())) {
    const current = existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : null;
    if (current === content) continue;
    if (check) {
      console.error(`build-llms: ${path} is out of date`);
      stale++;
    } else {
      writeFileSync(path, content);
      console.log(`build-llms: wrote ${path}`);
    }
  }
  if (check && !stale) console.log('build-llms: up to date');
  return stale ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
