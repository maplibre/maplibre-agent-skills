/**
 * The vocabulary the weekly eval run reports in: `pass`, `fail`, and `error`.
 *
 * `pass` and `fail` are the author's original pair and keep their meaning — a
 * graded verdict on skill content. `error` is new and means "no verdict": the
 * provider, the judge, or the run's own time bound stopped the config before it
 * could answer. Only `pass` and `fail` ever move a skill's `status:` field.
 *
 * The shapes read here are those of the installed promptfoo 0.122.0:
 *
 *   - `promptfoo eval --output x.json` writes
 *     `{ evalId, results: <EvaluateSummary>, config, shareableUrl, metadata }`
 *     — `createOutputData` in node_modules/promptfoo/dist/src/util-BA1y4Bfi.js:3797,
 *     via `writeJsonOutputSafely` (same file, :3856) from `writeOutput` (:3872).
 *   - That `results` value is the version-3 summary
 *     `{ version: 3, timestamp, prompts, results: [...], stats }` —
 *     `Eval.toEvaluateSummary` in node_modules/promptfoo/dist/src/eval-CMF40G1V.js:1380,
 *     with `stats` from `getStats` (same file, :1362): `successes`, `failures`,
 *     `errors`, `tokenUsage`, `durationMs`.
 *   - Each row carries `error` and `failureReason` —
 *     `EvalResult.toEvaluateResult` in
 *     node_modules/promptfoo/dist/src/evalResult-Dnh5pjl7.js:1041.
 *   - `ResultFailureReason` is `{ NONE: 0, ASSERT: 1, ERROR: 2 }` —
 *     node_modules/promptfoo/dist/src/tables-DxaDlQbd.js:3566.
 *
 * So the rows are at `sidecar.results.results`, not at `sidecar.results`. Any
 * other shape throws: a classifier that guessed would report a green week it
 * never checked.
 */
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const NONE = 0;
const ASSERT = 1;
const ERROR = 2;

// Signatures a config's verdict can carry. The first four come from the failure
// text in the run log of 2026-08-30; the last three are the runner's own.
const CUT_OFF_SIGNATURES = new Set(['max-duration', 'not-run', 'killed']);

/** Every skill's eval config, sorted, template excluded. */
export function listEvalConfigs(dir = 'evals/prompts') {
  // Globbing rather than a hardcoded list: a new skill is covered the moment
  // its config lands.
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml') && name !== 'TEMPLATE.yaml')
    .sort()
    .map((name) => join(dir, name));
}

/** `evals/prompts/maplibre-cartography.yaml` -> `maplibre-cartography`. */
export function skillOf(configPath) {
  return basename(configPath, '.yaml');
}

/** The dated prefix every output file of one run shares. */
export function runName(date, baseline) {
  return baseline ? `baseline-${date}` : String(date);
}

/**
 * Names the cause behind an ERROR row, so the issue can say what happened
 * instead of listing what to rule out. The names carry no provider: promptfoo
 * raises RateLimitExhaustedError for the generator and the judge alike, and the
 * row's message still names which one. Order matters: that message contains
 * the bare "Rate limit exceeded" phrase too, so it is matched first.
 */
export function signatureOf(message) {
  const text = String(message ?? '');
  if (/Evaluation exceeded max duration/.test(text)) return 'max-duration';
  if (/RateLimitExhaustedError/.test(text)) return 'rate-limit-exhausted';
  if (/timed out after \d+ms in queue/.test(text)) {
    return 'queue-timeout';
  }
  if (/\b429\b/.test(text) || /Rate limit exceeded/.test(text)) {
    return 'rate-limit';
  }
  return 'other';
}

/**
 * One config's verdict, read from its JSON sidecar.
 *
 * Any ERROR row makes the whole config an `error`, even alongside a genuine
 * assertion failure: a run that was rate-limited has not graded the content, so
 * it gets no say over a skill's status. That is deliberately conservative — a
 * real regression in a rate-limited week waits a week to be seen.
 */
export function classifyEval(sidecar) {
  const summary = sidecar?.results;
  const rows = summary?.results;
  if (!Array.isArray(rows)) {
    throw new Error(
      'Unexpected promptfoo output: no results array at results.results'
    );
  }
  if (rows.length === 0) {
    throw new Error('Unexpected promptfoo output: no results rows');
  }

  const counts = { pass: 0, fail: 0, error: 0 };
  const errors = [];
  const signatures = [];

  for (const [index, row] of rows.entries()) {
    const reason = row?.failureReason;
    if (reason !== NONE && reason !== ASSERT && reason !== ERROR) {
      throw new Error(
        `Unexpected promptfoo output: failureReason ${JSON.stringify(reason)} on row ${index}`
      );
    }
    if (reason === NONE) counts.pass++;
    if (reason === ASSERT) counts.fail++;
    if (reason === ERROR) {
      counts.error++;
      const message = row.error ?? '';
      const signature = signatureOf(message);
      if (!signatures.includes(signature)) signatures.push(signature);
      errors.push({
        description: row.description ?? `test ${row.testIdx ?? index}`,
        signature,
        message
      });
    }
  }

  let verdict = 'pass';
  if (counts.fail > 0) verdict = 'fail';
  if (counts.error > 0) verdict = 'error';

  return {
    verdict,
    counts,
    total: rows.length,
    errors,
    signatures,
    tokenUsage: summary.stats?.tokenUsage ?? null
  };
}

/**
 * The verdicts file, strictly. A line that does not parse is a bug in whoever
 * wrote it, so it stops the sync rather than being skipped: a silently dropped
 * line reads as "no verdict for that skill" and looks like a clean week.
 */
export function parseVerdicts(text) {
  const verdicts = new Map();
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^([^:\s]+):(pass|fail|error)$/.exec(line);
    if (!match) throw new Error(`Unparseable verdict line: "${line}"`);
    verdicts.set(match[1], match[2]);
  }
  return verdicts;
}

/** Expected skills with no line of their own — the run did not reach them. */
export function missingVerdicts(verdicts, expected) {
  return expected.filter((skill) => !verdicts.has(skill));
}

function isCutOff(config) {
  return (config.signatures ?? []).some((s) => CUT_OFF_SIGNATURES.has(s));
}

/**
 * One phrase for what this run was. Read from the run's own record, so it says
 * what happened rather than asking the reader to guess between infrastructure,
 * noise, and drift.
 */
export function headlineFor({ summary, evalResult }) {
  if (!summary) return 'cancelled before results';
  const configs = summary.configs ?? [];
  const planned = summary.planned ?? [];
  const failed = configs.some((c) => c.verdict === 'fail');
  const errored = configs.some((c) => c.verdict === 'error');
  const cutOff = configs.some(isCutOff) || configs.length < planned.length;

  if (failed && errored) return 'mixed';
  if (failed) return 'graded failure';
  // The job itself was stopped — the backstop, or a person — so what the
  // per-config bound did is beside the point.
  if (evalResult === 'cancelled') return 'cancelled before finishing';
  if (cutOff) return 'cut off by the time bound';
  // Everything recorded either passed or errored, and the job still did not
  // succeed: whatever went wrong was not a graded verdict on skill content.
  return evalResult === 'success' ? 'graded failure' : 'infrastructure';
}

function thousands(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function publishLines(publish = {}) {
  const commit =
    publish.commit === 'success'
      ? 'committed'
      : publish.commit === 'failure'
        ? 'not committed: push rejected or the commit step failed'
        : 'did not run';
  const sync =
    publish.sync === 'success'
      ? publish.partial === true || publish.partial === 'true'
        ? 'ran (partial: at least one skill had no verdict)'
        : 'ran'
      : publish.sync === 'failure'
        ? 'failed'
        : 'did not run';
  const statusCommit =
    publish.statusCommit === 'success'
      ? 'committed'
      : publish.statusCommit === 'failure'
        ? 'not committed: push rejected or the commit step failed'
        : 'did not run';
  return [
    `- Results CSVs: ${commit}.`,
    `- Status sync: ${sync}.`,
    `- Status commit: ${statusCommit}.`
  ];
}

/** The markdown that heads the drift issue: the verdict, then the evidence. */
export function classificationBlock({ summary, evalResult, publish }) {
  const headline = headlineFor({ summary, evalResult });
  const lines = [
    `**Classification: ${headline}.** The \`eval\` job finished with result \`${evalResult || 'unknown'}\`.`,
    ''
  ];

  if (!summary) {
    lines.push(
      'No summary.json reached the publish job, so no config finished and no verdict exists for any skill.',
      ''
    );
  } else {
    const configs = summary.configs ?? [];
    const planned = summary.planned ?? [];
    const bySkill = new Map(configs.map((c) => [c.skill, c]));
    lines.push('| Skill | Verdict | Signals |', '| --- | --- | --- |');
    for (const skill of planned.length > 0
      ? planned
      : configs.map((c) => c.skill)) {
      const config = bySkill.get(skill);
      const verdict = config?.verdict ?? 'not recorded';
      const signals = config?.signatures?.length
        ? config.signatures.join(', ')
        : '—';
      lines.push(`| ${skill} | ${verdict} | ${signals} |`);
    }
    const tokens = configs.reduce(
      (total, c) => total + (c.tokenUsage?.total ?? 0),
      0
    );
    lines.push(
      '',
      `${configs.length} of ${planned.length} planned configs recorded${
        tokens > 0 ? `, ${thousands(tokens)} tokens used` : ''
      }.`,
      ''
    );
  }

  lines.push(
    ...publishLines(publish),
    '',
    "An `error` verdict is not a graded result, so it never changes a skill's `status:` field — see `scripts/sync-skill-status.js`."
  );
  return lines.join('\n');
}
