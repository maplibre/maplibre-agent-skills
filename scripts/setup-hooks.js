#!/usr/bin/env node
// Setup git hooks for local CI checks

import { existsSync, copyFileSync, chmodSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// In a git worktree `.git` is a file, and the hooks live in the main
// checkout's git directory. `--git-dir` keeps a `GIT_DIR` inherited from
// another repo's hook from pointing git elsewhere.
function gitCommonDir() {
  const dotGit = join(rootDir, '.git');
  if (!existsSync(dotGit) || !statSync(dotGit).isFile()) return dotGit;
  const commonDir = execFileSync(
    'git',
    ['--git-dir', dotGit, 'rev-parse', '--git-common-dir'],
    { cwd: rootDir, encoding: 'utf8' }
  ).trim();
  return resolve(rootDir, commonDir);
}

const HOOKS_DIR = join(gitCommonDir(), 'hooks');
const SOURCE_HOOKS_DIR = join(rootDir, '.githooks');

console.log('🔧 Setting up git hooks...');

if (!existsSync(HOOKS_DIR)) {
  console.error(
    'Error: .git/hooks directory not found. Are you in the repository root?'
  );
  process.exit(1);
}

console.log('📋 Installing pre-push hook...');
const sourceHook = join(SOURCE_HOOKS_DIR, 'pre-push');
const targetHook = join(HOOKS_DIR, 'pre-push');

try {
  copyFileSync(sourceHook, targetHook);
  try {
    chmodSync(targetHook, 0o755);
  } catch (chmodError) {
    // Ignore chmod errors on Windows
  }
  console.log('✅ Pre-push hook installed');
} catch (error) {
  console.error(`Error installing hook: ${error.message}`);
  process.exit(1);
}

console.log('');
console.log('✨ Git hooks setup complete!');
console.log('');
console.log('The pre-push hook will run before every push to ensure:');
console.log('  - Code is properly formatted');
console.log('  - No spelling errors');
console.log('  - Markdown is valid');
console.log('  - Skills are valid');
console.log('');
console.log('To bypass the hook (not recommended), use: git push --no-verify');
