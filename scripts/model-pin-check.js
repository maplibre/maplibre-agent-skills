#!/usr/bin/env node
/**
 * Scans tracked files for provider-id-shaped strings and fails on any that isn't one
 * of the two pinned models. Reads the pins from their source of truth —
 * evals/prompts/lib/providers.yaml (generator) and the `eval:graded` script in
 * package.json (judge) — so rotating a pin there is the only edit; this script
 * just finds what didn't get updated to match.
 *
 * The results docs (the `.md` files under evals/results/) are checked too, and
 * may name an earlier model in a sentence that gives a date, as a `Run:` line
 * dates the run that model graded. The CSVs and run records beside them are
 * raw output, where an old id is data, so they are not checked.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXCLUDED_PATHS = [/^evals\/results\/.*(?<!\.md)$/, /^CHANGELOG\.md$/];
const RESULTS_DOC = /^evals\/results\/.*\.md$/;
const DATE = /20\d\d-\d\d-\d\d/;

const PROVIDER_PREFIXES = [
  'cerebras',
  'google',
  'openai',
  'anthropic',
  'groq',
  'ollama',
  'openrouter',
  'azure',
  'mistral',
  'cohere',
  'replicate',
  'huggingface',
  'bedrock',
  'vertex',
  'deepseek',
  'together',
  'xai',
  'perplexity'
];
const ID_PATTERN = new RegExp(
  `\\b(?:${PROVIDER_PREFIXES.join('|')}):[a-zA-Z0-9._/-]+`,
  'g'
);

/** Whether the check reads a tracked file at all. */
export function isChecked(file) {
  return !EXCLUDED_PATHS.some((pattern) => pattern.test(file));
}

/**
 * Each provider id in a file's `content` that is not one of the `pins`, with
 * its line number. In a results doc the date has to be in the id's own
 * sentence: a header that names the current pins and then dates an earlier
 * run on the same line still has an undated claim about the pins.
 */
export function staleIds(file, content, pins) {
  const resultsDoc = RESULTS_DOC.test(file);
  const stale = [];
  content.split('\n').forEach((text, index) => {
    const parts = resultsDoc ? text.split(/(?<=[.!?])\s+/) : [text];
    for (const part of parts) {
      if (resultsDoc && DATE.test(part)) continue;
      for (const [id] of part.matchAll(ID_PATTERN)) {
        if (!pins.has(id)) stale.push({ line: index + 1, id });
      }
    }
  });
  return stale;
}

function main() {
  const providersFileContent = readFileSync(
    'evals/prompts/lib/providers.yaml',
    'utf8'
  );
  const generatorMatch = providersFileContent.match(/^id:\s*(\S+)/m);
  if (!generatorMatch) {
    console.error(
      '❌ Could not find a top-level "id:" field in evals/prompts/lib/providers.yaml'
    );
    process.exit(1);
  }
  const generatorPin = generatorMatch[1];

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const graderMatch =
    packageJson.scripts?.['eval:graded']?.match(/--grader\s+(\S+)/);
  if (!graderMatch) {
    console.error(
      '❌ Could not find "--grader <id>" in the eval:graded script in package.json'
    );
    process.exit(1);
  }
  const judgePin = graderMatch[1];

  const pinnedIds = new Set([generatorPin, judgePin]);

  const trackedFiles = execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter(isChecked);

  let errors = 0;
  let inResultsDoc = false;

  for (const file of trackedFiles) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue; // binary or unreadable — not a doc mention
    }

    for (const { line, id } of staleIds(file, content, pinnedIds)) {
      console.error(`${file}:${line}: stale provider id "${id}"`);
      errors++;
      inResultsDoc ||= RESULTS_DOC.test(file);
    }
  }

  if (errors > 0) {
    console.error(
      `\n${errors} stale provider id(s). Pinned: ${[...pinnedIds].join(', ')}.`
    );
    if (inResultsDoc) {
      console.error(
        'A results doc may name an earlier model only in a sentence that gives the date of its run.'
      );
    }
    process.exit(1);
  }

  console.log(
    `✅ All provider ids match the pins (${[...pinnedIds].join(', ')})`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
