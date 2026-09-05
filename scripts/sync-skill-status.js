#!/usr/bin/env node
/**
 * Flips a skill's `status:` frontmatter to match the weekly drift check:
 * provisional -> verified on pass, verified -> provisional on fail.
 *
 * Reads one "skillName:pass", "skillName:fail", or "skillName:error" line per
 * skill from the file passed as argv[2] (written by scripts/run-evals.js).
 * Skills with no status field, or status: process, are left alone — this only
 * manages the provisional/verified pair, and only for skills that opted in.
 *
 * `error` means the run reached no verdict for that skill: a provider or judge
 * failure, the per-config time bound, or a run budget that ran out before the
 * config started. It never flips a status in either direction, so an unlucky
 * week cannot demote a skill and cannot promote one either. The cost is
 * deliberate: a real regression in a rate-limited week waits a week to be seen.
 *
 * A skill with an eval config but no line at all is reported as missing and
 * makes the run `partial`, so a half-finished run is never read as a clean one.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listEvalConfigs,
  missingVerdicts,
  parseVerdicts,
  skillOf
} from './lib/eval-verdicts.js';
import { setOutputs } from './lib/github-output.js';

export function syncSkillStatus({
  verdictsText,
  expectedSkills = [],
  skillsDir = 'skills'
}) {
  const verdicts = parseVerdicts(verdictsText);
  const changes = [];
  const ignored = [];

  for (const [skill, verdict] of verdicts) {
    const skillFile = join(skillsDir, skill, 'SKILL.md');

    let content;
    try {
      content = readFileSync(skillFile, 'utf8');
    } catch {
      ignored.push({ skill, reason: 'no SKILL.md found, skipping' });
      continue;
    }

    const statusMatch = content.match(/^status:\s*(\S+)/m);
    if (!statusMatch) continue; // no status field — not opted into auto-sync
    const status = statusMatch[1];
    if (status === 'process') continue; // eval-exempt, never auto-flipped

    if (verdict === 'error') {
      ignored.push({
        skill,
        reason:
          'status left as-is (infrastructure or cut-off, not a graded result)'
      });
      continue;
    }

    let next = null;
    if (status === 'provisional' && verdict === 'pass') next = 'verified';
    if (status === 'verified' && verdict === 'fail') next = 'provisional';
    if (!next) continue;

    writeFileSync(
      skillFile,
      content.replace(/^status:\s*\S+/m, `status: ${next}`)
    );
    changes.push(`${skill}: ${status} -> ${next}`);
  }

  return {
    changes,
    ignored,
    missing: missingVerdicts(verdicts, expectedSkills)
  };
}

/** Let the workflow open a report issue on the changes, and see a partial run. */
export function outputsFor({ changes, missing }) {
  return {
    changed: String(changes.length > 0),
    partial: String(missing.length > 0),
    ...(changes.length > 0 ? { summary: changes.join('\n') } : {})
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const verdictsPath = process.argv[2];
  if (!verdictsPath) {
    console.error('Usage: node scripts/sync-skill-status.js <verdicts-file>');
    process.exit(1);
  }

  let result;
  try {
    result = syncSkillStatus({
      verdictsText: readFileSync(verdictsPath, 'utf8'),
      expectedSkills: listEvalConfigs().map(skillOf)
    });
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  for (const change of result.changes) console.log(change);
  for (const { skill, reason } of result.ignored) {
    console.log(`⚠️  ${skill}: ${reason}`);
  }
  for (const skill of result.missing) {
    console.log(
      `::warning::${skill}: no verdict in this run, so its status was not checked.`
    );
  }

  console.log(
    result.changes.length > 0
      ? `\n${result.changes.length} skill(s) updated.`
      : '\nNo status changes.'
  );

  setOutputs(outputsFor(result));
}
