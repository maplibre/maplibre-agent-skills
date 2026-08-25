#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setOutputs } from './lib/github-output.js';

export function bumpVersion(version, level) {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (level) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid level: ${level}`);
  }
}

export function cutRelease({
  changelog,
  packageJson,
  packageLockJson,
  level,
  date
}) {
  const pkg = JSON.parse(packageJson);
  const currentVersion = pkg.version;

  const headingMatch = changelog.match(/^## \[Unreleased\].*$/m);
  if (!headingMatch) {
    throw new Error('No "## [Unreleased]" heading found');
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
  const marker = sectionContent.match(markerRegex);
  let effectiveLevel;

  if (level === 'auto') {
    if (marker) {
      effectiveLevel = marker[1];
    } else {
      const trimmed = sectionContent.replace(markerRegex, '').trim();
      if (!trimmed) {
        throw new Error(
          'No pending bump marker and no entries under [Unreleased]. Nothing to release.'
        );
      }
      throw new Error(
        'Entries found under [Unreleased] but no bump marker. Specify the level explicitly (patch, minor, or major).'
      );
    }
  } else {
    effectiveLevel = level;
  }

  sectionContent = sectionContent.replace(markerRegex, '');
  const newVersion = bumpVersion(currentVersion, effectiveLevel);
  const versionHeading = `## [${newVersion}] - ${date}`;

  const hasLinks =
    /^\[Unreleased\]:\s/m.test(changelog) ||
    /^\[\d+\.\d+\.\d+\]:\s/m.test(changelog);

  let newChangelog;
  if (hasLinks) {
    const repoUrl = 'https://github.com/maplibre/maplibre-agent-skills';
    const linkSection = changelog.match(/(\n\[Unreleased\]:[\s\S]*$)/m);
    const beforeLinks = linkSection
      ? changelog.substring(0, linkSection.index)
      : changelog;
    const unreleasedLink = `[Unreleased]: ${repoUrl}/compare/v${newVersion}...HEAD`;
    const versionLink = currentVersion
      ? `[${newVersion}]: ${repoUrl}/compare/v${currentVersion}...v${newVersion}`
      : `[${newVersion}]: ${repoUrl}/releases/tag/v${newVersion}`;
    const existingLinks = linkSection
      ? linkSection[0].replace(/^\n\[Unreleased\]:.*$/m, '').trim()
      : '';
    const links = [unreleasedLink, versionLink, existingLinks]
      .filter(Boolean)
      .join('\n');
    newChangelog = `${preamble}## [Unreleased]\n\n${versionHeading}${sectionContent}${rest}\n${links}\n`;
  } else {
    newChangelog = `${preamble}## [Unreleased]\n\n${versionHeading}${sectionContent}${rest}`;
  }

  pkg.version = newVersion;
  const newPackageJson = JSON.stringify(pkg, null, 2) + '\n';

  let newPackageLockJson = packageLockJson;
  if (packageLockJson) {
    let count = 0;
    newPackageLockJson = packageLockJson.replace(
      /"version":\s*"[^"]*"/g,
      (match) => {
        count++;
        return count <= 2 ? `"version": "${newVersion}"` : match;
      }
    );
  }

  return {
    changelog: newChangelog,
    packageJson: newPackageJson,
    packageLockJson: newPackageLockJson,
    version: newVersion
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const levelIdx = args.indexOf('--level');
  if (levelIdx === -1 || !args[levelIdx + 1]) {
    process.stderr.write(
      'Usage: cut-release.js --level <auto|patch|minor|major>\n'
    );
    process.exit(1);
  }
  const level = args[levelIdx + 1];
  const date =
    process.env.RELEASE_DATE || new Date().toISOString().slice(0, 10);

  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const packageJson = readFileSync('package.json', 'utf8');
  let packageLockJson;
  try {
    packageLockJson = readFileSync('package-lock.json', 'utf8');
  } catch {
    // no lockfile
  }

  let result;
  try {
    result = cutRelease({
      changelog,
      packageJson,
      packageLockJson,
      level,
      date
    });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  writeFileSync('CHANGELOG.md', result.changelog);
  writeFileSync('package.json', result.packageJson);
  if (result.packageLockJson) {
    writeFileSync('package-lock.json', result.packageLockJson);
  }

  process.stderr.write(
    `Updated CHANGELOG.md and package.json: ${result.version}\n`
  );

  const { updateReadme } = await import('./generate-skills-table.js');
  updateReadme();

  execSync('npx prettier --write CHANGELOG.md README.md package.json', {
    stdio: ['ignore', 'ignore', 'inherit']
  });

  setOutputs({ version: result.version });
}
