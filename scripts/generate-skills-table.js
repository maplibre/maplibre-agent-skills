#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const START_MARKER = '<!-- skills-table:start -->';
const END_MARKER = '<!-- skills-table:end -->';
const GENERATED_COMMENT =
  '<!-- Rows are regenerated at release by `npm run generate:skills-table`: sorted by name, new skills added, removed skills dropped. Edit the "Use when" text in place; it is preserved. -->';

export function extractUseWhen(description) {
  const idx = description.toLowerCase().lastIndexOf('use when');
  if (idx === -1) return { text: description, fallback: true };
  let text = description.substring(idx + 8).trim();
  if (text.endsWith('.')) text = text.slice(0, -1);
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return { text, fallback: false };
}

// Parses `| [`name`](skills/name/SKILL.md) | cell |` rows into a name → cell map.
export function parseExistingRows(block) {
  const rows = new Map();
  const re = /^\|\s*\[`([^`]+)`\]\([^)]*\)\s*\|\s*(.*?)\s*\|\s*$/gm;
  for (const m of block.matchAll(re)) rows.set(m[1], m[2]);
  return rows;
}

export function generateTable(skills, existing = new Map()) {
  const warnings = [];
  const rows = skills
    .filter((s) => s.status !== 'process')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => {
      let text = existing.get(s.name);
      if (text === undefined) {
        const uw = extractUseWhen(s.description);
        text = uw.text;
        if (uw.fallback) {
          warnings.push(
            `${s.name}: new row with no "Use when" clause in its description, using the full description — edit the cell in README.md`
          );
        }
      }
      return `| [\`${s.name}\`](skills/${s.name}/SKILL.md) | ${text} |`;
    });

  const header = '| Skill | Use when |\n| --- | --- |';
  return { table: header + '\n' + rows.join('\n'), warnings };
}

export function readSkills(skillsDir = 'skills') {
  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const skills = [];

  for (const dir of entries.filter((e) => e.isDirectory())) {
    const skillFile = join(skillsDir, dir.name, 'SKILL.md');
    let content;
    try {
      content = readFileSync(skillFile, 'utf8');
    } catch {
      continue;
    }

    if (!content.startsWith('---\n')) continue;
    const fmEnd = content.indexOf('\n---\n', 4);
    if (fmEnd === -1) continue;

    const fm = content.substring(4, fmEnd);
    const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
    const status = fm.match(/^status:\s*(\S+)$/m)?.[1]?.trim();

    if (name && description) {
      skills.push({ name, description, status: status || '' });
    }
  }

  return skills;
}

function readBlock(readme) {
  const startIdx = readme.indexOf(START_MARKER);
  const endIdx = readme.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `README.md is missing ${START_MARKER} or ${END_MARKER} markers`
    );
  }
  return {
    before: readme.substring(0, startIdx),
    block: readme.substring(startIdx + START_MARKER.length, endIdx),
    after: readme.substring(endIdx + END_MARKER.length)
  };
}

// Returns true when the README's rows already match what generation would produce.
export function tableIsCurrent(readme, skills) {
  const { block } = readBlock(readme);
  const existing = parseExistingRows(block);
  const { table } = generateTable(skills, existing);
  const expected = parseExistingRows(table);
  const actual = [...existing.entries()];
  const wanted = [...expected.entries()];
  return JSON.stringify(actual) === JSON.stringify(wanted);
}

export function updateReadme(readmePath = 'README.md', skillsDir = 'skills') {
  const skills = readSkills(skillsDir);
  const readme = readFileSync(readmePath, 'utf8');
  const { before, block, after } = readBlock(readme);
  const existing = parseExistingRows(block);
  const { table, warnings } = generateTable(skills, existing);

  for (const w of warnings) console.warn(`Warning: ${w}`);

  const newReadme = `${before}${START_MARKER}\n${GENERATED_COMMENT}\n\n${table}\n\n${END_MARKER}${after}`;
  writeFileSync(readmePath, newReadme);
  console.log(`Updated README.md skills table (${skills.length} skills)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const readme = readFileSync('README.md', 'utf8');
    if (!tableIsCurrent(readme, readSkills())) {
      console.error(
        'README skills table is stale. Run `npm run generate:skills-table` to update.'
      );
      process.exit(1);
    }
    console.log('README skills table is up to date.');
  } else {
    updateReadme();
  }
}
