#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function extractSection(changelog, version) {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingRegex = new RegExp(`^## \\[${escapedVersion}\\]`, 'm');
  const match = changelog.match(headingRegex);
  if (!match) return null;

  const lineEnd = changelog.indexOf('\n', match.index);
  if (lineEnd === -1) return '';

  const afterHeading = changelog.substring(lineEnd + 1);
  const nextHeading = afterHeading.match(/^## \[/m);
  const content = nextHeading
    ? afterHeading.substring(0, nextHeading.index)
    : afterHeading;

  return content.trim();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: changelog-section.js <version>');
    process.exit(1);
  }

  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const section = extractSection(changelog, version);

  if (section === null) {
    console.error(`No section found for version ${version}`);
    process.exit(1);
  }

  process.stdout.write(section + '\n');
}
