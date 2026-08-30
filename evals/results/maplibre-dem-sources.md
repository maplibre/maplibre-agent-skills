# Eval Results: maplibre-dem-sources

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-dem-sources.yaml`.

Run: 2026-08-30 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-dem-sources-*_2026-08-30`.

| #   | Test                                                   | Type         | Baseline (no skill)                                                                                          | With skill |
| --- | ------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | The pixel formula each `encoding` decodes with         | Explicit     | **PASS** — gives both formulas with exact constants, names `encoding` and its `"mapbox"` default             | PASS       |
| 2   | Terrain garbage because `encoding` was left at default | Implicit     | **PASS** — diagnoses the Terrarium/`mapbox` mismatch unprompted and gives `encoding: "terrarium"` as the fix | PASS       |
| 3   | Pre-rendered hillshade JPEG wired as `raster-dem`      | Anti-pattern | **PASS** — "No — a hillshade tile set is _not_ a DEM"; routes it to a `raster` layer                         | PASS       |
| 4   | Adjacent question about plain satellite imagery        | Negative     | PASS                                                                                                         | PASS       |

**Result: no discriminating power. `status: provisional` stands.** Every test passes at baseline and passes with the skill. The skill demonstrates no closed gap, and by the repo's own bar — a skill whose guidance duplicates what the model already produces will not pass baseline discrimination — it is not ready to be marked `verified`.

## The baseline is not a lenient grade

All four completions run to a natural end (6.7K–10.8K characters, none in the ≈11,900-character truncation zone), and the substance is correct rather than merely rubric-shaped:

- **Test 1** returns both formulas exactly — `((R * 256 * 256 + G * 256 + B) * 0.1) - 10000` for `mapbox` and `(R * 256 + G + B / 256) - 32768` for `terrarium` — in a table, and names `mapbox` as the default. This was the test the `32768` tripwire was meant to catch; the tripwire never fires because the constant is simply there. (The `icontains: 32768` assertion had already been dropped from this config for an unrelated reason; it would not have changed the verdict.)
- **Test 2** was written as the skill's centre of gravity: the failure the retired `maplibre-terrain-patterns` called "the primary AI failure zone" and never tested. Given only the symptom and the source JSON, the baseline reaches the encoding mismatch in its first sentence of reasoning and prescribes `encoding: "terrarium"`.
- **Test 3** was flagged in advance as genuinely uncertain. It resolves against the skill: the baseline separates a picture of relief from elevation data without help.

## What this means for the skill

Three sections have now been measured and none of them is defended by a failing baseline:

| Section                                                               | Test | Baseline |
| --------------------------------------------------------------------- | ---- | -------- |
| "A `raster-dem` source is a number format, not a subject matter"      | 3    | PASS     |
| "`encoding` defaults to `"mapbox"`, and the wrong one fails silently" | 2    | PASS     |
| The two decoding formulas                                             | 1    | PASS     |

The repo's rule is to cut a test that passes at baseline along with the section it defends. Applied here that removes the skill's three substantive sections, which is a question about whether `maplibre-dem-sources` should exist as a separate skill at all rather than an edit to make inside it. That decision is left to review; nothing has been cut in this branch. The remaining untested material — where open elevation tiles come from, and generating and hosting your own — is reference content that no current test grades.

`maplibre-terrain-rendering`, the other half of the same split, cleared the bar on all four of its substantive tests (`evals/results/maplibre-terrain-rendering.md`). The seam held; only one side of it earned its keep.

## What these tests are for

All four are new; none is carried from the terrain-patterns config, whose three failing tests all concern what _draws_ elevation and moved to `maplibre-terrain-rendering`.

- **Test 1** asks for both decoding formulas verbatim.
- **Test 2** gives the symptom and the source JSON, never the word "encoding".
- **Test 3** separates a picture of relief from elevation data. `maplibre-source-wiring` (#69) raises the same trap from the source-identification side; this test grades the encoding argument — lossy format, no recoverable elevation, what the endpoint _is_ good for.
- **Test 4** is the negative: adjacent (raster tiles, a basemap layer, an imagery endpoint) and close enough that an over-applying skill would push `raster-dem` at it. It holds in both directions.

## Retired from `maplibre-terrain-patterns`

The out-of-scope vector-tile-source negative test (test 4 there) passed at baseline in both the Cerebras and Groq runs. Its role is filled here and in `maplibre-terrain-rendering` by negatives that sit closer to the topic, so it is not carried over.
