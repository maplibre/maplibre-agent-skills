#!/usr/bin/env node
// Tag-time check for changelog.yml: did package.json's version change in this commit?
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setOutputs } from './lib/github-output.js';

export function readVersion(packageJsonText) {
  try {
    return JSON.parse(packageJsonText).version ?? '';
  } catch {
    return '';
  }
}

export function versionChange(previousText, currentText) {
  const prev = readVersion(previousText);
  const curr = readVersion(currentText);
  return curr && prev !== curr ? curr : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let previous = '';
  try {
    previous = execFileSync('git', ['show', 'HEAD~1:package.json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    // first commit, or no package.json in the parent
  }
  const current = readFileSync('package.json', 'utf8');
  const version = versionChange(previous, current);
  if (version) {
    console.log(`package.json version changed to ${version}`);
    setOutputs({ changed: 'true', version });
  } else {
    console.log('package.json version unchanged.');
    setOutputs({ changed: 'false' });
  }
}
