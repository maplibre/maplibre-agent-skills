#!/usr/bin/env node
/**
 * Checks that proper nouns in terminology.txt are correctly capitalized
 * in all markdown files. Skips fenced code blocks, inline code, and links.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const terms = readFileSync('terminology.txt', 'utf8')
  .split('\n')
  .map((t) => t.trim())
  .filter(Boolean);

function findMarkdown(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory() && entry !== 'node_modules') {
      results.push(...findMarkdown(full));
    } else if (extname(entry) === '.md') {
      results.push(full);
    }
  }
  return results;
}

const files = [
  ...readdirSync('.').filter((f) => f.endsWith('.md')),
  ...findMarkdown('skills')
];

// Remove inline code and links from a line before checking
function stripCode(line) {
  return line
    .replace(/`[^`]+`/g, '') // inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, ''); // links (text + url)
}

let errors = 0;

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let inFrontmatter = false;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === '---') inFrontmatter = false;
      continue;
    }
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const checkable = stripCode(line);

    for (const term of terms) {
      const pattern = new RegExp(
        `(?<![\\w/.-])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`,
        'gi'
      );
      for (const match of checkable.matchAll(pattern)) {
        if (match[0] !== term) {
          console.error(`${file}:${i + 1}: "${match[0]}" should be "${term}"`);
          errors++;
        }
      }
    }
  }
}

if (errors > 0) {
  console.error(
    `\n${errors} terminology issue(s). Run \`npm run fix:terminology\` to fix automatically.`
  );
  process.exit(1);
}
