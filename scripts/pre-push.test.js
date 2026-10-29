import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '.githooks',
  'pre-push'
);
const ZERO = '0'.repeat(40);
const SHA = 'a'.repeat(40);

// Runs the hook as git would, from a directory with no npm scripts, so the
// first check it reaches fails and names itself in the output.
function push(t, refs) {
  const dir = mkdtempSync(join(tmpdir(), 'pre-push-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }\n');
  mkdirSync(join(dir, 'node_modules'));
  const result = spawnSync('sh', [hook], {
    cwd: dir,
    input: refs.map((line) => `${line}\n`).join(''),
    encoding: 'utf8'
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

describe('pre-push hook', () => {
  it('skips the checks when the push only deletes branches', (t) => {
    const { status, output } = push(t, [
      `(delete) ${ZERO} refs/heads/old ${SHA}`
    ]);
    assert.equal(status, 0, output);
    assert.match(output, /only deletes branches/);
    assert.doesNotMatch(output, /Formatting check/);
  });

  it('runs the checks when the push carries a branch', (t) => {
    const { status, output } = push(t, [
      `(delete) ${ZERO} refs/heads/old ${SHA}`,
      `refs/heads/new ${SHA} refs/heads/new ${ZERO}`
    ]);
    assert.notEqual(status, 0, output);
    assert.match(output, /Formatting check/);
  });
});
