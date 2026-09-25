// F006, F034, F035: the API reference documented field names, nesting, units
// and enums the engine does not return (10 of 13 paid endpoints differed).
// The reference now shows real engine output (src/data/response-examples.json,
// copied from the gateway), and this contract test holds every page's field
// table to that output: each field the engine returns is documented, and each
// documented field exists unless its row says it is optional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const examples = JSON.parse(readFileSync(join(ROOT, 'src/data/response-examples.json'), 'utf8'));
const page = (name) =>
  readFileSync(join(ROOT, 'src/content/docs/api', `${name}.mdx`), 'utf8').replace(/\r\n/g, '\n');

// Every paid endpoint's reference page. /arb has no captured example (the
// capture had no arb log), so its table is checked for presence only.
const PAGES = [
  'pulse', 'bundle', 'screener', 'funding', 'sentiment', 'oi', 'spread',
  'correlation', 'basis', 'cex-dex', 'depeg', 'liquidations', 'arb',
];

/** Rows of every table whose first header cell is "Field": [{path, description}]. */
function documentedFields(mdx) {
  const rows = [];
  let inTable = false;
  for (const raw of mdx.split(/\r?\n/)) {
    if (!raw.startsWith('|')) {
      inTable = false;
      continue;
    }
    const cells = raw.replace(/\\\|/g, '\u0000').split('|').slice(1, -1).map((c) => c.trim());
    if (/^Field$/i.test(cells[0])) {
      inTable = true;
      continue;
    }
    if (!inTable || /^:?-+:?$/.test(cells[0])) continue;
    const m = cells[0].match(/^`([^`]+)`$/);
    if (m) rows.push({ path: m[1], description: cells[cells.length - 1] });
  }
  return rows;
}

// Keys that are data, not field names, become the placeholder the docs use.
const DYNAMIC = [
  [/^(timeframes)\.[^.[]+/, '$1.<tf>'],
  [/^(confluence\.per_timeframe)\.[^.]+/, '$1.<tf>'],
  [/^(meta\.as_of)\.[^.]+$/, '$1.<input>'],
  [/^(btc_correlation)\.[^.]+$/, '$1.<coin>'],
  [/^(correlation_stats)\.[^.]+/, '$1.<coin>'],
  [/^(sector_averages)\.[^.]+$/, '$1.<sector>'],
  [/^(spread\.estimated_slippage_bps)\.[^.]+$/, '$1.<size>'],
  [/^(open_interest\.delta_windows_seconds)\.[^.]+$/, '$1.<window>'],
  [/^(meta\.assumptions\.assumed_oi_share_by_leverage)\.[^.]+$/, '$1.<leverage>'],
  [/^(meta\.deprecated)\..+$/, '$1'],
];

/** Every leaf path of an engine response, with data keys replaced by placeholders. */
function fieldPaths(value, path = '', out = new Set()) {
  if (Array.isArray(value)) {
    const objects = value.filter((v) => v && typeof v === 'object' && !Array.isArray(v));
    if (!objects.length) out.add(path);
    for (const item of objects) fieldPaths(item, `${path}[]`, out);
    return out;
  }
  if (value && typeof value === 'object' && Object.keys(value).length) {
    for (const [k, v] of Object.entries(value)) fieldPaths(v, path ? `${path}.${k}` : k, out);
    return out;
  }
  let p = path;
  for (const [re, to] of DYNAMIC) p = p.replace(re, to);
  out.add(p);
  return out;
}

const under = (leaf, doc) => leaf.startsWith(`${doc}.`) || leaf.startsWith(`${doc}[]`);

// The metadata most endpoints share is documented once, on the Response
// Schemas page (checked below); pages document only their own meta fields.
const COMMON_META = [
  'meta.provider', 'meta.offering', 'meta.execution_ms', 'meta.data_age_seconds',
  'meta.sources[].name', 'meta.sources[].url', 'meta.sources[].notice',
  'meta.warning', 'meta.warnings', 'meta.disclaimer', 'meta.as_of.<input>',
];

/**
 * Is an engine field documented? By its own row, or by a row for an object
 * that the page documents whole (no row for any of its fields), or as common
 * metadata. A page that lists some of an object's fields must list them all.
 */
function documented(rows, leaf) {
  if (COMMON_META.includes(leaf)) return true;
  return rows.some(
    (r) => r.path === leaf || (under(leaf, r.path) && !rows.some((o) => under(o.path, r.path)))
  );
}

for (const name of PAGES) {
  test(`/${name}: the field table matches what the engine returns`, () => {
    const rows = documentedFields(page(name));
    assert.ok(rows.length >= 3, `/${name} has no field table`);
    const example = examples.examples[name];
    if (!example) {
      assert.equal(name, 'arb', `no captured example for /${name}`);
      return;
    }
    const leaves = [...fieldPaths(example)];
    const undocumented = leaves.filter((leaf) => !documented(rows, leaf));
    assert.deepEqual(undocumented, [], `/${name} returns fields its page does not document`);
    const invented = rows.filter(
      (r) => !/^Optional\b/.test(r.description) && !leaves.some((leaf) => leaf === r.path || under(leaf, r.path))
    );
    assert.deepEqual(invented.map((r) => r.path), [], `/${name} documents fields the engine does not return`);
  });
}

test('each paid reference page shows the real engine example', () => {
  for (const name of PAGES) {
    const text = page(name);
    if (examples.examples[name]) assert.match(text, new RegExp(`<ResponseExample endpoint="${name}" />`), name);
    // No hand-written JSON response: every ```json block on these pages is a request body or a schema
    assert.doesNotMatch(text, /```json\n\{\n\s+"(coin|endpoint)"/, `${name} has a hand-written example`);
  }
});

test('the Response Schemas page documents the common meta fields', () => {
  const text = readFileSync(join(ROOT, 'src/content/docs/reference/response-schemas.mdx'), 'utf8');
  const rows = documentedFields(text).map((r) => r.path);
  for (const field of COMMON_META) assert.ok(rows.includes(field), field);
});

test('the placeholder rules only rename data keys', () => {
  const paths = [...fieldPaths(examples.examples.pulse)];
  assert.ok(paths.includes('timeframes.<tf>.indicators.rsi_14'));
  assert.ok(paths.includes('confluence.per_timeframe.<tf>.family_scores.trend_following'));
  assert.ok(paths.includes('meta.sources[].name'));
  assert.ok(paths.includes('meta.as_of.<input>'));
});
