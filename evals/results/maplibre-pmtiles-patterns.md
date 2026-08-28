# Eval Results: maplibre-pmtiles-patterns

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-pmtiles-patterns.yaml`.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-pmtiles-patterns-*`. Re-run 2026-08-28 on the Groq pin, replacing the 2026-07-03/04 Cerebras run (#64).

| #   | Test                                           | Type         | Baseline (no skill)                                                   | With skill                                                                    |
| --- | ---------------------------------------------- | ------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Loading a PMTiles file                         | Explicit     | PASS — on concept; the code is invented, see below                    | **PASS** — `new pmtiles.Protocol()` + `addProtocol('pmtiles', protocol.tile)` |
| 2   | Serverless tile hosting on GitHub Pages        | Implicit     | **FAIL** — pre-cut `.pbf`/`.png` tile trees; never PMTiles            | **PASS** — single `.pmtiles` file, range requests, `url:` source              |
| 3   | addProtocol broke after upgrading to v4        | Anti-pattern | PASS — the v4 signature is known, see below                           | **PASS** — return `{ data }`, no callback                                     |
| 4   | Inspect a PMTiles file before deploying        | Explicit     | **FAIL** — `pmtiles show` yes, `pmtiles verify` never                 | **PASS** — `pmtiles show` + `pmtiles verify`                                  |
| 5   | Wrong tool for live PostGIS data               | Negative     | PASS                                                                  | PASS                                                                          |
| 6   | tiles array bypasses PMTiles header zoom range | Anti-pattern | PASS — cause and fix right, with an invented `tileset` key, see below | **PASS** — header never read → default `maxzoom: 22`; `url: 'pmtiles://…'`    |

**Result: two gaps demonstrated closed (2, 4); three tests now pass at baseline and are not gap evidence; the negative holds.** With-skill 6 of 6. `status: verified` was set on the Cerebras run, where all four gap tests failed at baseline; what it rests on now is narrower.

## Tests 1, 3, 6: passing at baseline, not equally

- **Test 3 is a closed gap.** The v4 `addProtocol` change is simply known: v3 `(params, callback)` against v4 `(params, abortController)` returning a Promise, with the v3 form shown only as the broken code.
- **Test 1 passes on concept with invented code.** `addProtocol('pmtiles', (request) => pmtiles.get(request))` as the handler, "MapLibre GL JS ≥ 2.4 already knows how to treat `pmtiles://` URLs", and `pmtiles info` for the CLI. The judge passed it. The skill's `new pmtiles.Protocol()` + `protocol.tile` still corrects a wrong answer, but the rubric does not pin that shape.
- **Test 6 passes on the causal story** (a `tiles` template bypasses the archive's metadata, so zooms the archive lacks get requested; fix with `url:`) while inventing a `tileset` key as an alias for `url` and never naming the default `maxzoom: 22` the rubric asks for.

Whether to tighten the rubrics for 1 and 6 to the distinguishing shapes, or to drop test 3 as a non-gap, is a maintainer call.

## Truncation

Groq stops this model at 3,072 completion tokens (`finish_reason: length`), at `max_tokens` 8192 and 4096 alike. Eight of twelve completions here hit it, always inside a trailing troubleshooting table or example after the graded substance. The two FAILs (tests 2 and 4) are content misses stated early in each answer.
