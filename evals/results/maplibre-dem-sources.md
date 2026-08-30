# Eval Results: maplibre-dem-sources

Canonical results table for this skill. Baseline is the same prompt with the skill omitted
(`--var injectSkill=false`). See `evals/prompts/maplibre-dem-sources.yaml`.

**Not yet run.** This skill and `maplibre-terrain-rendering` split `maplibre-terrain-patterns`, whose
with-skill half could not run on Groq's on-demand tier (8,310–8,602-token requests against an 8,000 TPM
window, `evals/results/maplibre-terrain-patterns.md`). The split exists to bring each prompt back inside
that window: this `SKILL.md` is ≈11.4K characters, ≈2.8K tokens injected. `status: provisional` until the
pinned run lands.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`.

| #   | Test                                                   | Type         | Baseline (no skill) | With skill |
| --- | ------------------------------------------------------ | ------------ | ------------------- | ---------- |
| 1   | The pixel formula each `encoding` decodes with         | Explicit     | not run             | not run    |
| 2   | Terrain garbage because `encoding` was left at default | Implicit     | not run             | not run    |
| 3   | Pre-rendered hillshade JPEG wired as `raster-dem`      | Anti-pattern | not run             | not run    |
| 4   | Adjacent question about plain satellite imagery        | Negative     | not run             | not run    |

## What these tests are for

All four are new; none is carried from the terrain-patterns config, whose three failing tests all concern
what _draws_ elevation and moved to `maplibre-terrain-rendering`.

- **Test 1** asks for both decoding formulas verbatim. The `32768` tripwire is the Terrarium offset — a
  single unambiguous number that a correct answer cannot omit and a reconstructed-from-memory answer
  usually gets wrong.
- **Test 2** is the failure the retired skill called "the primary AI failure zone" and never tested: the
  source property defaults to `encoding: "mapbox"`, most open tiles are Terrarium, and the mismatch is
  silent. The prompt gives the symptom and the source JSON, never the word "encoding".
- **Test 3** separates a picture of relief from elevation data. `maplibre-source-wiring` (#69) raises the
  same trap from the source-identification side; this test grades the encoding argument — lossy format,
  no recoverable elevation, what the endpoint _is_ good for.
- **Test 4** is the negative: adjacent (raster tiles, a basemap layer, an imagery endpoint) and close
  enough that an over-applying skill would push `raster-dem` at it.

## Expected baseline behavior

Recorded before the run so the prediction can be scored honestly:

- Tests 1 and 2 are expected to **FAIL** — the 2026-08-28 baseline answers on adjacent terrain prompts
  invented properties freely (`raster-color`, `raster-value`, `hillshade-ambient-occlusion-intensity`),
  and the default-`mapbox` fact is the kind of spec detail those answers omitted.
- Test 3's outcome is genuinely unknown. If it passes at baseline it is cut, and the section it defends
  shrinks to a line.
- Test 4 is expected to **PASS** at baseline, as a negative test should.

## Retired from `maplibre-terrain-patterns`

The out-of-scope vector-tile-source negative test (test 4 there) passed at baseline in both the Cerebras
and Groq runs. Its role is filled here and in `maplibre-terrain-rendering` by negatives that sit closer to
the topic, so it is not carried over.
