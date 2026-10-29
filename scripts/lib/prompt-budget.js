/**
 * Every request an eval config makes, sized the way Groq will see it: the
 * prompt evals/prompts/lib/skill-prompt.mjs renders, and the answer cap it
 * gives that prompt (see evals/prompts/lib/request-size.mjs). A request never
 * exceeds the generator's per-minute limit; what a growing skill costs is
 * answer room, so that is what this reports.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import render from '../../evals/prompts/lib/skill-prompt.mjs';
import { missingSkillFiles } from './eval-inputs.js';
import {
  answerBudget,
  answerCap,
  countTokens,
  limitsFrom,
  promptTokens
} from '../../evals/prompts/lib/request-size.mjs';

// The one prompt function and the one provider every config uses. A config
// with anything else is sized by rules nothing here measured.
export const SKILL_PROMPT = 'file://lib/skill-prompt.mjs';
export const PINNED_PROVIDER = 'file://lib/providers.yaml';

/**
 * Every test of one parsed eval config: its prompt, its answer cap, and the
 * request the two make. Vars merge the way promptfoo merges them, a test's
 * own over `defaultTest`'s. Throws for a config that does not use the shared
 * prompt and the pinned provider.
 */
export function sizeTests(
  config,
  { render, limits, answerTokens, count = countTokens }
) {
  const prompts = JSON.stringify(config?.prompts);
  const providers = JSON.stringify(config?.providers);
  if (prompts !== JSON.stringify([SKILL_PROMPT])) {
    throw new Error(`expected prompts: [${SKILL_PROMPT}], found ${prompts}`);
  }
  if (providers !== JSON.stringify([PINNED_PROVIDER])) {
    throw new Error(
      `expected providers: [${PINNED_PROVIDER}], found ${providers}`
    );
  }
  return (config.tests ?? []).map((test, index) => {
    const vars = { ...config.defaultTest?.vars, ...test.vars };
    const rendered = render({ vars });
    const messages = JSON.parse(
      typeof rendered === 'string' ? rendered : rendered.prompt
    );
    const prompt = promptTokens(messages, {
      templateTokens: limits.templateTokens,
      count
    });
    const answer = Math.max(
      0,
      answerCap(prompt, {
        answerTokens,
        tokensPerMinute: limits.tokensPerMinute
      })
    );
    return {
      test: index + 1,
      description: test.description ?? `test ${index + 1}`,
      prompt,
      answer,
      request: prompt + answer
    };
  });
}

/**
 * The most one pass over these tests can spend, since Groq stops each answer at
 * its cap, the largest single request, and how many requests the pass makes.
 */
export function passCost(sizes) {
  const requests = sizes.map((size) => size.request);
  return {
    firstPass: requests.reduce((total, request) => total + request, 0),
    largest: Math.max(0, ...requests),
    requests: requests.length
  };
}

/**
 * A whole-number setting of eval.yml's "Run evals" step, such as
 * `EVAL_TOKENS_PER_DAY: 200000`, or null when the workflow does not set it.
 */
export function workflowSetting(workflowText, name) {
  const match = new RegExp(`^\\s+${name}:\\s*(\\d+)\\s*$`, 'm').exec(
    workflowText
  );
  return match ? Number(match[1]) : null;
}

/**
 * Every test of one eval config file, rendered as the eval renders it, and
 * sized, with the skill files the config names that are not written yet. Such
 * a config is a rubric round, run at baseline until its skill exists, so its
 * requests are sized with the skill withheld, as that run sends them.
 */
export function sizeConfig(
  path,
  { limits = limitsFrom(), answerTokens = answerBudget(), root = '.' } = {}
) {
  const missingSkills = missingSkillFiles(path, { root });
  const withheld = ({ vars }) =>
    render({ vars: { ...vars, injectSkill: 'false' } });
  const sizes = sizeTests(load(readFileSync(join(root, path), 'utf8')), {
    render: missingSkills.length > 0 ? withheld : render,
    limits,
    answerTokens
  });
  return { sizes, missingSkills };
}
