# Eval Results: maplibre-terrain-rendering

Canonical results table for this skill. Baseline is the same prompt with the skill omitted
(`--var injectSkill=false`). See `evals/prompts/maplibre-terrain-rendering.yaml`.

**Not yet run at this pin.** Tests 1–3 are carried unchanged in substance from
`evals/prompts/maplibre-terrain-patterns.yaml`, where all three failed at baseline on 2026-08-28; their
baseline column below repeats that measurement and names the file it came from. The with-skill half of
that config could not run on Groq's on-demand tier (8,310–8,602-token requests against an 8,000 TPM
window). This `SKILL.md` is ≈10.4K characters, ≈2.6K tokens injected, which is what the split is for.
`status: provisional` until the pinned run lands.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Baseline
evidence for tests 1–3: `evals/results/latest/maplibre-terrain-patterns-baseline_2026-08-28.csv`.

| #   | Test                                              | Type         | Baseline (no skill)                                                                        | With skill |
| --- | ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------ | ---------- |
| 1   | Client-side hypsometric tint (`color-relief`)     | Explicit     | **FAIL** (2026-08-28) — a `raster` layer with invented `raster-color` / `raster-value`     | not run    |
| 2   | Runtime contour generation, off-the-shelf vs DIY  | Implicit     | **FAIL** (2026-08-28) — `geotiff.js` → `marchingsquares` / `d3-contour` as the main path   | not run    |
| 3   | Harsh hillshade, and the stacking anti-pattern    | Anti-pattern | **FAIL** (2026-08-28) — tunes six `hillshade-*` properties, never names `hillshade-method` | not run    |
| 4   | Nothing above the horizon once the camera pitches | Implicit     | not run                                                                                    | not run    |
| 5   | Adjacent pre-rendered shaded-relief raster tiles  | Negative     | not run                                                                                    | not run    |

## What changed in the carried tests

The prompts are unchanged. Two assertions were added from what the baseline answers actually said, per the
tripwire pattern already used in `evals/prompts/maplibre-fonts-glyphs.yaml` and
`evals/prompts/maplibre-cartography.yaml`:

- **Test 2** gains `not-icontains: marchingsquares` — the library the baseline answer built its DIY
  pipeline around — beside the existing `icontains: maplibre-contour`.
- **Test 3** gains `not-icontains: hillshade-ambient-occlusion-intensity`, a property the baseline answer
  put in a tuning table and MapLibre's style specification does not define. The skill does not mention it,
  so the tripwire cannot contradict the rubric beside it.

Test 3's rubric is also tightened to forbid endorsing a stack of hillshade layers **as an optional extra**,
not only as the primary answer. Run 3 of the old config failed on exactly that: the answer led with
`hillshade-method: "multidirectional"` and then offered stacking anyway, because the retired skill's own
text offered it. The replacement section does not.

## New tests

- **Test 4** grades a factual error the retired skill carried: it showed a `sky` **layer** with `sky-type`
  and `sky-atmosphere-sun`, which are Mapbox GL JS properties. MapLibre has no `sky` layer type
  (`maplibre-style-spec/layers/`); sky is a root-level `sky` object, or `map.setSky()`. Baseline is
  expected to reproduce the Mapbox syntax; if it does not, the test is cut.
- **Test 5** is the negative, deliberately adjacent: relief imagery that is already shaded, where an
  over-applying skill would reach for `raster-dem` and `hillshade`. Expected to pass at baseline.

## Retired from `maplibre-terrain-patterns`

The out-of-scope vector-tile-source negative (test 4 there) passed at baseline in both the Cerebras and
Groq runs and is not carried over; tests 5 here and 4 in `maplibre-dem-sources` sit closer to their
skills' topics and do the same job with discriminating power.
