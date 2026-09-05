# Evals

This directory contains evaluation infrastructure for MapLibre agent skills.

```text
evals/
├── prompts/     # Promptfoo eval configs — one per skill
│   └── lib/     # Shared prompt injection logic (skill-prompt.mjs)
└── results/     # Eval results committed by CI — do not edit manually
```

## How evals work

Each skill has a Promptfoo eval config in `evals/prompts/`. Promptfoo injects the
skill's `SKILL.md` as the system prompt, runs the test prompts, and checks
responses against assertions.

### Skill injection

`lib/skill-prompt.mjs` is the shared Promptfoo prompt function every eval config uses.
It reads the skill file at `vars.skillFile` — each skill YAML points this at its own
`SKILL.md` — and builds the messages array: a system message with the skill content,
then the user prompt.

Passing `--var injectSkill=false` on the CLI omits the system message, leaving the model
to answer from training data alone. This is used for the baseline check.

Two assertion types are used:

- **`icontains`** — deterministic substring check for a required term (an API name, CLI command, or config key) whose absence makes the response wrong. Pair with `llm-rubric` for the broader correctness check.
- **`llm-rubric`** — qualitative check evaluated by a judge model; the `value` field
  describes what a correct answer must include — keep items specific and checkable,
  not "gives good advice"

## Setup

Evals use [Promptfoo](https://promptfoo.dev/), pinned as a dev dependency in `package.json`.
Run `npm install` once before running evals locally.

Current models:

| Role          | When                        | Provider                                      | Model ID                       |
| ------------- | --------------------------- | --------------------------------------------- | ------------------------------ |
| Generator     | All runs                    | [Groq](https://console.groq.com/)             | `groq:openai/gpt-oss-120b`     |
| Judge (CI)    | CI only                     | [Google Gemini](https://aistudio.google.com/) | `google:gemini-2.5-flash-lite` |
| Judge (local) | Optional — stronger quality | [Google Gemini](https://aistudio.google.com/) | `google:gemini-2.5-flash-lite` |

Update `providers.yaml` and this table together when the model changes; see [CI](#ci) for how the pin is enforced.

**Groq** (required for all runs):

1. Sign up at [console.groq.com](https://console.groq.com/) (free, no credit card).
2. Create an API key and add it to your shell:

```bash
export GROQ_API_KEY=your_key_here
echo 'export GROQ_API_KEY=your_key_here' >> ~/.zshrc
```

**Google Gemini** (optional — recommended for baseline validation):

Gemini is a stricter judge, better at catching responses that satisfy a rubric's
letter without the required reasoning — use it when validating that new tests
discriminate.

1. Get a free API key at [aistudio.google.com](https://aistudio.google.com/).
2. Add it to your shell:

```bash
export GOOGLE_API_KEY=your_key_here
echo 'export GOOGLE_API_KEY=your_key_here' >> ~/.zshrc
```

## Running evals

Run the eval for the skill you are working on:

```bash
# Groq judge (default — uses GROQ_API_KEY only):
npm run eval -- \
  --config evals/prompts/<skill-name>.yaml \
  --no-cache -j 1

# Gemini judge (optional — stronger; requires GOOGLE_API_KEY):
npm run eval:graded -- --config evals/prompts/<skill-name>.yaml
```

`eval:graded` (see `package.json`) is the one place the grader, `--delay`, and
concurrency are pinned — CI calls the same script. Don't hand-roll those flags in a
second location; a value copied here would drift the moment `package.json` changes.

All assertions must pass before pushing.

To view results interactively after any run:

```bash
npx promptfoo view
```

Local results are ephemeral — terminal output and `promptfoo view` are sufficient.

## Proving tests fail without the skill

Before writing skill content, verify your eval prompts have discriminating power —
they should fail without the skill and pass with it. Add `--var injectSkill=false`
to the [Gemini-judge command above](#running-evals) to omit the skill from the
system prompt and run the baseline check.

Explicit, implicit, and anti-pattern tests must all fail without the skill — if any of
these pass, the prompt is not testing skill-specific knowledge and must be revised.
Negative tests require judgment: a negative test that passes without the skill may still
be valid if it is close enough to the skill's topic to confirm the skill doesn't over-apply.

Once the skill is written, re-run the same command with `--var injectSkill=true` (or
omit the flag — that's the default) to confirm every test now passes.

## Writing eval prompts

When contributing a new skill, copy `evals/prompts/TEMPLATE.yaml` and rename it to
match your skill directory. Each eval config contains four tests, one of each type:

| Type         | Description                                        |
| ------------ | -------------------------------------------------- |
| Explicit     | Names the topic directly                           |
| Implicit     | Describes the scenario without naming the solution |
| Anti-pattern | A wrong approach the skill should correct          |
| Negative     | An adjacent question the skill should not dominate |

Write each `llm-rubric` assertion's `value` as a checklist of what a correct answer
must include (specific enough for a judge to evaluate, e.g. "mentions `addProtocol`
by name" rather than "explains the API").

**Negative tests:** The question should be adjacent to the skill's topic — close enough
that an over-eager agent might wrongly push the new skill information, but where doing so
would be unhelpful. A trivially unrelated question (e.g. a different library entirely) has
no discriminating power. The rubric should assert that a correct answer answers the actual
question and does NOT recommend the skill's solution where it doesn't apply.

Write prompts based on real developer or AI confusion: evidenced in GitHub issues, Stack Overflow questions, or Slack threads where AI assistants are known to fail.

**Important:** Let the YAML choose the provider on any run you record or cite. Passing `--providers` replaces the pinned generator, and unless the value matches a configured provider's `id` or `label`, Promptfoo builds a bare provider with none of `providers.yaml`'s config — no `temperature`, no `max_tokens`, no label — which unpins the model on a run you are about to cite, and mislabels the results. Ad-hoc probes are a different matter and the flag is useful there: `--providers echo` renders the prompts back to you without touching a key or spending a token.

## Example results

`evals/results/` holds the current committed baseline/with-skill evidence for each skill.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to structure a new results doc.

## CI

Two workflows run in CI, and only one of them gates a merge:

- **`check.yml`** — the deterministic gate: formatting, spelling, markdown lint,
  terminology, model pins, and skill validation. It runs on every PR including forks,
  needs no secrets, and is the only workflow that blocks merge.
- **`eval.yml`** — the judge-graded eval: a weekly drift check against the default
  branch, plus `workflow_dispatch` (`ref`, `configs`, `baseline`) for a maintainer to
  validate a branch or PR by hand, pre- or post-merge.

**It never runs automatically on `pull_request`.** GitHub withholds secrets from a
fork's `pull_request`, so an automatic job there couldn't reach the generator or
judge anyway — hence the manual dispatch, which runs in this repo's own Actions
context with its secrets regardless of whose ref it checks out.

**Review before you dispatch.** Treat any change to `package.json` or the eval
harness (`evals/prompts/lib/`) as a reason to look closer — `--ignore-scripts` blocks
a malicious lifecycle script, not a modified `eval:graded` command.

**Three verdicts, and only two of them move a status.** `scripts/run-evals.js` runs one `npm run eval:graded` per config and records `pass`, `fail`, or `error` for each. `error` means the run reached no graded verdict — a provider or judge failure, a config the per-config time bound cut off, or one the run budget never reached — and `scripts/sync-skill-status.js` leaves those skills' `status:` fields exactly as they were, in either direction, so a rate-limited Sunday cannot demote a skill. A skill whose config produced no line at all is reported with a `::warning::` and makes the run partial. The two bounds are `EVAL_CONFIG_MINUTES` and `EVAL_BUDGET_MINUTES` on the "Run evals" step in `eval.yml`; the run's verdict artifact holds `verdicts.txt`, a `summary.json` with per-config counts, error signatures, and token usage, and one JSON sidecar per config, which is where the error text behind an ERROR row survives — the CSV's ERROR rows carry an empty output and an empty grader reason.

`npm run lint:model-pins` fails on any provider id that drifts from the [Setup](#setup)
pins (the generator in `providers.yaml`, the judge in the `eval:graded` script).
