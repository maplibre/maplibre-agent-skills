import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { answerTransform, selfTrippedTripwires } from './lib/tripwires.js';

const SKILLS = {
  'skills/contours/SKILL.md': [
    '# Contours',
    'Use `maplibre-contour`, not a hand-rolled Marching-Squares pipeline.',
    'There is no `raster-color` property.'
  ].join('\n'),
  'skills/other/SKILL.md': 'Nothing about contours.'
};
const readSkill = (path) => SKILLS[path];

function config(tests, defaultTest = {}) {
  return {
    defaultTest: {
      vars: { skillFile: 'skills/contours/SKILL.md' },
      ...defaultTest
    },
    tests
  };
}

function trips(tests, defaultTest) {
  return selfTrippedTripwires(config(tests, defaultTest), { readSkill }).map(
    ({ test, type, term, line }) => ({ test, type, term, line })
  );
}

describe('selfTrippedTripwires', () => {
  it('reports a not-icontains on text the skill contains, with its line', () => {
    assert.deepEqual(
      selfTrippedTripwires(
        config([
          {
            description: 'implicit — runtime contours',
            assert: [{ type: 'not-icontains', value: 'marching-squares' }]
          }
        ]),
        { readSkill }
      ),
      [
        {
          test: 1,
          description: 'implicit — runtime contours',
          type: 'not-icontains',
          term: 'marching-squares',
          skillFile: 'skills/contours/SKILL.md',
          line: 2
        }
      ]
    );
  });

  it('passes tripwires on text the skill lacks, and leaves positive assertions alone', () => {
    assert.deepEqual(
      trips([
        {
          description: 'implicit — runtime contours',
          assert: [
            { type: 'icontains', value: 'maplibre-contour' },
            { type: 'not-icontains', value: 'marching squares' },
            { type: 'not-icontains', value: 'geotiff' },
            {
              type: 'llm-rubric',
              value: 'Must not hand-roll marching squares.'
            }
          ]
        }
      ]),
      []
    );
  });

  it('matches not-contains by case, as promptfoo does', () => {
    assert.deepEqual(
      trips([
        {
          description: 'explicit — contours',
          assert: [
            { type: 'not-contains', value: 'marching-squares' },
            { type: 'not-contains', value: 'Marching-Squares' }
          ]
        }
      ]),
      [{ test: 1, type: 'not-contains', term: 'Marching-Squares', line: 2 }]
    );
  });

  it('checks each term of an -any tripwire, written as a list or one string', () => {
    assert.deepEqual(
      trips([
        {
          description: 'anti-pattern — tint',
          assert: [
            {
              type: 'not-icontains-any',
              value: ['geotiff', 'marching-squares']
            },
            { type: 'not-contains-any', value: 'd3-contour, raster-color' }
          ]
        }
      ]),
      [
        {
          test: 1,
          type: 'not-icontains-any',
          term: 'marching-squares',
          line: 2
        },
        { test: 1, type: 'not-contains-any', term: 'raster-color', line: 3 }
      ]
    );
  });

  it('asks for a YAML list when a one-string -any value quotes a term', () => {
    assert.throws(
      () =>
        trips([
          {
            description: 'explicit — contours',
            assert: [{ type: 'not-icontains-any', value: '"a, b", c' }]
          }
        ]),
      /write the terms of not-icontains-any as a YAML list/
    );
  });

  it('reports a not-regex that matches', () => {
    assert.deepEqual(
      trips([
        {
          description: 'implicit — runtime contours',
          assert: [{ type: 'not-regex', value: 'Marching[ -]?Squares' }]
        }
      ]),
      [{ test: 1, type: 'not-regex', term: 'Marching[ -]?Squares', line: 2 }]
    );
  });

  it("exempts the negative test, whose tripwires look for the skill's own words", () => {
    assert.deepEqual(
      trips([
        {
          description: 'negative — an adjacent question',
          assert: [{ type: 'not-icontains', value: 'maplibre-contour' }]
        }
      ]),
      []
    );
  });

  it('skips a test that withholds the skill', () => {
    assert.deepEqual(
      trips([
        {
          description: 'explicit — contours',
          vars: { injectSkill: 'False' },
          assert: [{ type: 'not-icontains', value: 'maplibre-contour' }]
        }
      ]),
      []
    );
  });

  it("reads a test's own skillFile over defaultTest's", () => {
    assert.deepEqual(
      trips([
        {
          description: 'explicit — elsewhere',
          vars: { skillFile: 'skills/other/SKILL.md' },
          assert: [{ type: 'not-icontains', value: 'marching-squares' }]
        }
      ]),
      []
    );
  });

  it("applies defaultTest's assertions and an assert-set's to every test", () => {
    assert.deepEqual(
      trips(
        [
          { description: 'explicit — one' },
          {
            description: 'implicit — two',
            assert: [
              {
                type: 'assert-set',
                assert: [{ type: 'not-icontains', value: 'maplibre-contour' }]
              }
            ]
          }
        ],
        { assert: [{ type: 'not-icontains', value: 'raster-color' }] }
      ),
      [
        { test: 1, type: 'not-icontains', term: 'raster-color', line: 3 },
        { test: 2, type: 'not-icontains', term: 'raster-color', line: 3 },
        { test: 2, type: 'not-icontains', term: 'maplibre-contour', line: 2 }
      ]
    );
  });

  it('names a test with tripwires and no skillFile', () => {
    assert.throws(
      () =>
        selfTrippedTripwires(
          {
            tests: [
              {
                description: 'explicit — contours',
                assert: [{ type: 'not-icontains', value: 'x' }]
              }
            ]
          },
          { readSkill }
        ),
      /test 1 sets no skillFile/
    );
  });

  it('leaves alone a test whose skill is not written yet', () => {
    const found = selfTrippedTripwires(
      config(
        [
          {
            description: 'explicit — contours',
            assert: [{ type: 'not-icontains', value: 'marching-squares' }]
          }
        ],
        { vars: { skillFile: 'skills/not-yet/SKILL.md' } }
      ),
      { readSkill: (path) => SKILLS[path] ?? null }
    );
    assert.deepEqual(found, []);
  });
});

describe('answerTransform', () => {
  it('runs a one-line transform as an expression over the output', () => {
    const graded = answerTransform({
      transform: "output.replace(/\\u2011/g, '-')"
    });
    assert.equal(graded('marching‑squares'), 'marching-squares');
  });

  it('runs a multi-line transform as a function body', () => {
    const graded = answerTransform({
      transform: 'const upper = output.toUpperCase();\nreturn upper;'
    });
    assert.equal(graded('dem'), 'DEM');
  });

  it('leaves the text as written without a transform', () => {
    assert.equal(answerTransform({})('a‑b'), 'a‑b');
  });

  it('refuses a transform it cannot run inline', () => {
    assert.throws(
      () => answerTransform({ transform: 'file://lib/normalize.js' }),
      /cannot run the provider transform/
    );
  });
});
