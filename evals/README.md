# Evals

This directory contains evaluation infrastructure for MapLibre agent skills.

```text
evals/
├── prompts/     # Promptfoo eval configs — one per skill
│   └── lib/     # Shared prompt injection logic (skill-prompt.mjs)
└── results/     # Eval results committed by CI — do not edit manually
```

## How evals work

Each skill has a Promptfoo eval config in `evals/prompts/`. When run, Promptfoo
injects the skill's `SKILL.md` as the system prompt, runs the test prompts against
the model, and checks responses against assertions.

### Skill injection

`lib/skill-prompt.mjs` is a shared Promptfoo prompt function used by every eval config.
It reads the skill file specified by `vars.skillFile` and constructs the messages array —
system message containing the skill content, followed by the user prompt. Each skill
YAML sets `vars.skillFile` to the path of its `SKILL.md`.

Passing `--var injectSkill=false` on the CLI omits the system message, leaving the model
to answer from training data alone. This is used for the baseline check.

Two assertion types are used:

- **`icontains`** — deterministic substring check; verifies a required term appears in the response
- **`llm-rubric`** — qualitative check evaluated by a judge model; the `value` field
  describes what a correct answer must include — keep items specific and checkable,
  not "gives good advice"

**Important:** Never use `--providers` on the CLI — it bypasses `lib/skill-prompt.mjs`,
so the skill will not be injected. The provider must be configured in the YAML.

## Setup

Evals use [Promptfoo](https://promptfoo.dev/). Current recommended models:

| Role                             | Provider                                      | Model ID                                  |
| -------------------------------- | --------------------------------------------- | ----------------------------------------- |
| Generator + CI judge             | [Cerebras](https://inference.cerebras.ai/)    | `cerebras:qwen-3-235b-a22b-instruct-2507` |
| Local judge (optional, stronger) | [Google Gemini](https://aistudio.google.com/) | `google:gemini-2.5-flash-lite`            |

Skill eval YAMLs reference these IDs directly. When models change, update this table.

**Cerebras** (required):

1. Sign up at [inference.cerebras.ai](https://inference.cerebras.ai/) (free, requires account).
2. Create an API key and add it to your shell:

```bash
export CEREBRAS_API_KEY=your_key_here
echo 'export CEREBRAS_API_KEY=your_key_here' >> ~/.zshrc
```

**Google Gemini** (recommended for local runs — better judge quality):

1. Get a free API key at [aistudio.google.com](https://aistudio.google.com/).
2. Add it to your shell:

```bash
export GOOGLE_API_KEY=your_key_here
echo 'export GOOGLE_API_KEY=your_key_here' >> ~/.zshrc
```

## Running evals

Run the eval for the skill you are working on. Use `--grader google:gemini-2.5-flash-lite`
for a stronger judge when you have a `GOOGLE_API_KEY`:

```bash
npm run eval -- \
  --config evals/prompts/<skill-name>.yaml \
  --grader google:gemini-2.5-flash-lite \
  --no-cache -j 1
```

All assertions must pass before pushing.

To view results interactively after any run:

```bash
npx promptfoo view
```

Local results are ephemeral — terminal output and `promptfoo view` are sufficient.

## Proving tests fail without the skill

Before writing skill content, verify your eval prompts have discriminating power —
they should fail without the skill and pass with it. Run the baseline check with
`--var injectSkill=false` to omit the skill from the system prompt:

```bash
npm run eval -- \
  --config evals/prompts/<skill-name>.yaml \
  --var injectSkill=false \
  --grader google:gemini-2.5-flash-lite \
  --no-cache -j 1
```

If any test passes without the skill, the prompt is not testing skill-specific knowledge —
revise it before proceeding.

## Writing eval prompts

When contributing a new skill, copy `evals/prompts/TEMPLATE.yaml` and rename it to
match your skill directory. Each eval config contains exactly four tests — one of each type:

| Type         | Description                                         |
| ------------ | --------------------------------------------------- |
| Explicit     | Names the topic directly                            |
| Implicit     | Describes the scenario without naming the solution  |
| Anti-pattern | A wrong approach the skill should correct           |
| Negative     | An unrelated question the skill should not dominate |

Write the `value` field of each `llm-rubric` assertion as a checklist of what a correct
answer must include. Make items specific enough for a judge model to evaluate — "mentions
`addProtocol` by name" rather than "explains the API."

Write prompts based on real developer confusion — GitHub issues, Stack Overflow questions,
or Slack threads where AI assistants are known to fail.

## CI

Two workflows run evals automatically:

- **`eval-pr.yml`** — Triggered on PRs that modify `skills/**` or `evals/prompts/**`.
  Runs only the eval configs for the modified skills. All assertions must pass to merge.
- **`eval-scheduled.yml`** — Runs every Monday against all skills on `main`. Results are
  committed to `evals/results/`. Opens a GitHub issue tagged `eval-regression` if any
  skill fails.

Both workflows use Cerebras as provider and judge. Requires `CEREBRAS_API_KEY`
in repository secrets.
