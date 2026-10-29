import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'format-check.js');

// Without GIT_*, a run from inside a git hook or `rebase -x` can't reach the
// repo it was started from.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
);

function git(cwd, ...args) {
  execFileSync('git', args, { cwd, env, encoding: 'utf8' });
}

// A checkout with one tracked file, formatted.
function checkout(t) {
  const repo = mkdtempSync(join(tmpdir(), 'format-check-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  git(repo, 'init', '-q');
  writeFileSync(join(repo, 'tracked.md'), '# Tracked\n');
  git(repo, 'add', 'tracked.md');
  return repo;
}

function check(cwd) {
  const result = spawnSync(process.execPath, [script], {
    cwd,
    env,
    encoding: 'utf8'
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

describe('format-check', () => {
  it('checks the files git would track and skips the ones it ignores', (t) => {
    const repo = checkout(t);
    writeFileSync(join(repo, 'new.js'), 'const x = 1\n');
    writeFileSync(join(repo, 'scratch.json'), '{"a":1}\n');
    writeFileSync(join(repo, '.git', 'info', 'exclude'), 'scratch.json\n');
    writeFileSync(join(repo, '.gitignore'), 'out/\n');
    mkdirSync(join(repo, 'out'));
    writeFileSync(join(repo, 'out', 'result.json'), '{"a":1}\n');

    let { status, output } = check(repo);
    assert.equal(status, 1, output);
    assert.match(output, /\[warn\] new\.js/);
    assert.match(output, /1 file\. Run `npm run format` to fix\./);
    assert.doesNotMatch(output, /scratch\.json|result\.json/);

    writeFileSync(join(repo, 'new.js'), 'const x = 1;\n');
    ({ status, output } = check(repo));
    assert.equal(status, 0, output);
  });

  it('skips a tracked file deleted from the working tree', (t) => {
    const repo = checkout(t);
    rmSync(join(repo, 'tracked.md'));
    const { status, output } = check(repo);
    assert.equal(status, 0, output);
  });
});
