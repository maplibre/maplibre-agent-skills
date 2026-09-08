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
7. **Write every run to `--output evals/results/local/<skill>-<baseline|with-skill>.csv`** (gitignored), and promote only the runs you cite: copy each to `evals/results/latest/<skill>-<baseline|with-skill>_<YYYY-MM-DD>.csv` — the naming already there, e.g. `maplibre-pmtiles-patterns-baseline_2026-08-30.csv` — and cite it from `evals/results/<skill>.md`. That pair is how [CONTRIBUTING.md step 3](https://github.com/maplibre/maplibre-agent-skills/blob/main/CONTRIBUTING.md#write-a-new-skill), "commit the raw CSVs to `evals/results/`", is met in this repo. For a run you do not cite, terminal output and `npx promptfoo view` are enough; the weekly CI run commits its own dated CSVs.

## Before you run

- **Check both keys, presence only, never the value:** `echo "GROQ set: ${GROQ_API_KEY:+yes}"` and `echo "GOOGLE set: ${GOOGLE_API_KEY:+yes}"`. If either is missing, stop and report; do not extrapolate a result.
- **Use `eval:graded` for every run you record or cite.** A bare `npm run eval` has no `--grader`, so Promptfoo picks the judge from whatever credentials it finds — `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`/`GEMINI_API_KEY`, Azure, Mistral, xAI, Vertex ADC, `~/.codex/auth.json`, or `GITHUB_TOKEN`. Groq is never a candidate, and with `GOOGLE_API_KEY` set the pick is Promptfoo's own Gemini default, not the pinned judge. With no `GOOGLE_API_KEY`, `eval:graded` errors on every `llm-rubric` instead.
- **Never pass `--providers` on a run you record or cite.** It replaces the pinned generator with a bare one — no `temperature`, no `max_tokens`, no label — and reintroduces mid-answer truncation. `--providers echo` is fine for probing prompt wiring; no model is called.
- **Never hand-roll `--grader`, `--delay`, or `-j`.** `package.json`'s `eval:graded` pins all three. A wrong value is a `package.json` change, not a flag typed around it. A results doc that records a different value — `evals/results/maplibre-v6-migration.md` records `--delay 20000` — documents that run; it is not a value to copy.
- **When the window or the day is smaller than the run, run fewer tests per invocation and wait it out.** `--filter-pattern '<regex against the test description>'` runs only the matching tests (quote it; `npm run` passes it through a shell), and `--filter-failing <eval id or .json output path>` re-runs only the tests that failed or errored — eval ids come from `npx promptfoo list evals`; a CSV `--output` does not qualify.
- **Never run two graded evals at once**, including across terminals or teammates — quota is per key and a single run drains two, the generator's on Groq (per-minute and per-day) and the judge's on Gemini. On Groq's Free Plan the daily token cap is the scarce one, so the collision may surface on the generator as `429`s and queue timeouts before the judge ever rate-limits. Chain them with `&& sleep 45 &&`.
- **Budget the run against the daily cap before launching, not only the per-minute one.** Tokens ≈ bytes / 4, so `wc -c skills/<skill>/SKILL.md` gives the with-skill overhead per test: each with-skill test costs about that plus `max_tokens` (`4096` in `evals/prompts/lib/providers.yaml`) on the generator, plus a separate judge call on Gemini. A 22 KB skill is ≈ 5.5K tokens, so six with-skill tests are ≈ 58K tokens before judging — more than a quarter of the 200K tokens-per-day Free Plan cap Groq lists for this model. Weigh it against `x-ratelimit-remaining-tokens` from the direct call under "Is it hung?" for the minute, and against what the day has already spent.
- `--delay` paces requests; it does not create budget. A rate-limit failure that survives correct pacing and no concurrency is exhausted capacity — stop, note the reset time from the direct call under "Is it hung?", do not loop.

## Is it hung?

Promptfoo prints the table and writes `--output` only after the run finishes, and its progress bar needs a TTY on stderr, so under an agent a healthy run and a dead one both show nothing. Never infer progress from elapsed time.

```bash
pgrep -fl promptfoo                       # take the node pid, not the sh wrapper — the wrapper holds no sockets
lsof -nP -p <node-pid> -i                 # ESTABLISHED = waiting on the provider
ls -l ~/.promptfoo/promptfoo.db*          # each finished result is written to the db; the -wal file's mtime stops advancing on a stall
```

An open connection is the signal; CPU is not — a healthy run waiting on the provider sits at 0%. Kill only when the connection is gone **and** the mtime is frozen. A killed run writes no `--output` file — its finished rows are only in the local db (export them, under "Reading results") — so give the re-run a fresh `--output` path.

Promptfoo reports a spent minute and a spent day the same way — `Request groq:openai/gpt-oss-120b[...] timed out after 300000ms in queue`, or `RateLimitExhaustedError` on the request that was retrying — so the message does not say which. (A request too large for the window is different: Groq rejects it outright with `413` rather than `429`, and Promptfoo records that as an error row carrying the body, not as a timeout.) One direct call to the provider does:

```bash
curl -s -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" -H "Content-Type: application/json" \
  --data '{"model":"openai/gpt-oss-120b","messages":[{"role":"user","content":"hi"}],"max_tokens":1}' \
  -D - | grep -iE 'ratelimit|retry-after|"error"'
```

The headers carry the per-minute window (`x-ratelimit-limit-tokens: 8000`, `x-ratelimit-remaining-tokens`, `x-ratelimit-reset-tokens`) and the daily request count (`x-ratelimit-limit-requests`, `x-ratelimit-remaining-requests`, `x-ratelimit-reset-requests`); no header carries the daily token cap — it appears in the `429` body's `error.message`, which names the limit that tripped (`tokens per minute (TPM)` or `tokens per day (TPD)`), the limit value, and the wait (`Please try again in …`).

## Reading results

- **Check the output file's mtime and row count before reading it.** A killed run leaves the previous file in place. If either looks wrong, say so instead of narrating numbers from it.
- **Check the tail of every FAIL for truncation.** A truncated PASS is usually safe; a truncated FAIL may have been cut before the part the rubric wanted.
- **The asymmetry inverts for `must NOT` clauses** — a prohibition is satisfied for free by an answer that stopped early, so there the truncated PASS is the unsafe one.
- **An empty row is not a FAIL.** The call never reached the model. Record it as no data; retrying more than once spends quota for no evidence.
- **Read the grader reason for `Error:` first.** When the judge is down, read the raw output and decide with a human; never edit a grader's reason in a recorded CSV.
- **No `--output` file? Export the last eval:** `npx promptfoo export eval latest -o evals/results/local/last.json` writes the most recent eval out of the local db and calls no provider. Read `results.results[].gradingResult.componentResults[].reason` beside `results.results[].response.output`, matched on `results.results[].testCase.description` — the reason alone is never enough to judge a verdict by; the raw output is what to read.
- **One run is a sample.** The generator is nondeterministic even at `temperature: 0` — never conclude "the skill regressed" from one run.
- **A test belongs to the skill that owns the claim,** not the config you had open. Test placement drives content placement, which is how one claim ends up in three drifting copies.
- **Deletion needs a higher bar than addition.** A baseline FAIL demonstrates a gap; a baseline PASS is only the absence of one on one sample. On a single baseline PASS, demote — a naming plus a pointer — rather than delete.
- **A leading prompt grades the harness, not the model.** When the question names the property, API, or value the rubric wants — asking whether `url: 'pmtiles://…'` should replace the `tiles` array instead of describing the tiles that go blank past a zoom level — a baseline PASS is the model repeating the question back. Reword the prompt to the symptom a user would report and re-run; the rubric was not the problem.
- **A rubric goes stale.** When you change a skill's wording, grep its rubric for the phrase you removed, in the same commit; an outdated rubric grades leniently and comes back green. Rewording a rubric invalidates that test's baseline — re-run it.
- **State a prohibition as `Must NOT ...`, naming the artifact,** in its own clause. "Must do X rather than Y" is satisfied by an answer that does both.
- **A stop condition must quote a rubric clause.** If you cannot point at the clause, it is your reading of the skill — an advisory note, never a verdict or a halt.

## Related Skills

- [**maplibre-skill-authoring**](../maplibre-skill-authoring/SKILL.md) — capturing a session's findings as a skill draft; this skill runs its eval step.

## References

- [evals/README.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/README.md) — prompts, rubrics, baseline-probe methodology, provider setup
- `package.json`'s `eval:graded` script — the single source of truth for grader, delay, and concurrency
- [Groq rate limits](https://console.groq.com/docs/rate-limits) — the tier limits and the headers

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
