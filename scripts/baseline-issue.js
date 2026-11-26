#!/usr/bin/env node
/**
 * Reads the baseline round a scheduled run recorded and gives the publish job
 * the issue for its cut candidates: `found`, and with it a `title` and `body`.
 * A run with no round, or one whose configs all failed without their skill
 * except for their negative tests, gives `found=false`.
 *
 *   node scripts/baseline-issue.js [path/to/candidates.json]
 *
 * Env: EVAL_WORK_DIR or RUNNER_TEMP for the default path, and GITHUB_SERVER_URL,
 * GITHUB_REPOSITORY and GITHUB_RUN_ID for the run's link.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { candidatesIssue } from './lib/baselines.js';
import { setOutputs } from './lib/github-output.js';

const workDir =
  process.env.EVAL_WORK_DIR ??
  (process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, 'eval') : 'eval');
const roundPath =
  process.argv[2] ?? join(workDir, 'baseline', 'candidates.json');

let round = null;
try {
  round = JSON.parse(readFileSync(roundPath, 'utf8'));
} catch {
  console.log(`No baseline round at ${roundPath}.`);
}

const runUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
const issue = round
  ? candidatesIssue(round, { date: round.date, runUrl })
  : null;
if (issue) {
  console.log(issue.body);
  setOutputs({ found: 'true', title: issue.title, body: issue.body });
} else {
  if (round) console.log('The baseline round found no cut candidates.');
  setOutputs({ found: 'false' });
}
