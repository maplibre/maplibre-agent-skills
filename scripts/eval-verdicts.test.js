import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classificationBlock,
  classifyEval,
  headlineFor,
  isSafeCliPath,
  isSafeConfigPath,
  listEvalConfigs,
  mergeWaits,
  missingVerdicts,
  parseVerdicts,
  runName,
  signatureOf,
  skillOf,
  waitsLine
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
// The judge's own 503, verbatim from the 2026-09-27 maplibre-cartography sidecar
// (run 36312598528, the implicit test) and the 2026-09-13
// maplibre-pmtiles-patterns one. promptfoo files it as an ASSERT row, with the
// text as the llm-rubric component's reason and `metadata.graderError: true` on
// that component.
const JUDGE_UNAVAILABLE =
  'Error: No candidates returned in API response.\n\nGot response: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}';
// Groq refusing a request over the organization's tokens per minute, verbatim
// from the 2026-10-21 maplibre-sprites-icons sidecar (run 39585050825, test 2),
// organization id elided.
const REQUEST_TOO_LARGE =
  'API error: 413 Payload Too Large\n{"error":{"message":"Request too large for model `openai/gpt-oss-120b` in organization `org_…` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 8008, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing","type":"tokens","code":"rate_limit_exceeded"}}';
// A rubric the judge did grade, from the 2026-09-06 maplibre-pmtiles-patterns
// sidecar (the addProtocol anti-pattern test).
const RUBRIC_FAILURE =
  'However, the rubric specifically requires the handler to return an object with a `data` property (e.g., `{ data: buffer }`) and states that returning a bare `ArrayBuffer`, `Blob`, or `Response` is *not* the v4 contract.';

// An ASSERT row trimmed to what the classifier reads: each assertion keeps its
// own verdict and reason in gradingResult.componentResults, and the row's
// `error` repeats the last failing one.
function assertRow(description, componentResults) {
  const failing = componentResults.filter((result) => !result.pass);
  const reason = failing[failing.length - 1].reason;
  return {
    ...row(1, description, reason),
    gradingResult: { pass: false, score: 0, reason, componentResults }
  };
}

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

  it('calls a judge outage inside a rubric an error, not a fail', () => {
    const result = classifyEval(
      sidecar([
        row(0, 'explicit'),
        assertRow('implicit', [
          {
            pass: false,
            score: 0,
            reason: JUDGE_UNAVAILABLE,
            metadata: { graderError: true },
            assertion: { type: 'llm-rubric' }
          }
        ]),
        row(0, 'anti-pattern'),
        row(0, 'negative')
      ])
    );
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.counts, { pass: 3, fail: 0, error: 1 });
    assert.deepEqual(result.signatures, ['judge-unavailable']);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].description, 'implicit');
    assert.equal(result.errors[0].signature, 'judge-unavailable');
    assert.equal(result.errors[0].message, JUDGE_UNAVAILABLE);
  });

  it('keeps a rubric the judge did grade a fail', () => {
    const result = classifyEval(
      sidecar([
        row(0, 'explicit'),
        assertRow('anti-pattern', [
          {
            pass: true,
            score: 1,
            reason: 'Assertion passed',
            assertion: { type: 'icontains' }
          },
          {
            pass: false,
            score: 0.3,
            reason: RUBRIC_FAILURE,
            assertion: { type: 'llm-rubric' }
          }
        ]),
        row(0, 'negative')
      ])
    );
    assert.equal(result.verdict, 'fail');
    assert.deepEqual(result.counts, { pass: 2, fail: 1, error: 0 });
    assert.deepEqual(result.signatures, []);
    assert.deepEqual(result.errors, []);
  });

  it('lets a judge outage outrank a graded failure in the same row', () => {
    const result = classifyEval(
      sidecar([
        row(0, 'explicit'),
        assertRow('implicit', [
          {
            pass: false,
            score: 0,
            reason: 'Expected output to contain "pmtiles"',
            assertion: { type: 'icontains' }
          },
          {
            pass: false,
            score: 0,
            reason: JUDGE_UNAVAILABLE,
            metadata: { graderError: true },
            assertion: { type: 'llm-rubric' }
          }
        ])
      ])
    );
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.counts, { pass: 1, fail: 0, error: 1 });
    assert.deepEqual(result.signatures, ['judge-unavailable']);
  });

  it('calls any failed grader call an error, named by its reason', () => {
    const result = classifyEval(
      sidecar([
        row(0, 'explicit'),
        assertRow('implicit', [
          {
            pass: false,
            score: 0,
            reason: 'API call error: TypeError: fetch failed',
            metadata: { graderError: true },
            assertion: { type: 'llm-rubric' }
          }
        ])
      ])
    );
    assert.equal(result.verdict, 'error');
    assert.deepEqual(result.counts, { pass: 1, fail: 0, error: 1 });
    assert.deepEqual(result.signatures, ['other']);
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

  it('names the judge outage only with the phrase promptfoo wraps it in', () => {
    assert.equal(signatureOf(JUDGE_UNAVAILABLE), 'judge-unavailable');
    assert.equal(
      signatureOf(
        'The output tells the user to retry a tile request that got a 503 "UNAVAILABLE".'
      ),
      'other'
    );
  });

  it('names a request too large for the minute, though its body says rate_limit_exceeded', () => {
    assert.equal(signatureOf(REQUEST_TOO_LARGE), 'request-too-large');
  });

  it("names a 5xx that outlasted promptfoo's retries", () => {
    assert.equal(
      signatureOf(
        'API call error: Error: Request failed after 4 retries: Error: Internal Server Error: 503 Service Unavailable'
      ),
      'unavailable'
    );
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

describe('isSafeCliPath', () => {
  it('accepts the paths this runner actually builds', () => {
    for (const path of [
      'evals/prompts/maplibre-cartography.yaml',
      'evals/results',
      'evals/results/2026-09-06-maplibre-cartography.csv',
      '/tmp/eval',
      '/var/folders/ab/T/eval',
      '.claude/worktrees/x'
    ]) {
      assert.equal(isSafeCliPath(path), true, path);
    }
  });

  it('rejects the characters that give a path a second meaning', () => {
    for (const path of [
      '',
      'evals/prompts/$(id).yaml',
      'a;b',
      'a b',
      'a|b',
      'a&b',
      'a`b`',
      'a\\b',
      "a'b",
      'a*b',
      'evals\nprompts'
    ]) {
      assert.equal(isSafeCliPath(path), false, JSON.stringify(path));
    }
  });

  it('rejects traversal, empty segments, and leading dashes', () => {
    for (const path of [
      '../evals',
      'evals/../x',
      'evals/./x',
      '.',
      '..',
      '-flag',
      'evals/-x',
      '//evals',
      'evals//x',
      'evals/'
    ]) {
      assert.equal(isSafeCliPath(path), false, JSON.stringify(path));
    }
  });

  it('rejects a value that is not a string', () => {
    for (const value of [undefined, null, 42, {}, ['evals/results']]) {
      assert.equal(isSafeCliPath(value), false, String(value));
    }
  });
});

describe('isSafeConfigPath', () => {
  function configDir() {
    const dir = mkdtempSync(join(tmpdir(), 'safe-config-'));
    mkdirSync(join(dir, 'sub'));
    for (const name of [
      'maplibre-cartography.yaml',
      'TEMPLATE.yaml',
      'x.yml',
      '$(id).yaml'
    ]) {
      writeFileSync(join(dir, name), '');
    }
    writeFileSync(join(dir, 'sub', 'x.yaml'), '');
    return dir;
  }

  it('accepts an existing config file sitting directly in the config dir', () => {
    const dir = configDir();
    assert.equal(
      isSafeConfigPath(join(dir, 'maplibre-cartography.yaml'), dir),
      true
    );
  });

  it('rejects the template, a subdirectory, a missing file, and another dir', () => {
    const dir = configDir();
    const other = configDir();
    assert.equal(isSafeConfigPath(join(dir, 'TEMPLATE.yaml'), dir), false);
    assert.equal(isSafeConfigPath(join(dir, 'sub', 'x.yaml'), dir), false);
    assert.equal(isSafeConfigPath(join(dir, 'missing.yaml'), dir), false);
    assert.equal(
      isSafeConfigPath(join(other, 'maplibre-cartography.yaml'), dir),
      false
    );
    assert.equal(isSafeConfigPath(dir, dir), false);
  });

  it('rejects a wrong extension and a directory itself', () => {
    const dir = configDir();
    assert.equal(isSafeConfigPath(join(dir, 'x.yml'), dir), false);
    assert.equal(isSafeConfigPath(join(dir, 'sub'), dir), false);
  });

  it('rejects a name outside the character rule even when the file exists', () => {
    const dir = configDir();
    assert.equal(isSafeConfigPath(join(dir, '$(id).yaml'), dir), false);
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

  it('says request too large when a request can never fit the minute', () => {
    const summary = withConfigs([
      { skill: 'maplibre-cartography', verdict: 'pass', signatures: [] },
      {
        skill: 'maplibre-fonts-glyphs',
        verdict: 'error',
        signatures: ['request-too-large']
      }
    ]);
    assert.equal(
      headlineFor({ summary, evalResult: 'failure' }),
      'request too large'
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

  it('leaves a config the day cut out of the headline: it is waiting, not broken', () => {
    const summary = withConfigs([
      { skill: 'maplibre-cartography', verdict: 'fail', signatures: [] },
      {
        skill: 'maplibre-fonts-glyphs',
        verdict: 'error',
        signatures: ['rate-limit-exhausted', 'day-spent'],
        dayCut: 'judge'
      }
    ]);
    assert.equal(
      headlineFor({ summary, evalResult: 'failure' }),
      'graded failure'
    );
  });

  it('says the day was spent when it ended before any config was graded', () => {
    // The config after it waited, so it was never planned.
    const summary = {
      ...PASSING,
      planned: ['maplibre-cartography'],
      configs: [
        {
          skill: 'maplibre-cartography',
          verdict: 'error',
          signatures: ['rate-limit-exhausted', 'day-spent'],
          dayCut: 'judge'
        }
      ]
    };
    assert.equal(
      headlineFor({ summary, evalResult: 'failure' }),
      'day spent before any verdict'
    );
  });
});

describe('classificationBlock', () => {
  it("quotes Google's refusal of the judge, and names what the day cut and what waits", () => {
    const summary = {
      ...withConfigs([
        { skill: 'maplibre-cartography', verdict: 'fail', signatures: [] },
        {
          skill: 'maplibre-fonts-glyphs',
          verdict: 'error',
          signatures: ['rate-limit-exhausted', 'day-spent'],
          dayCut: 'judge'
        }
      ]),
      day: {
        tokensPerDay: 200000,
        spent: 169072,
        waiting: ['maplibre-mapbox-migration'],
        judgeSpent: {
          quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
          limit: 20,
          model: 'gemini-2.5-flash-lite'
        }
      }
    };
    const block = classificationBlock({
      summary,
      evalResult: 'failure',
      publish: { commit: 'success', sync: 'success', statusCommit: 'skipped' }
    });
    assert.match(block, /\*\*Classification: graded failure\.\*\*/);
    assert.match(
      block,
      /Google refused the judge for its daily quota \(20 requests a day for gemini-2\.5-flash-lite, `GenerateRequestsPerDayPerProjectPerModel-FreeTier`\)/
    );
    assert.match(block, /they go first the next day: maplibre-fonts-glyphs\./);
    assert.match(
      block,
      /Waiting for another day, which is spent: maplibre-mapbox-migration\./
    );
  });

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

  it('says how many tests a config ran again', () => {
    const summary = withConfigs([
      {
        skill: 'maplibre-cartography',
        verdict: 'fail',
        signatures: [],
        retry: {
          tests: [
            {
              description: 'explicit',
              attempts: ['fail', 'fail', 'pass'],
              verdict: 'fail'
            }
          ]
        }
      },
      { skill: 'maplibre-fonts-glyphs', verdict: 'pass', signatures: [] }
    ]);
    const block = classificationBlock({
      summary,
      evalResult: 'failure',
      publish: { commit: 'success', sync: 'success', statusCommit: 'success' }
    });
    assert.match(block, /\| maplibre-cartography \| fail \| re-ran 1 test \|/);
    assert.match(block, /\| maplibre-fonts-glyphs \| pass \| — \|/);
  });

  it('names the rate-limit waits of both attempts, by host', () => {
    const summary = withConfigs([
      {
        skill: 'maplibre-cartography',
        verdict: 'pass',
        signatures: [],
        waits: [
          { host: 'generativelanguage.googleapis.com', count: 4, ms: 1080000 }
        ],
        retry: {
          tests: [],
          waits: [
            { host: 'generativelanguage.googleapis.com', count: 1, ms: 60000 },
            { host: 'api.groq.com', count: 1, ms: 86400 }
          ]
        }
      }
    ]);
    const block = classificationBlock({
      summary,
      evalResult: 'success',
      publish: { commit: 'success', sync: 'success', statusCommit: 'success' }
    });
    assert.match(
      block,
      /\| maplibre-cartography \| pass \| rate-limit waits: generativelanguage\.googleapis\.com 5 times, 19m 0s; api\.groq\.com 1 time, 1m 26s \|/
    );
  });

  it('sums waits by host across attempts and reads them as one line', () => {
    const waits = mergeWaits(
      [{ host: 'api.groq.com', count: 2, ms: 172800 }],
      [{ host: 'api.groq.com', count: 1, ms: 30000 }],
      []
    );
    assert.deepEqual(waits, [{ host: 'api.groq.com', count: 3, ms: 202800 }]);
    assert.equal(waitsLine(waits), 'api.groq.com 3 times, 3m 23s');
    assert.equal(
      waitsLine([{ host: 'api.groq.com', count: 1, ms: 8000 }]),
      'api.groq.com 1 time, 8s'
    );
    assert.equal(waitsLine([]), '');
  });

  it('says which configs wait for another day, and when Groq said the day was spent', () => {
    const summary = {
      ...withConfigs([
        {
          skill: 'maplibre-cartography',
          verdict: 'error',
          signatures: ['rate-limit-exhausted']
        },
        { skill: 'maplibre-fonts-glyphs', verdict: 'pass', signatures: [] }
      ]),
      day: {
        tokensPerDay: 200000,
        spent: 151000,
        waiting: ['maplibre-sprites-icons'],
        spentByGroq: { tokensPerDay: 150000, used: 149990 }
      }
    };
    const block = classificationBlock({
      summary,
      evalResult: 'failure',
      publish: {}
    });
    assert.match(block, /daily limit \(149,990 of 150,000 tokens used\)/);
    assert.match(block, /Waiting for another day.*: maplibre-sprites-icons\./);
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
