// G-CICD-2: the workflows used floating tags (claude-code-action@v1 was
// re-pointed twice in two days; actions/checkout@v4), and nothing kept
// dependencies or actions current (F048: no dependabot.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../.github/workflows/', import.meta.url);
const workflows = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));

test('there are workflows to check', () => {
  assert.ok(workflows.length >= 2);
});

for (const file of workflows) {
  test(`${file}: every action is pinned to a full commit SHA with a version comment`, () => {
    const lines = readFileSync(new URL(file, dir), 'utf8').split(/\r?\n/);
    const uses = lines.filter((l) => /^\s*(-\s*)?uses:/.test(l));
    for (const line of uses) {
      const m = line.match(/uses:\s*([^@\s]+)@(\S+)(?:\s+#\s*(\S+))?/);
      assert.ok(m, line);
      const [, action, ref, comment] = m;
      if (action.startsWith('./')) continue; // local action
      assert.match(ref, /^[0-9a-f]{40}$/, `${action}@${ref} is not a full SHA`);
      assert.match(comment || '', /^v\d+(\.\d+)*$/, `${action} has no "# vX.Y.Z" comment`);
    }
  });
}

test('dependabot.yml covers npm and github-actions weekly', () => {
  const text = readFileSync(new URL('../.github/dependabot.yml', import.meta.url), 'utf8');
  assert.match(text, /^version:\s*2\s*$/m);
  for (const eco of ['npm', 'github-actions']) {
    const block = text.split(/\n(?=\s*- package-ecosystem:)/).find((b) =>
      new RegExp(`package-ecosystem:\\s*"?${eco}"?\\s*$`, 'm').test(b)
    );
    assert.ok(block, `no ${eco} entry`);
    assert.match(block, /directory:\s*"?\/"?\s*$/m);
    assert.match(block, /interval:\s*"?weekly"?\s*$/m);
  }
});
