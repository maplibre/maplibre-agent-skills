# Eval Results: maplibre-mapbox-migration

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-mapbox-migration.yaml`.

Run: 2026-08-30 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-mapbox-migration-*_2026-08-30`. Test 3's rubric and test 5's rubric were revised in #79, and the skill gained the Mapbox-v2-API mapping test 3 asks for; the 2026-08-28 CSVs are kept alongside. The full-transcript Cerebras-era doc is [`example-mapbox-migration.md`](example-mapbox-migration.md).

| #   | Test                                                 | Type         | Baseline (no skill)                                                                                                             | With skill                                                                                                 |
| --- | ---------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | CLI tool to validate exported style JSON             | Explicit     | **FAIL** — never `gl-style-validate`                                                                                            | **PASS** — `@maplibre/maplibre-style-spec`, `gl-style-validate`                                            |
| 2   | Tile source with no API key during migration         | Implicit     | **FAIL** — demo style, OSM raster, Stadia, OpenMapTiles; never OpenFreeMap                                                      | **PASS** — OpenFreeMap                                                                                     |
| 3   | Mapbox v2 features (`setFog`) broken after migration | Anti-pattern | **FAIL** — "MapLibre GL JS v2.0+ supports `map.setFog()`", v2 camera helpers "mostly work"; `setSky` named as a Mapbox-only API | **PASS** — no `setFog` in any version; `setSky` / the `sky` block; free camera → `jumpTo`/`easeTo`/`flyTo` |
| 4   | Which Mapbox plugins still work in MapLibre          | Implicit     | **FAIL** — the GL JS wiki Plugins page, never awesome-maplibre                                                                  | **PASS** — awesome-maplibre                                                                                |
| 5   | Geocoder for an existing Mapbox GL JS v2 app         | Negative     | PASS                                                                                                                            | PASS — stays on Mapbox GL JS v2                                                                            |

**Result: the launch bar is cleared. `status: verified` is set.** Four gaps demonstrated closed, none open; the negative holds in both directions.

What carried each baseline FAIL: tests 2, 3 and 4 failed their rubric (test 3's `icontains: setSky` passed, on an answer that lists `setSky` as a Mapbox-only API). Test 1 failed only its `icontains: gl-style-validate`; the judge passed a rubric that requires `@maplibre/maplibre-style-spec` and `gl-style-validate` by name on an answer that has neither.

## Test 3: the invented API the old rubric let through

On 2026-08-28 this test passed at baseline _and_ with the skill on answers that invented a MapLibre fog API — a "v2-compatible branch" of MapLibre that "reintroduces" `map.setFog()`, and `map.setFreeCameraOptions()` alongside it. Neither exists. Checked against primary sources:

- [`src/ui/map.ts`](https://github.com/maplibre/maplibre-gl-js/blob/main/src/ui/map.ts) declares `setSky(sky: SkySpecification, …)` and `getSky()`; a GitHub code search for `setFog` and for `setFreeCameraOptions` across `maplibre/maplibre-gl-js` returns zero hits, and neither appears on the [Map API reference](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/).
- The style spec has no root-level `fog`. Atmosphere is the root-level [`sky`](https://maplibre.org/maplibre-style-spec/sky/) property, whose keys are `sky-color`, `horizon-color`, `fog-color`, `fog-ground-blend`, `horizon-fog-blend`, `sky-horizon-blend` and `atmosphere-blend` (`src/reference/v8.json` in maplibre-style-spec).

The rubric now requires the `sky` mapping and `setSky` by name (`icontains: setSky`) and forbids the invented claims item by item. That was enough on its own: the baseline fails the rubric, quoted by the judge as "incorrectly states that MapLibre GL JS v2.0 and later versions support the `map.setFog()` method".

A `not-icontains: setFreeCameraOptions` tripwire was tried and dropped: a correct answer names the Mapbox free-camera methods in order to say MapLibre never had them, so it failed a with-skill run the rubric passed. There is no clean tripwire term here — the invented answer and the correct answer name the same Mapbox APIs — so the test carries one positive `icontains` and the rubric.

Because the gap was open at baseline **and** with the skill, the skill gained one section — step 9, a two-row table mapping `setFog` → `setSky` / the `sky` block and the free camera → `calculateCameraOptionsFromCameraLngLatAltRotation` + `jumpTo`/`easeTo`/`flyTo`, with the `setSky` example adapted from the style spec's own `sky` example (`atmosphere-blend` flattened to `1.0`, as in the `Map.setSky` JSDoc) — and one checklist line. That is the only content change.

The with-skill pass is a pass on the rubric's terms, not a clean answer. Outside what the rubric checks it puts a `"type": "sky"` key inside the `sky` block, calls the sky "just another layer" editable with `setPaintProperty('sky', …)`, and recommends a `maplibre-gl-camera` plugin — none of which exist. It also maps the free camera to `jumpTo`/`easeTo`/`flyTo` on `center`/`zoom`/`pitch`/`bearing` alone, which is what the skill said at run time. The free-camera row was corrected after this run: MapLibre has no `FreeCameraOptions`, but `CameraOptions` carries `elevation` (v3.0.0) and `roll` (v5.0.0), and `calculateCameraOptionsFromCameraLngLatAltRotation` (v5.0.0, `src/ui/camera.ts`) converts a camera lng/lat/altitude/bearing/pitch/roll into `CameraOptions` for those three methods. The rubric does not check the free-camera mapping beyond "not presented as available", so the recorded run is unaffected by the correction; a re-run of this config is the honest confirmation.

## Test 5: what the old rubric was actually scoring

The 2026-08-28 rubric ("does NOT bring up library migration") failed a with-skill answer that stayed on Mapbox GL JS v2 throughout and merely noted, in passing, that a token-free geocoder control also works with MapLibre. The rubric now asks for the positive — at least one concrete geocoder option that works with the app as it stands — and forbids only the recommendation to replace the library. Same answer shape now passes; an answer that told the reader to migrate would still fail.

## Run-to-run variance worth knowing

Test 4 failed once in three with-skill runs on 2026-08-30 (an answer that ran long on namespace debugging and never reached awesome-maplibre) and passed in the other two. The recorded run is the last one, after the tripwire removal; the CSV of the failing run was overwritten by it.

## Truncation

Groq stops this model at 3,072 completion tokens (`finish_reason: length`). Most completions here hit it, inside a trailing checklist or example. Every FAIL is a content miss present in the delivered text.
