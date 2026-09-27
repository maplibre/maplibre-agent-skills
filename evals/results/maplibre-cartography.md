# Eval Results: maplibre-cartography

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-cartography.yaml`.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-cartography-*`. Re-run 2026-08-28 on the Groq pin, replacing the 2026-07-03 Cerebras run (#64).

| #   | Test                                           | Type         | Baseline (no skill)                                                       | With skill                                                                         |
| --- | ---------------------------------------------- | ------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Point symbols camouflaged on aerial imagery    | Implicit     | **FAIL** — halo and background circle only, never a saturated accent fill | **PASS** — saturated accent fill (amber, terracotta, teal, magenta) plus dark halo |
| 2   | Lowering road opacity to calm roads on imagery | Anti-pattern | **FAIL** — endorses it "as a temporary fix"                               | **PASS** — "the wrong fix"; hierarchy carried in width and value                   |
| 3   | flyTo camera animation (out of scope)          | Negative     | PASS                                                                      | PASS                                                                               |

**Result: the launch bar is cleared. `status: verified` stands.** Two gaps demonstrated closed, none open; the negative holds in both directions.

The route-shield test moved to [`maplibre-sprites-icons`](maplibre-sprites-icons.md) with its content (#68). Some completions in this run were cut off after their graded content.
