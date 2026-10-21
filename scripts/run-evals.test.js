import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn as spawnChild } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  boundFor,
  buildCommand,
  childEnv,
  combineAttempts,
  dayCost,
  dayRefusal,
  daySpent,
  dryRunLines,
  longestWaiting,
  measureLimits,
  parseShard,
  runEvals,
  shardOf,
  shouldRetry,
  spawnEval,
  verdictFor,
  SIGKILL_AFTER_MS
} from './run-evals.js';

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'run-evals-'));
  return {
    resultsDir: join(root, 'results'),
    workDir: join(root, 'work')
  };
}

function sidecar(rows) {
  return JSON.stringify({
    evalId: 'fixture-eval-id',
    results: {
      version: 3,
      timestamp: '2026-09-06T10:17:00.000Z',
      prompts: [],
      results: rows,
      stats: { successes: 0, failures: 0, errors: 0, tokenUsage: { total: 90 } }
    },
    config: {}
  });
}

function row(failureReason, error) {
  return {
    description: 'explicit',
    failureReason,
    success: failureReason === 0,
    testIdx: 0,
    ...(error === undefined ? {} : { error })
  };
}

/** A row for one test, told apart from the others by its prompt. */
function graded(prompt, failureReason, error) {
  return {
    vars: { prompt },
    testCase: { description: prompt },
    failureReason,
    success: failureReason === 0,
    testIdx: 0,
    ...(error === undefined ? {} : { error })
  };
}

/**
 * A grandchild that outlives its parent shell, the way promptfoo outlives the
 * `npm run` wrapper: it records its pid and then never exits on its own.
 */
function grandchildScript(dir, { ignoreSigterm = false } = {}) {
  const path = join(dir, 'grandchild.cjs');
  writeFileSync(
    path,
    [
      ignoreSigterm ? "process.on('SIGTERM', () => {});" : '',
      "require('node:fs').writeFileSync(process.argv[2], String(process.pid));",
      'setInterval(() => {}, 1000);',
      ''
    ]
      .filter(Boolean)
      .join('\n')
  );
  return path;
}

/** `sh -c '<node> script pidfile & wait'` — a wrapper with a child of its own. */
function wrapperArgs(script, pidFile) {
  return ['-c', `"${process.execPath}" "${script}" "${pidFile}" & wait`];
}

async function readPid(pidFile) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const text = readFileSync(pidFile, 'utf8').trim();
      if (text) return Number(text);
    } catch {
      // not written yet
    }
    await sleep(20);
  }
  throw new Error('the grandchild never wrote its pid');
}

async function gone(pid) {
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await sleep(20);
  }
  return false;
}

describe('buildCommand', () => {
  it('renders the pinned eval:graded call with both output paths', () => {
    assert.deepEqual(
      buildCommand({
        config: 'evals/prompts/maplibre-cartography.yaml',
        name: '2026-09-06',
        resultsDir: 'evals/results',
        workDir: '/tmp/eval',
        baseline: false
      }),
      {
        command: 'npm',
        args: [
          'run',
          'eval:graded',
          '--',
          '--config',
          'evals/prompts/maplibre-cartography.yaml',
          '--output',
          'evals/results/2026-09-06-maplibre-cartography.csv',
          '/tmp/eval/2026-09-06-maplibre-cartography.json'
        ]
      }
    );
  });

  it('refuses a config or output path the shell could read', () => {
    assert.throws(
      () =>
        buildCommand({
          config: 'evals/prompts/$(id).yaml',
          name: '2026-09-06',
          resultsDir: 'evals/results',
          workDir: '/tmp/eval'
        }),
      (error) => error.message.includes('evals/prompts/$(id).yaml')
    );
    assert.throws(
      () =>
        buildCommand({
          config: 'evals/prompts/maplibre-cartography.yaml',
          name: '2026-09-06',
          resultsDir: 'out dir',
          workDir: '/tmp/eval'
        }),
      (error) =>
        error.message.includes('out dir/2026-09-06-maplibre-cartography.csv')
    );
    assert.throws(
      () =>
        buildCommand({
          config: 'evals/prompts/maplibre-cartography.yaml',
          name: '2026-09-06',
          resultsDir: 'evals/results',
          workDir: 'x y'
        }),
      (error) =>
        error.message.includes('x y/2026-09-06-maplibre-cartography.json')
    );
  });

  it('withholds the skill on a baseline run, and names the files for it', () => {
    const { args } = buildCommand({
      config: 'evals/prompts/maplibre-cartography.yaml',
      name: 'baseline-2026-09-06',
      resultsDir: 'evals/results',
      workDir: '/tmp/eval',
      baseline: true
    });
    assert.deepEqual(args.slice(3, 7), [
      '--config',
      'evals/prompts/maplibre-cartography.yaml',
      '--var',
      'injectSkill=false'
    ]);
    assert.ok(
      args.includes(
        'evals/results/baseline-2026-09-06-maplibre-cartography.csv'
      )
    );
  });

  it('runs again only what the first attempt did not pass, into files of its own', () => {
    const { args } = buildCommand({
      config: 'evals/prompts/maplibre-cartography.yaml',
      name: '2026-10-18',
      resultsDir: 'evals/results',
      workDir: '/tmp/eval',
      retryOf: '/tmp/eval/2026-10-18-maplibre-cartography.json'
    });
    assert.deepEqual(args.slice(5), [
      '--filter-failing',
      '/tmp/eval/2026-10-18-maplibre-cartography.json',
      '--repeat',
      '2',
      '--output',
      'evals/results/2026-10-18-maplibre-cartography-retry.csv',
      '/tmp/eval/2026-10-18-maplibre-cartography-retry.json'
    ]);
  });

  it('refuses a first-attempt sidecar path the shell could read', () => {
    assert.throws(
      () =>
        buildCommand({
          config: 'evals/prompts/maplibre-cartography.yaml',
          name: '2026-10-18',
          resultsDir: 'evals/results',
          workDir: '/tmp/eval',
          retryOf: '/tmp/$(id).json'
        }),
      (error) => error.message.includes('/tmp/$(id).json')
    );
  });
});

describe('childEnv', () => {
  it('carries the ms bound to the child and keeps the rest of the env', () => {
    const env = childEnv({ boundMs: 1800000, env: { GROQ_API_KEY: 'x' } });
    assert.equal(env.PROMPTFOO_MAX_EVAL_TIME_MS, '1800000');
    assert.equal(env.GROQ_API_KEY, 'x');
    assert.equal('PROMPTFOO_LOG_DIR' in env, false);
  });

  it("points promptfoo's debug log at the folder it is given", () => {
    const env = childEnv({ boundMs: 1, env: {}, logDir: '/tmp/eval-logs/x' });
    assert.equal(env.PROMPTFOO_LOG_DIR, '/tmp/eval-logs/x');
  });
});

describe('boundFor', () => {
  it('bounds a config at the cap while the budget is wide open', () => {
    assert.deepEqual(
      boundFor({ elapsedMs: 0, budgetMs: 240 * 60000, capMs: 30 * 60000 }),
      { skip: false, boundMs: 30 * 60000 }
    );
  });

  it('shrinks the last config to whatever budget is left', () => {
    assert.deepEqual(
      boundFor({
        elapsedMs: 225 * 60000,
        budgetMs: 240 * 60000,
        capMs: 30 * 60000
      }),
      { skip: false, boundMs: 15 * 60000 }
    );
  });

  it('skips a config it cannot give five minutes', () => {
    assert.equal(
      boundFor({
        elapsedMs: 237 * 60000,
        budgetMs: 240 * 60000,
        capMs: 30 * 60000
      }).skip,
      true
    );
    assert.equal(
      boundFor({ elapsedMs: 0, budgetMs: 0, capMs: 60000 }).skip,
      true
    );
  });
});

describe('verdictFor', () => {
  it('passes only when every row passed', () => {
    const result = verdictFor({
      exitCode: 0,
      sidecarText: sidecar([row(0), row(0)])
    });
    assert.equal(result.verdict, 'pass');
    assert.deepEqual(result.counts, { pass: 2, fail: 0, error: 0 });
    assert.deepEqual(result.tokenUsage, { total: 90 });
  });

  it('reads a graded failure behind exit 100', () => {
    const result = verdictFor({
      exitCode: 100,
      sidecarText: sidecar([row(0), row(1)])
    });
    assert.equal(result.verdict, 'fail');
  });

  it('reads a provider error even when the process exited 0', () => {
    const result = verdictFor({
      exitCode: 0,
      sidecarText: sidecar([row(0), row(2, 'Rate limit exceeded')])
    });
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.signatures, ['rate-limit']);
  });

  it('calls a missing or unreadable sidecar an error, never a pass', () => {
    const missing = verdictFor({ exitCode: 1, sidecarText: null });
    assert.equal(missing.verdict, 'error');
    assert.deepEqual(missing.signatures, ['no-output']);

    const garbage = verdictFor({ exitCode: 0, sidecarText: '{ not json' });
    assert.equal(garbage.verdict, 'error');
    assert.deepEqual(garbage.signatures, ['no-output']);

    const wrongShape = verdictFor({ exitCode: 0, sidecarText: '{"a":1}' });
    assert.equal(wrongShape.verdict, 'error');
    assert.match(wrongShape.reason, /results/);
  });

  it('calls a hard-killed config an error', () => {
    const result = verdictFor({
      exitCode: null,
      killed: true,
      sidecarText: null
    });
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.signatures, ['killed']);
    assert.match(result.reason, /wrote no output/);
  });

  it('keeps the signatures a killed config had already written', () => {
    const result = verdictFor({
      exitCode: null,
      killed: true,
      sidecarText: sidecar([
        row(0),
        row(2, 'RateLimitExhaustedError: judge gave up'),
        row(2, 'Provider timed out after 300000ms in queue')
      ])
    });
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.signatures, [
      'rate-limit-exhausted',
      'queue-timeout',
      'killed'
    ]);
    assert.deepEqual(result.counts, { pass: 1, fail: 0, error: 2 });
    assert.match(result.reason, /killed after the hard timeout/);
  });

  it('never grades a killed config, however its rows read', () => {
    const passing = verdictFor({
      exitCode: null,
      killed: true,
      sidecarText: sidecar([row(0), row(0)])
    });
    assert.equal(passing.verdict, 'error');
    assert.deepEqual(passing.signatures, ['killed']);

    const failing = verdictFor({
      exitCode: null,
      killed: true,
      sidecarText: sidecar([row(0), row(1)])
    });
    assert.equal(failing.verdict, 'error');
    assert.deepEqual(failing.signatures, ['killed']);

    const garbage = verdictFor({
      exitCode: null,
      killed: true,
      sidecarText: '{ not json'
    });
    assert.equal(garbage.verdict, 'error');
    assert.deepEqual(garbage.signatures, ['killed']);
  });
});

describe('shouldRetry', () => {
  const read = (counts, signatures = []) => ({ counts, signatures });

  it('runs again a with-skill config with one or two tests down', () => {
    assert.equal(
      shouldRetry({ verdict: read({ pass: 3, fail: 1, error: 0 }) }),
      true
    );
    assert.equal(
      shouldRetry({
        verdict: read({ pass: 2, fail: 1, error: 1 }, ['rate-limit'])
      }),
      true
    );
  });

  it('leaves alone a pass, a baseline, a cut-off, an unread output, and a broad failure', () => {
    const oneDown = read({ pass: 3, fail: 1, error: 0 });
    assert.equal(
      shouldRetry({ verdict: read({ pass: 4, fail: 0, error: 0 }) }),
      false
    );
    assert.equal(shouldRetry({ baseline: true, verdict: oneDown }), false);
    assert.equal(shouldRetry({ killed: true, verdict: oneDown }), false);
    assert.equal(
      shouldRetry({
        verdict: read({ pass: 3, fail: 0, error: 1 }, ['max-duration'])
      }),
      false
    );
    assert.equal(
      shouldRetry({ verdict: { counts: null, signatures: ['no-output'] } }),
      false
    );
    assert.equal(
      shouldRetry({ verdict: read({ pass: 1, fail: 3, error: 0 }) }),
      false
    );
  });
});

describe('combineAttempts', () => {
  it('passes a test only when its passes outnumber its failures', () => {
    const result = combineAttempts({
      firstText: sidecar([
        graded('a', 0),
        graded('b', 1),
        graded('c', 2, 'Rate limit exceeded')
      ]),
      retryText: sidecar([
        graded('b', 0),
        graded('b', 0),
        graded('c', 0),
        graded('c', 1)
      ])
    });
    assert.equal(result.verdict, 'fail');
    assert.deepEqual(result.counts, { pass: 2, fail: 1, error: 0 });
    assert.equal(result.total, 3);
    assert.deepEqual(result.signatures, []);
    assert.deepEqual(result.retried, [
      { description: 'b', attempts: ['fail', 'pass', 'pass'], verdict: 'pass' },
      { description: 'c', attempts: ['error', 'pass', 'fail'], verdict: 'fail' }
    ]);
  });

  it('keeps a failure that comes back on either re-run', () => {
    const result = combineAttempts({
      firstText: sidecar([graded('a', 0), graded('b', 1)]),
      retryText: sidecar([graded('b', 0), graded('b', 1)])
    });
    assert.equal(result.verdict, 'fail');
  });

  it('passes a test that errored first on its one graded pass', () => {
    const result = combineAttempts({
      firstText: sidecar([
        graded('a', 0),
        graded('c', 2, 'Rate limit exceeded')
      ]),
      retryText: sidecar([
        graded('c', 0),
        graded('c', 2, 'Rate limit exceeded')
      ])
    });
    assert.equal(result.verdict, 'pass');
  });

  it('calls a test an error only when none of its attempts was graded', () => {
    const result = combineAttempts({
      firstText: sidecar([
        graded('a', 0),
        graded('c', 2, 'Rate limit exceeded')
      ]),
      retryText: sidecar([
        graded('c', 2, 'Rate limit exceeded'),
        graded('c', 2, 'RateLimitExhaustedError: judge gave up')
      ])
    });
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.signatures, ['rate-limit-exhausted']);
    assert.equal(result.errors[0].description, 'c');
  });

  it('leaves the first verdict standing when the re-run wrote nothing readable', () => {
    for (const retryText of [null, '{ not json', '{"a":1}']) {
      const result = combineAttempts({
        firstText: sidecar([graded('a', 0), graded('b', 1)]),
        retryText
      });
      assert.equal(result.verdict, 'fail');
      assert.deepEqual(result.counts, { pass: 1, fail: 1, error: 0 });
      assert.deepEqual(result.retried, []);
    }
  });

  it('adds the re-run tokens to the first attempt', () => {
    const result = combineAttempts({
      firstText: sidecar([graded('b', 1)]),
      retryText: sidecar([graded('b', 0), graded('b', 0)])
    });
    assert.deepEqual(result.tokenUsage, { total: 180 });
  });
});

describe('spawnEval', () => {
  it('leaves a child that finishes on its own alone', async () => {
    const abortListeners = () =>
      ['SIGINT', 'SIGTERM', 'SIGHUP'].map((s) => process.listenerCount(s));
    const before = abortListeners();
    const result = await spawnEval(
      process.execPath,
      ['-e', 'process.exit(3)'],
      {
        env: process.env,
        killAfterMs: 30000
      }
    );
    assert.equal(result.killed, false);
    assert.equal(result.exitCode, 3);
    assert.equal(typeof result.durationMs, 'number');
    assert.deepEqual(
      abortListeners(),
      before,
      'an abort listener outlived its child'
    );
  });

  it('kills the whole process group, not just the wrapper', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spawn-eval-group-'));
    const pidFile = join(dir, 'pid');
    const script = grandchildScript(dir);
    const pending = spawnEval('sh', wrapperArgs(script, pidFile), {
      env: process.env,
      killAfterMs: 1500,
      sigkillAfterMs: 300
    });
    const pid = await readPid(pidFile);
    const result = await pending;
    assert.equal(result.killed, true);
    assert.equal(await gone(pid), true, 'the grandchild outlived the kill');
  });

  it('escalates to SIGKILL when the group ignores SIGTERM', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spawn-eval-escalate-'));
    const pidFile = join(dir, 'pid');
    const script = grandchildScript(dir, { ignoreSigterm: true });
    const pending = spawnEval('sh', wrapperArgs(script, pidFile), {
      env: process.env,
      killAfterMs: 1500,
      sigkillAfterMs: 300
    });
    const pid = await readPid(pidFile);
    const result = await pending;
    assert.equal(result.killed, true);
    assert.equal(
      await gone(pid),
      true,
      'the SIGTERM-deaf grandchild survived the escalation'
    );
  });

  it('takes the group with it when the runner itself is interrupted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spawn-eval-abort-'));
    const pidFile = join(dir, 'pid');
    const script = grandchildScript(dir);
    const source = [
      `import { spawnEval } from ${JSON.stringify(new URL('./run-evals.js', import.meta.url).href)};`,
      `await spawnEval('sh', ${JSON.stringify(wrapperArgs(script, pidFile))}, {`,
      '  env: process.env,',
      '  killAfterMs: 60000',
      '});'
    ].join('\n');
    const runner = spawnChild(
      process.execPath,
      ['--input-type=module', '-e', source],
      { stdio: 'inherit' }
    );
    const pid = await readPid(pidFile);
    runner.kill('SIGINT');
    const [code] = await once(runner, 'close');
    assert.equal(code, 130, 'the runner should exit 128 + SIGINT');
    assert.equal(await gone(pid), true, 'Ctrl-C left the grandchild running');
  });

  it('gives the group half a minute before the escalation by default', () => {
    assert.equal(SIGKILL_AFTER_MS, 30000);
  });
});

describe('measureLimits', () => {
  const pin = 'groq:openai/gpt-oss-120b';
  // A response shaped like Groq's: the minute in a header, the prompt in usage.
  const groq =
    ({ ok = true, limit = '8000', promptTokens = 76 } = {}, seen = []) =>
    async (url, request) => {
      seen.push({ url, body: JSON.parse(request.body) });
      return {
        ok,
        headers: new Headers(
          limit === null ? {} : { 'x-ratelimit-limit-tokens': limit }
        ),
        json: async () => ({ usage: { prompt_tokens: promptTokens } })
      };
    };

  it('reads the minute from its header and the template from usage', async () => {
    assert.deepEqual(await measureLimits({ pin, apiKey: 'k', fetch: groq() }), {
      tokensPerMinute: 8000,
      templateTokens: 74
    });
  });

  it('asks the pinned model for one token', async () => {
    const seen = [];
    await measureLimits({ pin, apiKey: 'k', fetch: groq({}, seen) });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].body.model, 'openai/gpt-oss-120b');
    assert.equal(seen[0].body.max_completion_tokens, 1);
  });

  it('follows a limit that has changed', async () => {
    const limits = await measureLimits({
      pin,
      apiKey: 'k',
      fetch: groq({ limit: '6000', promptTokens: 90 })
    });
    assert.deepEqual(limits, { tokensPerMinute: 6000, templateTokens: 88 });
  });

  it('gives up rather than guess', async () => {
    const refused = groq({ ok: false });
    const headerless = groq({ limit: null });
    const offline = async () => {
      throw new Error('ENOTFOUND');
    };
    for (const options of [
      { pin, apiKey: 'k', fetch: refused },
      { pin, apiKey: 'k', fetch: headerless },
      { pin, apiKey: 'k', fetch: offline },
      { pin, apiKey: undefined, fetch: groq() },
      { pin: 'google:gemini-2.5-flash-lite', apiKey: 'k', fetch: groq() }
    ]) {
      assert.equal(await measureLimits(options), null);
    }
  });
});

describe('dayRefusal', () => {
  it("reads the last refusal for the day out of Groq's own words", () => {
    const log = [
      'on tokens per day (TPD): Limit 200000, Used 195468, Requested 5469.',
      'on tokens per minute (TPM): Limit 8000, Used 7900, Requested 120.',
      'on tokens per day (TPD): Limit 200000, Used 198049, Requested 4937.'
    ].join('\n');
    assert.deepEqual(dayRefusal(log), { tokensPerDay: 200000, used: 198049 });
  });

  it('says nothing without one', () => {
    assert.equal(dayRefusal('timed out after 300000ms in queue'), null);
    assert.equal(dayRefusal(undefined), null);
  });
});

describe('daySpent', () => {
  const pin = 'groq:openai/gpt-oss-120b';
  const respond = (status, text) => async () => ({
    status,
    ok: status === 200,
    text: async () => text
  });

  it("reads the limit and the usage out of Groq's refusal for the day", async () => {
    const refusal =
      '{"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org_…` service tier `on_demand` on tokens per day (TPD): Limit 200000, Used 199923, Requested 77. Please try again in 33s.","type":"tokens","code":"rate_limit_exceeded"}}';
    assert.deepEqual(
      await daySpent({ pin, apiKey: 'k', fetch: respond(429, refusal) }),
      { tokensPerDay: 200000, used: 199923 }
    );
  });

  it('says nothing for a request that goes through or a per-minute refusal', async () => {
    const perMinute =
      '{"error":{"message":"Rate limit reached ... on tokens per minute (TPM): Limit 8000, Used 7900, Requested 120."}}';
    assert.equal(
      await daySpent({ pin, apiKey: 'k', fetch: respond(200, '{}') }),
      null
    );
    assert.equal(
      await daySpent({ pin, apiKey: 'k', fetch: respond(429, perMinute) }),
      null
    );
  });
});

describe('runEvals', () => {
  it('records every config and leaves a complete summary', async () => {
    const { resultsDir, workDir } = workspace();
    const spawn = async (command, args) => {
      const jsonPath = args[args.indexOf('--output') + 2];
      const skill = jsonPath.includes('cartography') ? 'pass' : 'fail';
      const rows = args.includes('--filter-failing')
        ? [graded('b', 1), graded('b', 1)]
        : skill === 'pass'
          ? [graded('a', 0)]
          : [graded('a', 0), graded('b', 1)];
      writeFileSync(jsonPath, sidecar(rows));
      return { exitCode: skill === 'pass' ? 0 : 100, durationMs: 1000 };
    };

    const { summary, failed } = await runEvals({
      configs: [
        'evals/prompts/maplibre-cartography.yaml',
        'evals/prompts/maplibre-fonts-glyphs.yaml'
      ],
      name: '2026-09-06',
      resultsDir,
      workDir,
      capMinutes: 30,
      budgetMinutes: 240,
      spawn,
      log: () => {}
    });

    assert.equal(failed, true);
    assert.equal(
      readFileSync(join(workDir, 'verdicts.txt'), 'utf8'),
      'maplibre-cartography:pass\nmaplibre-fonts-glyphs:fail\n'
    );
    const written = JSON.parse(
      readFileSync(join(workDir, 'summary.json'), 'utf8')
    );
    assert.deepEqual(written.planned, [
      'maplibre-cartography',
      'maplibre-fonts-glyphs'
    ]);
    assert.equal(written.configs.length, 2);
    assert.equal(written.configs[1].verdict, 'fail');
    assert.equal(written.configs[1].exitCode, 100);
    assert.deepEqual(summary.planned, written.planned);
  });

  it('hands every child the limits the run measured, and records them', async () => {
    const { resultsDir, workDir } = workspace();
    const envs = [];
    const spawn = async (command, args, { env }) => {
      envs.push(env);
      const jsonPath = args[args.indexOf('--output') + 2];
      writeFileSync(jsonPath, sidecar([row(0)]));
      return { exitCode: 0, durationMs: 1000 };
    };
    const limits = {
      tokensPerMinute: 6000,
      templateTokens: 80,
      measured: true
    };

    const { summary } = await runEvals({
      configs: ['evals/prompts/maplibre-cartography.yaml'],
      name: '2026-10-22',
      resultsDir,
      workDir,
      capMinutes: 30,
      budgetMinutes: 240,
      limits,
      env: { GROQ_API_KEY: 'k' },
      spawn,
      log: () => {}
    });

    assert.equal(envs[0].EVAL_TOKENS_PER_MINUTE, '6000');
    assert.equal(envs[0].EVAL_TEMPLATE_TOKENS, '80');
    assert.equal(envs[0].GROQ_API_KEY, 'k');
    assert.deepEqual(summary.limits, limits);
  });

  it('runs the longest-waiting configs that fit what the day has left, and makes the rest wait', async () => {
    const { resultsDir, workDir } = workspace();
    const ran = [];
    const spawn = async (command, args) => {
      const jsonPath = args[args.indexOf('--output') + 2];
      ran.push(jsonPath);
      // Each config spends 90 tokens (the fixture's tokenUsage).
      writeFileSync(jsonPath, sidecar([row(0)]));
      return { exitCode: 0, durationMs: 1000 };
    };
    const a = 'evals/prompts/maplibre-a.yaml';
    const b = 'evals/prompts/maplibre-b.yaml';
    const c = 'evals/prompts/maplibre-c.yaml';
    // Worst cases: a 120, b 140, c 100, against a day of 230.
    const costs = new Map([
      [a, { firstPass: 120, largest: 0 }],
      [b, { firstPass: 140, largest: 0 }],
      [c, { firstPass: 100, largest: 0 }]
    ]);

    const { summary } = await runEvals({
      configs: [a, b, c],
      name: '2026-10-22',
      resultsDir,
      workDir,
      capMinutes: 30,
      budgetMinutes: 240,
      costs,
      tokensPerDay: 230,
      spawn,
      log: () => {}
    });

    // a ran and spent 90, which left 140 for b; then 50 left, so c waits.
    assert.deepEqual(summary.planned, ['maplibre-a', 'maplibre-b']);
    assert.deepEqual(summary.day, {
      tokensPerDay: 230,
      spent: 180,
      waiting: ['maplibre-c']
    });
    assert.equal(ran.length, 2);
  });

  it("stops starting configs once a child's debug log holds Groq's refusal for the day", async () => {
    const { resultsDir, workDir } = workspace();
    const logsDir = mkdtempSync(join(tmpdir(), 'eval-logs-'));
    const ran = [];
    const spawn = async (command, args, { env }) => {
      const jsonPath = args[args.indexOf('--output') + 2];
      ran.push(jsonPath);
      // What promptfoo leaves: a queue timeout in the sidecar, Groq's words in the log.
      mkdirSync(env.PROMPTFOO_LOG_DIR, { recursive: true });
      writeFileSync(
        join(
          env.PROMPTFOO_LOG_DIR,
          'promptfoo-debug-2026-10-21_19-48-38-062Z.log'
        ),
        '"message":"Rate limit reached ... on tokens per day (TPD): Limit 200000, Used 198049, Requested 4937."'
      );
      writeFileSync(
        jsonPath,
        sidecar([
          row(
            2,
            'Request groq:openai/gpt-oss-120b timed out after 300000ms in queue'
          )
        ])
      );
      return { exitCode: 100, durationMs: 1000 };
    };

    const { summary } = await runEvals({
      configs: [
        'evals/prompts/maplibre-cartography.yaml',
        'evals/prompts/maplibre-fonts-glyphs.yaml'
      ],
      name: '2026-10-22',
      resultsDir,
      workDir,
      capMinutes: 30,
      budgetMinutes: 240,
      logsDir,
      spawn,
      log: () => {}
    });

    assert.equal(ran.length, 1);
    assert.deepEqual(summary.planned, ['maplibre-cartography']);
    assert.deepEqual(summary.day.spentByGroq, {
      tokensPerDay: 200000,
      used: 198049
    });
    assert.deepEqual(summary.day.waiting, ['maplibre-fonts-glyphs']);
  });

  it('records the shard in the summary when the run is one slice of the week', async () => {
    const { resultsDir, workDir } = workspace();
    const spawn = async (command, args) => {
      const jsonPath = args[args.indexOf('--output') + 2];
      writeFileSync(jsonPath, sidecar([row(0)]));
      return { exitCode: 0, durationMs: 1000 };
    };

    const { summary } = await runEvals({
      configs: ['evals/prompts/maplibre-cartography.yaml'],
      name: '2026-10-11',
      shard: '1/2',
      resultsDir,
      workDir,
      capMinutes: 30,
      budgetMinutes: 240,
      spawn,
      log: () => {}
    });

    assert.equal(summary.shard, '1/2');
    const written = JSON.parse(
      readFileSync(join(workDir, 'summary.json'), 'utf8')
    );
    assert.equal(written.shard, '1/2');
  });

  it('runs a failing test again and lets its attempts decide', async () => {
    const { resultsDir, workDir } = workspace();
    const calls = [];
    const spawn = async (command, args) => {
      calls.push(args);
      const retry = args.includes('--filter-failing');
      const jsonPath = args[args.indexOf('--output') + 2];
      writeFileSync(
        jsonPath,
        sidecar(
          retry
            ? [graded('b', 0), graded('b', 0)]
            : [graded('a', 0), graded('b', 1)]
        )
      );
      return { exitCode: retry ? 0 : 100, durationMs: 1000 };
    };

    const { summary, failed } = await runEvals({
      configs: ['evals/prompts/maplibre-cartography.yaml'],
      name: '2026-10-18',
      resultsDir,
      workDir,
      capMinutes: 30,
      budgetMinutes: 240,
      spawn,
      log: () => {}
    });

    assert.equal(failed, false);
    assert.equal(calls.length, 2);
    assert.equal(
      calls[1][calls[1].indexOf('--filter-failing') + 1],
      join(workDir, '2026-10-18-maplibre-cartography.json')
    );
    assert.equal(
      readFileSync(join(workDir, 'verdicts.txt'), 'utf8'),
      'maplibre-cartography:pass\n'
    );
    const [record] = summary.configs;
    assert.deepEqual(record.counts, { pass: 2, fail: 0, error: 0 });
    assert.equal(record.exitCode, 100);
    assert.deepEqual(record.retry.tests, [
      { description: 'b', attempts: ['fail', 'pass', 'pass'], verdict: 'pass' }
    ]);
  });

  it('never runs a baseline failure again', async () => {
    const { resultsDir, workDir } = workspace();
    let calls = 0;
    const spawn = async (command, args) => {
      calls++;
      const jsonPath = args[args.indexOf('--output') + 2];
      writeFileSync(jsonPath, sidecar([graded('a', 0), graded('b', 1)]));
      return { exitCode: 100, durationMs: 1000 };
    };

    const { summary } = await runEvals({
      configs: ['evals/prompts/maplibre-cartography.yaml'],
      name: 'baseline-2026-10-18',
      baseline: true,
      resultsDir,
      workDir,
      capMinutes: 30,
      budgetMinutes: 240,
      spawn,
      log: () => {}
    });

    assert.equal(calls, 1);
    assert.equal(summary.configs[0].verdict, 'fail');
    assert.equal(summary.configs[0].retry, null);
  });

  it('records one not-run error per config when the budget is gone', async () => {
    const { resultsDir, workDir } = workspace();
    const spawn = async () => {
      throw new Error('the runner must not spend quota it has no budget for');
    };

    const { summary, failed } = await runEvals({
      configs: [
        'evals/prompts/maplibre-cartography.yaml',
        'evals/prompts/maplibre-fonts-glyphs.yaml'
      ],
      name: '2026-09-06',
      resultsDir,
      workDir,
      capMinutes: 30,
      budgetMinutes: 0,
      spawn,
      log: () => {}
    });

    assert.equal(failed, true);
    assert.equal(
      readFileSync(join(workDir, 'verdicts.txt'), 'utf8'),
      'maplibre-cartography:error\nmaplibre-fonts-glyphs:error\n'
    );
    assert.equal(summary.configs.length, 2);
    for (const config of summary.configs) {
      assert.equal(config.verdict, 'error');
      assert.deepEqual(config.signatures, ['not-run']);
      assert.match(config.reason, /budget exhausted/);
    }
  });
});

describe('dayCost', () => {
  it('adds every allowed re-run, at the largest request, to the first pass', () => {
    // MAX_RETRIED_TESTS (2) tests, RETRY_REPEATS (2) times each.
    assert.equal(
      dayCost({ firstPass: 30000, largest: 7900 }),
      30000 + 4 * 7900
    );
  });
});

describe('longestWaiting', () => {
  const config = (skill) => `evals/prompts/maplibre-${skill}.yaml`;
  const graded = new Map([
    ['maplibre-a', '2026-10-16'],
    ['maplibre-b', '2026-10-21'],
    ['maplibre-c', '2026-10-16']
  ]);

  it('puts the never-graded first, then the oldest verdict, names breaking ties', () => {
    assert.deepEqual(
      longestWaiting({
        configs: [config('b'), config('c'), config('new'), config('a')],
        graded
      }),
      [config('new'), config('a'), config('c'), config('b')]
    );
  });
});

describe('dryRunLines', () => {
  it('prints the command, the bound, and both output paths per config', () => {
    const lines = dryRunLines({
      configs: ['evals/prompts/maplibre-cartography.yaml'],
      name: '2026-09-06',
      baseline: false,
      resultsDir: 'evals/results',
      workDir: '/tmp/eval',
      capMinutes: 30,
      budgetMinutes: 240
    });
    const command = lines.find((line) => line.includes('eval:graded'));
    assert.match(command, /PROMPTFOO_MAX_EVAL_TIME_MS=1800000/);
    assert.match(
      command,
      /--output evals\/results\/2026-09-06-maplibre-cartography\.csv \/tmp\/eval\/2026-09-06-maplibre-cartography\.json/
    );
    assert.ok(lines.some((line) => line.includes('240')));
  });
});

describe('parseShard', () => {
  it('reads k/n the way the workflow writes it', () => {
    assert.deepEqual(parseShard('1/2'), { index: 1, count: 2 });
    assert.deepEqual(parseShard('2/2'), { index: 2, count: 2 });
    assert.deepEqual(parseShard('10/12'), { index: 10, count: 12 });
  });

  it('rejects everything that is not a 1-based slice of a count', () => {
    const rejected = [
      '0/2',
      '3/2',
      '1-2',
      '1/2/3',
      '1/',
      '/2',
      '1/0',
      'x',
      '',
      undefined
    ];
    for (const value of rejected) {
      assert.throws(() => parseShard(value), /Not a shard/);
    }
  });
});

describe('shardOf', () => {
  const configs = (n) =>
    Array.from(
      { length: n },
      (_, i) => `evals/prompts/skill-${String(i).padStart(2, '0')}.yaml`
    );

  it('splits eight configs into two halves of four', () => {
    const all = configs(8);
    assert.deepEqual(shardOf(all, { index: 1, count: 2 }), all.slice(0, 4));
    assert.deepEqual(shardOf(all, { index: 2, count: 2 }), all.slice(4));
  });

  it('hands the earlier slices the remainder: halves of nine are five then four', () => {
    const all = configs(9);
    assert.deepEqual(shardOf(all, { index: 1, count: 2 }), all.slice(0, 5));
    assert.deepEqual(shardOf(all, { index: 2, count: 2 }), all.slice(5));
  });

  it('keeps every slice within one of the others: quarters of nine are 3,2,2,2', () => {
    const all = configs(9);
    const sizes = [1, 2, 3, 4].map(
      (index) => shardOf(all, { index, count: 4 }).length
    );
    assert.deepEqual(sizes, [3, 2, 2, 2]);
  });

  it('covers every config exactly once, with no slice empty while configs are not outnumbered', () => {
    for (const length of [1, 2, 3, 7, 8, 9, 11]) {
      for (const count of [1, 2, 3, 4]) {
        const all = configs(length);
        const seen = [];
        for (let index = 1; index <= count; index++) {
          const slice = shardOf(all, { index, count });
          if (length >= count) {
            assert.ok(
              slice.length > 0,
              `slice ${index}/${count} of ${length} configs is empty`
            );
          }
          seen.push(...slice);
        }
        assert.deepEqual(seen, all, `${length} configs in ${count} slices`);
      }
    }
  });

  it('returns an empty slice when the count outruns the configs', () => {
    assert.deepEqual(shardOf(configs(2), { index: 3, count: 3 }), []);
  });
});
