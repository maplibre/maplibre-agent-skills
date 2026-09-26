import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

// Without GIT_*, a run from inside a git hook or `rebase -x` can't reach the
// repo it was started from.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
);

function git(cwd, ...args) {
  execFileSync('git', args, { cwd, env, encoding: 'utf8' });
}

// Runs a copy of the script from `dir`, as `npm install` there would.
function setupHooks(dir) {
  for (const file of ['scripts/setup-hooks.js', '.githooks/pre-push']) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    copyFileSync(join(rootDir, file), join(dir, file));
  }
  writeFileSync(join(dir, 'package.json'), '{ "type": "module" }\n');
  execFileSync(process.execPath, ['scripts/setup-hooks.js'], {
    cwd: dir,
    env,
    encoding: 'utf8'
  });
}

describe('setup-hooks', () => {
  it('installs the pre-push hook from the main checkout and from a worktree', (t) => {
    const repo = mkdtempSync(join(tmpdir(), 'setup-hooks-'));
    t.after(() => rmSync(repo, { recursive: true, force: true }));
    git(repo, 'init', '-q');
    git(
      repo,
      '-c',
      'user.email=test@example.com',
      '-c',
      'user.name=test',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-q',
      '--no-verify',
      '--allow-empty',
      '-m',
      'init'
    );
    const worktree = join(repo, 'worktree');
    git(repo, 'worktree', 'add', '-q', worktree);
    git(repo, 'config', 'core.hooksPath', join(repo, 'elsewhere'));
    const hook = join(repo, '.git', 'hooks', 'pre-push');
    mkdirSync(dirname(hook), { recursive: true });

    for (const dir of [repo, worktree]) {
      rmSync(hook, { force: true });
      setupHooks(dir);
      assert.ok(existsSync(hook), `no pre-push hook after running from ${dir}`);
    }
  });
});
