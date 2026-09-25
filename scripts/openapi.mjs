// Builds public/openapi.yaml from the same facts the gateway builds its own
// /openapi.json from (F006): the paid routes and prices (src/data/prices.json),
// real engine responses as examples and schemas (src/data/response-examples.json)
// and the query parameters the gateway validates, read from service/server.py.
// The hand-written spec it replaces had wrong field names, a "discount_pct"
// field and the 8-hour funding convention.
import { ENDPOINT_SUMMARIES } from '../src/lib/pricing.mjs';

const PUBLIC_BASE = 'https://api.cerebruspulse.xyz';
const DOCS_BASE = 'https://cerebruspulse.xyz';
const NETWORKS = ['eip155:8453', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'];

const tuple = (src, name) => {
  const m = src.match(new RegExp(`^${name} = \\(([^)]*)\\)`, 'm'));
  if (!m) throw new Error(`${name} not found in server.py`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
};

/**
 * Query parameters per paid path, as the gateway validates and defaults them:
 * {"/pulse/{coin}": [{name, schema, description}], ...}.
 */
export function queryParams(serverPy) {
  const handlers = {};
  for (const m of serverPy.matchAll(/@app\.get\("(\/[^"]+)", \*\*PAID_ROUTE\)\nasync def \w+\(([^)]*)\)/g)) {
    handlers[m[1].split('/')[1]] = Object.fromEntries(
      [...m[2].matchAll(/(\w+): (\w+)(?: = ("[^"]*"|[^,\s]+))?/g)].map(([, name, type, dflt]) => [
        name,
        { type, default: dflt === undefined ? undefined : JSON.parse(dflt) },
      ])
    );
  }
  const intBlock = serverPy.match(/^INT_PARAMS = \{([\s\S]*?)^\}/m);
  if (!intBlock) throw new Error('INT_PARAMS not found in server.py');
  const ranges = {};
  for (const m of intBlock[1].matchAll(/"\/([a-z-]+)\/?": \{"(\w+)": \((\d+), (\d+)\)\}/g)) {
    ranges[`${m[1]}.${m[2]}`] = { minimum: Number(m[3]), maximum: Number(m[4]) };
  }
  const timeframes = tuple(serverPy, 'VALID_TIMEFRAMES');
  const timeframePaths = tuple(serverPy, 'TIMEFRAME_PREFIXES').map((p) => p.split('/')[1]);
  const windows = tuple(serverPy, 'CORRELATION_WINDOWS');

  const out = {};
  for (const [endpoint, args] of Object.entries(handlers)) {
    const params = [];
    for (const [name, arg] of Object.entries(args)) {
      if (name === 'coin') continue; // the path parameter
      if (name === 'timeframes' && timeframePaths.includes(endpoint)) {
        params.push({ name, schema: { type: 'string', default: arg.default },
          description: `Comma-separated, from ${timeframes.join(',')} (default ${arg.default})` });
      } else if (name === 'window' && endpoint === 'correlation') {
        params.push({ name, schema: { type: 'string', enum: windows, default: arg.default },
          description: `Window of 1h returns: ${windows.join(', ')} (default ${arg.default})` });
      } else if (arg.type === 'int' && ranges[`${endpoint}.${name}`]) {
        const r = ranges[`${endpoint}.${name}`];
        params.push({ name, schema: { type: 'integer', ...r, default: arg.default },
          description: `${r.minimum}-${r.maximum} (default ${arg.default})` });
      } else {
        throw new Error(`no OpenAPI rule for /${endpoint} parameter ${name}`);
      }
    }
    out[endpoint] = params;
  }
  return out;
}

/** JSON Schema inferred from a real response; scalars nullable, as the gateway does. */
export function schemaOf(value) {
  if (Array.isArray(value)) return { type: 'array', items: value.length ? schemaOf(value[0]) : {} };
  if (value && typeof value === 'object') {
    return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, schemaOf(v)])) };
  }
  if (typeof value === 'boolean') return { type: ['boolean', 'null'] };
  if (typeof value === 'number') return { type: ['number', 'null'] };
  if (typeof value === 'string') return { type: ['string', 'null'] };
  return {};
}

const error = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const json = (example) =>
  example === undefined
    ? { 'application/json': { schema: { type: 'object' } } }
    : { 'application/json': { schema: schemaOf(example), example } };

// Paths whose coin must be one of GET /coins (the gateway's ALLOWLIST_PREFIXES)
const ALLOWLISTED = ['pulse', 'funding', 'bundle', 'oi', 'spread', 'liquidations'];

export function buildOpenApi(prices, examples, serverPy) {
  const params = queryParams(serverPy);
  const paths = {};
  for (const route of [...prices.routes].sort((a, b) => a.path.localeCompare(b.path))) {
    const { endpoint, path, price } = route;
    const pathParam = path.match(/\{(\w+)\}/);
    const parameters = [
      ...(pathParam
        ? [{ name: pathParam[1], in: 'path', required: true, schema: { type: 'string' },
             description: pathParam[1] === 'token' ? 'Token symbol, e.g. ETH, BTC' : 'Perpetual market symbol (e.g. BTC, ETH, SOL); see /coins' }]
        : []),
      ...(params[endpoint] || []).map((p) => ({ name: p.name, in: 'query', required: false, schema: p.schema, description: p.description })),
    ];
    const responses = {
      200: {
        description: 'Analysis result. The settlement receipt is in the PAYMENT-RESPONSE header.',
        headers: { 'PAYMENT-RESPONSE': { description: 'base64 x402 settlement receipt', schema: { type: 'string' } } },
        content: json(examples.examples[endpoint]),
      },
      400: error('Invalid input (bad symbol, timeframe or integer parameter), refused before any price is quoted; or the engine could not serve the request (not charged).'),
      402: {
        description: 'Payment required. x402 v2 terms are in the PAYMENT-REQUIRED header; retry with PAYMENT-SIGNATURE.',
        headers: { 'PAYMENT-REQUIRED': { description: 'base64 x402 v2 payment terms', schema: { type: 'string' } } },
        content: { 'application/json': { schema: { type: 'object' } } },
      },
      ...(ALLOWLISTED.includes(endpoint) ? { 404: error('Unknown coin. GET /coins lists the supported symbols.') } : {}),
      429: error('Rate limited'),
      503: error('Service disabled, payment system unavailable, or the upstream data feed is missing or stale. No price is quoted.'),
      504: error('Analysis timed out (not charged).'),
    };
    paths[path] = {
      get: {
        summary: ENDPOINT_SUMMARIES[endpoint],
        description: `${ENDPOINT_SUMMARIES[endpoint]}.\n\nPaid endpoint: ${price} USDC per call via x402 v2 (Base or Solana). Returns 402 with payment terms if unpaid. Reference: ${DOCS_BASE}/api/${endpoint}`,
        parameters,
        responses,
        'x-price-usd': Number(price),
        'x-payment-protocol': 'x402',
      },
    };
  }
  paths['/health'] = { get: { summary: 'Service health', responses: { 200: { description: 'OK' } } } };
  paths['/coins'] = { get: { summary: 'Supported perpetuals', responses: { 200: { description: 'OK' } } } };
  paths['/demo/{coin}'] = {
    get: {
      summary: 'Free demo: live pulse analysis (1h, 4h), cached 60 s',
      description: 'No payment. Rate limited to 3 requests per minute per IP.',
      parameters: [{ name: 'coin', in: 'path', required: true, schema: { type: 'string' }, description: 'Perpetual market symbol (e.g. BTC); see /coins' }],
      responses: {
        200: { description: 'Pulse analysis with demo metadata', content: json(examples.examples.pulse) },
        404: { description: 'Unknown coin, with suggestions' },
        429: error('Demo rate limit exceeded (3/min/IP)'),
      },
      'x-price-usd': 0,
    },
  };
  return {
    openapi: '3.1.0',
    info: {
      title: 'Cerebrus Pulse',
      version: prices.api_version,
      summary: 'Pay-per-call crypto derivatives intelligence for AI agents.',
      description:
        'Real-time Hyperliquid perpetuals intelligence. No account or API key: each paid call is settled in USDC ' +
        'over the x402 protocol (v2), on Base or Solana. Generated by the docs site from the gateway\'s payment ' +
        `routes and real engine output; the gateway serves the same surface at ${PUBLIC_BASE}/openapi.json.`,
      license: { name: 'Proprietary' },
    },
    servers: [{ url: PUBLIC_BASE }],
    externalDocs: { url: DOCS_BASE },
    'x-payment': { protocol: 'x402', version: 2, header: 'PAYMENT-SIGNATURE', networks: NETWORKS, asset: 'USDC' },
    paths,
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            detail: { description: 'Why the request was refused' },
            param: { type: 'string', description: 'The offending parameter, when there is one' },
          },
          required: ['detail'],
        },
      },
    },
  };
}
