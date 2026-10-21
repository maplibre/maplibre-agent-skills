import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PINNED_PROVIDER,
  SKILL_PROMPT,
  passCost,
  sizeTests,
  workflowSetting
} from './lib/prompt-budget.js';

// One token per character, so each sum below can be checked by eye.
const byLength = (text) => text.length;
const limits = { tokensPerMinute: 100, templateTokens: 10 };

// Renders the way evals/prompts/lib/skill-prompt.mjs does, from the vars alone.
function render({ vars }) {
  return {
    prompt: JSON.stringify([
      { role: 'system', content: vars.skillFile },
      { role: 'user', content: vars.prompt }
    ]),
    config: {}
  };
}

function config(tests, overrides = {}) {
  return {
    prompts: [SKILL_PROMPT],
    providers: [PINNED_PROVIDER],
    defaultTest: { vars: { skillFile: 's'.repeat(40) } },
    tests,
    ...overrides
  };
}

describe('sizeTests', () => {
  it("sizes every test's prompt, answer cap, and request, a test's vars over defaultTest's", () => {
    const sizes = sizeTests(
      config([
        { description: 'short', vars: { prompt: 'p'.repeat(10) } },
        { vars: { prompt: 'p'.repeat(30), skillFile: 's'.repeat(45) } }
      ]),
      { render, limits, answerTokens: 30, count: byLength }
    );
    assert.deepEqual(sizes, [
      // 10 template + 40 + 10 leaves 40 of the minute: the whole budget fits.
      { test: 1, description: 'short', prompt: 60, answer: 30, request: 90 },
      // 10 + 45 + 30 leaves 15, so the answer gets 15 and the request fits.
      { test: 2, description: 'test 2', prompt: 85, answer: 15, request: 100 }
    ]);
  });

  it('gives a prompt that fills the minute no answer at all', () => {
    const [size] = sizeTests(config([{ vars: { prompt: 'p'.repeat(60) } }]), {
      render,
      limits,
      answerTokens: 30,
      count: byLength
    });
    assert.equal(size.answer, 0);
  });

  it('refuses a config whose prompt it does not know how to render', () => {
    assert.throws(
      () =>
        sizeTests(config([], { prompts: ['file://lib/other.mjs'] }), {
          render,
          limits,
          answerTokens: 30
        }),
      /expected prompts/
    );
  });

  it('refuses a config with a generator other than the pinned one', () => {
    assert.throws(
      () =>
        sizeTests(config([], { providers: ['file://lib/other.yaml'] }), {
          render,
          limits,
          answerTokens: 30
        }),
      /expected providers/
    );
  });
});

describe('passCost', () => {
  it('adds up the requests and keeps the largest', () => {
    assert.deepEqual(
      passCost([{ request: 7000 }, { request: 7900 }, { request: 6500 }]),
      { firstPass: 21400, largest: 7900 }
    );
    assert.deepEqual(passCost([]), { firstPass: 0, largest: 0 });
  });
});

describe('workflowSetting', () => {
  const workflow = [
    '        env:',
    '          EVAL_CONFIG_MINUTES: 30',
    '          EVAL_TOKENS_PER_DAY: 200000'
  ].join('\n');

  it('reads a whole-number setting of the Run evals step', () => {
    assert.equal(workflowSetting(workflow, 'EVAL_TOKENS_PER_DAY'), 200000);
    assert.equal(workflowSetting(workflow, 'EVAL_CONFIG_MINUTES'), 30);
  });

  it('says null for a setting the workflow does not have', () => {
    assert.equal(workflowSetting(workflow, 'EVAL_TOKENS_PER_WEEK'), null);
  });
});
