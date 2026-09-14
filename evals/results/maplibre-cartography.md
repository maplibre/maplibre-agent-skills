# Eval Results: maplibre-cartography

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-cartography.yaml`.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-cartography-*`. Re-run 2026-08-28 on the Groq pin, replacing the 2026-07-03 Cerebras run (#64).

| #   | Test                                           | Type         | Baseline (no skill)                                                       | With skill                                                                         |
| --- | ---------------------------------------------- | ------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Point symbols camouflaged on aerial imagery    | Implicit     | **FAIL** — halo and background circle only, never a saturated accent fill | **PASS** — saturated accent fill (amber, terracotta, teal, magenta) plus dark halo |
| 2   | Lowering road opacity to calm roads on imagery | Anti-pattern | **FAIL** — endorses it "as a temporary fix"                               | **PASS** — "the wrong fix"; hierarchy carried in width and value                   |
| 3   | flyTo camera animation (out of scope)          | Negative     | PASS                                                                      | PASS                                                                               |

**Result: the launch bar is cleared. `status: verified` stands.** Two gaps demonstrated closed, none open; the negative holds in both directions.

## The route-shield test moved out on 2026-09-09

The explicit test "Route shields on the open OpenMapTiles stack" left this suite on 2026-09-09, moving verbatim to [`maplibre-sprites-icons`](maplibre-sprites-icons.md) along with the sprite and shield content it targeted (issue #68). Relocation only: the test, its assertions, and the claims it grades are unchanged, and it was not re-run for the move. Its baseline evidence here — the model knows `ref_length` and `us-interstate` but buries them in an invented `road_shield_*` sprite scheme, which the `not-icontains: road_shield` tripwire catches where the rubric alone would not — remains the record for that test's history.

The three tests left in this suite grade claims that did not move, so their 2026-08-28 results stand unchanged and `status: verified` stands. The suite now carries no explicit test; the topics cartography still owns are all reached implicitly or through the anti-pattern.

## Truncation

Groq stops this model at 3,072 completion tokens (`finish_reason: length`), at `max_tokens` 8192 and 4096 alike. Three of the eight completions in the 2026-08-28 run hit it: the baseline route-shield answer (after the tripwire had already fired), the baseline camouflaged-symbols answer (inside its closing checklist), and the with-skill camouflaged-symbols answer (inside a trailing JSON example). In each the graded substance was complete before the cut.
