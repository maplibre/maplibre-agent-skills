#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parseChangelogField,
  BUMP_ORDER,
  VALID_CATEGORIES
} from './lib/changelog-field.js';

export function accrueEntry(
  changelog,
  { category, entry, bump, prNumber, prUrl }
) {
  const entryLine = `- ${entry} ([#${prNumber}](${prUrl}))`;

  if (changelog.includes(`[#${prNumber}](${prUrl})`)) {
    return { changelog, changed: false };
  }

  const headingMatch = changelog.match(/^## \[Unreleased\].*$/m);
  if (!headingMatch) {
    throw new Error('No "## [Unreleased]" heading found in CHANGELOG.md');
  }

  const headingEnd = headingMatch.index + headingMatch[0].length;
  const preamble = changelog.substring(0, headingMatch.index);
  const afterHeading = changelog.substring(headingEnd);

  const nextVersionMatch = afterHeading.match(/\n(?=## \[)/);
  let sectionContent, rest;
  if (nextVersionMatch) {
    sectionContent = afterHeading.substring(0, nextVersionMatch.index + 1);
    rest = afterHeading.substring(nextVersionMatch.index + 1);
  } else {
    sectionContent = afterHeading;
    rest = '';
  }

  const markerRegex = /\n<!-- bump:\s*(\w+)\s*-->/;
  const existingMarker = sectionContent.match(markerRegex);
  let effectiveBump = bump;
  if (existingMarker) {
    if ((BUMP_ORDER[existingMarker[1]] || 0) >= (BUMP_ORDER[bump] || 0)) {
      effectiveBump = existingMarker[1];
    }
    sectionContent = sectionContent.replace(markerRegex, '');
  }

  const catRegex = new RegExp(`^### ${category}$`, 'm');

  if (catRegex.test(sectionContent)) {
    sectionContent = sectionContent.replace(
      new RegExp(`(### ${category}\\n)(\\n)`),
      `$1$2${entryLine}\n`
    );
  } else {
    let inserted = false;
    const catIdx = VALID_CATEGORIES.indexOf(category);
    for (let i = catIdx + 1; i < VALID_CATEGORIES.length; i++) {
      const nextCatRegex = new RegExp(`^### ${VALID_CATEGORIES[i]}$`, 'm');
      const match = sectionContent.match(nextCatRegex);
      if (match) {
        sectionContent =
          sectionContent.substring(0, match.index) +
          `### ${category}\n\n${entryLine}\n\n` +
          sectionContent.substring(match.index);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      sectionContent =
        sectionContent.trimEnd() + '\n\n' + `### ${category}\n\n${entryLine}\n`;
    }
  }

  const result = `${preamble}## [Unreleased]\n<!-- bump: ${effectiveBump} -->${sectionContent}${rest}`;
  return { changelog: result, changed: true, effectiveBump };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prNumber = process.env.PR_NUMBER;
  const prUrl = process.env.PR_URL;
  let prBody;
  if (process.env.PR_BODY) {
    prBody = process.env.PR_BODY;
  } else if (process.env.PR_BODY_FILE) {
    prBody = readFileSync(process.env.PR_BODY_FILE, 'utf8');
  } else {
    console.error('Set PR_BODY or PR_BODY_FILE');
    process.exit(1);
  }

  if (!prNumber || !prUrl) {
    console.error('Required env vars: PR_NUMBER, PR_URL');
    process.exit(1);
  }

  const parsed = parseChangelogField(prBody);

  if (parsed.errors.length > 0) {
    console.error(
      'Changelog field is missing or invalid in the merged PR body:\n'
    );
    for (const err of parsed.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  if (parsed.bump === 'none') {
    console.log('Bump is none — no CHANGELOG entry needed.');
    process.exit(0);
  }

  const changelogPath = 'CHANGELOG.md';
  const changelog = readFileSync(changelogPath, 'utf8');

  const result = accrueEntry(changelog, {
    category: parsed.category,
    entry: parsed.entry,
    bump: parsed.bump,
    prNumber,
    prUrl
  });

  if (!result.changed) {
    console.log(`PR #${prNumber} already recorded in CHANGELOG.md — skipping.`);
    process.exit(0);
  }

  writeFileSync(changelogPath, result.changelog);
  console.log(
    `Recorded #${prNumber} under ${parsed.category} (bump: ${result.effectiveBump})`
  );
}
