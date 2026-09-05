#!/usr/bin/env node
/**
 * Turns the weekly run's own record into the two things the drift issue needs:
 * a `headline` for its title, and a `classification` block for the top of its
 * body. The triage checklist below that block stays as written — this only says
 * what happened first, so the reader is not asked to rediscover it from the log.
 *
 * A missing summary.json is itself the answer: the run was cancelled before any
 * config finished, which is exactly the 2026-08-30 failure.
 *
 *   node scripts/eval-issue.js [path/to/summary.json]
 *
 * Env: EVAL_WORK_DIR or RUNNER_TEMP for the default path; EVAL_RESULT (the eval
 * job's result), COMMIT_OUTCOME, SYNC_OUTCOME, STATUS_COMMIT_OUTCOME, and
 * SYNC_PARTIAL for the publish steps.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { classificationBlock, headlineFor } from './lib/eval-verdicts.js';
import { setOutputs } from './lib/github-output.js';

const workDir =
  process.env.EVAL_WORK_DIR ??
  (process.env.RUNNER_TEMP ? join(process.env.RUNNER_TEMP, 'eval') : 'eval');
const summaryPath = process.argv[2] ?? join(workDir, 'summary.json');

let summary = null;
try {
  summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
} catch {
  console.log(`No run summary at ${summaryPath}.`);
}

const evalResult = process.env.EVAL_RESULT ?? '';
const publish = {
  commit: process.env.COMMIT_OUTCOME ?? '',
  sync: process.env.SYNC_OUTCOME ?? '',
  statusCommit: process.env.STATUS_COMMIT_OUTCOME ?? '',
  partial: process.env.SYNC_PARTIAL === 'true'
};

const headline = headlineFor({ summary, evalResult });
const classification = classificationBlock({ summary, evalResult, publish });

console.log(classification);
setOutputs({ headline, classification });
