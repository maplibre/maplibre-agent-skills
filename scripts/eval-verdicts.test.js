import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classificationBlock,
  classifyEval,
  headlineFor,
  listEvalConfigs,
  missingVerdicts,
  parseVerdicts,
  runName,
  signatureOf,
  skillOf
} from './lib/eval-verdicts.js';

// Shaped like a real `promptfoo eval --output x.json` file: the top level is
// { evalId, results: <EvaluateSummary v3>, config, metadata }, and the rows sit
// at results.results. See the note in scripts/lib/eval-verdicts.js.
function sidecar(rows, stats = {}) {
  return {
    evalId: 'fixture-eval-id',
    results: {
      version: 3,
      timestamp: '2026-08-30T10:24:47.000Z',
      prompts: [],
      results: rows,
      stats: {
        successes: 0,
        failures: 0,
        errors: 0,
        tokenUsage: { total: 0 },
        ...stats
      }
    },
    config: {},
    metadata: {}
  };
}

function row(failureReason, description, error) {
  return {
    description,
    failureReason,
    success: failureReason === 0,
    score: failureReason === 0 ? 1 : 0,
    testIdx: 0,
    ...(error === undefined ? {} : { error })
  };
}

const GRADER_RATE_LIMIT =
  'RateLimitExhaustedError: Rate limit exceeded for google:gemini-2.5-flash-lite after 4 attempts';
const QUEUE_TIMEOUT =
  'Request groq:openai/gpt-oss-120b[7b7ebfedd4ce]-1788103001543-7fjq3b4amns-0 timed out after 300000ms in queue';
const MAX_DURATION = 'Evaluation exceeded max duration of 2700000ms';

describe('classifyEval', () => {
  it('calls an all-passing run a pass', () => {
    const result = classifyEval(
      sidecar([
        row(0, 'explicit — asks for a raster source'),
        row(0, 'implicit — asks how to show terrain'),
        row(0, 'anti-pattern — asks about maxzoom'),
        row(0, 'negative — asks about geocoding')
      ])
    );
    assert.equal(result.verdict, 'pass');
    assert.deepEqual(result.counts, { pass: 4, fail: 0, error: 0 });
    assert.equal(result.total, 4);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.signatures, []);
  });

  it('calls a graded assertion failure a fail', () => {
    const result = classifyEval(
      sidecar([row(0, 'explicit'), row(1, 'implicit'), row(0, 'negative')])
    );
    assert.equal(result.verdict, 'fail');
    assert.deepEqual(result.counts, { pass: 2, fail: 1, error: 0 });
  });

  it('calls one error among passes an error', () => {
    const result = classifyEval(
      sidecar([
        row(0, 'explicit'),
        row(2, 'implicit', QUEUE_TIMEOUT),
        row(0, 'negative')
      ])
    );
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.counts, { pass: 2, fail: 0, error: 1 });
    assert.deepEqual(result.signatures, ['queue-timeout']);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].description, 'implicit');
    assert.equal(result.errors[0].message, QUEUE_TIMEOUT);
  });

  it('lets an error outrank an assertion failure in the same run', () => {
    const result = classifyEval(
      sidecar([
        row(1, 'explicit'),
        row(2, 'implicit', GRADER_RATE_LIMIT),
        row(0, 'negative')
      ])
    );
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.counts, { pass: 1, fail: 1, error: 1 });
    assert.deepEqual(result.signatures, ['rate-limit-exhausted']);
  });

  it('reads the max-duration rows the time bound writes', () => {
    const result = classifyEval(
      sidecar([
        row(0, 'explicit'),
        row(2, 'implicit', MAX_DURATION),
        row(2, 'anti-pattern', MAX_DURATION),
        row(2, 'negative', MAX_DURATION)
      ])
    );
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.signatures, ['max-duration']);
    assert.equal(result.errors.length, 3);
  });

  it('carries the token usage through when the sidecar has it', () => {
    const result = classifyEval(
      sidecar([row(0, 'explicit')], { tokenUsage: { total: 42000 } })
    );
    assert.deepEqual(result.tokenUsage, { total: 42000 });
  });

  it('throws rather than guess at an unexpected shape', () => {
    assert.throws(() => classifyEval(null), /results/);
    assert.throws(() => classifyEval({}), /results/);
    assert.throws(() => classifyEval({ results: [] }), /results/);
    assert.throws(() => classifyEval(sidecar([])), /no results/);
    assert.throws(
      () => classifyEval(sidecar([row(3, 'explicit')])),
      /failureReason/
    );
    assert.throws(
      () => classifyEval(sidecar([{ description: 'explicit' }])),
      /failureReason/
    );
  });
});

describe('signatureOf', () => {
  it('names the grader rate limit', () => {
    assert.equal(signatureOf(GRADER_RATE_LIMIT), 'rate-limit-exhausted');
  });

  it('names the generator queue timeout', () => {
    assert.equal(signatureOf(QUEUE_TIMEOUT), 'queue-timeout');
  });

  it('names the time bound', () => {
    assert.equal(signatureOf(MAX_DURATION), 'max-duration');
  });

  it('names a generator rate limit from a 429 or its text', () => {
    assert.equal(signatureOf('API error: 429 Too Many Requests'), 'rate-limit');
    assert.equal(
      signatureOf('Rate limit exceeded, please retry'),
      'rate-limit'
    );
  });

  it('falls back to other, and never throws on an absent message', () => {
    assert.equal(signatureOf('ECONNRESET'), 'other');
    assert.equal(signatureOf(undefined), 'other');
    assert.equal(signatureOf(''), 'other');
  });
});

describe('parseVerdicts', () => {
  it('reads one skill per line, blank lines ignored', () => {
    const verdicts = parseVerdicts(
      'maplibre-cartography:pass\n\nmaplibre-fonts-glyphs:error\nmaplibre-tile-sources:fail\n'
    );
    assert.deepEqual(
      [...verdicts],
      [
        ['maplibre-cartography', 'pass'],
        ['maplibre-fonts-glyphs', 'error'],
        ['maplibre-tile-sources', 'fail']
      ]
    );
  });

  it('is empty for empty input', () => {
    assert.equal(parseVerdicts('').size, 0);
    assert.equal(parseVerdicts('\n\n').size, 0);
  });

  it('rejects a malformed line rather than skipping it', () => {
    assert.throws(() => parseVerdicts('maplibre-cartography'), /cartography/);
    assert.throws(() => parseVerdicts('maplibre-cartography:ok'), /ok/);
    assert.throws(() => parseVerdicts('a:pass\nb:PASS'), /PASS/);
  });
});

describe('missingVerdicts', () => {
  it('names every expected skill with no line of its own', () => {
    const verdicts = parseVerdicts('a:pass\nc:error\n');
    assert.deepEqual(missingVerdicts(verdicts, ['a', 'b', 'c', 'd']), [
      'b',
      'd'
    ]);
    assert.deepEqual(missingVerdicts(verdicts, ['a', 'c']), []);
  });
});

describe('listEvalConfigs', () => {
  it('sorts the yaml configs and drops the template', () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-configs-'));
    mkdirSync(join(dir, 'lib'));
    for (const name of [
      'maplibre-tile-sources.yaml',
      'maplibre-cartography.yaml',
      'TEMPLATE.yaml',
      'README.md'
    ]) {
      writeFileSync(join(dir, name), '');
    }
    assert.deepEqual(listEvalConfigs(dir), [
      join(dir, 'maplibre-cartography.yaml'),
      join(dir, 'maplibre-tile-sources.yaml')
    ]);
  });
});

describe('skillOf and runName', () => {
  it('takes the skill name from the config filename', () => {
    assert.equal(
      skillOf('evals/prompts/maplibre-cartography.yaml'),
      'maplibre-cartography'
    );
  });

  it('prefixes a baseline run name', () => {
    assert.equal(runName('2026-09-06', false), '2026-09-06');
    assert.equal(runName('2026-09-06', true), 'baseline-2026-09-06');
  });
});

const PASSING = {
  name: '2026-09-06',
  baseline: false,
  planned: ['maplibre-cartography', 'maplibre-fonts-glyphs'],
  configs: [
    { skill: 'maplibre-cartography', verdict: 'pass', signatures: [] },
    { skill: 'maplibre-fonts-glyphs', verdict: 'pass', signatures: [] }
  ]
};

function withConfigs(configs) {
  return { ...PASSING, configs };
}

describe('headlineFor', () => {
  it('says cancelled when no summary was written at all', () => {
    assert.equal(
      headlineFor({ summary: null, evalResult: 'cancelled' }),
      'cancelled before results'
    );
  });

  it('says graded failure when only rubrics failed', () => {
    const summary = withConfigs([
      { skill: 'maplibre-cartography', verdict: 'fail', signatures: [] },
      { skill: 'maplibre-fonts-glyphs', verdict: 'pass', signatures: [] }
    ]);
    assert.equal(
      headlineFor({ summary, evalResult: 'failure' }),
      'graded failure'
    );
  });

  it('says infrastructure when only providers failed', () => {
    const summary = withConfigs([
      {
        skill: 'maplibre-cartography',
        verdict: 'error',
        signatures: ['rate-limit-exhausted']
      },
      { skill: 'maplibre-fonts-glyphs', verdict: 'pass', signatures: [] }
    ]);
    assert.equal(
      headlineFor({ summary, evalResult: 'failure' }),
      'infrastructure'
    );
  });

  it('says cut off when the time bound or the budget ended the run', () => {
    const bound = withConfigs([
      {
        skill: 'maplibre-cartography',
        verdict: 'error',
        signatures: ['max-duration']
      },
      {
        skill: 'maplibre-fonts-glyphs',
        verdict: 'error',
        signatures: ['not-run'],
        reason: 'not-run: budget exhausted'
      }
    ]);
    assert.equal(
      headlineFor({ summary: bound, evalResult: 'failure' }),
      'cut off by the time bound'
    );
  });

  it('says cut off when fewer configs were recorded than planned', () => {
    const partial = {
      ...PASSING,
      configs: [
        { skill: 'maplibre-cartography', verdict: 'pass', signatures: [] }
      ]
    };
    assert.equal(
      headlineFor({ summary: partial, evalResult: 'failure' }),
      'cut off by the time bound'
    );
  });

  it('says cancelled when the job itself was stopped mid-run', () => {
    const partial = {
      ...PASSING,
      configs: [
        { skill: 'maplibre-cartography', verdict: 'pass', signatures: [] }
      ]
    };
    assert.equal(
      headlineFor({ summary: partial, evalResult: 'cancelled' }),
      'cancelled before finishing'
    );
  });

  it('says mixed when a graded failure and an error share the run', () => {
    const summary = withConfigs([
      { skill: 'maplibre-cartography', verdict: 'fail', signatures: [] },
      {
        skill: 'maplibre-fonts-glyphs',
        verdict: 'error',
        signatures: ['queue-timeout']
      }
    ]);
    assert.equal(headlineFor({ summary, evalResult: 'failure' }), 'mixed');
  });

  it('calls an all-pass record with a non-success job infrastructure', () => {
    assert.equal(
      headlineFor({ summary: PASSING, evalResult: 'failure' }),
      'infrastructure'
    );
  });
});

describe('classificationBlock', () => {
  it('leads with the headline and tabulates every planned skill', () => {
    const summary = withConfigs([
      { skill: 'maplibre-cartography', verdict: 'pass', signatures: [] },
      {
        skill: 'maplibre-fonts-glyphs',
        verdict: 'error',
        signatures: ['queue-timeout'],
        tokenUsage: { total: 12000 }
      }
    ]);
    const block = classificationBlock({
      summary,
      evalResult: 'failure',
      publish: { commit: 'success', sync: 'success', statusCommit: 'skipped' }
    });
    assert.match(block, /\*\*Classification: infrastructure\.\*\*/);
    assert.match(block, /\| maplibre-cartography \| pass \|/);
    assert.match(
      block,
      /\| maplibre-fonts-glyphs \| error \| queue-timeout \|/
    );
    assert.match(block, /2 of 2 planned configs recorded/);
    assert.match(block, /12,000/);
    assert.match(block, /never changes a skill's `status:`/);
  });

  it('reports a rejected push in the publish steps', () => {
    const block = classificationBlock({
      summary: PASSING,
      evalResult: 'failure',
      publish: { commit: 'failure', sync: 'skipped', statusCommit: 'skipped' }
    });
    assert.match(block, /Results CSVs: not committed: push rejected/);
    assert.match(block, /Status sync: did not run/);
  });

  it('flags a partial sync', () => {
    const block = classificationBlock({
      summary: PASSING,
      evalResult: 'failure',
      publish: {
        commit: 'success',
        sync: 'success',
        statusCommit: 'success',
        partial: true
      }
    });
    assert.match(block, /Status sync: ran \(partial/);
  });

  it('says plainly that nothing finished when there is no summary', () => {
    const block = classificationBlock({
      summary: null,
      evalResult: 'cancelled',
      publish: { commit: 'failure', sync: 'skipped', statusCommit: 'skipped' }
    });
    assert.match(block, /\*\*Classification: cancelled before results\.\*\*/);
    assert.match(block, /No summary\.json/);
    assert.match(block, /Results CSVs: not committed: push rejected/);
  });
});
