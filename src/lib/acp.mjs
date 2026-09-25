// Helpers over src/data/acp.json: the ACP v2 offerings as the provider defines
// them (F009). Each delivers the engine's JSON for one coin; none calls a model.

/** "the /pulse output (1h, 4h)" */
export const delivers = (o) => `the /${o.endpoint} output (${o.timeframes.join(', ')})`;

/** [{name, delivers, budget}] for every offering, in provider order. */
export const acpRows = (acp) => acp.offerings.map((o) => ({ name: o.name, delivers: delivers(o), budget: o.budget_usdc }));

/** {min, max} budget, as strings. */
export function acpRange(acp) {
  const sorted = acp.offerings.map((o) => o.budget_usdc).sort((a, b) => Number(a) - Number(b));
  return { min: sorted[0], max: sorted[sorted.length - 1] };
}

/** The offerings table as markdown (used by the llms files). */
export function acpTableMarkdown(acp) {
  return [
    '| Offering | Delivers | Budget (USDC) |',
    '|----------|----------|---------------|',
    ...acpRows(acp).map((r) => `| \`${r.name}\` | ${r.delivers} | $${r.budget} |`),
  ].join('\n');
}
