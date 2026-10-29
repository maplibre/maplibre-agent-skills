#!/usr/bin/env node
/**
 * Reports how much answer room every eval request has, and fails when a skill
 * or a test prompt has grown so far that its answers would mostly be cut off.
 * Then it reports how many days of the generator key a full round of every
 * config takes, and fails only for a config no single day could grade.
 *
 * No request can exceed the generator's per-minute limit: the prompt function
 * gives each one an answer cap of whatever the limit leaves after its prompt,
 * up to the answer budget in providers.yaml. A longer prompt therefore costs
 * answer room. Below the budget this warns; below MIN_ANSWER_SHARE of it, most
 * answers would be truncated, so it fails. In the 98 answers of the October
 * runs the median used 2,822 tokens and 92% used more than 1,536, half the
 * 3,072-token budget.
 */
import { readFileSync } from 'node:fs';
import { listEvalConfigs, skillOf } from './lib/eval-verdicts.js';
import { passCost, sizeConfig, workflowSetting } from './lib/prompt-budget.js';
import { dayCost } from './run-evals.js';
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
const costs = new Map();
for (const configPath of listEvalConfigs()) {
  const skill = skillOf(configPath);
  let sizes;
  let missingSkills;
  try {
    ({ sizes, missingSkills } = sizeConfig(configPath, {
      limits,
      answerTokens
    }));
  } catch (error) {
    console.error(`❌ ${skill}: cannot size its requests (${error.message})`);
    failed = true;
    continue;
  }
  // A rubric round is run at baseline by hand, not by the scheduled run, so it
  // is sized as that run sends it and left out of the round below.
  const unwritten = missingSkills.length > 0;
  const withheld = unwritten ? ' with the skill withheld' : '';
  if (unwritten) {
    console.log(
      `⚠️  ${skill}: no SKILL.md at ${missingSkills.join(', ')} yet: sized with the skill withheld, as its baseline runs, and left out of the daily round until the skill exists.`
    );
  } else {
    costs.set(skill, passCost(sizes));
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
      `✅ ${skill}: every answer gets the full budget${withheld}, and its longest prompt can grow ${thousands(growth)} tokens before that changes`
    );
  }
}

// Each day's run grades the longest-waiting configs as far as
// EVAL_TOKENS_PER_DAY holds them, so a full round takes as many days as the
// configs need. Only a config too big for any one day can never be graded.
const workflow = readFileSync('.github/workflows/eval.yml', 'utf8');
const tokensPerDay = workflowSetting(workflow, 'EVAL_TOKENS_PER_DAY');
console.log('');
if (tokensPerDay === null) {
  console.error(
    '❌ .github/workflows/eval.yml sets no EVAL_TOKENS_PER_DAY for the "Run evals" step.'
  );
  failed = true;
} else {
  let round = 0;
  for (const [skill, cost] of costs) {
    const need = dayCost(cost);
    round += need;
    if (need > tokensPerDay) {
      console.error(
        `❌ ${skill}: its tests and their allowed re-runs can spend ${thousands(need)} generator tokens, more than a day's ${thousands(tokensPerDay)}, so no day can grade it. Split the config, or shorten the SKILL.md.`
      );
      failed = true;
    }
  }
  console.log(
    `✅ A full round of every config, every allowed re-run included, can spend ${thousands(round)} generator tokens: about ${(round / tokensPerDay).toFixed(1)} days of the key's ${thousands(tokensPerDay)} a day, longest-waiting first.`
  );
}

if (failed) process.exit(1);
console.log(
  '\n✅ Every eval request keeps at least half its answer budget, and every config fits in a day'
);
