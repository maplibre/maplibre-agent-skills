import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  changedInputs,
  harnessOf,
  inputsOf,
  missingSkillFiles,
  recordedInputs,
  skillFiles
} from './lib/eval-inputs.js';

const CONFIG = [
  'prompts: [file://lib/skill-prompt.mjs]',
  'providers: [file://lib/providers.yaml]',
  'defaultTest:',
  '  vars:',
  '    skillFile: skills/maplibre-a/SKILL.md',
  'tests:',
  '  - vars:',
  '      prompt: How?',
  ''
].join('\n');

const SKILL = (status, body = 'Use it.') =>
  [
    '---',
    'name: maplibre-a',
    'description: A skill. Use when testing.',
    'metadata:',
    `  status: ${status}`,
    '---',
    '',
    body,
    ''
  ].join('\n');

// A repo holding one skill, its config, and the harness, with `files`
// replacing or adding to them.
function repo(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'eval-inputs-'));
  const all = {
    'evals/prompts/lib/skill-prompt.mjs': 'export default () => [];\n',
    'evals/prompts/lib/providers.yaml': 'id: generator-a\n',
    'evals/prompts/maplibre-a.yaml': CONFIG,
    'skills/maplibre-a/SKILL.md': SKILL('verified'),
    'package.json': JSON.stringify({
      scripts: {
        'eval:graded': 'promptfoo eval --grader judge-a',
        lint: 'eslint'
      }
    }),
    'package-lock.json': JSON.stringify({
      packages: { 'node_modules/promptfoo': { version: '0.125.1' } }
    }),
    ...files
  };
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const inputs = (root) =>
  inputsOf('evals/prompts/maplibre-a.yaml', { root, harness: harnessOf(root) });

describe('skillFiles', () => {
  it("reads the defaultTest's skill file and any a test sets itself", () => {
    const text = [
      'defaultTest:',
      '  vars:',
      '    skillFile: skills/b/SKILL.md',
      'tests:',
      '  - vars: { prompt: x }',
      '  - vars: { prompt: y, skillFile: skills/a/SKILL.md }',
      '  - vars: { prompt: z, skillFile: skills/b/SKILL.md }',
      ''
    ].join('\n');
    assert.deepEqual(skillFiles(text), [
      'skills/a/SKILL.md',
      'skills/b/SKILL.md'
    ]);
  });

  it('finds none in a config that injects no skill', () => {
    assert.deepEqual(skillFiles('tests:\n  - vars: { prompt: x }\n'), []);
  });
});

describe('missingSkillFiles', () => {
  it('names the skill files a config points at that are not written yet', () => {
    const root = repo({
      'evals/prompts/maplibre-b.yaml': CONFIG.replace(
        'maplibre-a',
        'maplibre-b'
      )
    });
    assert.deepEqual(
      missingSkillFiles('evals/prompts/maplibre-b.yaml', { root }),
      ['skills/maplibre-b/SKILL.md']
    );
    assert.deepEqual(
      missingSkillFiles('evals/prompts/maplibre-a.yaml', { root }),
      []
    );
  });
});

describe('inputsOf', () => {
  it('hashes the same files the same way', () => {
    assert.deepEqual(inputs(repo()), inputs(repo()));
  });

  it('hashes a skill not written yet as absent, so the config is due when it appears', () => {
    const config = 'evals/prompts/maplibre-b.yaml';
    const text = CONFIG.replace('maplibre-a', 'maplibre-b');
    const unwritten = repo({ [config]: text });
    const written = repo({
      [config]: text,
      'skills/maplibre-b/SKILL.md': SKILL('provisional')
    });
    const before = inputsOf(config, {
      root: unwritten,
      harness: harnessOf(unwritten)
    });
    assert.deepEqual(
      before,
      inputsOf(config, {
        root: repo({ [config]: text }),
        harness: harnessOf(unwritten)
      })
    );
    const after = inputsOf(config, {
      root: written,
      harness: harnessOf(written)
    });
    assert.deepEqual(changedInputs(after, before), ['SKILL.md']);
  });

  it("changes only the skill's hash when the skill text changes", () => {
    const before = inputs(repo());
    const after = inputs(
      repo({ 'skills/maplibre-a/SKILL.md': SKILL('verified', 'Use it now.') })
    );
    assert.deepEqual(changedInputs(after, before), ['SKILL.md']);
  });

  it('leaves out the status, which the grade itself sets', () => {
    assert.deepEqual(
      inputs(repo({ 'skills/maplibre-a/SKILL.md': SKILL('provisional') })),
      inputs(repo())
    );
  });

  it("changes only the config's hash when a test changes", () => {
    const after = inputs(
      repo({
        'evals/prompts/maplibre-a.yaml': CONFIG.replace('How?', 'Why?')
      })
    );
    assert.deepEqual(changedInputs(after, inputs(repo())), ['eval config']);
  });
});

describe('harnessOf', () => {
  const base = harnessOf(repo());

  it('changes with a file in evals/prompts/lib', () => {
    assert.notEqual(
      harnessOf(
        repo({ 'evals/prompts/lib/providers.yaml': 'id: generator-b\n' })
      ),
      base
    );
  });

  it('changes with the eval:graded command, and with no other script', () => {
    const scripts = (graded, lint) =>
      JSON.stringify({ scripts: { 'eval:graded': graded, lint } });
    assert.notEqual(
      harnessOf(
        repo({
          'package.json': scripts('promptfoo eval --grader judge-b', 'eslint')
        })
      ),
      base
    );
    assert.equal(
      harnessOf(
        repo({
          'package.json': scripts('promptfoo eval --grader judge-a', 'biome')
        })
      ),
      base
    );
  });

  it('changes with the promptfoo version the lockfile pins', () => {
    assert.notEqual(
      harnessOf(
        repo({
          'package-lock.json': JSON.stringify({
            packages: { 'node_modules/promptfoo': { version: '0.126.0' } }
          })
        })
      ),
      base
    );
  });
});

describe('recordedInputs', () => {
  it("reads each skill's inputs from the record of the day it was graded", () => {
    const records = {
      '2026-10-20': {
        configs: { 'maplibre-a': { inputs: { skill: 'a' } } }
      },
      '2026-10-21': { configs: {} }
    };
    const recorded = recordedInputs(
      new Map([
        ['maplibre-a', '2026-10-20'],
        ['maplibre-b', '2026-10-21'],
        ['maplibre-c', '2026-10-01']
      ]),
      (date) => {
        if (!records[date]) throw new Error('ENOENT');
        return records[date];
      }
    );
    assert.deepEqual(recorded.get('maplibre-a'), { skill: 'a' });
    assert.equal(recorded.get('maplibre-b'), null);
    assert.equal(recorded.get('maplibre-c'), null);
  });
});

describe('changedInputs', () => {
  it('names every input when nothing was recorded', () => {
    assert.deepEqual(changedInputs({ skill: 'a', config: 'b', harness: 'c' }), [
      'SKILL.md',
      'eval config',
      'harness'
    ]);
  });
});
