#!/usr/bin/env node
/**
 * Auto-fixes capitalization of proper nouns from terminology.txt
 * in all markdown files. Skips fenced code blocks and inline code.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
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

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let inFrontmatter = false;
  let inCodeBlock = false;
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    if (i === 0 && lines[i].trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (lines[i].trim() === '---') inFrontmatter = false;
      continue;
    }
    if (lines[i].trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    let line = lines[i];

    // Split on inline code spans to avoid replacing inside them
    const parts = line.split(/(`[^`]+`)/);
    const fixed = parts.map((part) => {
      if (part.startsWith('`')) return part; // skip inline code
      for (const term of terms) {
        const pattern = new RegExp(
          `(?<![\\w/.-])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`,
          'gi'
        );
        part = part.replace(pattern, (match) => {
          if (match !== term) {
            changed = true;
            return term;
          }
          return match;
        });
      }
      return part;
    });

    lines[i] = fixed.join('');
  }

  if (changed) {
    writeFileSync(file, lines.join('\n'));
    console.log(`Fixed: ${file}`);
  }
}
