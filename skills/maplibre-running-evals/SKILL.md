---
name: maplibre-running-evals
description: How to run this repo's Promptfoo evals without wasting a run — baseline before content, the pinned flags never to hand-roll, and how to tell a hung run or a stale output file from a real result. Use before running any eval, not after one has already failed.
status: process
---

# Running Promptfoo Evals

[evals/README.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/README.md) covers what to test and how to write prompts and rubrics. This is the procedure for running them.

## Procedure

1. **Baseline first, before writing any content.** `npm run eval:graded -- --config evals/prompts/<skill>.yaml --var injectSkill=false`
2. **Write content only for tests that failed at baseline** — a passing test has nothing for the skill to fix. See [CONTRIBUTING.md, "Cutting content the model already gets right"](https://github.com/maplibre/maplibre-agent-skills/blob/main/CONTRIBUTING.md#cutting-content-the-model-already-gets-right).
3. **With-skill second.** `npm run eval:graded -- --config evals/prompts/<skill>.yaml` (injection is the default).
4. **Only a test that fails at baseline and passes with the skill is a demonstrated gap.** Passing both, failing both, or no with-skill run means no claim yet.
5. **One config per invocation.** Promptfoo merges `defaultTest` across combined configs, so one skill's `SKILL.md` lands in another's tests.
6. **Canary before any batch, once per run type.** Run a single-test copy of the config first, for baseline and again for with-skill: a with-skill call sends an entire `SKILL.md` on top of the prompt, so a green baseline canary says nothing about it.
7. Local results are ephemeral — terminal output and `npx promptfoo view` are enough. If you write a file, use `--output evals/results/local/<skill>-<baseline|with-skill>.csv` (gitignored); CI commits its own dated CSVs to `evals/results/`.

## Before you run

- **Check both keys, presence only, never the value:** `echo "GROQ set: ${GROQ_API_KEY:+yes}"` and `echo "GOOGLE set: ${GOOGLE_API_KEY:+yes}"`. If either is missing, stop and report; do not extrapolate a result.
- **Use `eval:graded` for every run you record or cite.** A bare `npm run eval` has no `--grader`, so Promptfoo picks the judge from whatever credentials it finds — `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`, Azure, Mistral, xAI, Vertex ADC, `~/.codex/auth.json`, or `GITHUB_TOKEN`. Groq is never a candidate, and with `GOOGLE_API_KEY` set the pick is Promptfoo's own Gemini default, not the pinned judge. With no `GOOGLE_API_KEY`, `eval:graded` errors on every `llm-rubric` instead.
- **Never pass `--providers` on a run you record or cite.** It replaces the pinned generator with a bare one — no `temperature`, no `max_tokens`, no label — and reintroduces mid-answer truncation. `--providers echo` is fine for probing prompt wiring; no model is called.
- **Never hand-roll `--grader`, `--delay`, or `-j`.** `package.json`'s `eval:graded` pins all three. A wrong value is a `package.json` change, not a flag typed around it.
- **Never run two graded evals at once**, including across terminals or teammates — they share one `GOOGLE_API_KEY` quota, and a rate limit kills both. Chain them with `&& sleep 45 &&`.
- `--delay` paces requests; it does not create budget. A rate-limit failure that survives correct pacing and no concurrency is exhausted capacity — stop and wait, do not loop.

## Is it hung?

Promptfoo prints the table and writes `--output` only after the run finishes, and its progress bar needs a TTY on stderr, so under an agent a healthy run and a dead one both show nothing. Never infer progress from elapsed time.

```bash
pgrep -fl promptfoo                       # take the node pid, not the sh wrapper — the wrapper holds no sockets
lsof -nP -p <node-pid> -i                 # ESTABLISHED = waiting on the provider
ls -l ~/.promptfoo/promptfoo.db*          # each finished result is written to the db; the -wal file's mtime stops advancing on a stall
```

An open connection is the signal; CPU is not — a healthy run waiting on the provider sits at 0%. Kill only when the connection is gone **and** the mtime is frozen. A killed run writes no output file, so nothing is recoverable: give the re-run a fresh `--output` path.

## Reading results

- **Check the output file's mtime and row count before reading it.** A killed run leaves the previous file in place. If either looks wrong, say so instead of narrating numbers from it.
- **Check the tail of every FAIL for truncation.** A truncated PASS is usually safe; a truncated FAIL may have been cut before the part the rubric wanted.
- **The asymmetry inverts for `must NOT` clauses** — a prohibition is satisfied for free by an answer that stopped early, so there the truncated PASS is the unsafe one.
- **An empty row is not a FAIL.** The call never reached the model. Record it as no data; retrying more than once spends quota for no evidence.
- **Read the grader reason for `Error:` first.** When the judge is down, read the raw output and decide with a human; never edit a grader's reason in a recorded CSV.
- **One run is a sample.** The generator is nondeterministic even at `temperature: 0` — never conclude "the skill regressed" from one run.
- **A test belongs to the skill that owns the claim,** not the config you had open. Test placement drives content placement, which is how one claim ends up in three drifting copies.
- **Deletion needs a higher bar than addition.** A baseline FAIL demonstrates a gap; a baseline PASS is only the absence of one on one sample. On a single baseline PASS, demote — a naming plus a pointer — rather than delete.
- **A rubric goes stale.** When you change a skill's wording, grep its rubric for the phrase you removed, in the same commit; an outdated rubric grades leniently and comes back green. Rewording a rubric invalidates that test's baseline — re-run it.
- **State a prohibition as `Must NOT ...`, naming the artifact,** in its own clause. "Must do X rather than Y" is satisfied by an answer that does both.
- **A stop condition must quote a rubric clause.** If you cannot point at the clause, it is your reading of the skill — an advisory note, never a verdict or a halt.

## Related Skills

- [**maplibre-skill-authoring**](../maplibre-skill-authoring/SKILL.md) — capturing a session's findings as a skill draft; this skill runs its eval step.

## References

- [evals/README.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/README.md) — prompts, rubrics, baseline-probe methodology, provider setup
- `package.json`'s `eval:graded` script — the single source of truth for grader, delay, and concurrency

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
