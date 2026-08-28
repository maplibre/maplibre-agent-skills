# Eval Results: maplibre-cartography

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-cartography.yaml`.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-cartography-*`. Re-run 2026-08-28 on the Groq pin, replacing the 2026-07-03 Cerebras run (#64).

| #   | Test                                           | Type         | Baseline (no skill)                                                                                         | With skill                                                                         |
| --- | ---------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Route shields on the open OpenMapTiles stack   | Explicit     | **FAIL** — knows `ref_length` and `us-interstate`, buries them in an invented `road_shield_*` sprite scheme | **PASS** — `us-interstate_2` / `{network}_{ref_length}`                            |
| 2   | Point symbols camouflaged on aerial imagery    | Implicit     | **FAIL** — halo and background circle only, never a saturated accent fill                                   | **PASS** — saturated accent fill (amber, terracotta, teal, magenta) plus dark halo |
| 3   | Lowering road opacity to calm roads on imagery | Anti-pattern | **FAIL** — endorses it "as a temporary fix"                                                                 | **PASS** — "the wrong fix"; hierarchy carried in width and value                   |
| 4   | flyTo camera animation (out of scope)          | Negative     | PASS                                                                                                        | PASS                                                                               |

**Result: the launch bar is cleared. `status: verified` stands.** Three gaps demonstrated closed, none open; the negative holds in both directions. Same shape as the Cerebras-era table.

## Test 1: what the tripwire caught

The baseline is not ignorant of the naming. It says `ref_length` thirteen times and `us-interstate` once, and the rubric passed it. What fails it is `not-icontains: road_shield`: every sprite it proposes carries an invented `road_shield_` prefix (`road_shield_us_interstate_2` and forty-odd variants). The with-skill answer drops the prefix. A rubric alone would have scored the baseline as broadly right.

## Truncation

Groq stops this model at 3,072 completion tokens (`finish_reason: length`), at `max_tokens` 8192 and 4096 alike. Three of eight completions here hit it: baseline test 1 (after the tripwire had already fired), baseline test 2 (inside its closing checklist), and with-skill test 2 (inside a trailing JSON example). In each the graded substance was complete before the cut.
