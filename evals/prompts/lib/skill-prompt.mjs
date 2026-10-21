/**
 * Shared Promptfoo prompt function for skill evals.
 *
 * Injects the skill's SKILL.md as the system message.
 * Set vars.skillFile to the skill path relative to the repo root,
 * e.g. "skills/maplibre-tile-sources/SKILL.md".
 *
 * It also sets each request's answer cap. Groq counts a request as its prompt
 * plus that cap and refuses one over its per-minute limit before the model
 * reads it, so the cap is the answer budget in providers.yaml or whatever the
 * limit leaves after this prompt, whichever is smaller. A skill can grow without
 * any request being refused; its answers get less room instead, which
 * `npm run lint:prompt-budget` reports.
 */

import { readFileSync } from 'fs';
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
  const messages = [];
  // Compares case-insensitively: `--var injectSkill=False` on the CLI is a
  // one-character typo away from silently injecting the skill anyway.
  if (String(vars.injectSkill).toLowerCase() !== 'false') {
    const skillContent = readFileSync(join(repoRoot, vars.skillFile), 'utf8');
    messages.push({ role: 'system', content: skillContent });
  }
  messages.push({ role: 'user', content: vars.prompt });
  const prompt = JSON.stringify(messages);

  const limits = limitsFrom();
  const cap = answerCap(promptTokens(messages, limits), {
    answerTokens: answerBudget(),
    ...limits
  });
  // A prompt that fills the minute on its own is sent as is: Groq refuses it,
  // and the run reports it as `request-too-large`.
  if (cap < 1) return prompt;
  return { prompt, config: { max_completion_tokens: cap } };
}
