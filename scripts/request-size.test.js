import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEMPLATE_TOKENS,
  DEFAULT_TOKENS_PER_MINUTE,
  UNRESERVED_TOKENS,
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
  it("size run 39585050825's refused request to fit the minute, one token short", () => {
    // That SKILL.md was 4,769 tokens and the test prompt 93; with no cap sent,
    // Groq reserved 3,072 and logged "Limit 8000, Requested 8008".
    const tokens = { skill: 4769, prompt: 93 };
    const prompt = promptTokens([{ content: 'skill' }, { content: 'prompt' }], {
      templateTokens: 74,
      count: (text) => tokens[text]
    });
    assert.equal(prompt + 3072, 8008);
    const cap = answerCap(prompt, {
      answerTokens: answerBudget(),
      tokensPerMinute: 8000
    });
    assert.equal(cap, 3063);
    assert.equal(prompt + cap + UNRESERVED_TOKENS, 8000);
  });

  it('never reserves the whole minute, so a full answer leaves Groq some', () => {
    assert.ok(UNRESERVED_TOKENS > 0);
    assert.equal(
      answerCap(4000, { answerTokens: 65536, tokensPerMinute: 8000 }),
      8000 - UNRESERVED_TOKENS - 4000
    );
  });

  it('keeps to the budget while the minute leaves more', () => {
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

  it('gives the answer what the minute leaves after the prompt', () => {
    withEnv({ EVAL_TOKENS_PER_MINUTE: '8000' }, () => {
      const { prompt, config } = render({ vars });
      const used = promptTokens(JSON.parse(prompt), limitsFrom());
      assert.equal(JSON.parse(prompt).length, 2);
      assert.equal(
        config.max_completion_tokens,
        8000 - UNRESERVED_TOKENS - used
      );
    });
  });

  it('lowers the cap to what a smaller minute leaves after the prompt', () => {
    withEnv({ EVAL_TOKENS_PER_MINUTE: '4000' }, () => {
      const { prompt, config } = render({ vars });
      const used = promptTokens(JSON.parse(prompt), limitsFrom());
      assert.equal(
        config.max_completion_tokens,
        4000 - UNRESERVED_TOKENS - used
      );
    });
  });

  it('sends a prompt that fills the minute on its own as is, for Groq to refuse', () => {
    withEnv({ EVAL_TOKENS_PER_MINUTE: '100' }, () => {
      assert.equal(typeof render({ vars }), 'string');
    });
  });

  it('withholds the skill on a baseline run and gives it the same cap', () => {
    const withSkill = render({ vars });
    const baseline = render({ vars: { ...vars, injectSkill: 'false' } });
    assert.deepEqual(JSON.parse(baseline.prompt), [
      { role: 'user', content: vars.prompt }
    ]);
    assert.equal(
      baseline.config.max_completion_tokens,
      withSkill.config.max_completion_tokens
    );
  });

  it('sizes a baseline from its question alone while the skill is unwritten', () => {
    const unwritten = {
      skillFile: 'skills/maplibre-not-written-yet/SKILL.md',
      prompt: vars.prompt,
      injectSkill: 'false'
    };
    withEnv({ EVAL_TOKENS_PER_MINUTE: '8000' }, () => {
      const { prompt, config } = render({ vars: unwritten });
      const used = promptTokens(JSON.parse(prompt), limitsFrom());
      assert.equal(
        config.max_completion_tokens,
        8000 - UNRESERVED_TOKENS - used
      );
    });
    assert.throws(
      () => render({ vars: { ...unwritten, injectSkill: 'true' } }),
      /ENOENT/
    );
  });
});
