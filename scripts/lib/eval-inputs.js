/**
 * What an eval config's grade depends on, hashed so a run can tell whether it
 * has changed since the config was last graded.
 *
 * Three inputs reach a grade: the skill text the generator gets as its system
 * prompt, the config's tests and rubrics, and the harness every config shares
 * (the prompt and provider files in evals/prompts/lib, the `eval:graded`
 * command that pins the judge, and the promptfoo release that renders each
 * request and grades each answer). With the generator and the judge pinned,
 * grading a config again on the same three only repeats the same measurement.
 *
 * A release of a library a skill describes changes none of the three, so it
 * cannot change a grade; the release watch (.github/release-watch/watch.yml)
 * checks releases against the skills.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { withStatus } from './frontmatter.js';

// Each input a run records, as the run log names it.
export const INPUTS = {
  skill: 'SKILL.md',
  config: 'eval config',
  harness: 'harness'
};

function hash(...parts) {
  const sha = createHash('sha256');
  for (const part of parts) sha.update(`${part}\0`);
  return sha.digest('hex').slice(0, 16);
}

/** The skill files a config's tests put in the system prompt, sorted. */
export function skillFiles(configText) {
  const config = load(configText);
  const files = new Set();
  for (const vars of [
    config?.defaultTest?.vars,
    ...(config?.tests ?? []).map((test) => test?.vars)
  ]) {
    if (typeof vars?.skillFile === 'string') files.add(vars.skillFile);
  }
  return [...files].sort();
}

/**
 * The skill files a config names that do not exist under `root`: a new
 * skill's rubric round, whose tests are written and run at baseline before the
 * skill is (CONTRIBUTING.md, "Write a new skill"). Such a config has nothing
 * to grade until the file exists.
 */
export function missingSkillFiles(config, { root = '.' } = {}) {
  const text = readFileSync(join(root, config), 'utf8');
  return skillFiles(text).filter((file) => !existsSync(join(root, file)));
}

// What a skill not written yet hashes as, so the hash changes when it appears.
const NOT_WRITTEN = '(no SKILL.md yet)';

/**
 * The hash of what every config is graded with: each file in
 * evals/prompts/lib, the `eval:graded` command, and the promptfoo version the
 * lockfile pins.
 */
export function harnessOf(root = '.') {
  const lib = join(root, 'evals/prompts/lib');
  const files = readdirSync(lib, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
    .map((name) => `${name}\n${readFileSync(join(lib, name), 'utf8')}`);
  const read = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
  const command = read('package.json').scripts?.['eval:graded'] ?? '';
  const promptfoo =
    read('package-lock.json').packages?.['node_modules/promptfoo']?.version ??
    '';
  return hash(...files, command, promptfoo);
}

/**
 * One hash per input of a config's grade, keyed as INPUTS is. A skill's
 * `metadata.status` is left out: the status sync writes it from the grade, so
 * it cannot be a reason to grade again. A skill not written yet hashes as
 * absent, so the config is due the day the file appears.
 */
export function inputsOf(config, { root = '.', harness }) {
  const text = readFileSync(join(root, config), 'utf8');
  const skills = skillFiles(text).map((file) => {
    let body;
    try {
      body = withStatus(readFileSync(join(root, file), 'utf8'), '');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      body = NOT_WRITTEN;
    }
    return `${file}\n${body}`;
  });
  return { skill: hash(...skills), config: hash(text), harness };
}

/**
 * The inputs each skill's last graded run recorded, read with
 * `readRecord(date)`; null for a skill whose run recorded none.
 */
export function recordedInputs(graded, readRecord) {
  const recorded = new Map();
  for (const [skill, date] of graded) {
    let record = null;
    try {
      record = readRecord(date);
    } catch {
      // A run from before runs recorded their inputs.
    }
    recorded.set(skill, record?.configs?.[skill]?.inputs ?? null);
  }
  return recorded;
}

/** The inputs that differ between two records, by the names INPUTS gives. */
export function changedInputs(now, then) {
  return Object.keys(INPUTS)
    .filter((key) => now?.[key] !== then?.[key])
    .map((key) => INPUTS[key]);
}
