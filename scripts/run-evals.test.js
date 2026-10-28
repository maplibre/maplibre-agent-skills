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
  judgeDaySpent,
  judgePin,
  judgeRefusal,
  longestWaiting,
  measureLimits,
  paceMs,
  parseShard,
  planRun,
  rateLimitWaits,
  reserveAfter,
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

  it("adds the config's pace after the script's own delay, so it is the one promptfoo keeps", () => {
    const { args } = buildCommand({
      config: 'evals/prompts/maplibre-cartography.yaml',
      name: '2026-10-22',
      resultsDir: 'evals/results',
      workDir: '/tmp/eval',
      delayMs: 46163
    });
    assert.deepEqual(
      args.slice(args.indexOf('--delay'), args.indexOf('--delay') + 2),
      ['--delay', '46163']
    );
    assert.ok(args.indexOf('--delay') > args.indexOf('--'));
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

  it('has promptfoo retry a 5xx rather than file it as an error', () => {
    assert.equal(childEnv({ boundMs: 1, env: {} }).PROMPTFOO_RETRY_5XX, 'true');
  });
});

describe('boundFor', () => {
  it('gives a config what the budget has left after the reserve', () => {
    assert.deepEqual(
      boundFor({
        elapsedMs: 20 * 60000,
        budgetMs: 240 * 60000,
        reserveMs: 40 * 60000
      }),
      { skip: false, boundMs: 180 * 60000 }
    );
  });

  it('gives the last config whatever budget is left', () => {
    assert.deepEqual(
      boundFor({ elapsedMs: 225 * 60000, budgetMs: 240 * 60000 }),
      { skip: false, boundMs: 15 * 60000 }
    );
  });

  it('skips a config it cannot give five minutes', () => {
    assert.equal(
      boundFor({ elapsedMs: 237 * 60000, budgetMs: 240 * 60000 }).skip,
      true
    );
    assert.equal(
      boundFor({
        elapsedMs: 0,
        budgetMs: 240 * 60000,
        reserveMs: 236 * 60000
      }).skip,
      true
    );
    assert.equal(boundFor({ elapsedMs: 0, budgetMs: 0 }).skip, true);
  });
});

describe('paceMs', () => {
  it("spaces requests by the largest one's share of the minute", () => {
    assert.equal(paceMs({ largest: 8000, tokensPerMinute: 8000 }), 60000);
    assert.equal(paceMs({ largest: 6155, tokensPerMinute: 8000 }), 46163);
    assert.equal(paceMs({ largest: 6155, tokensPerMinute: 30000 }), 12310);
  });
});

describe('reserveAfter', () => {
  const costs = new Map([
    ['b.yaml', { firstPass: 300, largest: 120, requests: 3 }],
    ['c.yaml', { firstPass: 100, largest: 60, requests: 2 }]
  ]);

  it('adds up the paced requests of the configs the day still holds', () => {
    // b needs 300 + 4 * 120 = 780 tokens, c 100 + 4 * 60 = 340.
    assert.equal(
      reserveAfter({
        rest: ['b.yaml', 'c.yaml'],
        costs,
        tokensLeft: 1120,
        tokensPerMinute: 120
      }),
      3 * 60000 + 2 * 30000
    );
  });

  it('leaves out a config the day cannot hold, and one it cannot size', () => {
    assert.equal(
      reserveAfter({
        rest: ['b.yaml', 'unsized.yaml', 'c.yaml'],
        costs,
        tokensLeft: 400,
        tokensPerMinute: 120
      }),
      2 * 30000
    );
  });
});

describe('rateLimitWaits', () => {
  it('sums the waits a debug log records, by host', () => {
    const log = [
      '2026-10-22T17:53:33.438Z [DEBUG] [logger-B9f-j62Q.js:1215]: Rate limited on URL https://api.groq.com/openai/v1/chat/completions: HTTP 429 Too Many Requests, attempt 1/5, waiting before retry...',
      '2026-10-22T17:53:33.438Z [DEBUG] [logger-B9f-j62Q.js:1215]: Rate limited, waiting 518720ms (base 518400ms + 320ms jitter) before retry',
      'Rate limited on URL https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=***: HTTP 429 Too Many Requests, attempt 1/5, waiting before retry...',
      'Rate limited, waiting 60000ms (base 60000ms + 0ms jitter) before retry',
      'Rate limited on URL https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=***: HTTP 429 Too Many Requests, attempt 2/5, waiting before retry...',
      'Rate limited, waiting 61000ms (base 60000ms + 1000ms jitter) before retry'
    ].join('\n');
    assert.deepEqual(rateLimitWaits(log), [
      { host: 'api.groq.com', count: 1, ms: 518720 },
      { host: 'generativelanguage.googleapis.com', count: 2, ms: 121000 }
    ]);
  });

  it('finds nothing in a log without waits, or no log at all', () => {
    assert.deepEqual(rateLimitWaits('Running 5 test cases'), []);
    assert.deepEqual(rateLimitWaits(''), []);
    assert.deepEqual(rateLimitWaits(null), []);
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
  it('fails a test that failed on any graded attempt', () => {
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
    assert.deepEqual(result.counts, { pass: 1, fail: 2, error: 0 });
    assert.equal(result.total, 3);
    assert.deepEqual(result.signatures, []);
    assert.deepEqual(result.retried, [
      { description: 'b', attempts: ['fail', 'pass', 'pass'], verdict: 'fail' },
      { description: 'c', attempts: ['error', 'pass', 'fail'], verdict: 'fail' }
    ]);
  });

  it('never lets two passing re-runs outvote the first failure', () => {
    const result = combineAttempts({
      firstText: sidecar([graded('a', 0), graded('b', 1)]),
      retryText: sidecar([graded('b', 0), graded('b', 0)])
    });
    assert.equal(result.verdict, 'fail');
    assert.deepEqual(result.counts, { pass: 1, fail: 1, error: 0 });
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
      { pin: 'google:gemini-3.1-flash-lite', apiKey: 'k', fetch: groq() }
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

describe('judgePin', () => {
  it('reads the --grader of the eval:graded script', () => {
    const packageJson = {
      scripts: {
        'eval:graded':
          'promptfoo eval --grader google:gemini-3.1-flash-lite --delay 8000 --no-cache -j 1'
      }
    };
    assert.equal(judgePin(packageJson), 'google:gemini-3.1-flash-lite');
    assert.equal(judgePin({ scripts: {} }), null);
  });
});

// The shape of Google's 429 body: a QuotaFailure naming the quota, a Help
// link, and a RetryInfo whose short delay holds even for a per-day quota.
function googleRefusal(quotaId, quotaValue = '20') {
  return JSON.stringify({
    error: {
      code: 429,
      message:
        'You exceeded your current quota, please check your plan and billing details.',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [
            {
              quotaMetric:
                'generativelanguage.googleapis.com/generate_content_free_tier_requests',
              quotaId,
              quotaDimensions: {
                location: 'global',
                model: 'gemini-3.1-flash-lite'
              },
              ...(quotaValue === null ? {} : { quotaValue })
            }
          ]
        },
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: '41s'
        }
      ]
    }
  });
}

const PER_DAY = 'GenerateRequestsPerDayPerProjectPerModel-FreeTier';
const PER_MINUTE = 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier';

describe('judgeRefusal', () => {
  it("reads the quota, its limit and the model out of Google's refusal for the day", () => {
    assert.deepEqual(judgeRefusal(googleRefusal(PER_DAY)), {
      quotaId: PER_DAY,
      limit: 20,
      model: 'gemini-3.1-flash-lite'
    });
  });

  it('keeps the quota when Google states no limit', () => {
    assert.deepEqual(judgeRefusal(googleRefusal(PER_DAY, null)), {
      quotaId: PER_DAY,
      limit: null,
      model: 'gemini-3.1-flash-lite'
    });
  });

  it('says nothing of a per-minute refusal, a 503, or a body that is not JSON', () => {
    assert.equal(judgeRefusal(googleRefusal(PER_MINUTE)), null);
    assert.equal(
      judgeRefusal(
        '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'
      ),
      null
    );
    assert.equal(judgeRefusal('Too Many Requests'), null);
    assert.equal(judgeRefusal(undefined), null);
  });
});

describe('judgeDaySpent', () => {
  const pin = 'google:gemini-3.1-flash-lite';
  const respond =
    (status, text, seen = []) =>
    async (url, request) => {
      seen.push({ url, request });
      return { status, text: async () => text };
    };

  it('asks the pinned model for one token, with the key in its header', async () => {
    const seen = [];
    await judgeDaySpent({
      pin,
      apiKey: 'k',
      fetch: respond(429, googleRefusal(PER_DAY), seen)
    });
    assert.equal(seen.length, 1);
    assert.equal(
      seen[0].url,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent'
    );
    assert.equal(seen[0].request.headers['x-goog-api-key'], 'k');
    assert.equal(
      JSON.parse(seen[0].request.body).generationConfig.maxOutputTokens,
      1
    );
  });

  it("reads Google's refusal for the day", async () => {
    assert.deepEqual(
      await judgeDaySpent({
        pin,
        apiKey: 'k',
        fetch: respond(429, googleRefusal(PER_DAY))
      }),
      { quotaId: PER_DAY, limit: 20, model: 'gemini-3.1-flash-lite' }
    );
  });

  it("puts a refusal it cannot read into the run log in Google's words", async () => {
    const lines = [];
    const said = await judgeDaySpent({
      pin,
      apiKey: 'k',
      fetch: respond(
        429,
        '{"error":{"code":429,"message":"Resource has been exhausted (e.g. check quota).","status":"RESOURCE_EXHAUSTED"}}'
      ),
      log: (line) => lines.push(line)
    });
    assert.equal(said, null);
    assert.deepEqual(lines, [
      "  Google answered the judge's probe with 429, not a daily quota: Resource has been exhausted (e.g. check quota)."
    ]);
  });

  it('says nothing when the judge answers, refuses for the minute, or cannot be asked', async () => {
    const offline = async () => {
      throw new Error('ENOTFOUND');
    };
    for (const options of [
      { pin, apiKey: 'k', fetch: respond(200, '{}') },
      { pin, apiKey: 'k', fetch: respond(429, googleRefusal(PER_MINUTE)) },
      { pin, apiKey: 'k', fetch: offline },
      { pin, apiKey: undefined, fetch: respond(429, googleRefusal(PER_DAY)) },
      {
        pin: 'groq:openai/gpt-oss-120b',
        apiKey: 'k',
        fetch: respond(429, googleRefusal(PER_DAY))
      }
    ]) {
      assert.equal(await judgeDaySpent(options), null);
    }
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

  it('records beside the CSVs what each config it graded was graded on', async () => {
    const { resultsDir, workDir } = workspace();
    const cartography = 'evals/prompts/maplibre-cartography.yaml';
    const fonts = 'evals/prompts/maplibre-fonts-glyphs.yaml';
    // The fonts child writes nothing, so that config gets no verdict.
    const spawn = async (command, args) => {
      const jsonPath = args[args.indexOf('--output') + 2];
      if (jsonPath.includes('cartography')) {
        writeFileSync(jsonPath, sidecar([graded('a', 0)]));
      }
      return { exitCode: 0, durationMs: 1000 };
    };
    const inputs = new Map([
      [cartography, { skill: 's1', config: 'c1', harness: 'h' }],
      [fonts, { skill: 's2', config: 'c2', harness: 'h' }]
    ]);

    await runEvals({
      configs: [cartography, fonts],
      name: '2026-10-27',
      resultsDir,
      workDir,
      budgetMinutes: 240,
      judge: 'the-judge',
      inputs,
      commit: 'abc123',
      spawn,
      log: () => {}
    });

    assert.deepEqual(
      JSON.parse(readFileSync(join(resultsDir, '2026-10-27.json'), 'utf8')),
      {
        commit: 'abc123',
        configs: {
          'maplibre-cartography': {
            inputs: { skill: 's1', config: 'c1', harness: 'h' },
            judge: 'the-judge'
          }
        }
      }
    );
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
    assert.equal(summary.configs[0].dayCut, 'generator');
  });

  // What promptfoo leaves when Google refuses the judge: ERROR rows naming the
  // judge, and in its debug log the waits, but never Google's body.
  const JUDGE_REFUSED =
    'RateLimitExhaustedError: Rate limit exceeded for google:gemini-3.1-flash-lite after 4 attempts';
  const judgeWaits = (dir) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'promptfoo-debug-2026-10-24_10-50-02-597Z.log'),
      [
        'Rate limited on URL https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent: HTTP 429 Too Many Requests, attempt 1/5, waiting before retry...',
        'Rate limited, waiting 60516ms (base 60000ms + 516ms jitter) before retry'
      ].join('\n')
    );
  };
  // Writes both outputs, as promptfoo does: the CSV the publish job commits
  // and the sidecar the verdict is read from.
  const outputs = (args, rows) => {
    const at = args.indexOf('--output');
    writeFileSync(args[at + 1], 'Description,Status\n');
    writeFileSync(args[at + 2], sidecar(rows));
  };
  const googleSays =
    (status, calls = []) =>
    async (url) => {
      calls.push(url);
      return {
        status,
        text: async () => (status === 429 ? googleRefusal(PER_DAY) : '{}')
      };
    };
  const judged = {
    judge: 'google:gemini-3.1-flash-lite',
    env: { GOOGLE_API_KEY: 'k' }
  };

  it('ends the day when Google refuses the judge for its daily quota, and does not fail the run for it', async () => {
    const { resultsDir, workDir } = workspace();
    const logsDir = mkdtempSync(join(tmpdir(), 'eval-logs-'));
    const ran = [];
    const spawn = async (command, args, { env }) => {
      ran.push(args);
      if (args.includes('evals/prompts/maplibre-fonts-glyphs.yaml')) {
        judgeWaits(env.PROMPTFOO_LOG_DIR);
        outputs(args, [row(0), row(2, JUDGE_REFUSED)]);
        return { exitCode: 100, durationMs: 1000 };
      }
      outputs(args, [row(0)]);
      return { exitCode: 0, durationMs: 1000 };
    };
    const lines = [];

    const { summary, failed } = await runEvals({
      configs: [
        'evals/prompts/maplibre-cartography.yaml',
        'evals/prompts/maplibre-fonts-glyphs.yaml',
        'evals/prompts/maplibre-mapbox-migration.yaml'
      ],
      name: '2026-10-24',
      resultsDir,
      workDir,
      budgetMinutes: 240,
      logsDir,
      ...judged,
      spawn,
      fetch: googleSays(429),
      log: (line) => lines.push(line)
    });

    // No re-run: the judge would refuse it too.
    assert.equal(ran.length, 2);
    assert.deepEqual(summary.day.judgeSpent, {
      quotaId: PER_DAY,
      limit: 20,
      model: 'gemini-3.1-flash-lite'
    });
    assert.deepEqual(summary.day.waiting, ['maplibre-mapbox-migration']);
    const cut = summary.configs[1];
    assert.equal(cut.verdict, 'error');
    assert.equal(cut.dayCut, 'judge');
    assert.ok(cut.signatures.includes('day-spent'));
    assert.equal(failed, false);
    assert.equal(
      readFileSync(join(workDir, 'verdicts.txt'), 'utf8'),
      'maplibre-cartography:pass\nmaplibre-fonts-glyphs:error\n'
    );
    assert.ok(
      lines.includes(
        `Google refused the judge for its daily quota (20 requests a day for gemini-3.1-flash-lite, ${PER_DAY}); the rest wait for another day.`
      )
    );
    // Its CSV is set aside, so the rotation keeps it first in line.
    assert.throws(() =>
      readFileSync(join(resultsDir, '2026-10-24-maplibre-fonts-glyphs.csv'))
    );
    readFileSync(
      join(workDir, 'day-spent', '2026-10-24-maplibre-fonts-glyphs.csv')
    );
    readFileSync(join(resultsDir, '2026-10-24-maplibre-cartography.csv'));
  });

  it('leaves an error standing when the judge still answers', async () => {
    const { resultsDir, workDir } = workspace();
    const logsDir = mkdtempSync(join(tmpdir(), 'eval-logs-'));
    const calls = [];
    const spawn = async (command, args, { env }) => {
      if (args.includes('evals/prompts/maplibre-fonts-glyphs.yaml')) {
        judgeWaits(env.PROMPTFOO_LOG_DIR);
        outputs(args, [row(2, JUDGE_REFUSED)]);
        return { exitCode: 100, durationMs: 1000 };
      }
      outputs(args, [row(0)]);
      return { exitCode: 0, durationMs: 1000 };
    };

    const { summary, failed } = await runEvals({
      configs: [
        'evals/prompts/maplibre-fonts-glyphs.yaml',
        'evals/prompts/maplibre-mapbox-migration.yaml'
      ],
      name: '2026-10-24',
      resultsDir,
      workDir,
      budgetMinutes: 240,
      logsDir,
      ...judged,
      spawn,
      fetch: googleSays(200, calls),
      log: () => {}
    });

    // Asked after the first attempt and again after its re-run.
    assert.equal(calls.length, 2);
    assert.equal(summary.day.judgeSpent, undefined);
    assert.equal(summary.configs[0].verdict, 'error');
    assert.equal(summary.configs[0].dayCut, undefined);
    assert.equal(summary.configs[1].verdict, 'pass');
    assert.equal(failed, true);
  });

  it('cuts a config whose re-runs the judge could not grade', async () => {
    const { resultsDir, workDir } = workspace();
    const logsDir = mkdtempSync(join(tmpdir(), 'eval-logs-'));
    const spawn = async (command, args, { env }) => {
      if (!args.includes('evals/prompts/maplibre-cartography.yaml')) {
        outputs(args, [graded('a', 0)]);
        return { exitCode: 0, durationMs: 1000 };
      }
      if (args.includes('--filter-failing')) {
        judgeWaits(env.PROMPTFOO_LOG_DIR);
        outputs(args, [
          graded('b', 2, JUDGE_REFUSED),
          graded('b', 2, JUDGE_REFUSED)
        ]);
        return { exitCode: 100, durationMs: 1000 };
      }
      outputs(args, [graded('a', 0), graded('b', 1)]);
      return { exitCode: 100, durationMs: 1000 };
    };

    const { summary, failed } = await runEvals({
      configs: [
        'evals/prompts/maplibre-mapbox-migration.yaml',
        'evals/prompts/maplibre-cartography.yaml',
        'evals/prompts/maplibre-fonts-glyphs.yaml'
      ],
      name: '2026-10-24',
      resultsDir,
      workDir,
      budgetMinutes: 240,
      logsDir,
      ...judged,
      spawn,
      fetch: googleSays(429),
      log: () => {}
    });

    // One graded failure is not a verdict when its re-runs were refused.
    const cut = summary.configs[1];
    assert.equal(cut.verdict, 'error');
    assert.equal(cut.dayCut, 'judge');
    assert.deepEqual(summary.day.waiting, ['maplibre-fonts-glyphs']);
    assert.equal(failed, false);
    for (const stem of ['', '-retry']) {
      readFileSync(
        join(workDir, 'day-spent', `2026-10-24-maplibre-cartography${stem}.csv`)
      );
    }
  });

  it('fails a run that graded nothing, whatever ended its day', async () => {
    const { resultsDir, workDir } = workspace();
    const logsDir = mkdtempSync(join(tmpdir(), 'eval-logs-'));
    const spawn = async (command, args, { env }) => {
      judgeWaits(env.PROMPTFOO_LOG_DIR);
      outputs(args, [row(2, JUDGE_REFUSED)]);
      return { exitCode: 100, durationMs: 1000 };
    };
    const lines = [];

    const { summary, failed } = await runEvals({
      configs: [
        'evals/prompts/maplibre-fonts-glyphs.yaml',
        'evals/prompts/maplibre-mapbox-migration.yaml'
      ],
      name: '2026-10-24',
      resultsDir,
      workDir,
      budgetMinutes: 240,
      logsDir,
      ...judged,
      spawn,
      fetch: googleSays(429),
      log: (line) => lines.push(line)
    });

    assert.equal(summary.configs[0].dayCut, 'judge');
    assert.deepEqual(summary.day.waiting, ['maplibre-mapbox-migration']);
    assert.equal(failed, true);
    assert.ok(lines.includes('No config got a verdict today.'));
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

  it('runs a failing test again and keeps the failure whatever the re-runs say', async () => {
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
      budgetMinutes: 240,
      spawn,
      log: () => {}
    });

    assert.equal(failed, true);
    assert.equal(calls.length, 2);
    assert.equal(
      calls[1][calls[1].indexOf('--filter-failing') + 1],
      join(workDir, '2026-10-18-maplibre-cartography.json')
    );
    assert.equal(
      readFileSync(join(workDir, 'verdicts.txt'), 'utf8'),
      'maplibre-cartography:fail\n'
    );
    const [record] = summary.configs;
    assert.deepEqual(record.counts, { pass: 1, fail: 1, error: 0 });
    assert.equal(record.exitCode, 100);
    assert.deepEqual(record.retry.tests, [
      { description: 'b', attempts: ['fail', 'pass', 'pass'], verdict: 'fail' }
    ]);
  });

  it('passes a test a provider error left ungraded once its re-runs grade it', async () => {
    const { resultsDir, workDir } = workspace();
    const spawn = async (command, args) => {
      const retry = args.includes('--filter-failing');
      const jsonPath = args[args.indexOf('--output') + 2];
      writeFileSync(
        jsonPath,
        sidecar(
          retry
            ? [graded('b', 0), graded('b', 0)]
            : [graded('a', 0), graded('b', 2, 'Rate limit exceeded')]
        )
      );
      return { exitCode: retry ? 0 : 1, durationMs: 1000 };
    };

    const { summary, failed } = await runEvals({
      configs: ['evals/prompts/maplibre-cartography.yaml'],
      name: '2026-10-18',
      resultsDir,
      workDir,
      budgetMinutes: 240,
      spawn,
      log: () => {}
    });

    assert.equal(failed, false);
    assert.equal(
      readFileSync(join(workDir, 'verdicts.txt'), 'utf8'),
      'maplibre-cartography:pass\n'
    );
    assert.deepEqual(summary.configs[0].retry.tests, [
      { description: 'b', attempts: ['error', 'pass', 'pass'], verdict: 'pass' }
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

describe('planRun', () => {
  const config = (skill) => `evals/prompts/maplibre-${skill}.yaml`;
  const same = { skill: 's', config: 'c', harness: 'h' };
  const plan = ({ graded, recorded = {}, inputs = {}, regradeDays = 0 }) =>
    planRun({
      configs: Object.keys(graded).map(config),
      graded: new Map(
        Object.entries(graded)
          .filter(([, date]) => date !== null)
          .map(([skill, date]) => [`maplibre-${skill}`, date])
      ),
      recorded: new Map(
        Object.keys(graded).map((skill) => [
          `maplibre-${skill}`,
          skill in recorded ? recorded[skill] : same
        ])
      ),
      inputs: new Map(
        Object.keys(graded).map((skill) => [
          config(skill),
          inputs[skill] ?? same
        ])
      ),
      today: '2026-10-26',
      regradeDays
    });
  const due = (result) =>
    result.due.map(({ config, why }) => [
      config.replace(/^.*maplibre-|\.yaml$/g, ''),
      why
    ]);

  it('grades a config whose inputs changed since its last grade, and says which', () => {
    const result = plan({
      graded: { a: '2026-10-20', b: '2026-10-20' },
      inputs: {
        a: { ...same, skill: 't' },
        b: { ...same, config: 'd', harness: 'i' }
      }
    });
    assert.deepEqual(due(result), [
      ['a', 'SKILL.md changed since its grade of 2026-10-20'],
      ['b', 'eval config and harness changed since its grade of 2026-10-20']
    ]);
    assert.deepEqual(result.later, []);
  });

  it('grades a config with no grade, no recorded inputs, or inputs it cannot read, the longest-waiting first', () => {
    const result = plan({
      graded: { a: '2026-10-24', b: null, c: '2026-10-22' },
      recorded: { c: null },
      inputs: { a: { error: 'ENOENT: skills/maplibre-a/SKILL.md' } }
    });
    assert.deepEqual(due(result), [
      ['b', 'no graded run yet'],
      ['c', 'graded 2026-10-22 by a run that recorded no inputs'],
      ['a', 'inputs unreadable: ENOENT: skills/maplibre-a/SKILL.md']
    ]);
  });

  it('grades only what changed when no regrade period is set', () => {
    const result = plan({ graded: { a: '2026-09-01' } });
    assert.deepEqual(result.due, []);
    assert.deepEqual(result.later, [
      { config: config('a'), why: 'graded 2026-09-01 on its current inputs' }
    ]);
  });

  it('grades an unchanged config once its grade is the regrade period old, after every changed one', () => {
    const result = plan({
      graded: { a: '2026-10-19', b: '2026-10-25', c: '2026-10-20' },
      inputs: { b: { ...same, skill: 't' } },
      regradeDays: 7
    });
    assert.deepEqual(due(result), [
      ['b', 'SKILL.md changed since its grade of 2026-10-25'],
      ['a', 'last graded 2026-10-19, 7 days ago']
    ]);
    assert.deepEqual(result.later, [
      {
        config: config('c'),
        why: 'graded 2026-10-20 on its current inputs; due again 2026-10-27'
      }
    ]);
  });
});

describe('runEvals pacing and bounds', () => {
  it("paces each config's requests and bounds it by what the budget leaves after the configs planned behind it", async () => {
    const { resultsDir, workDir } = workspace();
    const calls = [];
    const spawn = async (command, args, { env }) => {
      calls.push({ args, bound: env.PROMPTFOO_MAX_EVAL_TIME_MS });
      writeFileSync(args[args.indexOf('--output') + 2], sidecar([row(0)]));
      return { exitCode: 0, durationMs: 1000 };
    };

    const { summary } = await runEvals({
      configs: ['evals/prompts/a.yaml', 'evals/prompts/b.yaml'],
      name: '2026-10-22',
      resultsDir,
      workDir,
      budgetMinutes: 10,
      limits: { tokensPerMinute: 120, templateTokens: 10, measured: true },
      costs: new Map([
        ['evals/prompts/a.yaml', { firstPass: 100, largest: 60, requests: 2 }],
        ['evals/prompts/b.yaml', { firstPass: 300, largest: 120, requests: 3 }]
      ]),
      spawn,
      now: () => 0,
      log: () => {}
    });

    assert.deepEqual(
      calls.map(({ args }) => args[args.indexOf('--delay') + 1]),
      ['30000', '60000']
    );
    // a keeps b's three requests, a minute apart, in reserve; b gets the rest.
    assert.deepEqual(
      calls.map(({ bound }) => Number(bound)),
      [10 * 60000 - 3 * 60000, 10 * 60000]
    );
    assert.deepEqual(
      summary.configs.map(({ delayMs, boundMs }) => [delayMs, boundMs]),
      [
        [30000, 7 * 60000],
        [60000, 10 * 60000]
      ]
    );
  });

  it("names the rate-limit waits a child's debug log records, in the run log and the summary", async () => {
    const { resultsDir, workDir } = workspace();
    const logsDir = mkdtempSync(join(tmpdir(), 'run-evals-logs-'));
    const spawn = async (command, args) => {
      const dir = join(logsDir, '2026-10-22-maplibre-cartography');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, 'promptfoo-debug-1.log'),
        [
          'Rate limited on URL https://generativelanguage.googleapis.com/v1beta/models/x:generateContent: HTTP 429 Too Many Requests, attempt 1/5, waiting before retry...',
          'Rate limited, waiting 90000ms (base 90000ms + 0ms jitter) before retry'
        ].join('\n')
      );
      writeFileSync(args[args.indexOf('--output') + 2], sidecar([row(0)]));
      return { exitCode: 0, durationMs: 1000 };
    };
    const lines = [];

    const { summary } = await runEvals({
      configs: ['evals/prompts/maplibre-cartography.yaml'],
      name: '2026-10-22',
      resultsDir,
      workDir,
      budgetMinutes: 240,
      logsDir,
      spawn,
      log: (line) => lines.push(line)
    });

    assert.ok(
      lines.includes(
        '  rate-limit waits: generativelanguage.googleapis.com 1 time, 1m 30s'
      )
    );
    assert.deepEqual(summary.configs[0].waits, [
      { host: 'generativelanguage.googleapis.com', count: 1, ms: 90000 }
    ]);
  });
});

describe('dryRunLines', () => {
  it('prints each command at its pace, both output paths, and the budget', () => {
    const lines = dryRunLines({
      configs: ['evals/prompts/maplibre-cartography.yaml'],
      name: '2026-09-06',
      baseline: false,
      resultsDir: 'evals/results',
      workDir: '/tmp/eval',
      budgetMinutes: 240,
      costs: new Map([
        [
          'evals/prompts/maplibre-cartography.yaml',
          { firstPass: 18000, largest: 6000, requests: 3 }
        ]
      ]),
      tokensPerMinute: 8000
    });
    const command = lines.find((line) => line.includes('eval:graded'));
    assert.match(command, /--delay 45000 /);
    assert.match(
      command,
      /--output evals\/results\/2026-09-06-maplibre-cartography\.csv \/tmp\/eval\/2026-09-06-maplibre-cartography\.json/
    );
    assert.ok(lines.some((line) => line.includes('240 minutes')));
  });

  it('leaves the pinned delay alone for a config it cannot size', () => {
    const lines = dryRunLines({
      configs: ['evals/prompts/maplibre-cartography.yaml'],
      name: '2026-09-06',
      baseline: false,
      resultsDir: 'evals/results',
      workDir: '/tmp/eval',
      budgetMinutes: 240
    });
    assert.ok(lines.every((line) => !line.includes('--delay')));
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
