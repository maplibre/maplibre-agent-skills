import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isChecked, staleIds } from './model-pin-check.js';

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  'model-pin-check.js'
);

// Built from parts, so this file names no provider id the check would read.
const id = (provider, model) => `${provider}:${model}`;
const GENERATOR = id('groq', 'the-generator');
const JUDGE = id('google', 'the-judge');
const EARLIER = id('google', 'an-earlier-judge');
const PINS = new Set([GENERATOR, JUDGE]);
const DOC = 'evals/results/maplibre-x.md';

describe('staleIds', () => {
  it('reports each id that is not a pin, with its line', () => {
    const content = [
      `Generator \`${GENERATOR}\`.`,
      `Judge \`${EARLIER}\`, not \`${JUDGE}\`.`
    ].join('\n');
    assert.deepEqual(staleIds('evals/README.md', content, PINS), [
      { line: 2, id: EARLIER }
    ]);
  });

  it('lets a results doc name an earlier model in a sentence that gives a date', () => {
    const content = [
      `Run: 2026-08-30 · model \`${id('cerebras', 'an-earlier-generator')}\` · judge \`${EARLIER}\` · \`npm run eval:graded\`.`,
      `Model \`${GENERATOR}\` · judge \`${JUDGE}\`. Re-run 2026-08-28 with the judge \`${EARLIER}\`.`
    ].join('\n');
    assert.deepEqual(staleIds(DOC, content, PINS), []);
  });

  it('reports an undated earlier model in a results doc, even on a line whose next sentence has a date', () => {
    const content = [
      `Model \`${GENERATOR}\` · judge \`${EARLIER}\` · \`npm run eval:graded\`.`,
      `Model \`${GENERATOR}\` · judge \`${EARLIER}\`. Re-run 2026-08-28 on the Groq pin.`
    ].join('\n');
    assert.deepEqual(staleIds(DOC, content, PINS), [
      { line: 1, id: EARLIER },
      { line: 2, id: EARLIER }
    ]);
  });

  it('allows no dated earlier model outside the results docs', () => {
    assert.deepEqual(
      staleIds('README.md', `Run: 2026-08-30 · judge \`${EARLIER}\`.`, PINS),
      [{ line: 1, id: EARLIER }]
    );
  });
});

describe('isChecked', () => {
  it('checks the results docs, not the raw results beside them or the changelog', () => {
    assert.equal(isChecked('evals/results/maplibre-x.md'), true);
    assert.equal(isChecked('evals/results/example-x.md'), true);
    assert.equal(isChecked('evals/results/2026-11-07-maplibre-x.csv'), false);
    assert.equal(
      isChecked('evals/results/latest/maplibre-x-with-skill_2026-11-04.csv'),
      false
    );
    assert.equal(isChecked('evals/results/2026-11-07.json'), false);
    assert.equal(isChecked('CHANGELOG.md'), false);
    assert.equal(isChecked('evals/README.md'), true);
  });
});

// Without GIT_*, a run from inside a git hook can't reach the repo it was
// started from.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
);

describe('model-pin-check', () => {
  it('reads the pins, checks the tracked files, and says how a results doc may keep an earlier model', (t) => {
    const repo = mkdtempSync(join(tmpdir(), 'model-pin-check-'));
    t.after(() => rmSync(repo, { recursive: true, force: true }));
    const write = (path, text) => {
      mkdirSync(dirname(join(repo, path)), { recursive: true });
      writeFileSync(join(repo, path), text);
    };
    write(
      'package.json',
      JSON.stringify({
        scripts: { 'eval:graded': `promptfoo eval --grader ${JUDGE} -j 1` }
      })
    );
    write('evals/prompts/lib/providers.yaml', `id: ${GENERATOR}\n`);
    write(DOC, `Model \`${GENERATOR}\` · judge \`${EARLIER}\`.\n`);
    write('evals/results/2026-08-30-maplibre-x.csv', `generator\n${EARLIER}\n`);
    write('CHANGELOG.md', `- judged by \`${EARLIER}\`\n`);
    execFileSync('git', ['init', '-q'], { cwd: repo, env });
    execFileSync('git', ['add', '-A'], { cwd: repo, env });
    const check = () => {
      const result = spawnSync(process.execPath, [script], {
        cwd: repo,
        env,
        encoding: 'utf8'
      });
      return { status: result.status, output: result.stdout + result.stderr };
    };

    let { status, output } = check();
    assert.equal(status, 1, output);
    assert.equal(
      output,
      [
        `${DOC}:1: stale provider id "${EARLIER}"`,
        '',
        `1 stale provider id(s). Pinned: ${GENERATOR}, ${JUDGE}.`,
        'A results doc may name an earlier model only in a sentence that gives the date of its run.',
        ''
      ].join('\n')
    );

    write(DOC, `Run: 2026-08-30 · judge \`${EARLIER}\`.\n`);
    ({ status, output } = check());
    assert.equal(status, 0, output);
    assert.match(output, /✅ All provider ids match the pins/);
  });
});
