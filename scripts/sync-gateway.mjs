// Copies the facts the docs must not invent from the gateway source into
// src/data/, so every page reads them from one place (F010).
//
// Prices: the gateway builds X402_ROUTES in service/server.py; each route's
// price is prices.get("<key>", "<fallback>") read from
// service/x402_server_config.json. Those route objects are what gates payment,
// so they are the only price source. A2A skills come from SKILL_MAP in the
// same file: each skill is served, and priced, by one of those routes. The
// A2A agent card in public/.well-known/ gets its prices and version filled in
// from the same data, as the gateway fills its own card.
//
// Response examples: service/response_examples.json is real engine output on
// captured feeds (the gateway's scripts/build_response_examples.py), the same
// file the gateway publishes as Bazaar and OpenAPI examples. It is copied to
// src/data/response-examples.json and the API reference renders it (F006).
// public/openapi.yaml is built from both plus the parameters the gateway
// validates (scripts/openapi.mjs).
//
// The gateway repo is local-only, so this runs on a machine that has it:
//
//   node scripts/sync-gateway.mjs           regenerate the generated files
//   node scripts/sync-gateway.mjs --check   exit 1 if any is out of date
//
// The gateway is looked for at $CEREBRUS_GATEWAY_DIR, else ../gateway (the
// cerebrus-pulse workspace layout). --check without a gateway skips (exit 0)
// so a checkout without it (CI, Vercel) is not blocked. Files are read from
// the gateway's committed HEAD, not its working tree, so someone's unfinished
// edit there never leaks into the docs; set CEREBRUS_GATEWAY_REF to another
// ref, or to "worktree" to read the files on disk.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { buildOpenApi } from './openapi.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const PRICES_FILE = join(ROOT, 'src', 'data', 'prices.json');
export const EXAMPLES_FILE = join(ROOT, 'src', 'data', 'response-examples.json');
export const OPENAPI_FILE = join(ROOT, 'public', 'openapi.yaml');

export function gatewayDir(env = process.env) {
  return resolve(env.CEREBRUS_GATEWAY_DIR || join(ROOT, '..', 'gateway'));
}

/** The source of the Python dict literal that starts at `NAME = {` or `NAME: dict = {`. */
function dictBlock(source, name) {
  const start = source.search(new RegExp(`^\\s*${name}\\s*(?::[^=]+)?=\\s*\\{`, 'm'));
  if (start === -1) throw new Error(`${name} = { ... } not found in server.py`);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed in server.py`);
}

const ROUTE_RE =
  /"GET (\/[^"]+)":\s*RouteConfig\(\s*accepts=make_option\(prices\.get\("([a-z_]+)",\s*"([0-9.]+)"\)\),\s*description="([^"]*)"/g;

/**
 * The paid routes, in X402_ROUTES order: [{route, path, endpoint, price, ...}].
 * `price` is what the gateway charges: the config price, else the route's fallback.
 */
export function parseRoutes(serverPy, config) {
  const block = dictBlock(serverPy, 'routes');
  const configured = config.prices || {};
  // The route description is not copied: the docs write their own, and a
  // wording change in the gateway must not make the docs look stale.
  const routes = [...block.matchAll(ROUTE_RE)].map(([, path, key, fallback]) => ({
    route: `GET ${path}`,
    path: path.replace(/:([A-Za-z_]\w*)/g, '{$1}'),
    endpoint: path.split('/')[1],
    config_key: key,
    price: String(configured[key] ?? fallback),
  }));
  const declared = (block.match(/"GET \//g) || []).length;
  if (!routes.length || routes.length !== declared) {
    throw new Error(`parsed ${routes.length} of ${declared} routes; the route table format changed`);
  }
  return routes;
}

const SKILL_RE = /"([a-z0-9-]+)":\s*\{"endpoint":\s*"([a-z0-9-]+)",\s*"needs_coin":\s*(True|False)\}/g;

/** A2A skills from SKILL_MAP, each priced by the route that serves it. */
export function parseSkills(serverPy, routes) {
  const block = dictBlock(serverPy, 'SKILL_MAP');
  const skills = [...block.matchAll(SKILL_RE)].map(([, id, endpoint, needsCoin]) => {
    const route = routes.find((r) => r.endpoint === endpoint);
    if (!route) throw new Error(`skill ${id} is served by /${endpoint}, which has no paid route`);
    return { id, endpoint, path: route.path, needs_coin: needsCoin === 'True', price: route.price };
  });
  if (!skills.length) throw new Error('SKILL_MAP parsed to nothing; its format changed');
  return skills;
}

/** A gateway file at CEREBRUS_GATEWAY_REF (default HEAD); from disk if the dir is not a git repo. */
export function readGatewayFile(dir, relPath, ref = process.env.CEREBRUS_GATEWAY_REF || 'HEAD') {
  if (ref !== 'worktree' && existsSync(join(dir, '.git'))) {
    return execFileSync('git', ['-C', dir, 'show', `${ref}:${relPath}`], { encoding: 'utf8', maxBuffer: 64 << 20 });
  }
  return readFileSync(join(dir, relPath), 'utf8');
}

export function buildPrices(dir = gatewayDir()) {
  const serverPy = readGatewayFile(dir, 'service/server.py');
  const config = JSON.parse(readGatewayFile(dir, 'service/x402_server_config.json'));
  const routes = parseRoutes(serverPy, config);
  const version = serverPy.match(/^API_VERSION = "([^"]+)"/m);
  if (!version) throw new Error('API_VERSION not found in server.py');
  return {
    _meta: {
      generated_by: 'scripts/sync-gateway.mjs',
      sources: [
        'gateway service/server.py: X402_ROUTES (the objects that gate payment) and SKILL_MAP',
        'gateway service/x402_server_config.json: prices',
      ],
      note: 'Do not edit by hand. Rerun `npm run sync:gateway` after a gateway price change.',
    },
    api_version: version[1],
    currency: 'USDC',
    routes,
    skills: parseSkills(serverPy, routes),
  };
}

export const ACP_FILE = join(ROOT, 'src', 'data', 'acp.json');

const OFFERING_RE =
  /"(\w+)":\s*\("(\w+)",\s*lambda coin:\s*\{"endpoint":\s*"([\w-]+)",\s*"coin":\s*coin,\s*"timeframes":\s*\[([^\]]*)\]\}\)/g;

// The retail price per service key: the module-level RETAIL_USDC dict, or the
// `retail = {...}` literal inside price_for() in providers before it moved out.
const RETAIL_RE = /^\s*(?:RETAIL_USDC|retail)\s*(?::[^=\n]+)?=\s*\{([^}]*)\}/m;

/**
 * The ACP v2 offerings as acp-v2/provider_loop.py serves them: which engine
 * endpoint and timeframes each delivers, and the USDC budget it proposes
 * (F009). One source for every page that shows ACP.
 */
export function parseAcp(providerPy) {
  const block = dictBlock(providerPy, 'OFFERINGS');
  const retailSrc = providerPy.match(RETAIL_RE);
  if (!retailSrc) throw new Error('retail prices (RETAIL_USDC) not found in provider_loop.py');
  const retail = Object.fromEntries([...retailSrc[1].matchAll(/"(\w+)":\s*([0-9.]+)/g)].map((m) => [m[1], m[2]]));
  const offerings = [...block.matchAll(OFFERING_RE)].map(([, name, serviceKey, endpoint, tfs]) => {
    if (!(serviceKey in retail)) throw new Error(`ACP offering ${name} has no retail price`);
    return {
      name,
      service_key: serviceKey,
      endpoint,
      timeframes: [...tfs.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
      budget_usdc: Number(retail[serviceKey]).toFixed(2),
    };
  });
  const declared = (block.match(/^\s*"\w+":\s*\(/gm) || []).length;
  if (!offerings.length || offerings.length !== declared) {
    throw new Error(`parsed ${offerings.length} of ${declared} ACP offerings; the format changed`);
  }
  return {
    _meta: {
      generated_by: 'scripts/sync-gateway.mjs',
      source: 'gateway acp-v2/provider_loop.py: OFFERINGS and RETAIL_USDC',
      note: 'Do not edit by hand. The ACP seller is paused; these are the v2 definitions, not live listings.',
    },
    currency: 'USDC',
    chain: 'Base',
    offerings,
  };
}

export const COINS_FILE = join(ROOT, 'src', 'data', 'coins.json');

/** The markets the engine serves: COIN_ALLOWLIST in engine/coin_registry.py, sorted (what GET /coins lists). */
export function parseCoins(registryPy) {
  const block = registryPy.match(/^COIN_ALLOWLIST = frozenset\(\[([\s\S]*?)\]\)/m);
  if (!block) throw new Error('COIN_ALLOWLIST not found in coin_registry.py');
  const coins = [...block[1].matchAll(/"([A-Z0-9]+)"/g)].map((m) => m[1]).sort();
  const markets = Object.fromEntries(
    [...(registryPy.match(/^HL_NAME_MAP = \{([\s\S]*?)\}/m)?.[1] || '').matchAll(/"(\w+)":\s*"(\w+)"/g)].map((m) => [m[1], m[2]])
  );
  return {
    _meta: { generated_by: 'scripts/sync-gateway.mjs', source: 'gateway engine/coin_registry.py: COIN_ALLOWLIST, HL_NAME_MAP' },
    count: coins.length,
    coins,
    hyperliquid_names: markets,
  };
}

export const serialize = (value) => JSON.stringify(value, null, 2) + '\n';
const normalize = (text) => text.replace(/\r\n/g, '\n');

export const AGENT_CARD_FILE = join(ROOT, 'public', '.well-known', 'agent-card.json');
// The legacy discovery path serves the same card, as the gateway does.
export const AGENT_JSON_FILE = join(ROOT, 'public', '.well-known', 'agent.json');
const SKILL_PRICE_SENTENCE = / \$[0-9.]+ USDC per call\.$/;

/**
 * The site's copy of the A2A agent card with its prices filled in from the
 * payment routes, the way the gateway fills its own (_with_generated_fields).
 * The prose stays hand-written here; every skill must be one SKILL_MAP serves.
 */
export function withGeneratedCardFields(card, prices) {
  const ids = new Set(prices.skills.map((s) => s.id));
  const listed = new Set((card.skills || []).map((s) => s.id));
  const missing = [...ids].filter((id) => !listed.has(id));
  const unknown = [...listed].filter((id) => !ids.has(id));
  if (missing.length || unknown.length) {
    throw new Error(`agent card skills differ from SKILL_MAP: missing ${missing}, unknown ${unknown}`);
  }
  const out = structuredClone(card);
  out.version = prices.api_version;
  const x402 = out.extensions.x402;
  x402.pricing = Object.fromEntries(prices.skills.map((s) => [s.id, s.price]));
  const values = prices.skills.map((s) => Number(s.price)).sort((a, b) => a - b);
  x402.pricing_notes =
    `All prices in USDC per call, from $${values[0]} to $${values[values.length - 1]}, ` +
    'settled over x402 v2. Generated from the gateway\'s payment routes.';
  for (const skill of out.skills) {
    const price = prices.skills.find((s) => s.id === skill.id).price;
    skill.description = `${skill.description.replace(SKILL_PRICE_SENTENCE, '').trimEnd()} $${price} USDC per call.`;
  }
  return out;
}

/** Files this script owns: {path: expected content}. */
export function expectedFiles(dir = gatewayDir()) {
  const prices = buildPrices(dir);
  const card = serialize(
    withGeneratedCardFields(JSON.parse(readFileSync(AGENT_CARD_FILE, 'utf8')), prices)
  );
  const examples = JSON.parse(readGatewayFile(dir, 'service/response_examples.json'));
  const openapi = buildOpenApi(prices, examples, readGatewayFile(dir, 'service/server.py'));
  return {
    [PRICES_FILE]: serialize(prices),
    [ACP_FILE]: serialize(parseAcp(readGatewayFile(dir, 'acp-v2/provider_loop.py'))),
    [COINS_FILE]: serialize(parseCoins(readGatewayFile(dir, 'engine/coin_registry.py'))),
    [EXAMPLES_FILE]: serialize(examples),
    [OPENAPI_FILE]:
      '# Generated by scripts/sync-gateway.mjs from the gateway source; do not edit by hand.\n' +
      yaml.dump(openapi, { lineWidth: 120, noRefs: true }),
    [AGENT_CARD_FILE]: card,
    [AGENT_JSON_FILE]: card,
  };
}

function main(argv) {
  const dir = gatewayDir();
  const check = argv.includes('--check');
  if (!existsSync(join(dir, 'service', 'server.py'))) {
    if (check) {
      console.log(`sync-gateway: skipped, no gateway source at ${dir} (set CEREBRUS_GATEWAY_DIR)`);
      return 0;
    }
    console.error(`sync-gateway: no gateway source at ${dir} (set CEREBRUS_GATEWAY_DIR)`);
    return 1;
  }
  let stale = 0;
  for (const [path, content] of Object.entries(expectedFiles(dir))) {
    const current = existsSync(path) ? normalize(readFileSync(path, 'utf8')) : null;
    if (current === content) continue;
    if (check) {
      console.error(`sync-gateway: ${path} is out of date with ${dir}`);
      stale++;
    } else {
      writeFileSync(path, content);
      console.log(`sync-gateway: wrote ${path}`);
    }
  }
  if (check && !stale) console.log('sync-gateway: up to date');
  return stale ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
