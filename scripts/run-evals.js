#!/usr/bin/env node
/**
 * Runs the eval configs the weekly drift check covers, one bounded child per
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
 *   --results-dir <d>    where the dated CSVs go (default evals/results)
 *   --work-dir <d>       where the sidecars, verdicts, and summary go
 *   --config-dir <d>     where the eval configs live (default evals/prompts)
 *
 * Env: EVAL_CONFIG_MINUTES, EVAL_BUDGET_MINUTES, EVAL_WORK_DIR, INPUT_CONFIGS,
 * INPUT_BASELINE. The workflow sets the two bounds in YAML so they are visible
 * and tunable there; the defaults here match.
 */
import { spawn as spawnChild } from 'node:child_process';
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
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
  skillOf
} from './lib/eval-verdicts.js';
import { setOutputs } from './lib/github-output.js';

const CONFIG_MINUTES_DEFAULT = 30;
const BUDGET_MINUTES_DEFAULT = 240;

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
 * The unchanged `npm run eval:graded` call, with the second output path added.
 * Never combine configs into one invocation: promptfoo merges the defaultTest
 * blocks of combined configs (last one wins), which would inject a single
 * skill's SKILL.md into every test.
 *
 * These args reach a shell through `npm run`; npm quotes them, but the runner
 * does not rely on that — every path is checked here before it enters argv, so a
 * hostile or mistyped config name is rejected rather than forwarded.
 */
export function buildCommand({
  config,
  name,
  resultsDir,
  workDir,
  baseline = false
}) {
  const skill = skillOf(config);
  const csvPath = join(resultsDir, `${name}-${skill}.csv`);
  const jsonPath = join(workDir, `${name}-${skill}.json`);
  // The last point before the child process, so this covers every caller.
  if (!isSafeCliPath(config)) {
    throw new Error(
      `Refusing to build a command with an unusable config path: ${JSON.stringify(config)}`
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
      '--output',
      csvPath,
      jsonPath
    ]
  };
}

export function childEnv({ boundMs, env = process.env }) {
  return { ...env, PROMPTFOO_MAX_EVAL_TIME_MS: String(boundMs) };
}

/** How long this config may take: the cap, or whatever budget is left. */
export function boundFor({ elapsedMs, budgetMs, capMs }) {
  const remaining = budgetMs - elapsedMs;
  if (remaining < MIN_CONFIG_MS) return { skip: true, boundMs: 0 };
  return { skip: false, boundMs: Math.min(capMs, remaining) };
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

export function dryRunLines({
  configs,
  name,
  baseline,
  resultsDir,
  workDir,
  capMinutes,
  budgetMinutes
}) {
  const capMs = capMinutes * 60000;
  const lines = [
    `Run name: ${name}`,
    `Bounds: ${capMinutes} minutes per config, ${budgetMinutes} minutes for the run.`,
    `Verdicts: ${join(workDir, 'verdicts.txt')}; summary: ${join(workDir, 'summary.json')}`,
    ''
  ];
  for (const config of configs) {
    const { args } = buildCommand({
      config,
      name,
      resultsDir,
      workDir,
      baseline
    });
    lines.push(`PROMPTFOO_MAX_EVAL_TIME_MS=${capMs} npm ${args.join(' ')}`);
  }
  return lines;
}

export async function runEvals({
  configs,
  name,
  baseline = false,
  resultsDir,
  workDir,
  capMinutes = CONFIG_MINUTES_DEFAULT,
  budgetMinutes = BUDGET_MINUTES_DEFAULT,
  env = process.env,
  spawn = spawnEval,
  now = () => Date.now(),
  log = console.log
}) {
  mkdirSync(resultsDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  const verdictsPath = join(workDir, 'verdicts.txt');
  const summaryPath = join(workDir, 'summary.json');
  writeFileSync(verdictsPath, '');

  const capMs = capMinutes * 60000;
  const budgetMs = budgetMinutes * 60000;
  const summary = {
    name,
    baseline,
    bounds: { configMinutes: capMinutes, budgetMinutes },
    planned: configs.map(skillOf),
    configs: []
  };
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');

  const started = now();
  for (const config of configs) {
    const skill = skillOf(config);
    const bound = boundFor({
      elapsedMs: now() - started,
      budgetMs,
      capMs
    });

    let record;
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
        tokenUsage: null
      };
    } else {
      const { command, args } = buildCommand({
        config,
        name,
        resultsDir,
        workDir,
        baseline
      });
      log(
        `${skill}: running with a ${Math.round(bound.boundMs / 60000)}-minute bound.`
      );
      // A sidecar left by an earlier run must not stand in for one the child
      // never wrote.
      const sidecarPath = join(workDir, `${name}-${skill}.json`);
      rmSync(sidecarPath, { force: true });
      const outcome = await spawn(command, args, {
        env: childEnv({ boundMs: bound.boundMs, env }),
        killAfterMs: bound.boundMs + KILL_GRACE_MS
      });
      let sidecarText = null;
      try {
        sidecarText = readFileSync(sidecarPath, 'utf8');
      } catch {
        sidecarText = null;
      }
      const verdict = verdictFor({
        exitCode: outcome.exitCode ?? null,
        killed: outcome.killed === true,
        sidecarText
      });
      record = {
        skill,
        config,
        verdict: verdict.verdict,
        counts: verdict.counts,
        total: verdict.total,
        signatures: verdict.signatures,
        reason: verdict.reason ?? outcome.spawnError ?? null,
        durationMs: outcome.durationMs ?? null,
        exitCode: outcome.exitCode ?? null,
        tokenUsage: verdict.tokenUsage ?? null
      };
      for (const error of verdict.errors ?? []) {
        log(`  ${error.signature}: ${error.description} — ${error.message}`);
      }
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
  const configs =
    args.configs.length > 0
      ? args.configs
      : fromInput.length > 0
        ? fromInput
        : listEvalConfigs(configDir);
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
  const capMinutes = Number(
    process.env.EVAL_CONFIG_MINUTES || CONFIG_MINUTES_DEFAULT
  );
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

  if (args.dryRun) {
    console.log(
      dryRunLines({
        configs,
        name,
        baseline,
        resultsDir,
        workDir,
        capMinutes,
        budgetMinutes
      }).join('\n')
    );
    process.exit(0);
  }

  // The publish job names its committed CSVs from this.
  setOutputs({ name });
  console.log(`Evaluating: ${configs.join(' ')}`);

  const { failed } = await runEvals({
    configs,
    name,
    baseline,
    resultsDir,
    workDir,
    capMinutes,
    budgetMinutes
  });
  process.exit(failed ? 1 : 0);
}
