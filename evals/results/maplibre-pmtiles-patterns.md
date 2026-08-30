# Eval Results: maplibre-pmtiles-patterns

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-pmtiles-patterns.yaml`.

Run: 2026-08-30 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-pmtiles-patterns-*_2026-08-30`. Rubrics revised in #79 after the 2026-08-28 run passed three tests at baseline on invented code; the 2026-08-28 CSVs are kept alongside.

| #   | Test                                           | Type         | Baseline (no skill)                                                                                          | With skill                                                                    |
| --- | ---------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | Loading a PMTiles file                         | Explicit     | **FAIL** — `addProtocol('pmtiles', (request) => pmtiles.get(request))`; `pmtiles://nyc.pmtiles` with no host | **PASS** — `new pmtiles.Protocol()` + `addProtocol('pmtiles', protocol.tile)` |
| 2   | Serverless tile hosting on GitHub Pages        | Implicit     | **FAIL** — pre-cut `.pbf`/`.png` tile trees; never PMTiles                                                   | **PASS** — single `.pmtiles` file, range requests, `url:` source              |
| 3   | addProtocol broke after upgrading to v4        | Anti-pattern | **FAIL** — right on the Promise shape, but registers it as `map.addProtocol` (not a `Map` method)            | **PASS** — global `maplibregl.addProtocol`, handler resolving to `{data}`     |
| 4   | Inspect a PMTiles file before deploying        | Explicit     | **FAIL** — `pmtiles show` yes, `pmtiles verify` never                                                        | **PASS** — `pmtiles show` + `pmtiles verify`                                  |
| 5   | Wrong tool for live PostGIS data               | Negative     | PASS                                                                                                         | PASS                                                                          |
| 6   | tiles array bypasses PMTiles header zoom range | Anti-pattern | PASS — judged green on an answer that contradicts the rubric, see below                                      | **PASS** — header never read → default `maxzoom: 22`; `url: 'pmtiles://…'`    |

**Result: four gaps demonstrated closed (1, 2, 3, 4); test 6 is not usable as gap evidence on this judge; the negative holds in both directions.** With-skill 6 of 6. `status:` stays `provisional` until test 6 either fails at baseline or is redesigned.

## What the tightened rubrics changed

Three tests passed at baseline on 2026-08-28 because the rubrics scored the concept and not the code. Each now names the specific invented thing the completion produced, next to the real name (the #52 tripwire technique):

- **Test 1** — required `protocol.tile` and the `Protocol` class from the `pmtiles` package, tripwire `not-icontains: pmtiles.get(`. The baseline still hand-rolls `(request) => pmtiles.get(request)` and still writes host-less `pmtiles://nyc.pmtiles` URLs; it now fails for it. Verified against [`js/src/adapters.ts`](https://github.com/protomaps/PMTiles/blob/main/js/src/adapters.ts): `class Protocol` exposes `tile = v3compat(this.tilev4)`.
- **Test 3** — required the v4 handler shape (`async (params, abortController)` resolving to an object with a `data` property) registered on the module, tripwire `not-icontains: map.addProtocol`. The baseline describes the Promise change correctly and then registers it as a `Map` method. Verified against [`src/source/protocol_crud.ts`](https://github.com/maplibre/maplibre-gl-js/blob/main/src/source/protocol_crud.ts): `addProtocol` is a module-level function whose `loadFn` returns `{data: buffer}`.
- **Test 6** — swapped the near-meaningless `icontains: url` for `maxzoom`, added tripwires for the invented `tileset:` source property and the invented `pmtiles info` subcommand. go-pmtiles has no `info`: `main.go` declares `show`, `tile`, `cluster`, `edit`, `extract`, `merge`, `convert`, `verify`, `serve`, `upload`, `version`.

## Test 6: green on an answer that violates its own rubric

Both 2026-08-30 baseline runs passed, and neither should have. The second one:

- attributes the blank tiles to the loader not understanding the templated URL ("Those URLs are **not** understood by the PMTiles loader") — the rubric forbids exactly that claim;
- never names the default `maxzoom: 22` the rubric asks for, and instead says the archive's own `maxzoom` is the limit being hit;
- offers `pmtiles inspect` and `pmtiles set-metadata`, neither of which exists, and recommends regenerating at a higher zoom — also forbidden.

So this is judge leniency, not a model that has the answer. The skill's paragraph is not demoted on that basis; the test needs either a stricter judge or a rubric a lenient judge cannot wave through, and until then it earns no `verified`. The 2026-08-28 baseline pass was the same failure with different invented details (a `tileset` source property, `pmtiles info`).

## Truncation

Groq stops this model at 3,072 completion tokens (`finish_reason: length`). Most completions here hit it, always inside a trailing troubleshooting table or extended example after the graded substance. Every FAIL is a miss or an error in the delivered text, not a cut-off answer.
