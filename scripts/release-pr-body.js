#!/usr/bin/env node
// Prints the body for the release PR opened by release.yml.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractSection } from './changelog-section.js';

export function releasePrBody(changelog, version) {
  const section = extractSection(changelog, version);
  if (section === null) {
    throw new Error(`No CHANGELOG section for ${version}`);
  }
  return [
    `## What this changes`,
    ``,
    `Release v${version}. Merging tags \`v${version}\` and publishes the GitHub Release from the section below.`,
    ``,
    section,
    ``,
    `## Changelog`,
    ``,
    `Bump: none`,
    ``
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: release-pr-body.js <version>');
    process.exit(1);
  }
  process.stdout.write(
    releasePrBody(readFileSync('CHANGELOG.md', 'utf8'), version)
  );
}
