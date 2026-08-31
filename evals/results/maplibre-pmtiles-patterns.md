# Eval Results: maplibre-pmtiles-patterns

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-pmtiles-patterns.yaml`.

Run: 2026-08-30 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-pmtiles-patterns-*_2026-08-30`. The 2026-08-28 CSVs are kept alongside.

| #   | Test                                           | Type         | Baseline (no skill)                                                                                                             | With skill                                                                                                        |
| --- | ---------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Loading a PMTiles file                         | Explicit     | **FAIL** — hand-rolled `addProtocol('pmtiles', (request) => pmtiles.get(request))`; host-less `pmtiles://my-pmtiles-source` URL | **PASS** — `new pmtiles.Protocol()` + `addProtocol('pmtiles', protocol.tile)`                                     |
| 2   | Serverless tile hosting on GitHub Pages        | Implicit     | **FAIL** — pre-cut raster and vector tile trees; never PMTiles, never range requests                                            | **PASS** — single `.pmtiles` file, range requests, `url:` source                                                  |
| 3   | addProtocol broke after upgrading to v4        | Anti-pattern | **FAIL** — right on the Promise shape, then "`map.addProtocol()` still exists in v4"; the `map.addProtocol` tripwire fired      | **PASS** — global `maplibregl.addProtocol`, handler resolving to `{data}`                                         |
| 4   | Inspect a PMTiles file before deploying        | Explicit     | **FAIL** — never `pmtiles show` or `pmtiles verify`; invents `pmtiles info`                                                     | **PASS** — `pmtiles show` + `pmtiles verify`                                                                      |
| 5   | Wrong tool for live PostGIS data               | Negative     | PASS                                                                                                                            | PASS                                                                                                              |
| 6   | tiles array bypasses PMTiles header zoom range | Anti-pattern | **FAIL** — invents `pmtiles set-metadata … maxzoom` and `pmtiles info`, and tells the reader to regenerate at a higher zoom     | **PASS** — header never read → default `maxzoom: 22`; `url: 'pmtiles://…'` → overzoom of the deepest stored tiles |

**Result: 5 FAIL / 1 PASS at baseline, 6 PASS with the skill. Every non-negative test fails at baseline and passes with the skill; the negative holds in both directions. `status: verified` is set.**

## What the rubrics guard against

Three tests once passed at baseline on invented code because their rubrics scored the concept, not the code. Each now names the real API beside a tripwire for the invented one, and the tripwires are doing work the rubric text alone did not (tests 3 and 4 fail at baseline on their tripwire alone; the judge passed both rubrics):

- **Test 1** — `protocol.tile` and the `Protocol` class from `pmtiles`; tripwire `not-icontains: pmtiles.get(`. Verified against [`js/src/adapters.ts`](https://github.com/protomaps/PMTiles/blob/main/js/src/adapters.ts).
- **Test 3** — the v4 handler shape (`async (params, abortController)` resolving to `{data}`) on the module-level `maplibregl.addProtocol`; tripwire `not-icontains: map.addProtocol`. Verified against [`src/source/protocol_crud.ts`](https://github.com/maplibre/maplibre-gl-js/blob/main/src/source/protocol_crud.ts).
- **Test 6** — the answer must say that with the archive's own `maxzoom` supplied MapLibre **overzooms** the deepest stored tiles, and must not patch the archive's metadata; tripwires `not-icontains` for `pmtiles inspect`, `set-metadata`, `pmtiles info`, and `tileset:`. go-pmtiles has none of those subcommands (`main.go` declares `show`, `tile`, `cluster`, `edit`, `extract`, `merge`, `convert`, `verify`, `serve`, `upload`, `version`).

## Truncation

Groq stops this model at 3,072 completion tokens (`finish_reason: length`). Most completions here hit it, always inside a trailing troubleshooting table or extended example after the graded substance. Both test 6 completions (baseline 7,924 characters, with-skill 9,799) ran to a natural end. Every FAIL is a miss or an error in the delivered text, not a cut-off answer.
