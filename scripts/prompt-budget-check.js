#!/usr/bin/env node
/**
 * Reports how much answer room every eval request has, and fails when a skill
 * or a test prompt has grown so far that its answers would mostly be cut off.
 *
 * No request can exceed the generator's per-minute limit: the prompt function
 * gives each one an answer cap of whatever the limit leaves after its prompt,
 * up to the answer budget in providers.yaml. A longer prompt therefore costs
 * answer room. Below the budget this warns; below MIN_ANSWER_SHARE of it, most
 * answers would be truncated, so it fails. In the 98 answers of the October
 * runs the median used 2,822 tokens and 92% used more than 1,536, half the
 * 3,072-token budget.
 */
import { listEvalConfigs, skillOf } from './lib/eval-verdicts.js';
import { sizeConfig } from './lib/prompt-budget.js';
import {
  answerBudget,
  limitsFrom
} from '../evals/prompts/lib/request-size.mjs';

const MIN_ANSWER_SHARE = 0.5;

function thousands(value) {
  return value.toLocaleString('en-US');
}

const limits = limitsFrom();
const answerTokens = answerBudget();
const floor = Math.ceil(answerTokens * MIN_ANSWER_SHARE);
console.log(
  `Sizing with ${thousands(limits.tokensPerMinute)} tokens a minute and a ${limits.templateTokens}-token chat template; each eval run measures both again.\n`
);

let failed = false;
for (const configPath of listEvalConfigs()) {
  const skill = skillOf(configPath);
  let sizes;
  try {
    sizes = sizeConfig(configPath, { limits, answerTokens });
  } catch (error) {
    console.error(`❌ ${skill}: cannot size its requests (${error.message})`);
    failed = true;
    continue;
  }
  if (sizes.length === 0) {
    console.log(`✅ ${skill}: no tests to size`);
    continue;
  }

  for (const size of sizes.filter((s) => s.answer < answerTokens)) {
    const line = `${skill} test ${size.test} (${size.description}): its ${thousands(size.prompt)}-token prompt leaves ${thousands(size.answer)} of the ${thousands(answerTokens)}-token answer budget`;
    if (size.answer < floor) {
      console.error(
        `❌ ${line}, under half, so most answers would be cut off. Shorten the SKILL.md or the test prompt.`
      );
      failed = true;
    } else {
      console.log(`⚠️  ${line}.`);
    }
  }
  if (sizes.every((s) => s.answer === answerTokens)) {
    const growth = Math.min(
      ...sizes.map((s) => limits.tokensPerMinute - answerTokens - s.prompt)
    );
    console.log(
      `✅ ${skill}: every answer gets the full budget, and its longest prompt can grow ${thousands(growth)} tokens before that changes`
    );
  }
}

if (failed) process.exit(1);
console.log('\n✅ Every eval request keeps at least half its answer budget');
