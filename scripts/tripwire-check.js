#!/usr/bin/env node
/**
 * Fails on any eval tripwire that the skill it tests already trips: a
 * `not-icontains` or another `not-` string check that matches text in the
 * injected SKILL.md. The model repeats what the skill says, warnings included,
 * so such a check can fail an answer for following the skill. Negative tests
 * are exempt; see scripts/lib/tripwires.js.
 *
 * The skill is read through the provider's own transform, so it is compared
 * the way an answer that quotes it would be graded.
 */
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { missingSkillFiles } from './lib/eval-inputs.js';
import { listEvalConfigs, skillOf } from './lib/eval-verdicts.js';
import { answerTransform, selfTrippedTripwires } from './lib/tripwires.js';

const graded = answerTransform(
  load(readFileSync('evals/prompts/lib/providers.yaml', 'utf8'))
);
// A skill not written yet (a rubric round) has no text for a tripwire to match.
const readSkill = (path) => {
  try {
    return graded(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

let failed = false;
for (const configPath of listEvalConfigs()) {
  const skill = skillOf(configPath);
  let found;
  try {
    found = selfTrippedTripwires(load(readFileSync(configPath, 'utf8')), {
      readSkill
    });
  } catch (error) {
    console.error(`❌ ${skill}: cannot check its tripwires (${error.message})`);
    failed = true;
    continue;
  }
  for (const trip of found) {
    console.error(
      `❌ ${skill} test ${trip.test} (${trip.description}): ${trip.type} ${JSON.stringify(trip.term)} matches ${trip.skillFile} line ${trip.line}, so an answer that repeats the skill fails it. Check it in the llm-rubric instead, where the judge can tell recommending a thing from warning against it.`
    );
    failed = true;
  }
  if (found.length === 0) {
    const unwritten = missingSkillFiles(configPath);
    console.log(
      unwritten.length > 0
        ? `✅ ${skill} (no SKILL.md at ${unwritten.join(', ')} yet, so nothing to match)`
        : `✅ ${skill}`
    );
  }
}

if (failed) process.exit(1);
console.log('\n✅ No eval tripwire matches the skill it tests');
