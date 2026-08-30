# Eval Results: maplibre-terrain-rendering

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-terrain-rendering.yaml`.

Run: 2026-08-30 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-terrain-rendering-*_2026-08-30`. Tests 1–3 are carried unchanged in substance from the retired `maplibre-terrain-patterns` config, where all three also failed at baseline on 2026-08-28; the baseline column below is the fresh 2026-08-30 measurement, not that one.

| #   | Test                                              | Type         | Baseline (no skill)                                                                                                                                                                          | With skill                                                                                  |
| --- | ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Client-side hypsometric tint (`color-relief`)     | Explicit     | **FAIL** — a `raster` layer with `raster-color` / `raster-value`; judge: "the rubric explicitly states that `raster-color`, `raster-value` … should not be presented as MapLibre properties" | **PASS** — `color-relief` layer, `color-relief-color` with `interpolate` on `["elevation"]` |
| 2   | Runtime contour generation, off-the-shelf vs DIY  | Implicit     | **FAIL** — judge: "does not mention 'maplibre-contour' and instead focuses on a DIY approach using libraries like geotiff.js and d3-contour"                                                 | **PASS** — `maplibre-contour`, `DemSource` + `contourProtocolUrl` setup                     |
| 3   | Harsh hillshade, and the stacking anti-pattern    | Anti-pattern | **FAIL** — judge: "does not mention the `hillshade-method` paint property … invents a 'hillshade shading parameters' which does not exist"                                                   | **PASS** — `hillshade-method` on the single layer, no stack offered                         |
| 4   | Nothing above the horizon once the camera pitches | Implicit     | **FAIL** — judge: "incorrectly states that the sky is configured using a layer with `type: 'sky'` and provides properties like `sky-type`, `sky-atmosphere-sun`"                             | **PASS** — root-level `sky` object / `map.setSky()` with real keys                          |
| 5   | Adjacent pre-rendered shaded-relief raster tiles  | Negative     | PASS                                                                                                                                                                                         | PASS                                                                                        |

**Result: the launch bar is cleared. `status: verified`.** Four gaps demonstrated closed, none open; the negative holds in both directions.

## Test 4 was a prediction, and it scored

Test 4 was written as a prediction rather than a measurement: the retired skill carried a `sky` **layer** with `sky-type` and `sky-atmosphere-sun` (Mapbox GL JS properties — MapLibre has no `sky` layer type; sky is a root-level `sky` object or `map.setSky()`), and the expectation was that the baseline would reproduce that same Mapbox syntax from training data. It did, verbatim, down to `sky-atmosphere-sun-intensity`. The test stands and the section it defends stays.

## Truncation

The four failing baseline completions run 11,082–11,694 characters, inside the ≈11,900-character zone where Groq stops this model mid-sentence, and tests 2, 3, and 4 do end mid-sentence. None of the four failures is a truncation artifact: test 2 never names `maplibre-contour` anywhere in 11.4K characters and builds a DIY pipeline instead, and tests 1, 3, and 4 fail on what they affirmatively assert (`raster-color`, an invented hillshade parameter set, `type: "sky"`), not on what the cut removed.

## What changed in the carried tests

The prompts are unchanged. Two assertions were added from what the baseline answers actually said, per the tripwire pattern already used in `evals/prompts/maplibre-fonts-glyphs.yaml` and `evals/prompts/maplibre-cartography.yaml`:

- **Test 2** gains `not-icontains: marchingsquares` — the library the baseline answer built its DIY pipeline around — beside the existing `icontains: maplibre-contour`.
- **Test 3** gains `not-icontains: hillshade-ambient-occlusion-intensity`, a property the baseline answer put in a tuning table and MapLibre's style specification does not define. The skill does not mention it, so the tripwire cannot contradict the rubric beside it.

Test 3's rubric is also tightened to forbid endorsing a stack of hillshade layers **as an optional extra**, not only as the primary answer. Run 3 of the old config failed on exactly that: the answer led with `hillshade-method: "multidirectional"` and then offered stacking anyway, because the retired skill's own text offered it. The replacement section does not, and the 2026-08-30 with-skill answer does not either.

## Retired from `maplibre-terrain-patterns`

The out-of-scope vector-tile-source negative (test 4 there) passed at baseline in both the Cerebras and Groq runs and is not carried over; test 5 here sits closer to the skill's topic and does the same job with discriminating power.
