#!/usr/bin/env node
/**
 * Runs each eval config that is due in its own bounded `npm run eval:graded`
 * child and records its `pass`, `fail` or `error` verdict in the work dir as
 * soon as it has one, for the publish job. Configs named on the command line
 * or in INPUT_CONFIGS, or a `--shard` slice, run whether due or not.
 *
 * Configs run with their skill injected, and a second child may re-run the
 * tests a config's first child did not pass, RETRY_REPEATS more times. Only
 * `--baseline` or INPUT_BASELINE=true starts a baseline run instead: it
 * withholds the skill from every config, keeps configs whose SKILL.md is not
 * written yet, and never re-runs a test.
 *
 * evals/README.md ("CI") says how a run plans its day, paces requests, re-runs
 * failures, bounds each child and ends on a provider's daily limit.
 *
 *   node scripts/run-evals.js --dry-run
 *   node scripts/run-evals.js evals/prompts/maplibre-cartography.yaml
 *
 * Exit status is 1 when a config failed, or errored for any reason but its
 * day ending, and when no config got a verdict.
 *
 * Flags:
 *   --baseline           withhold the skill (--var injectSkill=false)
 *   --dry-run            print the commands and the bounds; run nothing
 *   --shard <k/n>        run the k-th of n contiguous slices of the discovered configs
 *   --results-dir <d>    where the dated CSVs go (default evals/results)
 *   --work-dir <d>       where the sidecars, verdicts, and summary go
 *   --config-dir <d>     where the eval configs live (default evals/prompts)
 *
 * Env: EVAL_BUDGET_MINUTES, EVAL_WORK_DIR, EVAL_TOKENS_PER_DAY,
 * EVAL_REGRADE_DAYS, EVAL_SHARD, INPUT_CONFIGS, INPUT_BASELINE, GROQ_API_KEY.
 * The workflow sets the budget and the plan's settings in YAML so they are
 * visible and tunable there; the defaults here match, except that a run with
 * no EVAL_REGRADE_DAYS grades only what changed.
 */
import { execFileSync, spawn as spawnChild } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { constants as osConstants, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyEval,
  isSafeCliPath,
  isSafeConfigPath,
  listEvalConfigs,
  runName,
  skillOf,
  waitsLine
} from './lib/eval-verdicts.js';
import { setOutputs } from './lib/github-output.js';
import { countTokens, limitsFrom } from '../evals/prompts/lib/request-size.mjs';
import {
  changedInputs,
  harnessOf,
  inputsOf,
  missingSkillFiles,
  recordedInputs
} from './lib/eval-inputs.js';
import { passCost, sizeConfig } from './lib/prompt-budget.js';
import { lastGraded } from './lib/results-history.js';

const BUDGET_MINUTES_DEFAULT = 240;

// The Groq key's daily tokens: its free tier's limit, which no header reports.
const TOKENS_PER_DAY_DEFAULT = 200000;

// How many more times a test that did not pass runs. A failure stands
// whatever the re-runs say.
export const RETRY_REPEATS = 2;

// More tests down than this in one config is not noise, so none is re-run.
export const MAX_RETRIED_TESTS = 2;

// A shorter bound yields only ERROR rows: promptfoo's queue timeout is 300 s.
const MIN_CONFIG_MS = 5 * 60000;

// How far past its soft bound a child is killed: the kill loses the config's
// CSV, so it comes well after the bound rather than on it.
const KILL_GRACE_MS = 10 * 60000;

// How long a child's process group gets to exit on SIGTERM before SIGKILL.
export const SIGKILL_AFTER_MS = 30 * 1000;

// While a child runs, any of these makes the runner SIGKILL the child's
// group, which Ctrl-C alone would not reach because the child is `detached`.
const ABORT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

export function parseArgs(argv) {
  const args = { baseline: false, dryRun: false, configs: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--baseline') args.baseline = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--shard') args.shard = argv[++i];
    else if (arg === '--results-dir') args.resultsDir = argv[++i];
    else if (arg === '--work-dir') args.workDir = argv[++i];
    else if (arg === '--config-dir') args.configDir = argv[++i];
    else if (arg.startsWith('--')) {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    } else args.configs.push(arg);
  }
  return args;
}

/** Parses `k/n` into a 1-based `{ index, count }`; throws on anything else. */
export function parseShard(value) {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(value ?? '');
  if (!match) {
    throw new Error(
      `Not a shard: ${JSON.stringify(value)}. Expected k/n with 1 <= k <= n, e.g. 1/2.`
    );
  }
  const index = Number(match[1]);
  const count = Number(match[2]);
  if (index > count) {
    throw new Error(
      `Not a shard: ${value}. The slice index exceeds the slice count.`
    );
  }
  return { index, count };
}

/** The k-th of n contiguous slices, earlier slices taking the remainder. */
export function shardOf(configs, { index, count }) {
  const base = Math.floor(configs.length / count);
  const extra = configs.length % count;
  const start = (index - 1) * base + Math.min(index - 1, extra);
  const size = base + (index - 1 < extra ? 1 : 0);
  return configs.slice(start, start + size);
}

/**
 * The `npm run eval:graded` call for one config. Never combine configs into
 * one invocation: promptfoo merges their defaultTest blocks, so every test
 * would get the last config's skill. `delayMs` follows the script's own
 * `--delay`, since promptfoo keeps the last one.
 */
export function buildCommand({
  config,
  name,
  resultsDir,
  workDir,
  baseline = false,
  retryOf = null,
  delayMs = null
}) {
  const skill = skillOf(config);
  const stem = `${name}-${skill}${retryOf === null ? '' : '-retry'}`;
  const csvPath = join(resultsDir, `${stem}.csv`);
  const jsonPath = join(workDir, `${stem}.json`);
  // `npm run` hands these args to a shell; checking here covers every caller.
  if (!isSafeCliPath(config)) {
    throw new Error(
      `Refusing to build a command with an unusable config path: ${JSON.stringify(config)}`
    );
  }
  if (retryOf !== null && !isSafeCliPath(retryOf)) {
    throw new Error(
      `Refusing to build a command with an unusable sidecar path: ${JSON.stringify(retryOf)}`
    );
  }
  if (!isSafeCliPath(csvPath)) {
    throw new Error(
      `Refusing to build a command with an unusable output path: ${JSON.stringify(csvPath)}`
    );
  }
  if (!isSafeCliPath(jsonPath)) {
    throw new Error(
      `Refusing to build a command with an unusable output path: ${JSON.stringify(jsonPath)}`
    );
  }
  return {
    command: 'npm',
    args: [
      'run',
      'eval:graded',
      '--',
      '--config',
      config,
      ...(baseline ? ['--var', 'injectSkill=false'] : []),
      ...(retryOf === null
        ? []
        : ['--filter-failing', retryOf, '--repeat', String(RETRY_REPEATS)]),
      ...(delayMs === null ? [] : ['--delay', String(delayMs)]),
      '--output',
      csvPath,
      jsonPath
    ]
  };
}

/** A child's environment: its time bound, its log dir and retries on a 5xx. */
export function childEnv({ boundMs, env = process.env, logDir = null }) {
  return {
    ...env,
    PROMPTFOO_MAX_EVAL_TIME_MS: String(boundMs),
    PROMPTFOO_RETRY_5XX: 'true',
    ...(logDir === null ? {} : { PROMPTFOO_LOG_DIR: logDir })
  };
}

/** Limit and usage from the last tokens-per-day refusal in `text`, or null. */
export function dayRefusal(text) {
  const all = [
    ...String(text ?? '').matchAll(
      /tokens per day \(TPD\): Limit (\d+), Used (\d+)/g
    )
  ];
  if (all.length === 0) return null;
  const [, limit, used] = all.at(-1);
  return { tokensPerDay: Number(limit), used: Number(used) };
}

/** The rate-limit waits a debug log records: count and total ms by host. */
export function rateLimitWaits(text) {
  const waits = new Map();
  let host = 'unknown host';
  for (const line of String(text ?? '').split('\n')) {
    const url = /Rate limited on URL (\S+): HTTP/.exec(line);
    if (url) {
      try {
        host = new URL(url[1]).host;
      } catch {
        host = 'unknown host';
      }
      continue;
    }
    const wait = /Rate limited, waiting (\d+)ms/.exec(line);
    if (!wait) continue;
    const total = waits.get(host) ?? { count: 0, ms: 0 };
    waits.set(host, { count: total.count + 1, ms: total.ms + Number(wait[1]) });
  }
  return [...waits].map(([name, total]) => ({ host: name, ...total }));
}

/** Every promptfoo debug log a child left in `dir`, as one text. */
function readDebugLogs(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => /^promptfoo-debug-.*\.log$/.test(name))
      .map((name) => readFileSync(join(dir, name), 'utf8'))
      .join('\n');
  } catch {
    return '';
  }
}

const GROQ_CHAT = 'https://api.groq.com/openai/v1/chat/completions';
const PROBE = [
  { role: 'system', content: 'x' },
  { role: 'user', content: 'y' }
];

/** One minimal request to the pinned Groq model, or null when none can be made. */
async function probe({ pin, apiKey, fetch }) {
  if (!pin?.startsWith('groq:') || !apiKey) return null;
  try {
    return await fetch(GROQ_CHAT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: pin.slice('groq:'.length),
        messages: PROBE,
        max_completion_tokens: 1,
        temperature: 0
      })
    });
  } catch {
    return null;
  }
}

/**
 * Groq's tokens per minute and chat template size, measured with one minimal
 * request; null when the pin is not a Groq model or nothing usable comes back.
 */
export async function measureLimits({
  pin,
  apiKey,
  fetch = globalThis.fetch,
  count = countTokens
}) {
  const response = await probe({ pin, apiKey, fetch });
  if (!response?.ok) return null;
  try {
    const tokensPerMinute = Number(
      response.headers.get('x-ratelimit-limit-tokens')
    );
    const usage = (await response.json())?.usage;
    const templateTokens =
      usage?.prompt_tokens -
      PROBE.reduce((total, message) => total + count(message.content), 0);
    if (!(tokensPerMinute > 0) || !(templateTokens >= 0)) return null;
    return { tokensPerMinute, templateTokens };
  } catch {
    return null;
  }
}

/** Groq's refusal of a minimal request for tokens per day, or null. */
export async function daySpent({ pin, apiKey, fetch = globalThis.fetch }) {
  const response = await probe({ pin, apiKey, fetch });
  if (response?.status !== 429) return null;
  try {
    return dayRefusal(await response.text());
  } catch {
    return null;
  }
}

/** The pinned judge: the `--grader` of the `eval:graded` script. */
export function judgePin(packageJson) {
  return (
    /--grader\s+(\S+)/.exec(packageJson?.scripts?.['eval:graded'] ?? '')?.[1] ??
    null
  );
}

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';
export const GEMINI_HOST = new URL(GEMINI).host;

/**
 * The per-day quota a Google 429 body's `google.rpc.QuotaFailure` names, with
 * its limit and model, or null.
 */
export function judgeRefusal(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  for (const detail of body?.error?.details ?? []) {
    if (!String(detail?.['@type']).endsWith('google.rpc.QuotaFailure')) {
      continue;
    }
    for (const violation of detail.violations ?? []) {
      if (!/PerDay/.test(violation?.quotaId ?? '')) continue;
      const limit = Number(violation.quotaValue);
      return {
        quotaId: violation.quotaId,
        limit: Number.isFinite(limit) ? limit : null,
        model: violation.quotaDimensions?.model ?? null
      };
    }
  }
  return null;
}

/**
 * Google's refusal of one minimal request to the judge for a per-day quota, or
 * null. A request that goes through spends one of the judge's daily requests.
 */
export async function judgeDaySpent({
  pin,
  apiKey,
  fetch = globalThis.fetch,
  log = () => {}
}) {
  if (!pin?.startsWith('google:') || !apiKey) return null;
  try {
    const model = encodeURIComponent(pin.slice('google:'.length));
    const response = await fetch(`${GEMINI}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'x' }] }],
        generationConfig: { maxOutputTokens: 1 }
      })
    });
    if (response?.status === 200) return null;
    const text = await response.text();
    const said = response.status === 429 ? judgeRefusal(text) : null;
    // Any other answer goes to the run log in Google's words.
    if (!said) {
      log(
        `  Google answered the judge's probe with ${response.status}, not a daily quota: ${googleMessage(text)}`
      );
    }
    return said;
  } catch {
    return null;
  }
}

/** The `error.message` of a Google error body, or the body's start. */
function googleMessage(text) {
  try {
    const message = JSON.parse(text)?.error?.message;
    if (message) return String(message).slice(0, 500);
  } catch {
    // Not JSON: the body itself.
  }
  return String(text ?? '').slice(0, 500);
}

/** Request spacing that keeps a config under Groq's per-minute limit. */
export function paceMs({ largest, tokensPerMinute }) {
  return Math.ceil((60000 * largest) / tokensPerMinute);
}

/**
 * The least time the configs in `rest` need at their pace, counting only those
 * that `tokensLeft` holds when taken as `runEvals` takes them.
 */
export function reserveAfter({ rest, costs, tokensLeft, tokensPerMinute }) {
  let reserve = 0;
  for (const config of rest) {
    const cost = costs?.get(config);
    if (!cost) continue;
    const need = dayCost(cost);
    if (need > tokensLeft) continue;
    tokensLeft -= need;
    reserve +=
      cost.requests * paceMs({ largest: cost.largest, tokensPerMinute });
  }
  return reserve;
}

/** What the run's budget has left for this config after `reserveMs`. */
export function boundFor({ elapsedMs, budgetMs, reserveMs = 0 }) {
  const remaining = budgetMs - elapsedMs - reserveMs;
  if (remaining < MIN_CONFIG_MS) return { skip: true, boundMs: 0 };
  return { skip: false, boundMs: remaining };
}

/**
 * One config's verdict from what its child left. A missing or unreadable
 * sidecar is an `error`, never a pass or a fail, and a killed config is an
 * `error` that keeps its sidecar's signatures, with `killed` added.
 */
export function verdictFor({
  exitCode = null,
  killed = false,
  sidecarText = null
}) {
  const base = { counts: null, total: 0, errors: [], tokenUsage: null };
  const killedBlind = (why) => ({
    ...base,
    verdict: 'error',
    signatures: ['killed'],
    reason: `killed after the hard timeout; ${why}`
  });

  if (sidecarText === null || sidecarText === undefined) {
    if (killed) return killedBlind('promptfoo wrote no output');
    return {
      ...base,
      verdict: 'error',
      signatures: ['no-output'],
      reason: `no JSON output was written (exit ${exitCode})`
    };
  }
  let sidecar;
  try {
    sidecar = JSON.parse(sidecarText);
  } catch (error) {
    if (killed)
      return killedBlind(
        `the JSON output could not be parsed: ${error.message}`
      );
    return {
      ...base,
      verdict: 'error',
      signatures: ['no-output'],
      reason: `the JSON output could not be parsed: ${error.message}`
    };
  }
  try {
    const classified = classifyEval(sidecar);
    if (!killed) return { ...classified, reason: null };
    return {
      ...classified,
      verdict: 'error',
      signatures: classified.signatures.includes('killed')
        ? classified.signatures
        : [...classified.signatures, 'killed'],
      reason: 'killed after the hard timeout; promptfoo had written output'
    };
  } catch (error) {
    if (killed)
      return killedBlind(`unreadable promptfoo output: ${error.message}`);
    return {
      ...base,
      verdict: 'error',
      signatures: ['no-output'],
      reason: `unreadable promptfoo output: ${error.message}`
    };
  }
}

/** Whether the tests a config's first attempt did not pass run again. */
export function shouldRetry({ baseline = false, killed = false, verdict }) {
  if (baseline || killed || verdict.counts === null) return false;
  if (verdict.signatures.includes('max-duration')) return false;
  const down = verdict.counts.fail + verdict.counts.error;
  return down > 0 && down <= MAX_RETRIED_TESTS;
}

/** The most generator tokens one config can spend, re-runs included. */
export function dayCost(cost) {
  return cost.firstPass + MAX_RETRIED_TESTS * RETRY_REPEATS * cost.largest;
}

/** Each config's `passCost`; a config that cannot be sized throws here. */
export function costsOf(configs, { limits }) {
  return new Map(
    configs.map((config) => [
      config,
      passCost(sizeConfig(config, { limits }).sizes)
    ])
  );
}

/** Splits off configs with no SKILL.md yet, which only a baseline run takes. */
export function withoutUnwrittenSkills(
  configs,
  { missing = missingSkillFiles } = {}
) {
  const run = [];
  const skipped = [];
  for (const config of configs) {
    const files = missing(config);
    if (files.length > 0) skipped.push({ config, files });
    else run.push(config);
  }
  return { run, skipped };
}

/** The configs, longest-waiting first: never graded, then by oldest grade. */
export function longestWaiting({ configs, graded }) {
  const since = (config) => graded.get(skillOf(config)) ?? '';
  return [...configs].sort(
    (a, b) => since(a).localeCompare(since(b)) || a.localeCompare(b)
  );
}

const DAY_MS = 24 * 60 * 60000;

const daysFrom = (date, today) =>
  Math.round((Date.parse(today) - Date.parse(date)) / DAY_MS);

const addDays = (date, days) =>
  new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);

const listed = (names) =>
  names.length < 3
    ? names.join(' and ')
    : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/**
 * Which configs a run grades, and why. A config is due when it has no graded
 * run, or when its inputs are unreadable, unrecorded by that run or changed
 * since; with `regradeDays` set, also when that grade is that many days old.
 * Changed configs go first, then aged ones, each longest-waiting first, and
 * `later` holds the rest.
 */
export function planRun({
  configs,
  graded,
  recorded,
  inputs,
  today,
  regradeDays = 0
}) {
  const changed = [];
  const aged = [];
  const later = [];
  for (const config of longestWaiting({ configs, graded })) {
    const date = graded.get(skillOf(config));
    const now = inputs.get(config);
    const then = recorded.get(skillOf(config)) ?? null;
    const differ = changedInputs(now, then);
    if (date === undefined) {
      changed.push({ config, why: 'no graded run yet' });
    } else if (now?.error) {
      changed.push({ config, why: `inputs unreadable: ${now.error}` });
    } else if (then === null) {
      changed.push({
        config,
        why: `graded ${date} by a run that recorded no inputs`
      });
    } else if (differ.length > 0) {
      changed.push({
        config,
        why: `${listed(differ)} changed since its grade of ${date}`
      });
    } else if (regradeDays > 0 && daysFrom(date, today) >= regradeDays) {
      aged.push({
        config,
        why: `last graded ${date}, ${daysFrom(date, today)} days ago`
      });
    } else {
      later.push({
        config,
        why: `graded ${date} on its current inputs${regradeDays > 0 ? `; due again ${addDays(date, regradeDays)}` : ''}`
      });
    }
  }
  return { due: [...changed, ...aged], later };
}

function sumTokenUsage(a, b) {
  if (!a || !b) return a ?? b ?? null;
  const sum = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (typeof value === 'number') sum[key] = (sum[key] ?? 0) + value;
  }
  return sum;
}

/**
 * A config's verdict once its failing tests have run again, with rows matched
 * to tests by their vars as `--filter-failing` matches them. A test fails when
 * any attempt failed, passes when none did and at least one was graded, and is
 * an `error` only when no attempt was graded.
 */
export function combineAttempts({ firstText, retryText = null }) {
  const first = JSON.parse(firstText);
  const firstVerdict = classifyEval(first);
  let retryRows = [];
  let retryTokens = null;
  try {
    const retry = JSON.parse(retryText);
    retryTokens = classifyEval(retry).tokenUsage;
    retryRows = retry.results.results;
  } catch {
    // Nothing to add: the first attempt's rows decide.
  }

  const tests = new Map();
  for (const row of [...first.results.results, ...retryRows]) {
    const key = JSON.stringify(row.vars ?? {});
    const test = tests.get(key) ?? {
      description: row.testCase?.description ?? `test ${row.testIdx}`,
      attempts: [],
      error: null
    };
    // classifyEval reads each row, as it reads a config's single run.
    const attempt = classifyEval({ results: { results: [row] } });
    test.attempts.push(attempt.verdict);
    if (attempt.verdict === 'error') test.error = attempt.errors[0];
    tests.set(key, test);
  }

  const counts = { pass: 0, fail: 0, error: 0 };
  const errors = [];
  const signatures = [];
  const retried = [];
  for (const test of tests.values()) {
    const passes = test.attempts.filter((a) => a === 'pass').length;
    const fails = test.attempts.filter((a) => a === 'fail').length;
    const verdict = fails > 0 ? 'fail' : passes > 0 ? 'pass' : 'error';
    counts[verdict]++;
    if (verdict === 'error') {
      const { signature, message } = test.error;
      if (!signatures.includes(signature)) signatures.push(signature);
      errors.push({ description: test.description, signature, message });
    }
    if (test.attempts.length > 1) {
      retried.push({
        description: test.description,
        attempts: test.attempts,
        verdict
      });
    }
  }

  let verdict = 'pass';
  if (counts.fail > 0) verdict = 'fail';
  if (counts.error > 0) verdict = 'error';
  return {
    verdict,
    counts,
    total: tests.size,
    errors,
    signatures,
    tokenUsage: sumTokenUsage(firstVerdict.tokenUsage, retryTokens),
    retried
  };
}

function readSidecar(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * One `npm run eval:graded` child in its own process group, since `npm run`
 * forwards no signals. At `killAfterMs` the group gets SIGTERM, then SIGKILL
 * `sigkillAfterMs` later. While the child runs, a SIGINT, SIGTERM or SIGHUP
 * makes the runner SIGKILL the group and exit with 128 plus the signal number.
 */
export function spawnEval(
  command,
  args,
  { env, killAfterMs, sigkillAfterMs = SIGKILL_AFTER_MS }
) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawnChild(command, args, {
      stdio: 'inherit',
      env,
      detached: true
    });
    let settled = false;
    let killed = false;
    let escalated = false;
    let pending = null;
    let escalation = null;

    // Signal 0 asks whether the group has members left; ESRCH means none.
    const signalGroup = (signal) => {
      if (child.pid === undefined) return false;
      try {
        process.kill(-child.pid, signal);
        return true;
      } catch {
        return false;
      }
    };

    const unlisten = () =>
      ABORT_SIGNALS.forEach((signal) => process.removeListener(signal, abort));
    function abort(signal) {
      signalGroup('SIGKILL');
      unlisten();
      process.exit(128 + (osConstants.signals[signal] ?? 0));
    }
    // finish() removes these, so a signal between configs ends the runner.
    ABORT_SIGNALS.forEach((signal) => process.on(signal, abort));

    const finish = () => {
      if (settled || pending === null) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(escalation);
      unlisten();
      resolve({ ...pending, killed, durationMs: Date.now() - started });
    };

    const timer = setTimeout(() => {
      killed = true;
      signalGroup('SIGTERM');
      escalation = setTimeout(() => {
        escalated = true;
        signalGroup('SIGKILL');
        finish();
      }, sigkillAfterMs);
    }, killAfterMs);

    const settle = (result) => {
      pending = result;
      // After a kill the wrapper exits long before promptfoo does, so while the
      // group still has members the result waits for the SIGKILL.
      if (killed && !escalated && signalGroup(0)) return;
      finish();
    };

    child.on('close', (code) => settle({ exitCode: code }));
    child.on('error', (error) =>
      settle({ exitCode: null, spawnError: error.message })
    );
  });
}

/**
 * Each config's command at its pace. A child's bound depends on how long the
 * children before it took, so the dry run names the budget it comes from.
 */
export function dryRunLines({
  configs,
  name,
  baseline,
  resultsDir,
  workDir,
  budgetMinutes,
  costs = null,
  tokensPerMinute = null
}) {
  const lines = [
    `Run name: ${name}`,
    `Budget: ${budgetMinutes} minutes for the run; each config may use what is left after the least time the configs planned after it need.`,
    `Verdicts: ${join(workDir, 'verdicts.txt')}; summary: ${join(workDir, 'summary.json')}`,
    ''
  ];
  for (const config of configs) {
    const cost = costs?.get(config);
    const { args } = buildCommand({
      config,
      name,
      resultsDir,
      workDir,
      baseline,
      delayMs:
        cost && tokensPerMinute
          ? paceMs({ largest: cost.largest, tokensPerMinute })
          : null
    });
    lines.push(`npm ${args.join(' ')}`);
  }
  return lines;
}

export async function runEvals({
  configs,
  name,
  baseline = false,
  shard = null,
  resultsDir,
  workDir,
  budgetMinutes = BUDGET_MINUTES_DEFAULT,
  limits = null,
  costs = null,
  tokensPerDay = TOKENS_PER_DAY_DEFAULT,
  logsDir = null,
  judge = null,
  inputs = null,
  commit = null,
  env = process.env,
  spawn = spawnEval,
  fetch = globalThis.fetch,
  now = () => Date.now(),
  log = console.log
}) {
  // The children size every answer cap by these, so they get the run's limits.
  if (limits !== null) {
    env = {
      ...env,
      EVAL_TOKENS_PER_MINUTE: String(limits.tokensPerMinute),
      EVAL_TEMPLATE_TOKENS: String(limits.templateTokens)
    };
  }
  mkdirSync(resultsDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  const verdictsPath = join(workDir, 'verdicts.txt');
  const summaryPath = join(workDir, 'summary.json');
  writeFileSync(verdictsPath, '');

  const budgetMs = budgetMinutes * 60000;
  const summary = {
    name,
    baseline,
    ...(shard === null ? {} : { shard }),
    bounds: { budgetMinutes },
    ...(limits === null ? {} : { limits }),
    // Filled in as the run goes: a config joins `planned` when it starts, and
    // one the day could not hold is `waiting`, so it is never reported missing.
    day: { tokensPerDay, spent: 0, waiting: [] },
    planned: [],
    configs: []
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  // The inputs each graded config was graded on, for a later run's `planRun`.
  const gradedOnPath = join(resultsDir, `${name}.json`);
  const gradedOn = { commit, configs: {} };
  writeFileSync(gradedOnPath, JSON.stringify(gradedOn, null, 2) + '\n');

  // Asks the judge itself after a child whose grading met rate limits and left
  // its config short of a pass.
  const checkJudge = async (verdict, waits) => {
    if (summary.day.judgeSpent || verdict.verdict === 'pass') return;
    if (!waits.some((wait) => wait.host === GEMINI_HOST)) return;
    const said = await judgeDaySpent({
      pin: judge,
      apiKey: env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY,
      fetch,
      log
    });
    if (!said) return;
    summary.day.judgeSpent = said;
    log(
      `Google refused the judge for its daily quota (${said.limit ?? 'an unstated number of'} requests a day for ${said.model ?? judge}, ${said.quotaId}); the rest wait for another day.`
    );
  };

  const started = now();
  for (const [index, config] of configs.entries()) {
    const skill = skillOf(config);
    // A config the day cannot hold waits, and is first in line tomorrow.
    const cost = costs?.get(config) ?? null;
    const need = cost ? dayCost(cost) : 0;
    if (summary.day.spentByGroq || summary.day.judgeSpent) {
      log(`${skill}: waits for another day, which a provider says is spent.`);
      summary.day.waiting.push(skill);
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
      continue;
    }
    if (summary.day.spent + need > tokensPerDay) {
      log(
        `${skill}: waits for another day; it may need ${need} generator tokens and the day has ${tokensPerDay - summary.day.spent} left.`
      );
      summary.day.waiting.push(skill);
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
      continue;
    }
    summary.planned.push(skill);
    const delayMs =
      cost && limits
        ? paceMs({
            largest: cost.largest,
            tokensPerMinute: limits.tokensPerMinute
          })
        : null;
    // Keeps a slow config from taking the time the configs after it need.
    const reserveMs = limits
      ? reserveAfter({
          rest: configs.slice(index + 1),
          costs,
          tokensLeft: tokensPerDay - summary.day.spent - need,
          tokensPerMinute: limits.tokensPerMinute
        })
      : 0;
    const bound = boundFor({
      elapsedMs: now() - started,
      budgetMs,
      reserveMs
    });

    let record;
    let refused = null;
    if (bound.skip) {
      log(
        `${skill}: not run — the ${budgetMinutes}-minute run budget is spent.`
      );
      record = {
        skill,
        config,
        verdict: 'error',
        counts: null,
        total: 0,
        signatures: ['not-run'],
        reason: 'not-run: budget exhausted',
        durationMs: 0,
        exitCode: null,
        tokenUsage: null,
        retry: null
      };
    } else {
      const { command, args } = buildCommand({
        config,
        name,
        resultsDir,
        workDir,
        baseline,
        delayMs
      });
      log(
        `${skill}: running${delayMs === null ? '' : ` with requests ${Math.round(delayMs / 1000)}s apart`} and a ${Math.round(bound.boundMs / 60000)}-minute bound.`
      );
      // A sidecar left by an earlier run must not stand in for one the child
      // never wrote.
      const sidecarPath = join(workDir, `${name}-${skill}.json`);
      rmSync(sidecarPath, { force: true });
      const outcome = await spawn(command, args, {
        env: childEnv({
          boundMs: bound.boundMs,
          env,
          logDir: logsDir && join(logsDir, `${name}-${skill}`)
        }),
        killAfterMs: bound.boundMs + KILL_GRACE_MS
      });
      const sidecarText = readSidecar(sidecarPath);
      let verdict = verdictFor({
        exitCode: outcome.exitCode ?? null,
        killed: outcome.killed === true,
        sidecarText
      });

      let retry = null;
      const retryBound = boundFor({
        elapsedMs: now() - started,
        budgetMs,
        reserveMs
      });
      const debugLog = logsDir
        ? readDebugLogs(join(logsDir, `${name}-${skill}`))
        : '';
      const waits = rateLimitWaits(debugLog);
      if (waits.length > 0) log(`  rate-limit waits: ${waitsLine(waits)}`);
      // Neither provider takes a re-run once it has refused for the day.
      refused = logsDir && dayRefusal(debugLog);
      await checkJudge(verdict, waits);
      if (
        shouldRetry({ baseline, killed: outcome.killed === true, verdict }) &&
        !retryBound.skip &&
        !refused &&
        !summary.day.judgeSpent
      ) {
        const down = verdict.counts.fail + verdict.counts.error;
        log(
          `${skill}: ${down} of ${verdict.total} tests did not pass; running them ${RETRY_REPEATS} more times.`
        );
        const rerun = buildCommand({
          config,
          name,
          resultsDir,
          workDir,
          baseline,
          retryOf: sidecarPath,
          delayMs
        });
        const retryPath = join(workDir, `${name}-${skill}-retry.json`);
        rmSync(retryPath, { force: true });
        const retryOutcome = await spawn(rerun.command, rerun.args, {
          env: childEnv({
            boundMs: retryBound.boundMs,
            env,
            logDir: logsDir && join(logsDir, `${name}-${skill}-retry`)
          }),
          killAfterMs: retryBound.boundMs + KILL_GRACE_MS
        });
        const combined = combineAttempts({
          firstText: sidecarText,
          retryText: readSidecar(retryPath)
        });
        verdict = { ...combined, reason: null };
        const retryLog = logsDir
          ? readDebugLogs(join(logsDir, `${name}-${skill}-retry`))
          : '';
        const retryWaits = rateLimitWaits(retryLog);
        if (retryWaits.length > 0) {
          log(`  rate-limit waits in the re-run: ${waitsLine(retryWaits)}`);
        }
        refused = refused || (logsDir && dayRefusal(retryLog));
        await checkJudge(verdict, retryWaits);
        retry = {
          exitCode: retryOutcome.exitCode ?? null,
          killed: retryOutcome.killed === true,
          durationMs: retryOutcome.durationMs ?? null,
          boundMs: retryBound.boundMs,
          waits: retryWaits,
          tests: combined.retried
        };
        for (const test of combined.retried) {
          log(
            `  ${test.description}: ${test.attempts.join(', ')} -> ${test.verdict}`
          );
        }
      }

      // Groq may refuse a request for a daily limit lower than the configured
      // one, or for tokens spent elsewhere today; then no further config starts.
      if (refused) {
        summary.day.spentByGroq = refused;
        log(
          `Groq refused a request for the key's daily limit (${refused.used} of ${refused.tokensPerDay} tokens used); the rest wait for another day.`
        );
      }
      // A config the day cut off is an `error` that does not fail the run.
      const dayCut =
        verdict.verdict === 'pass'
          ? null
          : refused
            ? 'generator'
            : summary.day.judgeSpent
              ? 'judge'
              : null;
      if (dayCut) {
        verdict = {
          ...verdict,
          verdict: 'error',
          signatures: [...verdict.signatures, 'day-spent']
        };
        setAside({ resultsDir, workDir, name, skill });
        log(
          `${skill}: the ${dayCut}'s day ended before it was graded; it goes first the next day.`
        );
      }

      record = {
        skill,
        config,
        verdict: verdict.verdict,
        counts: verdict.counts,
        total: verdict.total,
        signatures: verdict.signatures,
        reason: verdict.reason ?? outcome.spawnError ?? null,
        durationMs: outcome.durationMs ?? null,
        delayMs,
        boundMs: bound.boundMs,
        waits,
        exitCode: outcome.exitCode ?? null,
        tokenUsage: verdict.tokenUsage ?? null,
        ...(dayCut ? { dayCut } : {}),
        retry
      };
      for (const error of verdict.errors ?? []) {
        log(`  ${error.signature}: ${error.description} — ${error.message}`);
      }
    }

    summary.day.spent += record.tokenUsage?.total ?? 0;
    log(`${skill}: ${record.verdict}`);
    appendFileSync(verdictsPath, `${skill}:${record.verdict}\n`);
    summary.configs.push(record);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
    if (record.verdict === 'pass' || record.verdict === 'fail') {
      gradedOn.configs[skill] = { inputs: inputs?.get(config) ?? null, judge };
      writeFileSync(gradedOnPath, JSON.stringify(gradedOn, null, 2) + '\n');
    }
  }

  // A day a provider ended early is not a failure, but a day that graded
  // nothing is, whatever ended it, so a spent quota cannot pass in silence.
  const graded = summary.configs.some(
    (c) => c.verdict === 'pass' || c.verdict === 'fail'
  );
  if (summary.configs.length > 0 && !graded) {
    log('No config got a verdict today.');
  }
  return {
    summary,
    failed:
      summary.configs.some(
        (c) => c.verdict === 'fail' || (c.verdict === 'error' && !c.dayCut)
      ) ||
      (summary.configs.length > 0 && !graded)
  };
}

/**
 * Moves the CSVs of a config the day cut off from the results the publish job
 * commits to `<work>/day-spent`, so their graded rows do not count as a
 * verdict and the config keeps its place at the front of the line.
 */
export function setAside({ resultsDir, workDir, name, skill }) {
  const aside = join(workDir, 'day-spent');
  for (const stem of [`${name}-${skill}`, `${name}-${skill}-retry`]) {
    const from = join(resultsDir, `${stem}.csv`);
    try {
      mkdirSync(aside, { recursive: true });
      copyFileSync(from, join(aside, `${stem}.csv`));
      rmSync(from);
    } catch {
      // Not written: nothing to set aside.
    }
  }
}

/** The commit the run grades, or null outside a git checkout. */
function headCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const configDir = args.configDir ?? 'evals/prompts';
  const fromInput = (process.env.INPUT_CONFIGS ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const explicit =
    args.configs.length > 0
      ? args.configs
      : fromInput.length > 0
        ? fromInput
        : null;

  // A shard slices only the discovered list, never an explicit one.
  const shardSpec = args.shard ?? process.env.EVAL_SHARD ?? '';
  let shard = null;
  if (shardSpec !== '') {
    if (explicit !== null) {
      console.error(
        '--shard (and EVAL_SHARD) slice the discovered config list; pass either a shard or explicit configs, not both.'
      );
      process.exit(1);
    }
    try {
      shard = parseShard(shardSpec);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  }

  let configs = explicit ?? listEvalConfigs(configDir);
  if (shard !== null) {
    const discovered = configs.length;
    configs = shardOf(configs, shard);
    if (configs.length === 0) {
      console.error(
        `Shard ${shardSpec} selects no configs — only ${discovered} were discovered.`
      );
      process.exit(1);
    }
  }
  if (configs.length === 0) {
    console.error('No eval configs found.');
    process.exit(1);
  }
  const rejected = configs.filter((c) => !isSafeConfigPath(c, configDir));
  if (rejected.length > 0) {
    for (const value of rejected) {
      console.error(`Not an eval config under ${configDir}: ${value}`);
    }
    console.error(`Configs must be existing ${configDir}/<skill>.yaml paths.`);
    process.exit(1);
  }

  const baseline = args.baseline || process.env.INPUT_BASELINE === 'true';
  const today = new Date().toISOString().slice(0, 10);
  const name = runName(today, baseline);
  if (!baseline) {
    const { run, skipped } = withoutUnwrittenSkills(configs);
    for (const { config, files } of skipped) {
      console.log(
        `${skillOf(config)}: not run (no SKILL.md at ${files.join(', ')} yet; its baseline runs with --baseline).`
      );
    }
    configs = run;
    if (configs.length === 0) {
      console.log('Nothing to grade: no config has a SKILL.md yet.');
      if (!args.dryRun) setOutputs({ name, ran: 'false' });
      process.exit(0);
    }
  }
  const resultsDir = args.resultsDir ?? 'evals/results';
  const workDir =
    args.workDir ?? process.env.EVAL_WORK_DIR ?? join(tmpdir(), 'eval');
  const budgetMinutes = Number(
    process.env.EVAL_BUDGET_MINUTES || BUDGET_MINUTES_DEFAULT
  );

  const badDirs = [
    ['--results-dir', resultsDir],
    ['--work-dir / EVAL_WORK_DIR', workDir]
  ].filter(([, dir]) => !isSafeCliPath(dir));
  if (badDirs.length > 0) {
    for (const [flag, dir] of badDirs) {
      console.error(`Not a usable ${flag} path: ${dir}`);
    }
    process.exit(1);
  }

  // When each config last got a verdict, and what it would be graded on now.
  let resultFiles = [];
  try {
    resultFiles = readdirSync(resultsDir);
  } catch {
    // No results yet: no config has had a verdict.
  }
  const graded = lastGraded(resultFiles, (fileName) =>
    readFileSync(join(resultsDir, fileName), 'utf8')
  );
  const inputs = new Map();
  let harness = null;
  for (const config of configs) {
    try {
      harness ??= harnessOf();
      inputs.set(config, inputsOf(config, { harness }));
    } catch (error) {
      inputs.set(config, { error: error.message });
    }
  }

  // A discovered list runs what `planRun` finds due. Named configs run as
  // named, and a shard runs its whole slice, longest-waiting first.
  const regradeDays = Number(process.env.EVAL_REGRADE_DAYS || 0);
  const plan =
    explicit === null && shard === null
      ? planRun({
          configs,
          graded,
          recorded: recordedInputs(graded, (date) =>
            JSON.parse(readFileSync(join(resultsDir, `${date}.json`), 'utf8'))
          ),
          inputs,
          today,
          regradeDays
        })
      : null;
  for (const { config, why } of plan?.due ?? []) {
    console.log(`${skillOf(config)}: due (${why}).`);
  }
  for (const { config, why } of plan?.later ?? []) {
    console.log(`${skillOf(config)}: not due (${why}).`);
  }
  const order = plan
    ? plan.due.map(({ config }) => config)
    : explicit === null
      ? longestWaiting({ configs, graded })
      : configs;
  if (order.length === 0) {
    console.log(
      'Nothing is due: every config was graded on its current inputs.'
    );
    if (!args.dryRun) setOutputs({ name, ran: 'false' });
    process.exit(0);
  }

  const pin = /^id:\s*(\S+)/m.exec(
    readFileSync('evals/prompts/lib/providers.yaml', 'utf8')
  )?.[1];
  const measured = args.dryRun
    ? null
    : await measureLimits({ pin, apiKey: process.env.GROQ_API_KEY });
  const limits = measured ?? limitsFrom({});
  console.log(
    measured
      ? `Generator limits, measured: ${limits.tokensPerMinute} tokens a minute, ${limits.templateTokens}-token chat template.`
      : `Generator limits not measured; using ${limits.tokensPerMinute} tokens a minute and a ${limits.templateTokens}-token template.`
  );

  // runEvals runs, in this order, each config whose worst case the day holds.
  const tokensPerDay = Number(
    process.env.EVAL_TOKENS_PER_DAY || TOKENS_PER_DAY_DEFAULT
  );
  const costs = costsOf(order, { limits });

  if (args.dryRun) {
    for (const config of order) {
      console.log(
        `${skillOf(config)}: may need ${dayCost(costs.get(config))} of the day's ${tokensPerDay} generator tokens.`
      );
    }
    console.log(
      dryRunLines({
        configs: order,
        name,
        baseline,
        resultsDir,
        workDir,
        budgetMinutes,
        costs,
        tokensPerMinute: limits.tokensPerMinute
      }).join('\n')
    );
    process.exit(0);
  }

  // The publish job names its committed CSVs from this.
  setOutputs({ name });
  // A refused probe may mean the day is already spent, by a dispatch earlier
  // today or by a limit lower than configured: then every config waits.
  const spentAtStart =
    measured === null
      ? await daySpent({ pin, apiKey: process.env.GROQ_API_KEY })
      : null;
  if (spentAtStart) {
    console.log(
      `Groq says the key's day is already spent (${spentAtStart.used} of ${spentAtStart.tokensPerDay} tokens); every config waits for another day.`
    );
    setOutputs({ ran: 'false' });
    process.exit(0);
  }
  if (shardSpec !== '') console.log(`Shard ${shardSpec} of the config list.`);
  console.log(`In order: ${order.join(' ')}`);

  const { summary, failed } = await runEvals({
    configs: order,
    name,
    baseline,
    shard: shardSpec === '' ? null : shardSpec,
    resultsDir,
    workDir,
    budgetMinutes,
    limits: { ...limits, measured: measured !== null },
    costs,
    tokensPerDay,
    // Beside the work dir, not in it: the work dir is uploaded as an artifact,
    // and these logs hold every request and response in full.
    logsDir: `${workDir}-logs`,
    judge: judgePin(JSON.parse(readFileSync('package.json', 'utf8'))),
    inputs,
    commit: headCommit()
  });
  // A run that planned no config has nothing for the publish job.
  setOutputs({ ran: String(summary.planned.length > 0) });
  // Unreachable while `npm run lint:prompt-budget` passes, which checks that
  // every config fits in a day on its own.
  const stuck = summary.planned.length === 0 && order.length > 0;
  if (stuck) {
    console.error(
      `::error::No config fits in a day of ${tokensPerDay} generator tokens; run npm run lint:prompt-budget.`
    );
  }
  process.exit(failed || stuck ? 1 : 0);
}
