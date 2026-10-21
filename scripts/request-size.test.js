import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEMPLATE_TOKENS,
  DEFAULT_TOKENS_PER_MINUTE,
  answerBudget,
  answerCap,
  countTokens,
  limitsFrom,
  promptTokens
} from '../evals/prompts/lib/request-size.mjs';
import render from '../evals/prompts/lib/skill-prompt.mjs';

// The prompt function reads the limits a run passes it from the environment.
function withEnv(values, body) {
  const saved = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );
  Object.assign(process.env, values);
  try {
    return body();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('countTokens', () => {
  it('counts in o200k_base, the encoding Groq counted the template in', () => {
    // cl100k_base makes this four tokens.
    assert.equal(countTokens('スプライト'), 3);
  });
});

describe('limitsFrom', () => {
  it('takes the limits a run measured', () => {
    assert.deepEqual(
      limitsFrom({
        EVAL_TOKENS_PER_MINUTE: '6000',
        EVAL_TEMPLATE_TOKENS: '80'
      }),
      { tokensPerMinute: 6000, templateTokens: 80 }
    );
  });

  it('falls back to the last measured values for anything missing or unusable', () => {
    assert.deepEqual(limitsFrom({ EVAL_TOKENS_PER_MINUTE: 'lots' }), {
      tokensPerMinute: DEFAULT_TOKENS_PER_MINUTE,
      templateTokens: DEFAULT_TEMPLATE_TOKENS
    });
  });
});

describe('answerBudget', () => {
  it("reads max_completion_tokens from the provider's config", () => {
    assert.equal(
      answerBudget(
        'config:\n  temperature: 0\n  max_completion_tokens: 3072\n'
      ),
      3072
    );
  });

  it('does not read the key out of a comment', () => {
    assert.throws(
      () =>
        answerBudget(
          '# max_completion_tokens: 10\nconfig:\n  temperature: 0\n'
        ),
      /No max_completion_tokens/
    );
  });

  it('finds the budget in providers.yaml itself', () => {
    assert.ok(answerBudget() > 0);
  });
});

describe('promptTokens and answerCap', () => {
  it("size run 39585050825's refused request to fit the minute", () => {
    // That SKILL.md was 4,769 tokens and the test prompt 93; with no cap sent,
    // Groq reserved 3,072 and logged "Limit 8000, Requested 8008".
    const tokens = { skill: 4769, prompt: 93 };
    const prompt = promptTokens([{ content: 'skill' }, { content: 'prompt' }], {
      templateTokens: 74,
      count: (text) => tokens[text]
    });
    assert.equal(prompt + 3072, 8008);
    assert.equal(
      answerCap(prompt, { answerTokens: 3072, tokensPerMinute: 8000 }),
      3064
    );
  });

  it('keeps the whole budget while the prompt leaves room for it', () => {
    assert.equal(
      answerCap(3000, { answerTokens: 3072, tokensPerMinute: 8000 }),
      3072
    );
  });
});

describe('skill-prompt', () => {
  const vars = {
    skillFile: 'skills/maplibre-v6-migration/SKILL.md',
    prompt: 'How do I add a map?'
  };

  it('gives the answer the whole budget when the prompt leaves room', () => {
    const { prompt, config } = render({ vars });
    assert.equal(JSON.parse(prompt).length, 2);
    assert.equal(config.max_completion_tokens, answerBudget());
  });

  it('lowers the cap to what a smaller minute leaves after the prompt', () => {
    withEnv({ EVAL_TOKENS_PER_MINUTE: '4000' }, () => {
      const { prompt, config } = render({ vars });
      const used = promptTokens(JSON.parse(prompt), limitsFrom());
      assert.ok(4000 - used < answerBudget());
      assert.equal(config.max_completion_tokens, 4000 - used);
    });
  });

  it('sends a prompt that fills the minute on its own as is, for Groq to refuse', () => {
    withEnv({ EVAL_TOKENS_PER_MINUTE: '100' }, () => {
      assert.equal(typeof render({ vars }), 'string');
    });
  });

  it('withholds the skill on a baseline run', () => {
    const { prompt } = render({ vars: { ...vars, injectSkill: 'false' } });
    assert.deepEqual(JSON.parse(prompt), [
      { role: 'user', content: vars.prompt }
    ]);
  });
});
