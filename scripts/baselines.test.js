import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  baselineRecords,
  candidatesIssue,
  cutCandidates,
  firstRecordedGenerator,
  planBaselines
} from './lib/baselines.js';

const OLD = 'groq:openai/gpt-oss-120b';
const NEW = 'next-pinned-generator';

// A results dir as a map of file name to text.
const reader = (files) => (fileName) => {
  if (!(fileName in files)) throw new Error(`ENOENT: ${fileName}`);
  return files[fileName];
};
const record = (generator, skills) =>
  JSON.stringify({
    commit: 'abc',
    generator,
    judge: 'google:gemini-3.1-flash-lite',
    configs: Object.fromEntries(skills.map((skill) => [skill, { inputs: {} }]))
  });

describe('baselineRecords', () => {
  it("keeps each skill's newest recorded baseline and its generator", () => {
    const files = {
      'baseline-2026-12-01.json': record(OLD, ['maplibre-a', 'maplibre-b']),
      'baseline-2026-12-03.json': record(NEW, ['maplibre-a']),
      '2026-12-04.json': record(NEW, ['maplibre-b']),
      'baseline-2026-12-03-maplibre-a.csv': 'Description,Status\n'
    };
    const records = baselineRecords(Object.keys(files), reader(files));
    assert.deepEqual(
      records,
      new Map([
        ['maplibre-a', { date: '2026-12-03', generator: NEW }],
        ['maplibre-b', { date: '2026-12-01', generator: OLD }]
      ])
    );
  });

  it('skips a record it cannot read or that names no generator', () => {
    const files = {
      'baseline-2026-12-01.json': '{ not json',
      'baseline-2026-12-02.json': JSON.stringify({
        configs: { 'maplibre-a': {} }
      })
    };
    assert.equal(baselineRecords(Object.keys(files), reader(files)).size, 0);
  });
});

describe('firstRecordedGenerator', () => {
  it('reads the earliest run record that names a generator', () => {
    const files = {
      '2026-10-27.json': JSON.stringify({ configs: {} }),
      '2026-11-09.json': record(NEW, []),
      '2026-11-08.json': record(OLD, []),
      'baseline-2026-11-01.json': record('an-earlier-generator', [])
    };
    assert.equal(
      firstRecordedGenerator(Object.keys(files), reader(files)),
      OLD
    );
  });

  it('is null with no record that names one', () => {
    assert.equal(firstRecordedGenerator([], reader({})), null);
  });
});

describe('planBaselines', () => {
  const configs = [
    'evals/prompts/maplibre-a.yaml',
    'evals/prompts/maplibre-b.yaml',
    'evals/prompts/maplibre-c.yaml'
  ];

  it('finds nothing due while the pin is the generator of the evidence', () => {
    const { due, later } = planBaselines({
      configs,
      records: new Map(),
      fallback: OLD,
      generator: OLD
    });
    assert.deepEqual(due, []);
    assert.equal(later.length, 3);
  });

  it('makes every config due when the pin changes, until each has a baseline under it', () => {
    const { due, later } = planBaselines({
      configs,
      records: new Map([
        ['maplibre-b', { date: '2026-12-03', generator: NEW }],
        ['maplibre-c', { date: '2026-12-01', generator: OLD }]
      ]),
      fallback: OLD,
      generator: NEW
    });
    assert.deepEqual(
      due.map(({ config }) => config),
      ['evals/prompts/maplibre-a.yaml', 'evals/prompts/maplibre-c.yaml']
    );
    assert.match(due[0].why, /results doc cites ran under .*120b/);
    assert.match(due[1].why, /2026-12-01 baseline ran under .*120b/);
    assert.deepEqual(
      later.map(({ config }) => config),
      ['evals/prompts/maplibre-b.yaml']
    );
  });

  it('finds nothing due with no generator to compare', () => {
    const { due } = planBaselines({
      configs,
      records: new Map(),
      fallback: null,
      generator: NEW
    });
    assert.deepEqual(due, []);
  });
});

describe('cutCandidates', () => {
  const sidecar = (rows) => JSON.stringify({ results: { results: rows } });
  const test = (description, failureReason) => ({
    testCase: { description },
    failureReason
  });

  it('lists the tests that passed without the skill, except negative ones', () => {
    const text = sidecar([
      test('explicit — style JSON validator', 0),
      test('implicit — tile source with no key', 1),
      test('anti-pattern — Mapbox v2 camera', 0),
      test('negative — geocoder on Mapbox', 0),
      test('implicit — callback code', 2)
    ]);
    assert.deepEqual(cutCandidates(text), [
      'explicit — style JSON validator',
      'anti-pattern — Mapbox v2 camera'
    ]);
  });

  it('is null for output with no result rows', () => {
    assert.equal(cutCandidates('{ not json'), null);
    assert.equal(cutCandidates(null), null);
    assert.equal(cutCandidates(JSON.stringify({ results: {} })), null);
  });
});

describe('candidatesIssue', () => {
  const runUrl =
    'https://github.com/maplibre/maplibre-agent-skills/actions/runs/1';

  it('lists each config with candidates under its name', () => {
    const issue = candidatesIssue(
      {
        generator: NEW,
        date: '2026-12-03',
        configs: [
          {
            skill: 'maplibre-a',
            candidates: ['explicit — one', 'implicit — two']
          },
          { skill: 'maplibre-b', candidates: [] }
        ]
      },
      { date: '2026-12-03', runUrl }
    );
    assert.equal(
      issue.title,
      'Baseline round: tests that pass without the skill — 2026-12-03'
    );
    assert.ok(issue.body.includes(`under \`${NEW}\``));
    assert.ok(
      issue.body.includes(
        '**maplibre-a**\n\n- explicit — one\n- implicit — two'
      )
    );
    assert.ok(!issue.body.includes('maplibre-b'));
    assert.ok(issue.body.includes(runUrl));
  });

  it('is null when no config has a candidate', () => {
    assert.equal(
      candidatesIssue(
        {
          generator: NEW,
          date: '2026-12-03',
          configs: [{ skill: 'maplibre-a', candidates: [] }]
        },
        { date: '2026-12-03', runUrl }
      ),
      null
    );
    assert.equal(candidatesIssue(null, { date: '2026-12-03', runUrl }), null);
  });
});
