# Eval Results: maplibre-native-gl-js-parity

Baseline evidence for the skill proposed in [#20](https://github.com/maplibre/maplibre-agent-skills/issues/20); the skill is not written yet. One row per eval test, with the skill withheld (`--var injectSkill=false`). See `evals/prompts/maplibre-native-gl-js-parity.yaml`.

Run: 2026-09-25 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded -- --var injectSkill=false`, three runs per test, one test per invocation · raw CSV [`latest/maplibre-native-gl-js-parity-baseline_2026-09-25.csv`](latest/maplibre-native-gl-js-parity-baseline_2026-09-25.csv).

| #   | Test                                           | Type         | Baseline, three runs                   | What the answers made up                                                                                                                                    |
| --- | ---------------------------------------------- | ------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `addProtocol` equivalent on Android            | Explicit     | **FAIL** ×3 on reading (judged 2 of 3) | an `HttpRequestHandler` registration, or Mapbox's legacy `com.mapbox.mapboxsdk.net` classes; never `ModuleProvider`'s `HttpRequest` or `CustomVectorSource` |
| 2   | Globe projection ignored on iOS                | Implicit     | **FAIL** ×3                            | code that turns the globe on in MapLibre iOS                                                                                                                |
| 3   | Porting `setTerrain` to Kotlin                 | Anti-pattern | **FAIL** ×3                            | a Kotlin `setTerrain` / `Terrain` API                                                                                                                       |
| 4   | `interpolate-hcl` layer never draws            | Implicit     | **FAIL** ×3                            | a log line MapLibre Native never emits, in all three; one calls `interpolate-hcl` Mapbox-only                                                               |
| 5   | Hypsometric tint from Terrarium DEM on Android | Explicit     | **FAIL** ×3                            | `raster-color` instead of `color-relief`                                                                                                                    |
| 6   | PMTiles archive on iOS                         | Explicit     | **FAIL** ×3                            | a `pmtiles-swift` package with a `PMTilesArchive` type                                                                                                      |
| 7   | Registering a protocol in the browser          | Negative     | PASS ×3                                | —                                                                                                                                                           |

**Result: every non-negative test fails in every run on reading (the judge caught 17 of 18); the negative passes all three.**
