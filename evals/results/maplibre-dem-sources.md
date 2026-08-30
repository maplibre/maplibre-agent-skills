# Eval Probe: DEM-source content (not shipped)

This is a record of a probe, not the results table of a shipped skill. `maplibre-dem-sources` was drafted as the data half of the `maplibre-terrain-patterns` split — the `raster-dem` source, `encoding` and its decoding formulas, and where elevation tiles come from — and evaluated before it landed. Every test passed at baseline, so there was no demonstrated gap to close and the skill was withdrawn from the pull request. Nothing under `skills/` corresponds to this file; the CSVs beside it are the evidence for that decision.

Run: 2026-08-30 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-dem-sources-*_2026-08-30`. Baseline is the same prompt with the draft skill omitted (`--var injectSkill=false`).

| #   | Test                                                   | Type         | Baseline (no skill)                                                                                          | With skill |
| --- | ------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | The pixel formula each `encoding` decodes with         | Explicit     | **PASS** — gives both formulas with exact constants, names `encoding` and its `"mapbox"` default             | PASS       |
| 2   | Terrain garbage because `encoding` was left at default | Implicit     | **PASS** — diagnoses the Terrarium/`mapbox` mismatch unprompted and gives `encoding: "terrarium"` as the fix | PASS       |
| 3   | Pre-rendered hillshade JPEG wired as `raster-dem`      | Anti-pattern | **PASS** — "No — a hillshade tile set is _not_ a DEM"; routes it to a `raster` layer                         | PASS       |
| 4   | Adjacent question about plain satellite imagery        | Negative     | PASS                                                                                                         | PASS       |

**Result: no discriminating power — the content was not shipped.** All four tests pass at baseline and pass with the skill. By the repo's own bar, content the model already gets right is cut along with the section that defends it; here that is every substantive section, so the draft was withdrawn rather than trimmed.

## The baseline is not a lenient grade

All four completions run to a natural end (6.7K–10.8K characters, none in the ≈11,900-character truncation zone), and the substance is correct rather than merely rubric-shaped:

- **Test 1** returns both formulas exactly — `((R * 256 * 256 + G * 256 + B) * 0.1) - 10000` for `mapbox` and `(R * 256 + G + B / 256) - 32768` for `terrarium` — in a table, and names `mapbox` as the default. This was the test the `32768` tripwire was meant to catch; the tripwire never fires because the constant is simply there. (The `icontains: 32768` assertion had already been dropped from the config for an unrelated reason; it would not have changed the verdict.)
- **Test 2** was written as the draft's centre of gravity: the failure the retired `maplibre-terrain-patterns` called "the primary AI failure zone" and never tested. Given only the symptom and the source JSON, the baseline reaches the encoding mismatch in its first sentence of reasoning and prescribes `encoding: "terrarium"`.
- **Test 3** was flagged in advance as genuinely uncertain. It resolves against the draft: the baseline separates a picture of relief from elevation data without help.

## The sections each test defended

| Section                                                               | Test | Baseline |
| --------------------------------------------------------------------- | ---- | -------- |
| "A `raster-dem` source is a number format, not a subject matter"      | 3    | PASS     |
| "`encoding` defaults to `"mapbox"`, and the wrong one fails silently" | 2    | PASS     |
| The two decoding formulas                                             | 1    | PASS     |

The remaining material — where open elevation tiles come from, and generating and hosting your own — is reference content no test graded, and not enough on its own to carry a skill.

`maplibre-terrain-rendering`, the other half of the same split, cleared the bar on all four of its substantive tests ([`maplibre-terrain-rendering.md`](maplibre-terrain-rendering.md)). The seam held; only one side of it earned its keep.

## Where the DEM facts live instead

The style specification is the primary source and is not restated here: the `raster-dem` source type and its `encoding`, `tileSize`, and `redFactor`/`greenFactor`/`blueFactor`/`baseShift` fields — <https://maplibre.org/maplibre-style-spec/sources/#raster-dem>. `maplibre-terrain-rendering` points there for the data side, and `maplibre-source-wiring` covers identifying a source that is not what it claims to be.

## What these tests were for

All four were new; none was carried from the terrain-patterns config, whose three failing tests all concern what _draws_ elevation and moved to `maplibre-terrain-rendering`.

- **Test 1** asks for both decoding formulas verbatim.
- **Test 2** gives the symptom and the source JSON, never the word "encoding".
- **Test 3** separates a picture of relief from elevation data. `maplibre-source-wiring` (#69) raises the same trap from the source-identification side; this test graded the encoding argument — lossy format, no recoverable elevation, what the endpoint _is_ good for.
- **Test 4** is the negative: adjacent (raster tiles, a basemap layer, an imagery endpoint) and close enough that an over-applying skill would push `raster-dem` at it. It holds in both directions.

## Retired from `maplibre-terrain-patterns`

The out-of-scope vector-tile-source negative test (test 4 there) passed at baseline in both the Cerebras and Groq runs. Its role is filled by `maplibre-terrain-rendering`'s negative, which sits closer to the topic, so it is not carried over.
