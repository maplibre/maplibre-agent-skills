import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn as spawnChild } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  boundFor,
  buildCommand,
  childEnv,
  dryRunLines,
  runEvals,
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
});

describe('childEnv', () => {
  it('carries the ms bound to the child and keeps the rest of the env', () => {
    const env = childEnv({ boundMs: 1800000, env: { GROQ_API_KEY: 'x' } });
    assert.equal(env.PROMPTFOO_MAX_EVAL_TIME_MS, '1800000');
    assert.equal(env.GROQ_API_KEY, 'x');
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

describe('runEvals', () => {
  it('records every config and leaves a complete summary', async () => {
    const { resultsDir, workDir } = workspace();
    const spawn = async (command, args) => {
      const jsonPath = args[args.indexOf('--output') + 2];
      const skill = jsonPath.includes('cartography') ? 'pass' : 'fail';
      writeFileSync(
        jsonPath,
        sidecar(skill === 'pass' ? [row(0)] : [row(0), row(1)])
      );
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
