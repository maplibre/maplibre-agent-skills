#!/usr/bin/env node
// Checks the formatting of the files git tracks or would track. A file that
// .gitignore, .git/info/exclude or a global excludes file hides from git is
// not part of the repo, so it is skipped here as it is in CI.
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import * as prettier from 'prettier';

const listed = spawnSync(
  'git',
  [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
    '--',
    '*.md',
    '*.json',
    '*.js'
  ],
  { encoding: 'utf8' }
);
if (listed.status !== 0) {
  const reason = listed.error?.message ?? listed.stderr.trim();
  console.error(`Could not list the repo's files with git: ${reason}`);
  process.exit(1);
}
// A tracked file deleted from the working tree is still in git's list.
const files = listed.stdout
  .split('\0')
  .filter((file) => file && existsSync(file));

console.log('Checking formatting...');
const unformatted = [];
for (const file of files) {
  const info = await prettier.getFileInfo(file, {
    ignorePath: '.prettierignore'
  });
  if (info.ignored || !info.inferredParser) continue;
  const options = await prettier.resolveConfig(file, { editorconfig: true });
  const source = readFileSync(file, 'utf8');
  if (!(await prettier.check(source, { ...options, filepath: file }))) {
    console.warn(`[warn] ${file}`);
    unformatted.push(file);
  }
}

if (unformatted.length > 0) {
  const noun = unformatted.length === 1 ? 'file' : 'files';
  console.warn(
    `[warn] Code style issues found in ${unformatted.length} ${noun}. Run \`npm run format\` to fix.`
  );
  process.exit(1);
}
console.log('All matched files use Prettier code style!');
