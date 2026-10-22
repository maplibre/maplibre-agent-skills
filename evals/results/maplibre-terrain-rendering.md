# Eval Results: maplibre-terrain-rendering

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-terrain-rendering.yaml`.

Run: 2026-10-22 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded` with the skill, all five tests once at one request a minute, then test 2 three more times with the skill and three times without. Raw CSVs: [with skill](latest/maplibre-terrain-rendering-with-skill_2026-10-22.csv), [test 2 with skill](latest/maplibre-terrain-rendering-with-skill-test2_2026-10-22.csv), [test 2 baseline](latest/maplibre-terrain-rendering-baseline-test2_2026-10-22.csv). Test 2 lost its marching-squares tripwires, which line 18 of the skill matched. Test 3 reached no verdict (the judge returned no JSON), so its row keeps the 2026-08-30 verdict, as does the rest of the baseline column ([CSV](latest/maplibre-terrain-rendering-baseline_2026-08-30.csv)).

| #   | Test                                              | Type         | Baseline (no skill)                                                                                                                                                                          | With skill                                                                                  |
| --- | ------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Client-side hypsometric tint (`color-relief`)     | Explicit     | **FAIL** — a `raster` layer with `raster-color` / `raster-value`; judge: "the rubric explicitly states that `raster-color`, `raster-value` … should not be presented as MapLibre properties" | **PASS** — `color-relief` layer, `color-relief-color` with `interpolate` on `["elevation"]` |
| 2   | Runtime contour generation, off-the-shelf vs DIY  | Implicit     | **FAIL**, 3 of 3 — judge: "does not mention `maplibre-contour` as an existing library. Instead, it guides the user through building the pipeline themselves"                                 | **PASS**, 4 of 4 — `maplibre-contour`, `DemSource` + `contourProtocolUrl` setup\*           |
| 3   | Harsh hillshade, and the stacking anti-pattern    | Anti-pattern | **FAIL** — judge: "does not mention the `hillshade-method` paint property … invents a 'hillshade shading parameters' which does not exist"                                                   | **PASS** — `hillshade-method` on the single layer, no stack offered                         |
| 4   | Nothing above the horizon once the camera pitches | Implicit     | **FAIL** — judge: "incorrectly states that the sky is configured using a layer with `type: 'sky'` and provides properties like `sky-type`, `sky-atmosphere-sun`"                             | **PASS**† — root-level `sky` object / `map.setSky()` with real keys                         |
| 5   | Adjacent pre-rendered shaded-relief raster tiles  | Negative     | PASS                                                                                                                                                                                         | PASS                                                                                        |

\* All four put a `{z}/{x}/{y}` template in the `raster-dem` source's `url`, where TileJSON belongs; the skill shows both correctly, and the rubric does not grade the DEM source.

† The 2026-10-22 answer sets `'sky-type': 'atmosphere'`, which the rubric forbids, and the judge passed it. Earlier answers name `sky-type` only to repeat the skill's warning.

**Result: the launch bar is cleared.** Four gaps demonstrated closed, none open; the negative holds in both directions. `status: provisional` since the 2026-10-22 drift run failed test 2 on its tripwire; the next scheduled run that passes this config sets it back to `verified`.

## Test 4 was a prediction, and it scored

Test 4 was written as a prediction rather than a measurement: the retired skill carried a `sky` **layer** with `sky-type` and `sky-atmosphere-sun` (Mapbox GL JS properties — MapLibre has no `sky` layer type; sky is a root-level `sky` object or `map.setSky()`), and the expectation was that the baseline would reproduce that same Mapbox syntax from training data. It did, verbatim, down to `sky-atmosphere-sun-intensity`. The test stands and the section it defends stays.

## Truncation

The four failing baseline completions run 11,082–11,694 characters, inside the ≈11,900-character zone where Groq stops this model mid-sentence, and tests 2, 3, and 4 do end mid-sentence. None of the four failures is a truncation artifact: test 2 never names `maplibre-contour` anywhere in 11.4K characters and builds a DIY pipeline instead, and tests 1, 3, and 4 fail on what they affirmatively assert (`raster-color`, an invented hillshade parameter set, `type: "sky"`), not on what the cut removed.

## Test 5 passes both ways, and both passes are loose

The negative's rubric grades the shape of the answer — a `raster` source and layer inserted beneath the data and label layers, no `raster-dem`, `hillshade`, `color-relief`, or `setTerrain` — without requiring the MapLibre API. The baseline answered in Leaflet (`L.tileLayer`) and passed. The with-skill answer gets the shape right in MapLibre and says outright that the elevation layer types do not apply, then appends two optional sections anyway: a `hillshade` layer from a DEM "if you also have the DEM tiles", and `setTerrain` plus `setSky` "if you later enable" terrain. The rubric forbids saying the task _needs_ those, so the judge passed it. That is mild over-application the test did not catch; tightening the rubric to forbid offering them as extras (the same tightening test 3 received) would need a fresh with-skill run and is left as is here.

One ungraded slip in the with-skill explicit answer: a code comment lists `raster-dem` encodings as `'terrarium' | 'mapbox' | 'raw'`. The style specification's third value is `custom`; the skill does not mention encodings, so this is a model fact, not a skill fact.

## What changed in the carried tests

The prompts are unchanged. Test 3 gains `not-icontains: hillshade-ambient-occlusion-intensity`, a property the baseline answer put in a tuning table and MapLibre's style specification does not define. The skill does not mention it, so the tripwire cannot contradict the rubric beside it.

Test 3's rubric is also tightened to forbid endorsing a stack of hillshade layers **as an optional extra**, not only as the primary answer. Run 3 of the old config failed on exactly that: the answer led with `hillshade-method: "multidirectional"` and then offered stacking anyway, because the retired skill's own text offered it. The replacement section does not, and the 2026-08-30 with-skill answer does not either.

## Retired from `maplibre-terrain-patterns`

The out-of-scope vector-tile-source negative (test 4 there) passed at baseline in both the Cerebras and Groq runs and is not carried over; test 5 here sits closer to the skill's topic and does the same job with discriminating power.
