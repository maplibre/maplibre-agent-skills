#!/usr/bin/env node
/**
 * Runs the eval configs the drift check covers, one bounded child per
 * config, and leaves a complete record whatever happens.
 *
 * The bound is promptfoo's own: `PROMPTFOO_MAX_EVAL_TIME_MS` arms a global timer
 * (`getMaxEvalTimeMs`, node_modules/promptfoo/dist/src/logger-B9f-j62Q.js:126,
 * read at node_modules/promptfoo/dist/src/evaluator-SSlcaq_U.js:8950), and on
 * expiry every unprocessed test becomes an ERROR row reading "Evaluation
 * exceeded max duration of Nms" (`createMaxDurationTimeoutResult`, same file,
 * :8196) before the eval finalizes and writes its outputs. A job-level kill
 * writes nothing at all, which is how the 2026-08-30 run ended with six hours
 * spent and no evidence of what happened.
 *
 * Each config asks for two output files: the dated CSV the publish job commits,
 * and a JSON sidecar in the work dir that carries the failure reason behind each
 * row (`-o, --output <paths...>` is variadic, node_modules/promptfoo/dist/src/main.js:4908,
 * and both are written before the exit code is set, :4787 then :4845). The CSV's
 * ERROR rows have an empty output and an empty grader reason, so the sidecar is
 * the only place the error text survives.
 *
 * The hard kill that backs that bound goes to the child's process group, never
 * to the child alone. `npm run` forwards no signals, so a SIGTERM to the wrapper
 * ends the wrapper and leaves promptfoo running: the three configs killed in the
 * 2026-09-06 run outlived their kills by 2h40m (source-wiring), 36 minutes
 * (terrain-rendering) and 13 minutes (tile-sources), all of them still spending
 * the same Groq and Gemini keys, which rate-limited every config that came after
 * them. So the child is spawned `detached` (its own group), signalled as `-pid`,
 * and the group is SIGKILLed if it has not emptied SIGKILL_AFTER_MS later —
 * promptfoo's backoff sleeps do not honor SIGTERM promptly. Because a detached
 * child also survives a Ctrl-C on the runner, SIGINT, SIGTERM and SIGHUP on the
 * parent SIGKILL the group before the runner exits.
 *
 * After every config it appends `skill:pass|fail|error` to `<work>/verdicts.txt`
 * and rewrites `<work>/summary.json`, so a run cut off halfway still hands the
 * publish job a record it can report.
 *
 * A test that did not pass runs twice more before its verdict stands, since the
 * generator is nondeterministic even at temperature 0. A second child hands the
 * first attempt's sidecar to promptfoo's `--filter-failing`, so only those tests
 * run, and `combineAttempts` judges each test on all its graded attempts: it
 * passes only when its passes outnumber its failures. Baseline runs are not
 * re-run, since their gap tests are meant to fail; neither is a config the bound
 * cut off, nor one with more than MAX_RETRIED_TESTS tests down.
 *
 * A week of evals is bigger than the generator key's day: a full pass over
 * every config needs more generator tokens than the Groq key's daily free-tier
 * cap, which is how the last four configs ended as `error` every Sunday from
 * 2026-09-06 on (#108). So every run plans its own day. It measures the
 * generator's limits (`measureLimits`), sizes each config's requests by them,
 * puts the configs in `longestWaiting` order by the day each last got a verdict
 * (`lastGraded`), and runs each one whose worst case, re-runs included, fits in
 * what EVAL_TOKENS_PER_DAY has left after what the run has spent. What does not
 * fit is first in line the next day, so how often a config is graded follows
 * from how many configs there are and how big they are, and nothing has to be
 * retuned as they grow. When Groq refuses a request for its daily limit, which
 * only promptfoo's debug log records in Groq's words (`dayRefusal`), no further
 * config starts; a day already spent is caught before the first (`daySpent`). `--shard k/n` (or EVAL_SHARD) takes the k-th of n contiguous
 * slices of the discovered config list by hand; it never shapes an explicit
 * config list — that combination is refused as ambiguous rather than quietly
 * running a subset of what the caller named.
 *
 * Each config's requests are paced: promptfoo gets a `--delay` long enough
 * (`paceMs`) that Groq's per-minute limit has room for the config's largest
 * request again before the next one goes out. Without it nearly every request
 * after a config's first drew a 429 for the minute, and promptfoo 0.122 sizes
 * its wait after one from Groq's daily-request refill header
 * (`x-ratelimit-reset-requests`, read first by `parseRateLimitHeaders` in
 * node_modules/promptfoo/dist/src/fetch-DTVomFtf.js) rather than from the
 * seconds Groq states: 86 s or more per request from 2026-10-16 to 10-22. Each
 * child's bound is whatever the run's budget has left after the least time the
 * configs planned after it need at their pace (`boundFor`, `reserveAfter`), so
 * a config that meets a slow judge uses slack the others do not need, and no
 * per-config cap is left for a bigger config to outgrow. After every child, the
 * rate-limit waits its debug log records go into the run log by host
 * (`rateLimitWaits`).
 *
 * Config and output paths are validated before they are placed in the `npm run`
 * argv, which a shell receives.
 *
 *   node scripts/run-evals.js --dry-run
 *   node scripts/run-evals.js evals/prompts/maplibre-cartography.yaml
 *
 * Exit status is 1 when any config did not pass.
 *
 * Flags:
 *   --baseline           withhold the skill (--var injectSkill=false)
 *   --dry-run            print the commands and the bounds; run nothing
 *   --shard <k/n>        run the k-th of n contiguous slices of the discovered configs
 *   --results-dir <d>    where the dated CSVs go (default evals/results)
 *   --work-dir <d>       where the sidecars, verdicts, and summary go
 *   --config-dir <d>     where the eval configs live (default evals/prompts)
 *
 * Env: EVAL_BUDGET_MINUTES, EVAL_WORK_DIR, EVAL_TOKENS_PER_DAY, EVAL_SHARD,
 * INPUT_CONFIGS, INPUT_BASELINE, GROQ_API_KEY. The workflow sets the budget and
 * the plan's settings in YAML so they are visible and tunable there; the
 * defaults here match.
 */
import { spawn as spawnChild } from 'node:child_process';
import {
  appendFileSync,
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
import { passCost, sizeConfig } from './lib/prompt-budget.js';
import { lastGraded } from './lib/results-history.js';

const BUDGET_MINUTES_DEFAULT = 240;

// How many generator tokens one day of the Groq key holds: its free tier's
// published daily limit, which Groq reports in no response header. eval.yml
// sets it, and this matches. A run that finds the day spent sooner, because
// Groq refuses a request for its daily limit, stops there and says so.
const TOKENS_PER_DAY_DEFAULT = 200000;

// How many more times a test that did not pass is run. Two re-runs after one
// failure is a best of three: the failure stands unless both re-runs pass.
export const RETRY_REPEATS = 2;

// More tests down than this in one config is not sampling noise, and running
// them again would spend the generator key's daily tokens on a known result.
export const MAX_RETRIED_TESTS = 2;

// Below this there is no point starting a config: promptfoo's own queue timeout
// is 300s, so a shorter slice buys ERROR rows and nothing else.
const MIN_CONFIG_MS = 5 * 60000;

// The bound is soft — promptfoo's queue timeout and its backoff sleeps do not
// honor the abort — so a hard kill follows it. That kill loses the config's CSV,
// which is why it sits well past the bound rather than on it.
const KILL_GRACE_MS = 10 * 60000;

// How long the process group gets to exit on SIGTERM before it is SIGKILLed:
// promptfoo's backoff sleeps do not honor SIGTERM promptly, and a survivor keeps
// spending the run's API keys.
export const SIGKILL_AFTER_MS = 30 * 1000;

// A human abort has to take the group with it: `detached` puts the child
// outside the terminal's foreground group, so Ctrl-C alone would not reach it.
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

/**
 * `k/n` → the k-th of n contiguous slices, 1-based so the workflow's
 * `EVAL_SHARD=1/2` reads the way a human says it. The format is strict:
 * anything else — `0/2`, `3/2`, `1-2`, an empty string — is a loud error
 * rather than a silently full (or silently empty) run.
 */
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

/**
 * The k-th of n contiguous slices of an already-sorted config list. Contiguous
 * rather than round-robin so a human can predict a day's slice from the
 * alphabetical list. Slice sizes differ by at most one, earlier slices taking
 * the remainder — 9 configs in halves is 5 then 4, in quarters 3,2,2,2 — so a
 * slice is never empty while there are at least n configs.
 */
export function shardOf(configs, { index, count }) {
  const base = Math.floor(configs.length / count);
  const extra = configs.length % count;
  const start = (index - 1) * base + Math.min(index - 1, extra);
  const size = base + (index - 1 < extra ? 1 : 0);
  return configs.slice(start, start + size);
}

/**
 * The unchanged `npm run eval:graded` call, with the second output path added.
 * Never combine configs into one invocation: promptfoo merges the defaultTest
 * blocks of combined configs (last one wins), which would inject a single
 * skill's SKILL.md into every test.
 *
 * These args reach a shell through `npm run`; npm quotes them, but the runner
 * does not rely on that — every path is checked here before it enters argv, so a
 * hostile or mistyped config name is rejected rather than forwarded.
 *
 * `retryOf` is the first attempt's sidecar. The re-run it builds writes its own
 * `-retry` files beside the first attempt's, so the publish job commits both.
 *
 * `delayMs` is the config's pace (`paceMs`). It follows the script's own
 * `--delay`, and promptfoo keeps the last value it is given.
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
  // The last point before the child process, so this covers every caller.
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

export function childEnv({ boundMs, env = process.env, logDir = null }) {
  return {
    ...env,
    PROMPTFOO_MAX_EVAL_TIME_MS: String(boundMs),
    ...(logDir === null ? {} : { PROMPTFOO_LOG_DIR: logDir })
  };
}

/**
 * The last refusal for the key's daily limit in Groq's own words, with the
 * limit and usage it states, or null. promptfoo files such a refusal as "timed
 * out ... in queue" once its retries give up, so the wording survives only in
 * the response body Groq sent, which promptfoo's debug log keeps.
 */
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

/**
 * The rate-limit waits a child's debug log records, by host: how many and how
 * long in all. promptfoo logs each one as "Rate limited on URL <url>: HTTP
 * <status>" and then "Rate limited, waiting <n>ms" (fetchWithRetries,
 * node_modules/promptfoo/dist/src/fetch-DTVomFtf.js:1094 and :1264), and only
 * at debug level, so the CI log never shows them otherwise.
 */
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
 * The generator's limits as Groq reports them now, so a run never sizes its
 * requests by numbers that have since changed: tokens per minute from the
 * `x-ratelimit-limit-tokens` header of one minimal request, and the chat
 * template as that request's `usage.prompt_tokens` minus its two one-token
 * messages. Costs about 77 tokens. Null when the pin is not a Groq model or
 * Groq cannot be reached; the run then keeps the last measured defaults.
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

/**
 * What Groq says when the key's day is spent: one minimal request refused for
 * its tokens per day, with the limit and the usage the refusal states. Null
 * when the request goes through or is refused for anything else.
 */
export async function daySpent({ pin, apiKey, fetch = globalThis.fetch }) {
  const response = await probe({ pin, apiKey, fetch });
  if (response?.status !== 429) return null;
  try {
    return dayRefusal(await response.text());
  } catch {
    return null;
  }
}

/**
 * How far apart one config's requests go so that none meets Groq's per-minute
 * limit: the limit refills in a minute, and the largest request needs this
 * share of it back before the next one is sent.
 */
export function paceMs({ largest, tokensPerMinute }) {
  return Math.ceil((60000 * largest) / tokensPerMinute);
}

/**
 * The least time the configs after this one need, of those the day's tokens
 * still hold: each one's requests at its pace. `rest` is the remaining run
 * order; `tokensLeft` is what the day has once this config's worst case is
 * spent, and the configs are taken the way `runEvals` will take them.
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

/**
 * How long this config may take: whatever the run's budget has left after
 * `reserveMs`, the least time the configs planned after it need.
 */
export function boundFor({ elapsedMs, budgetMs, reserveMs = 0 }) {
  const remaining = budgetMs - elapsedMs - reserveMs;
  if (remaining < MIN_CONFIG_MS) return { skip: true, boundMs: 0 };
  return { skip: false, boundMs: remaining };
}

/**
 * One config's verdict from what the child left behind. A sidecar that is
 * missing, unparseable, or not shaped like promptfoo's output is an `error` —
 * "no verdict" — and never a pass or a fail, so an unread run cannot move a
 * skill's status in either direction.
 *
 * A killed config is an `error` whatever its rows say, but promptfoo often has
 * written its sidecar by then (its own PROMPTFOO_MAX_EVAL_TIME_MS timer fires
 * before the hard kill), and that sidecar names why the config ran long. So the
 * classified signatures are kept and `killed` is appended to them: the issue
 * table then reads `rate-limit-exhausted, killed` rather than just `killed`.
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

/**
 * Whether a config's first attempt has its failing tests run again: a
 * with-skill run whose sidecar was read and that the bound did not cut off,
 * with at least one and at most MAX_RETRIED_TESTS tests that did not pass.
 */
export function shouldRetry({ baseline = false, killed = false, verdict }) {
  if (baseline || killed || verdict.counts === null) return false;
  if (verdict.signatures.includes('max-duration')) return false;
  const down = verdict.counts.fail + verdict.counts.error;
  return down > 0 && down <= MAX_RETRIED_TESTS;
}

/**
 * The most one config can spend of the generator key's day: its first pass at
 * every request's full size, plus the re-runs shouldRetry allows at its largest
 * request. `cost` is what `passCost` measured.
 */
export function dayCost(cost) {
  return cost.firstPass + MAX_RETRIED_TESTS * RETRY_REPEATS * cost.largest;
}

/**
 * Every config, the longest-waiting first: those that never got a verdict,
 * then by the day they last got one (`lastGraded`), oldest first. How often a
 * config is graded is whatever this order and the day's tokens make it; there
 * is no cadence for the set of configs to outgrow.
 */
export function longestWaiting({ configs, graded }) {
  const since = (config) => graded.get(skillOf(config)) ?? '';
  return [...configs].sort(
    (a, b) => since(a).localeCompare(since(b)) || a.localeCompare(b)
  );
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
 * A config's verdict once its failing tests have run again. Rows are matched to
 * tests by their vars, as `--filter-failing` matches them, and each test is
 * judged on all its graded attempts: it passes when its passes outnumber its
 * failures, fails when they do not, and is an `error` only when no attempt was
 * graded. A test that passed the first time was not run again, so its one pass
 * stands. A re-run with no readable output adds no attempts, which leaves the
 * first attempt's verdict unchanged.
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
    // Each row is read by classifyEval itself, so an attempt means the same
    // thing here as it does in a config's single run.
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
    const verdict =
      passes + fails === 0 ? 'error' : passes > fails ? 'pass' : 'fail';
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
 * One `npm run eval:graded` child, killed as a process group when it overruns.
 *
 * `npm run` is a wrapper: it spawns a shell, which spawns promptfoo, and it
 * forwards nothing it receives. Signalling the child alone therefore reaps the
 * wrapper and orphans the promptfoo process holding the API keys — the whole
 * 2026-09-06 failure. `detached: true` gives the child its own process group so
 * `-pid` reaches every descendant, and the promise is not resolved while that
 * group still has members: SIGKILL follows SIGTERM `sigkillAfterMs` later, and
 * the next config starts only once the group is gone.
 *
 * That same detachment takes the child out of the terminal's foreground group,
 * so a Ctrl-C on the runner no longer reaches it: while a child is live the
 * runner catches SIGINT, SIGTERM and SIGHUP, SIGKILLs the group — a human abort
 * has no use for promptfoo's partial output, and SIGTERM would leave it asleep
 * in backoff — and exits 128 + the signal number.
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

    // Signal 0 asks whether the group still has members. ESRCH — an empty group,
    // or a child that never started — is the answer, not an error.
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
    // No listener outlives its child: finish() takes these off again, so a
    // runner aborted between configs dies of the signal as it always did.
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
      // The wrapper exits on SIGTERM long before promptfoo does. Hold the result
      // until the escalation has emptied the group rather than letting the run
      // move on while the old config still spends the run's quota.
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
  env = process.env,
  spawn = spawnEval,
  now = () => Date.now(),
  log = console.log
}) {
  // The children size every request's answer cap by these, so they get the
  // limits this run measured rather than whatever their own defaults say.
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
    // Which slice of the week this run is, so the artifact says so itself;
    // `planned` below is already only this slice's skills.
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

  const started = now();
  for (const [index, config] of configs.entries()) {
    const skill = skillOf(config);
    // The longest-waiting config whose worst case fits in what the day has
    // left runs next; one that does not is first in line tomorrow.
    const cost = costs?.get(config) ?? null;
    const need = cost ? dayCost(cost) : 0;
    if (summary.day.spentByGroq || summary.day.spent + need > tokensPerDay) {
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
    // What the configs after this one need at the least, so a slow config
    // cannot take the time they would need to run at all.
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
      // A first attempt Groq refused for the day would only be refused again.
      refused = logsDir && dayRefusal(debugLog);
      if (
        shouldRetry({ baseline, killed: outcome.killed === true, verdict }) &&
        !retryBound.skip &&
        !refused
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
        const retryWaits = rateLimitWaits(
          logsDir ? readDebugLogs(join(logsDir, `${name}-${skill}-retry`)) : ''
        );
        if (retryWaits.length > 0) {
          log(`  rate-limit waits in the re-run: ${waitsLine(retryWaits)}`);
        }
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
        retry
      };
      for (const error of verdict.errors ?? []) {
        log(`  ${error.signature}: ${error.description} — ${error.message}`);
      }
    }

    summary.day.spent += record.tokenUsage?.total ?? 0;
    // Groq may refuse a request for a daily limit lower than the configured one,
    // or for tokens spent elsewhere today; then no further config starts.
    const said =
      refused ||
      (logsDir &&
        dayRefusal(readDebugLogs(join(logsDir, `${name}-${skill}-retry`))));
    if (said) {
      summary.day.spentByGroq = said;
      log(
        `Groq refused a request for the key's daily limit (${said.used} of ${said.tokensPerDay} tokens used); the rest wait for another day.`
      );
    }

    log(`${skill}: ${record.verdict}`);
    appendFileSync(verdictsPath, `${skill}:${record.verdict}\n`);
    summary.configs.push(record);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  }

  return { summary, failed: summary.configs.some((c) => c.verdict !== 'pass') };
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

  // The shard shapes only the discovered list. Shaping an explicit list too
  // would mean a dispatch that names configs runs some unstated subset of
  // them, so the combination is refused instead of guessed at.
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
  const name = runName(new Date().toISOString().slice(0, 10), baseline);
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

  // The day's order: longest-waiting first, by the day each config last got a
  // verdict, unless the caller named configs. runEvals then runs each one whose
  // worst case fits in what the day has left, so how often a config is graded
  // follows from how many there are and how big they are.
  const tokensPerDay = Number(
    process.env.EVAL_TOKENS_PER_DAY || TOKENS_PER_DAY_DEFAULT
  );
  const costs = new Map();
  for (const config of configs) {
    try {
      costs.set(config, passCost(sizeConfig(config, { limits })));
    } catch (error) {
      console.log(
        `${skillOf(config)}: not sized (${error.message}), so planned at no cost.`
      );
    }
  }
  let resultFiles = [];
  try {
    resultFiles = readdirSync(resultsDir);
  } catch {
    // No results yet: no config has had a verdict.
  }
  const order =
    explicit === null
      ? longestWaiting({
          configs,
          graded: lastGraded(resultFiles, (fileName) =>
            readFileSync(join(resultsDir, fileName), 'utf8')
          )
        })
      : configs;

  if (args.dryRun) {
    for (const config of order) {
      const cost = costs.get(config);
      console.log(
        `${skillOf(config)}: may need ${cost ? dayCost(cost) : 'an unknown number of'} of the day's ${tokensPerDay} generator tokens.`
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
    logsDir: `${workDir}-logs`
  });
  // A day that graded nothing has nothing for the publish job.
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
