# Eval Results: maplibre-mapbox-migration

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-mapbox-migration.yaml`.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-mapbox-migration-*`. Re-run 2026-08-28 on the Groq pin, replacing the Cerebras-era full-transcript doc [`example-mapbox-migration.md`](example-mapbox-migration.md) (#64).

| #   | Test                                                 | Type         | Baseline (no skill)                                                                         | With skill                                                      |
| --- | ---------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | CLI tool to validate exported style JSON             | Explicit     | **FAIL** — invents `@maplibre/style-spec` and a `style-spec` CLI; never `gl-style-validate` | **PASS** — `@maplibre/maplibre-style-spec`, `gl-style-validate` |
| 2   | Tile source with no API key during migration         | Implicit     | **FAIL** — demo style, Carto Positron, OSM raster; never OpenFreeMap                        | **PASS** — OpenFreeMap                                          |
| 3   | Mapbox v2 features (`setFog`) broken after migration | Anti-pattern | PASS — failed green, see below                                                              | **PASS** — with a defect, see below                             |
| 4   | Which Mapbox plugins still work in MapLibre          | Implicit     | **FAIL** — an "Awesome MapLibre" repo in passing, not as the list                           | **PASS** — awesome-maplibre                                     |
| 5   | Geocoder for an existing Mapbox GL JS v2 app         | Negative     | PASS                                                                                        | **FAIL** — over-applies, see below                              |

**Result: three gaps demonstrated closed (1, 2, 4); test 3 is not evidence either way; the negative over-applies.** The launch bar is not cleanly cleared on this pin. `status: verified` was set on the Cerebras run and is left for a maintainer to keep or drop.

## Test 3: failed green in both directions

The baseline passes, and should not have. It invents a "MapLibre GL JS v2 (v2-compatible branch)" that "reintroduces" `map.setFog()` with "the same API as Mapbox GL JS v2", and never states the v1.13 fork. The judge accepted that as fact ("accurately notes that MapLibre GL JS v2.x has reintroduced features like fog"), and the `icontains: v1.13` tripwire matched an unrelated "sky layer (available in v1.13+)". This is the anti-pattern the test exists to catch, scored as success.

The with-skill answer states the December 2020 v1.13 fork correctly, then does the same thing in miniature: its comparison table says fog was "added back in MapLibre v5" and it ships `map.setFog({…})` for `maplibre-gl@^5`. MapLibre GL JS has `map.setSky()` and no `setFog` (`src/ui/map.ts`), and the skill never mentions fog or sky.

Two follow-ups, both for reviewer sign-off rather than this PR:

- The rubric needs a positive clause the hallucination cannot satisfy: must not claim MapLibre provides `setFog` or a v2-compatible branch, paired with must name `setSky` / the `sky` style property as the equivalent.
- The Mapbox `setFog` → MapLibre `sky` / `setSky()` mapping is a candidate skill addition. Probe at baseline first; on this evidence it fails there.

The Cerebras-era record scored this test 0.00 at baseline and 1.00 with the skill.

## Test 5: the negative over-applies

The answer addresses the Mapbox GL JS v2 question (Mapbox-provided geocoder → open-source controls such as `maplibre-gl-geocoder` used with `mapboxgl` → DIY), but migration surfaces as asides ("or are already planning to move to MapLibre", "cut costs or move to an open-source stack"), and the chain-of-thought the judge reads says "if you want open-source, you can switch to MapLibre GL JS". Scored 0.00 against a rubric that forbids bringing up migration. Cerebras-era: 1.00. Left as-is rather than loosened.

## Truncation

Groq stops this model at 3,072 completion tokens (`finish_reason: length`), at `max_tokens` 8192 and 4096 alike. Eight of ten completions here hit it. Every FAIL is a content miss present in the delivered text: test 1 names its packages up front, test 2 enumerates its sources in full, and test 4's only mention of the list is mid-answer.
