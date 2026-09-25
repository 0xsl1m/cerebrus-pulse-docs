// Price helpers over src/data/prices.json (F010). Pure functions: Astro
// components import the JSON themselves; node scripts and tests read it from
// disk. Every price the site shows goes through here, so none is typed twice.

/** "0.025" -> "$0.025" */
export const usd = (price) => `$${price}`;

/** The paid route for an endpoint name ("pulse", "cex-dex", ...). */
export function routeOf(prices, endpoint) {
  const route = prices.routes.find((r) => r.endpoint === endpoint);
  if (!route) throw new Error(`no paid route for "${endpoint}" in src/data/prices.json`);
  return route;
}

export const priceOf = (prices, endpoint) => routeOf(prices, endpoint).price;

/** Sum of decimal price strings, exact to 6 places (USDC has 6 decimals). */
export function sumPrices(...values) {
  const micro = values.reduce((total, p) => total + Math.round(Number(p) * 1e6), 0);
  return String(micro / 1e6);
}

/** {min, max} of the paid prices, as strings. */
export function priceRange(prices) {
  const sorted = prices.routes.map((r) => r.price).sort((a, b) => Number(a) - Number(b));
  return { min: sorted[0], max: sorted[sorted.length - 1] };
}

// One line per paid endpoint, for tables. Descriptions are the docs' own; the
// gateway's route descriptions are not reused because some overstate (the
// bundle's says "+ spread", which it does not contain).
export const ENDPOINT_SUMMARIES = {
  screener: 'Scan 50+ perpetuals: signal strength, RSI zone, trend, volatility, funding bias, confluence',
  pulse: 'Multi-timeframe technical analysis, derivatives snapshot, regime and confluence',
  sentiment: 'Bucketed market sentiment label and how many sources are live',
  funding: 'Funding rate statistics over a 1-168 hour lookback (hourly rates)',
  oi: 'Open interest: 1h/4h/24h deltas, percentile, trend, price-OI divergence',
  spread: 'Impact spread and uncalibrated slippage estimates at $10k-$500k',
  correlation: 'BTC-alt correlation of 1h returns (30h, 7d or 30d window) with regime',
  basis: 'Hyperliquid perp premium to its oracle, plus oracle vs Chainlink spot',
  depeg: 'USDC peg status from the Chainlink oracle on Arbitrum',
  arb: 'Market Stress Index from cross-chain arbitrage scans',
  'cex-dex': 'Coinbase vs DEX/Chainlink price divergence for one token',
  liquidations: 'Modelled liquidation zones by leverage tier, with cascade risk',
  bundle: '/pulse output plus 24h funding statistics and sentiment in one call',
};

// Table order: the most used first, the bundle last.
export const ENDPOINT_ORDER = [
  'screener', 'pulse', 'sentiment', 'funding', 'oi', 'spread', 'correlation',
  'basis', 'depeg', 'arb', 'cex-dex', 'liquidations', 'bundle',
];

export const FREE_ENDPOINTS = [
  { path: '/demo/{coin}', summary: 'Live /pulse analysis (1h, 4h), cached 60 s, 3 requests/min, no wallet' },
  { path: '/health', summary: 'Gateway health status' },
  { path: '/coins', summary: 'List the supported perpetuals' },
];

/** [{path, price, summary}] for every paid route, in ENDPOINT_ORDER. */
export function endpointRows(prices) {
  const missing = prices.routes.filter((r) => !ENDPOINT_ORDER.includes(r.endpoint));
  if (missing.length) throw new Error(`no docs summary for ${missing.map((r) => r.path).join(', ')}`);
  return ENDPOINT_ORDER.map((endpoint) => {
    const route = routeOf(prices, endpoint);
    return { path: route.path, price: route.price, summary: ENDPOINT_SUMMARIES[endpoint] };
  });
}

/** The endpoint table as markdown (used by the llms files). */
export function endpointTableMarkdown(prices) {
  const rows = endpointRows(prices).map((r) => `| \`GET ${r.path}\` | ${usd(r.price)} USDC | ${r.summary} |`);
  const free = FREE_ENDPOINTS.map((r) => `| \`GET ${r.path}\` | Free | ${r.summary} |`);
  return ['| Endpoint | Price | Description |', '|----------|-------|-------------|', ...rows, ...free].join('\n');
}

export const SKILL_SUMMARIES = {
  'confluence-analysis': 'Multi-timeframe technical analysis with the confluence vote share',
  'market-screener': 'Screen 50+ perpetuals by signal strength',
  'open-interest-analysis': 'OI deltas, percentile, trend and price-OI divergence',
  'spread-analysis': 'Impact spread and slippage estimates',
  'correlation-matrix': 'BTC-alt correlation matrix with regime',
  'intelligence-bundle': 'Pulse, 24h funding and sentiment in one call',
  'basis-analysis': 'Perp premium to the Hyperliquid oracle, and oracle vs Chainlink',
  'cex-dex-divergence': 'Coinbase vs DEX/Chainlink divergence for one token',
  'collateral-health': 'USDC peg status from Chainlink',
  'liquidation-heatmap': 'Modelled liquidation zones with cascade risk',
  'market-stress': 'Cross-chain arbitrage stress index',
};

/** [{id, path, price, needs_coin, summary}] for every A2A skill, in SKILL_MAP order. */
export function skillRows(prices) {
  return prices.skills.map((s) => {
    const summary = SKILL_SUMMARIES[s.id];
    if (!summary) throw new Error(`no docs summary for A2A skill ${s.id}`);
    return { ...s, summary };
  });
}

/** The A2A skill table as markdown (used by the llms files). */
export function skillTableMarkdown(prices) {
  const rows = skillRows(prices).map(
    (s) => `| \`${s.id}\` | \`GET ${s.path}\` | ${usd(s.price)} | ${s.needs_coin ? 'Yes' : 'No'} | ${s.summary} |`
  );
  return [
    '| Skill ID | Served by | Price (USDC) | Needs a coin | Description |',
    '|----------|-----------|--------------|--------------|-------------|',
    ...rows,
  ].join('\n');
}
