/**
 * Shared Promptfoo prompt function for skill evals.
 *
 * Injects the skill's SKILL.md as the system message.
 * Set vars.skillFile to the skill path relative to the repo root,
 * e.g. "skills/maplibre-tile-sources/SKILL.md".
 *
 * It also sets each request's answer cap. Groq counts a request as its prompt
 * plus that cap and refuses one over its per-minute limit before the model
 * reads it, so the cap is whatever the limit leaves after the test's prompt
 * with the skill loaded (see answerCap in request-size.mjs). A skill can grow
 * without any request being refused; its answers get less room instead, which
 * `npm run lint:prompt-budget` reports.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  answerBudget,
  answerCap,
  limitsFrom,
  promptTokens
} from './request-size.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export default function ({ vars }) {
  // Compares case-insensitively: `--var injectSkill=False` on the CLI is a
  // one-character typo away from silently injecting the skill anyway.
  const inject = String(vars.injectSkill).toLowerCase() !== 'false';
  const skillPath = join(repoRoot, vars.skillFile);
  const question = { role: 'user', content: vars.prompt };
  // A baseline reads the skill too, to size its cap, unless the skill is not
  // written yet (a new skill's rubric round).
  const skill =
    inject || existsSync(skillPath)
      ? { role: 'system', content: readFileSync(skillPath, 'utf8') }
      : null;
  const withSkill = skill ? [skill, question] : [question];
  const messages = inject ? withSkill : [question];
  const prompt = JSON.stringify(messages);

  // Both runs of a test get the cap the skill's run gets, so the skill is the
  // only thing a baseline comparison changes.
  const limits = limitsFrom();
  const cap = answerCap(promptTokens(withSkill, limits), {
    answerTokens: answerBudget(),
    ...limits
  });
  // A prompt that fills the minute on its own is sent as is: Groq refuses it,
  // and the run reports it as `request-too-large`.
  if (cap < 1) return prompt;
  return { prompt, config: { max_completion_tokens: cap } };
}
