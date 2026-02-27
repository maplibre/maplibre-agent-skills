#!/usr/bin/env node
// Setup git hooks for local CI checks

import { existsSync, copyFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const HOOKS_DIR = join(rootDir, '.git', 'hooks');
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
