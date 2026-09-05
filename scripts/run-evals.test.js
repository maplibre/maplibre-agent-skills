import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  boundFor,
  buildCommand,
  childEnv,
  dryRunLines,
  runEvals,
  verdictFor
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
