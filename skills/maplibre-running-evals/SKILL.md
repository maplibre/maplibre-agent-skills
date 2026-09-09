---
name: maplibre-running-evals
description: The step-by-step procedure for running this repo's Promptfoo evals against a generator and a judge — budgeting a run against the provider's limits, proving a gap at baseline before writing content, diagnosing a stalled or rate-limited run, and deciding when a change needs a retest. Use before running an eval, not after one has already failed.
status: process
---

# Running Promptfoo Evals

Every eval here runs two roles over provider APIs: a **generator**, the model under test, and a **judge**, the model that grades each `llm-rubric` assertion. [evals/README.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/README.md) covers what to test and how to write prompts and rubrics; this is the procedure for running them. Work the phases in order — do not start at phase 5 because content already exists.

## 1. Set up and budget the run

Budget before anything else. These providers are used on free tiers, and a run you cannot finish teaches nothing.

- **Confirm a generator key and a judge key are set — presence only, never the value:** `echo "generator: ${GROQ_API_KEY:+set}"` and `echo "judge: ${GOOGLE_API_KEY:+set}"`. If either is missing, stop and report; do not extrapolate a result from a run you did not make.
- **Both roles are pinned:** the generator in [`evals/prompts/lib/providers.yaml`](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/prompts/lib/providers.yaml), the judge in `package.json`'s `eval:graded` script. Use the pinned pair by default. The one hard requirement is that they are different models — never grade a generator with itself — and any result you report names both.
- **Send every recorded run through `npm run eval:graded`,** the only place `--grader`, `--delay`, and `-j` are set. Do not hand-type them, and do not copy a value out of an older results doc: that value documents that run, not this one. Do not pass `--providers` either: it replaces the pinned generator with a bare one, so the run is no longer pinned and its results are mislabeled — [evals/README.md, "Writing eval prompts"](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/README.md#writing-eval-prompts) has the detail. `--providers echo` is the exception: it renders the prompts back and calls no model.
- **Learn the provider's limits before launching:** read its rate-limit documentation for the pinned model's tier, then make one minimal request to the endpoint with response headers shown. On an OpenAI-compatible endpoint the `x-ratelimit-*` headers carry the per-minute token window (limit, remaining, reset) and the per-day request count; a daily token cap has no header of its own, so it surfaces only when a `429` arrives — `retry-after` gives the wait, and the body names which limit tripped. Header names and what they count are provider-specific and change, so confirm them against the provider's own page.

```bash
# Example against the current generator's OpenAI-compatible endpoint; the URL and model id come from providers.yaml.
curl -s -X POST https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer $GROQ_API_KEY" -H "Content-Type: application/json" \
  --data '{"model":"openai/gpt-oss-120b","messages":[{"role":"user","content":"hi"}],"max_tokens":1}' \
  -D - | grep -iE 'ratelimit|retry-after|"error"'
```

- **Do the arithmetic before launching.** Tokens ≈ bytes / 4, so `wc -c skills/<skill>/SKILL.md` gives the injection cost per test; a with-skill run costs roughly tests × (that + the generator's configured `max_tokens`), plus one judge call per rubric, against whatever the day has left. A baseline run drops the injection. If the total does not fit the remaining budget, do not launch it whole.
- **Run sequentially, one config per invocation.** `-j 1` is pinned, and never run two graded evals at once — across terminals or across teammates. Limits are per account, not per process, so a `429` on either role kills both runs; chain them instead, leaving a full per-minute window between: `<run one> && sleep 60 && <run two>`. Pass a single `--config`, because Promptfoo merges `defaultTest` across combined configs and one skill's `SKILL.md` would be injected into another skill's tests.
- **`--delay` paces requests; it does not create budget.** A rate-limit failure that survives correct pacing with no concurrency is exhausted capacity — stop, take the reset time from the direct call above, and do not loop.
- **When the remaining window or day is smaller than the run, run fewer tests per invocation — never a larger delay.** `--filter-pattern '<regex against the test description>'` runs only the matching tests (quote it; `npm run` passes it through a shell), and it is also how you probe one test of a run type before committing the whole config. `--filter-failing <eval id or .json output path>` re-runs only what failed or errored.

## 2. Write the tests before the content

- Copy [`evals/prompts/TEMPLATE.yaml`](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/prompts/TEMPLATE.yaml) to `evals/prompts/<skill>.yaml` and write four tests — explicit, implicit, anti-pattern, negative — before the skill has any content. [evals/README.md, "Writing eval prompts"](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/README.md#writing-eval-prompts) is the how; this skill is the running procedure.
- State a prohibition as `Must NOT …`, naming the artifact, in its own clause: "must do X rather than Y" is satisfied by an answer that does both.
- Describe only the symptom in the prompt. A prompt that names the API, property, or value the rubric wants grades the harness, not the model.

## 3. Run the baseline, with the skill withheld

`npm run eval:graded -- --config evals/prompts/<skill>.yaml --var injectSkill=false`

- **An explicit, implicit, or anti-pattern test that passes at baseline has no discriminating power.** Redesign it. Never keep it as evidence, and never delete a test to make a run green. A negative test may pass at baseline — that is what it is for.
- **Read every baseline answer, not the verdict column.** A hallucination the judge waved through is a failure of the test design, not evidence of a gap.
- **One run is one sample.** The generator is nondeterministic even at `temperature: 0`, so a claim rests on a FAIL you have read, never on a verdict alone.

## 4. Write content only for what failed at baseline

- Content the model already gets right is a cost, not a benefit — [CONTRIBUTING.md, "Cutting content the model already gets right"](https://github.com/maplibre/maplibre-agent-skills/blob/main/CONTRIBUTING.md#cutting-content-the-model-already-gets-right).
- A claim belongs in the skill that owns it, not the config you had open. Test placement drives content placement, and the alternative is one claim living in three drifting copies.

## 5. Run with the skill injected

`npm run eval:graded -- --config evals/prompts/<skill>.yaml` — injection is the default. **A demonstrated gap is a FAIL at baseline and a PASS with the skill.** Passing both, failing both, or no with-skill run at all means there is no claim yet.

## 6. Diagnose before retrying

Promptfoo prints its table and writes `--output` only after the run finishes, and the progress bar needs a TTY on stderr, so under an agent a healthy run and a dead one look identical. Never infer progress from elapsed time — establish which one it is.

```bash
pgrep -fl promptfoo                       # take the node pid, not the sh wrapper — the wrapper holds no sockets
lsof -nP -p <node-pid> -i                 # ESTABLISHED = still waiting on a provider
ls -l ~/.promptfoo/promptfoo.db*          # finished rows land in the local db; the -wal file's mtime stops advancing on a stall
```

- **An open connection is the signal; CPU is not** — a run waiting on a provider sits at 0%. Kill only when the connection is gone **and** the mtime is frozen.
- **Ask which limit tripped**, with the direct call from phase 1. A spent minute and a spent day are reported identically: a queue timeout, or a rate-limit error on the request that was retrying. A request larger than the per-minute window is different — the provider rejects it outright and Promptfoo records an error row carrying the body.
- **`0 passed / 0 failed` alongside "There were some errors" is no data, not a result,** and an empty row is not a FAIL — the call never reached the model. Record either as no data; retrying more than once spends budget for no evidence.
- **A killed run writes no `--output` file** and leaves any previous one in place, so check mtime and row count before reading. Its finished rows are in the local db: `npx promptfoo export eval latest -o <path>.json` writes them out and calls no provider. Read `results.results[].response.output` beside `results.results[].gradingResult.componentResults[].reason`, matched on `testCase.description` — the reason alone is never enough to judge a verdict by, and a reason that is an error message, or empty, is a judge failure, not a verdict. Never edit a grader's reason in a recorded CSV.
- **Check the tail of every FAIL for truncation, and the tail of every `Must NOT` PASS for an early stop.** A cut-off answer can lose the part the rubric wanted, and it satisfies a prohibition for free.

## 7. When a retest is needed, and when it is not

Needed:

- A claim is added, corrected, or removed — run the tests covering it with the skill, and baseline any **new** claim before writing it.
- A rubric or prompt is reworded — that test's baseline is now invalid, so re-run that test with `--filter-pattern`, not the whole config. The reverse holds too: when you change a skill's wording, grep its rubric for the phrase you removed, in the same commit, because an outdated rubric grades leniently and comes back green.
- The pinned generator or judge changes — re-run every config.

The weekly CI drift check (`eval.yml`) re-runs the whole collection against the default branch on its own cadence; that run is not something a contributor repeats by hand.

Not needed:

- Wording that keeps the meaning, formatting, link fixes, typos.
- Moving a claim between skills — the corpus is unchanged; the test moves with the claim to the owning skill's config.
- Removing content the generator did not need in order to pass — the baseline PASS is the evidence. Record it in the results doc as the reason for the cut.
- A `status: process` skill — eval-exempt, reviewed by reading it against the files it describes.

## 8. Record the result concisely

- **Write every run to `--output evals/results/local/<skill>-<baseline|with-skill>.csv`** (gitignored). Promote only a run you cite: copy it to `evals/results/latest/<skill>-<baseline|with-skill>_<YYYY-MM-DD>.csv`.
- **`evals/results/<skill>.md` is one table** — a row per test carrying its type, the baseline outcome, the with-skill outcome, and the failure mode compressed into the cell. Head it with a `Run:` line naming the date, the generator model, and the judge model; close with a bold pass/fail tally. Add nothing else unless a verdict needed human reading — then say which one, and where the raw output is.
- **`status:` follows the run:** `verified` only when the pinned run passes, `provisional` otherwise.

## Related Skills

- [**maplibre-skill-authoring**](../maplibre-skill-authoring/SKILL.md) — capturing a session's findings as a skill draft; this skill runs its eval step.

## References

- [evals/README.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/README.md) — prompts, rubrics, baseline-probe methodology, provider setup
- `package.json`'s `eval:graded` script — the single source of truth for grader, delay, and concurrency
- [The current generator's rate-limit page](https://console.groq.com/docs/rate-limits) — the tier limits and the response headers

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
