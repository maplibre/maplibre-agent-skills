---
name: maplibre-running-evals
description: The baseline-then-with-skill order that makes an eval mean something, and operating Promptfoo without wasting an API budget on a run that never produced a result — the grader flags to never hand-roll, why two configs can't run at once, and how to tell a stale output file from a real one. Use before running any eval, not after one fails.
status: process
---

# Running Promptfoo Evals

Writing a good prompt and rubric is half the job. The other half is running Promptfoo without burning the budget against a rate limit, or trusting a result nobody checked. For what to test and how to write the prompt and rubric, see [evals/README.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/README.md); this is the operational layer underneath it.

**Use this before** running `npm run eval:graded`, deciding which config a new test belongs in, resuming a killed run, or reading a verdict that came back suspiciously clean.

## The order this plumbing serves

1. **Baseline first** (`--var injectSkill=false`), before any content is written. A test that passes at baseline has nothing for the skill to fix; one that fails is the evidence a section is warranted.
2. **Write content only for the confirmed failures.**
3. **With-skill second** — confirms it fixes what failed and did not regress what passed.
4. Only a test that fails at baseline and passes with-skill is a demonstrated gap. Passes both, fails both, or no with-skill run means no claim yet.

## A test belongs to the skill that owns the claim

Not the skill you had open when you thought of it. This sounds like filing hygiene and isn't: **test placement drives content placement.** A test in skill A's config fails at baseline, and the obvious next move is to write the fix into skill A, even when another skill already owns that subject. That is how one claim ends up in three drifting copies.

Ask which skill a reader would be sent to for this claim. If no skill owns it, that is a finding to report, not a reason to park it somewhere convenient. Read backwards it is an audit: a test whose claim is owned elsewhere means two skills' boundaries have blurred.

## Provider limits live in `providers.yaml`

Ceilings and how a provider counts against them are properties of the **currently pinned** models. `providers.yaml` documents the pin, the numbers, and the reasoning together. Never copy a limit into this skill — the two drift the moment the pin changes, and a stale number here looks authoritative.

The durable lesson: **`--delay` paces requests, it does not create budget.** A request larger than the ceiling fails at any delay; an exhausted window stays exhausted at any delay. Establish which failure you have before slowing down, because re-pacing fixes neither.

## Never hand-roll grader flags

`package.json` pins grader, delay, and concurrency in one place, chosen against a documented failure mode. Copying a value from an old example — including this repo's own stale docs — reproduces that failure.

```bash
npm run eval:graded -- --config evals/prompts/<skill>.yaml \
  --output evals/results/local/<skill>-with-skill.csv

npm run eval:graded -- --config evals/prompts/<skill>.yaml --var injectSkill=false \
  --output evals/results/local/<skill>-baseline.csv
```

If a pinned value is wrong, change `package.json`. A hand-typed flag is a fork of the config that looks identical until it drifts.

## Never run two graded evals at once

Two invocations against the same `GOOGLE_API_KEY`, even in separate terminals, double the request rate against one quota. The failure is `RateLimitExhaustedError` and it kills _both_ runs. Chain them with `&& sleep 45 &&` instead. This holds across sessions: if a teammate might be running one now, yours is a bet against the same quota.

**A rate-limit failure that survives correct pacing and no concurrency is capacity exhaustion.** Some window is spent and no delay recovers it. Stop, don't loop, and either wait or fall back to the Groq judge (`npm run eval --`). Only a real result proves the window reopened; a retry-after hint describes the next single request's headroom, not recovery.

## Resuming a partial run: filter, canary first

Build a temporary config with only the test blocks missing from the target CSV (same header, filtered `tests:`), run it, then merge rows into the canonical CSV by matching `Description` so a re-run never double-counts. Delete the scratch config and its output afterward.

Before any filtered batch, spend one call on a **canary** — a single-test config. A rate-limit error there costs one call instead of the batch.

**Canary each run type, not once per session.** Baseline sends a bare prompt; with-skill sends the same prompt plus an entire `SKILL.md`, up to twenty times the input. A green baseline canary says nothing about the with-skill path: one passed, a 7-test with-skill run was launched on it, and that run hung for 78 minutes without completing a call. The with-skill canary takes 15 seconds.

## A hung run looks identical to a slow one

Promptfoo buffers its table until the end, so healthy and dead runs both show an empty output file. Never infer progress from elapsed time.

```bash
pgrep -f "promptfoo"                      # the node process, not the shell wrapper
lsof -nP -p <node-pid> -i                 # ESTABLISHED = waiting on the provider
ls -l ~/.promptfoo/promptfoo.db           # mtime stops advancing on a stall
```

**The open connection is the signal; CPU is not.** A run waiting on the provider sits at 0% CPU in state `S`, exactly like a dead one. **Match the right process:** `npm run` wraps node in a shell, and a `pgrep` on the config filename usually returns the wrapper, which holds no sockets — reporting zero connections for a healthy run.

Kill only when the connection is gone _and_ the mtime is frozen; the CSV is written only on success, so nothing is recoverable. Killing leaves any previous file at that `--output` path looking plausible, so give the re-run a fresh path.

## Check when an output file was written

A killed run can leave an _older_ file at `--output`, and an agent reading it reports last run's numbers as this run's. Check mtime against launch time, and check the row count matches the config you just ran — a config that gained tests still shows the old count in a stale file. If either looks wrong, say so rather than narrating a result from it.

## Verify keys, never fabricate a result

```bash
echo "GROQ_API_KEY set: ${GROQ_API_KEY:+yes}"
echo "GOOGLE_API_KEY set: ${GOOGLE_API_KEY:+yes}"
```

Presence only, never the value. If either is absent, stop and report. Do not extrapolate a result to fill the gap.

## Never pass `--providers` on a run you'll cite

It replaces the pinned generator, and unless the value matches a configured `id`/`label`, Promptfoo builds a bare provider with none of `providers.yaml`'s config — no `temperature`, no `max_tokens`, no label. It unpins the model on a run you are about to cite. `--providers echo` is fine for probing prompt wiring, where no model is called.

## Read behind every verdict

A verdict is a claim about the model. Four things routinely make it a claim about the harness instead, all cheap to check against the raw CSV.

**Truncation.** Providers cap completions well below `max_tokens`, mid-word. A truncated **PASS** is usually safe — the grader found what it needed. A truncated **FAIL** is not, since the answer may have been cut before the part the rubric wanted. Check the tail of every FAIL. Measure the ceiling rather than assuming it follows `max_tokens`.

**The asymmetry inverts for `must NOT` clauses.** A prohibition is satisfied for free by a completion cut before it reached the forbidden thing, so there the truncated PASS is the unsafe one. Ask whether the answer stopped or was stopped.

**An empty row is never a FAIL.** The call never reached the model. A rate-limit rejection is recoverable by pacing or a smaller batch; a queue timeout — no completion, no provider error — is size-independent and gives you nothing to read. Record either as no data. Retrying more than once spends a daily quota for no evidence.

**A judge that erred.** Read the grader reason for `Error:` first. When the judge is down, read the raw output and make the call with a human rather than looping. Never edit a grader's reason in a recorded CSV, and say in the results file where a human decided.

One run is a sample: the generator is nondeterministic even at `temperature: 0`. Never conclude "the skill regressed" from one run.

## A section with no baseline test is a gap, not a failure.

The unambiguous fix for untested prose is a new baseline test. Only a section covered by a test that _passes at baseline_ has earned a cut. However, a section with no passing baseline test is an absence of evidence either way. The decision of whether to delete it, design new tests, or leave it requires discretion and careful consideration of factors outside the evals.

## A rubric goes stale too

When the thing a test grades moves and the rubric does not, the failure is invisible: the model's outdated assumption and the rubric's outdated expectation agree. Two things can move, and only one is the library.

**The library moved.** A rubric required "the style is missing a `glyphs` property" as the cause of a map with no text. True until GL JS 5.11.0, after which an absent `glyphs` falls back to a local system font. The test passed at baseline for months; reworded to current behavior, the same model on the same day failed it.

**The skill moved.** One commit can cause this. A skill's guidance was tightened to remove an escape hatch that read as blanket permission, and left the rubric quoting the removed phrase verbatim — so the rubric licensed exactly what the skill had just withdrawn. It was grading the skill's previous draft.

An outdated rubric grades _leniently_, because what it still permits is a superset of the current position. That is why it comes back green and nobody goes looking.

- When a skill's claim is corrected, **open its rubric in the same commit.** The moment you delete a sentence is the moment to grep the rubric for it. A phrase removed _because_ it was too permissive is the likeliest one still granting permission.
- Rewording a rubric invalidates that test's baseline. Re-run rather than carrying the row forward; it was measured against a different question.
- A version boundary in a rubric (`>= 5.11.0`, "current versions") is a claim with an expiry date. Re-read it first when the library ships a major.

## "Must do X rather than Y" does not forbid Y

A clause phrased as a preference is satisfied by an answer that does both. A real one: _"Must push back on merging application data into the basemap tileset rather than simply supplying the requested pipeline."_ The model pushed back, then supplied the entire pipeline underneath — and the judge was right to pass it. "Simply" carried an exclusion the clause never stated.

The twin in skill prose: _"Do not open with the pipeline"_ forbids an ordering, not the artifact. Both fixes are the same — say what must be **absent**, in its own sentence, naming the artifact:

> Must NOT include build commands or a tool invocation sequence for producing the combined tileset, anywhere in the answer.

A rubric that only describes the good answer cannot fail a good answer with a bad one stapled to it.

## A run packet's stop conditions must come from the rubric

That prohibition lived in skill prose and never reached the rubric. A run packet then took its FAIL triggers from the skill. The delegated agent read the completion correctly, found the triggers, and reported a FAIL; the grader had returned a PASS. Both were right — the answer did contain the pipeline, and the rubric said nothing about pipelines.

The cost earns this its own section. The packet said "if the with-skill row fails, stop entirely," so the baseline never ran, the quota bought half a result, and a passing test was reported as failing.

- **A stop condition must quote a rubric clause.** If you cannot point at the clause, it is your reading of the skill — an advisory note in the packet, never a verdict or a halt.
- **Diff the skill against the rubric when drafting a packet.** Anything the skill forbids that the rubric does not is a gap to log; the run proceeds under the rubric as written. Declining to add a clause you never had is not weakening a test.

## A PASS and a FAIL are not equally strong evidence

The generator is a **test instrument, not the audience** — the models loading these skills are whichever ones the reader's agent runs.

- A baseline **FAIL** is a positive demonstration. One sample proves the failure is possible, which justifies writing content.
- A baseline **PASS** is the absence of a failure, on one sample, from one model, at one moment. Deleting on it bets every consumer model also knows the claim.

Deletion needs a higher bar than addition. Default for a passing section is **demote, not delete**: compress to a naming plus a pointer so cross-references still land, and drop the re-teaching. Reserve deletion for a whole config passing, not one test, and record the evidence with the cut.

### Screening cuts against a small local model

Run the baseline prompt against a deliberately weaker local model (Ollama, 7–8B class) alongside the pinned generator:

| Pinned generator | Small local model | Read                                                                      |
| ---------------- | ----------------- | ------------------------------------------------------------------------- |
| PASS             | PASS              | Safe cut — a small model knowing it unprompted makes it common knowledge. |
| PASS             | FAIL              | **Demote, don't delete.** Some consumer models still need it.             |
| FAIL             | FAIL              | Load-bearing. Write the content.                                          |

Two limits. It is a **screening probe, not a recorded result** — same status as `--providers echo`; recording it, or letting it stand in for the pinned generator, is a pin change needing a maintainer decision (Golden Rule 2). And use it only in the cut direction: a small model failing is weak evidence anyone needs the content, and treating those as gaps would inflate every skill.

Where a skill has a known downstream consumer running a specific small model, that model is not a proxy — it is the audience, and a failure there is a real gap even if the pinned generator passes.

## Do not

- **Don't hand-roll `--grader`/`--delay`/`-j`.** A wrong pinned value is a `package.json` change, not a flag typed around it.
- **Don't run two `eval:graded` invocations concurrently** against the same grader key.
- **Don't trust an `--output` file without checking its mtime and test count.**
- **Don't pass `--providers` on a run you'll record or cite.**
- **Don't delete untested content and call it evidence-based.** Write the missing test.
- **Don't delete on a single baseline PASS.** Demote to a naming and a pointer.
- **Don't write a test into the config you happen to have open.**
- **Don't edit a skill's guidance without grepping its rubric for the wording you removed.**
- **Don't state a prohibition as a preference.** Write the `must NOT` as its own clause, naming the artifact.
- **Don't put a stop condition in a run packet that no rubric clause backs.**
- **Don't record a local screening model's output as an eval result.**
- **Don't retry a failing grader in a tight loop.**

## Related Skills

- **maplibre-skill-authoring** — capturing a session's findings as a skill draft; this skill makes its eval step run cleanly.

## References

- [evals/README.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/evals/README.md) — prompts, rubrics, baseline-probe methodology, provider setup
- `package.json`'s `eval:graded` script — the single source of truth for grader, delay, and concurrency
