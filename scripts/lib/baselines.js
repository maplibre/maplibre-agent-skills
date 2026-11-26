/**
 * The baseline round a change of the generator pin starts.
 *
 * A config's baseline evidence, that each of its tests fails without the
 * skill, holds only for the generator that produced it. A scheduled run records
 * each baseline it grades in `evals/results/baseline-<date>.json`, with the
 * generator's id. A config with no such record keeps the evidence its results
 * doc cites, which predates those records and is taken to come from the
 * generator of the earliest run record that names one. A config whose evidence
 * came from a generator other than the pinned one is due for a baseline, which
 * a scheduled run grades with what its day has left. Every test that passes
 * without the skill, other than a negative test, is then a cut candidate.
 *
 * The publish job runs scripts/baseline-issue.js from this file, and it
 * installs no packages, so nothing here imports one.
 */
import { skillOf } from './eval-verdicts.js';

const BASELINE_RECORD = /^baseline-(\d{4}-\d{2}-\d{2})\.json$/;
const RUN_RECORD = /^(\d{4}-\d{2}-\d{2})\.json$/;

// promptfoo's ResultFailureReason.NONE: the row passed every assertion.
const PASSED = 0;

function parsed(read, fileName) {
  try {
    return JSON.parse(read(fileName));
  } catch {
    return null;
  }
}

/**
 * For each skill, the date and generator of its newest recorded baseline.
 * `fileNames` lists evals/results/, and `read(fileName)` returns one file.
 */
export function baselineRecords(fileNames, read) {
  const records = new Map();
  const dated = fileNames
    .map((fileName) => [fileName, BASELINE_RECORD.exec(fileName)?.[1]])
    .filter(([, date]) => date)
    .sort(([, a], [, b]) => a.localeCompare(b));
  for (const [fileName, date] of dated) {
    const record = parsed(read, fileName);
    if (!record?.generator) continue;
    for (const skill of Object.keys(record.configs ?? {})) {
      records.set(skill, { date, generator: record.generator });
    }
  }
  return records;
}

/** The generator of the earliest run record that names one, or null. */
export function firstRecordedGenerator(fileNames, read) {
  const dated = fileNames.filter((fileName) => RUN_RECORD.test(fileName));
  for (const fileName of dated.sort()) {
    const generator = parsed(read, fileName)?.generator;
    if (generator) return generator;
  }
  return null;
}

/**
 * Which configs need a baseline under `generator`: each whose newest recorded
 * baseline ran under another generator, or, with none recorded, whose evidence
 * came from `fallback`. With nothing to compare, nothing is due.
 */
export function planBaselines({ configs, records, fallback, generator }) {
  const due = [];
  const later = [];
  for (const config of configs) {
    const record = records.get(skillOf(config)) ?? null;
    const evidence = record?.generator ?? fallback;
    const source = record
      ? `its ${record.date} baseline`
      : 'the baseline its results doc cites';
    if (!generator || !evidence) {
      later.push({ config, why: 'no generator recorded to compare with' });
    } else if (evidence === generator) {
      later.push({ config, why: `${source} ran under ${generator}` });
    } else {
      due.push({
        config,
        why: `${source} ran under ${evidence}, and the pin is now ${generator}`
      });
    }
  }
  return { due, later };
}

/**
 * The tests a baseline config passed without its skill, from its promptfoo
 * JSON, other than the negative tests, which are meant to pass. Each test's
 * description opens with its type. Null when the JSON has no result rows.
 */
export function cutCandidates(sidecarText) {
  let rows;
  try {
    rows = JSON.parse(sidecarText)?.results?.results;
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  return rows
    .filter((row) => row?.failureReason === PASSED)
    .map(
      (row) =>
        row.testCase?.description ?? row.description ?? `test ${row.testIdx}`
    )
    .filter((description) => !/^negative\b/i.test(description));
}

/**
 * The issue for a baseline round's cut candidates, or null when it found none.
 * `round` is the runner's record: the generator, and each graded config with
 * its candidates.
 */
export function candidatesIssue(round, { date, runUrl }) {
  const found = (round?.configs ?? []).filter(
    (config) => config.candidates?.length > 0
  );
  if (found.length === 0) return null;
  const lines = [
    `The baseline round under \`${round.generator}\` found tests that pass with the skill withheld. The generator now gets these right on its own, so the content each one checks is a cut candidate.`,
    ''
  ];
  for (const { skill, candidates } of found) {
    lines.push(`**${skill}**`, '');
    for (const description of candidates) lines.push(`- ${description}`);
    lines.push('');
  }
  lines.push(
    `[Workflow run](${runUrl}). The baseline CSVs are \`evals/results/baseline-${date}-<skill>.csv\`.`,
    '',
    "For each candidate, read the answer before cutting anything: the judge may have passed a wrong answer. Then cut the content the test checks, or keep it with the reason, in a PR that updates the baseline cell of that skill's results doc."
  );
  return {
    title: `Baseline round: tests that pass without the skill — ${date}`,
    body: lines.join('\n')
  };
}
