/**
 * How big a request to the pinned generator is, as Groq counts it, and how much
 * of the generator's per-minute limit that leaves for the answer.
 *
 * Groq counts a request as its prompt plus the answer cap it reserves, and
 * refuses one over the organization's tokens per minute with a 413 before the
 * model reads it. The prompt is each message's content in o200k_base, the
 * vocabulary of gpt-oss's o200k_harmony encoding (openai/harmony,
 * src/tiktoken_ext/public_encodings.rs), plus a fixed chat template.
 *
 * Both limits come from Groq itself: scripts/run-evals.js measures them at the
 * start of every run and passes them on as EVAL_TOKENS_PER_MINUTE and
 * EVAL_TEMPLATE_TOKENS. The defaults are what that measurement returned on
 * 2026-10-21, for a run started some other way.
 */
import { readFileSync } from 'node:fs';
import { Tiktoken } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

export const DEFAULT_TOKENS_PER_MINUTE = 8000;
export const DEFAULT_TEMPLATE_TOKENS = 74;

const PROVIDERS = new URL('./providers.yaml', import.meta.url);

/**
 * The answer budget providers.yaml sets for the pinned generator. Read from the
 * file because promptfoo hands a prompt function only the provider's id and
 * label, never its config.
 */
export function answerBudget(text = readFileSync(PROVIDERS, 'utf8')) {
  const match = /^\s+max_completion_tokens:\s*(\d+)\s*$/m.exec(text);
  if (!match) {
    throw new Error(
      'No max_completion_tokens in evals/prompts/lib/providers.yaml'
    );
  }
  return Number(match[1]);
}

// Built on first use: the rank table is large, and a prompt render needs it
// only once per process.
let encoder = null;

/** Tokens in one message's content, in gpt-oss's encoding. */
export function countTokens(text) {
  encoder ??= new Tiktoken(o200k_base);
  return encoder.encode(text).length;
}

/** The limits a run measured, or the defaults when nothing was passed in. */
export function limitsFrom(env = process.env) {
  const read = (name, fallback) => {
    const value = Number(env[name]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  };
  return {
    tokensPerMinute: read('EVAL_TOKENS_PER_MINUTE', DEFAULT_TOKENS_PER_MINUTE),
    templateTokens: read('EVAL_TEMPLATE_TOKENS', DEFAULT_TEMPLATE_TOKENS)
  };
}

/** Groq's prompt size for one rendered messages array. */
export function promptTokens(
  messages,
  { templateTokens, count = countTokens }
) {
  return messages.reduce(
    (total, message) => total + count(message.content),
    templateTokens
  );
}

/**
 * The answer cap for a prompt of this size: the configured answer budget, or
 * whatever the per-minute limit leaves after the prompt, whichever is smaller.
 * Zero or less means the prompt alone fills the minute.
 */
export function answerCap(prompt, { answerTokens, tokensPerMinute }) {
  return Math.min(answerTokens, tokensPerMinute - prompt);
}
