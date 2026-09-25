// Helpers shared by the content tests (not a test file itself).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Text files a reader or a crawler sees, under the given top-level folders. */
export const siteFiles = (...dirs) =>
  dirs.flatMap((d) => walk(join(ROOT, d))).filter((p) => /\.(mdx|astro|json|txt|yaml|mjs|ts)$/.test(p));

// Misdescriptions of the data that must not come back (F002, F034, F035).
export const WRONG = [
  [/8[- ]hour funding|funding[^.\n]{0,40}\b8h\b|every 8 hours|3 \* 365|× ?3 × ?365/i, 'funding is hourly'],
  [/open[_ ]interest[^.\n|]{0,60}USD notional/i, 'open interest is in contracts'],
  [/30-day rolling|rolling 30-day/i, 'correlation uses 30 hourly returns by default'],
  [/\bRISK_ON\b|\bRISK_OFF\b/, 'regime labels are lower-case'],
  [/confidence score|Multi-signal confidence|Higher = stronger signal/i, 'the confluence score is a vote share'],
  [/>\s?2 hours old|older than 2 hours/i, 'stale_data means more than 15 minutes'],
  [/x-x402-payer/i, 'the wallet limit uses the verified payer'],
  [/long\/short ratio from funding|funding skew/i, 'the liquidation split is 50:50'],
];
