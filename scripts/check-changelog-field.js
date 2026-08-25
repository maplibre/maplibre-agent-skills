#!/usr/bin/env node
import { parseChangelogField } from './lib/changelog-field.js';

const body = process.env.PR_BODY;
const result = parseChangelogField(body);

if (result.errors.length > 0) {
  console.error('Changelog field validation failed:\n');
  for (const err of result.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(
  `Changelog field valid: bump=${result.bump}` +
    (result.category ? `, category=${result.category}` : '')
);
