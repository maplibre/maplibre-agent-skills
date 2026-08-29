# Eval Results: maplibre-pmtiles-patterns

Canonical results table for `evals/prompts/maplibre-pmtiles-patterns.yaml`.

Baseline run: 2026-07-03. With-skill run: re-verified 2026-07-04 after two fixes made while confirming this table — `config.max_tokens: 8192` added to the provider. Without it, answers were truncated ~3,800-4,200 chars in, causing a false FAIL on test 4. Model `cerebras:gpt-oss-120b` · judge `google:gemini-2.5-flash-lite`, hand-judged from raw output where noted (†) — the grader still 503's intermittently; contaminated rows were read and judged by a human instead of retried.

| #   | Test                                           | Type         | Baseline (no skill)                                                                                       | With skill                                                                 |
| --- | ---------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Loading a PMTiles file                         | Explicit     | FAIL (deterministic `icontains: addProtocol`)                                                             | PASS — clean                                                               |
| 2   | Serverless tile hosting on GitHub Pages        | Implicit     | FAIL † — answer degenerates into a repetition loop, never lands PMTiles                                   | PASS † — correct: single static file, `url:` source, protocol registration |
| 3   | addProtocol broke after upgrading to v4        | Anti-pattern | FAIL † — gives v3-style handler without `{data}`                                                          | PASS — clean                                                               |
| 4   | Inspect a PMTiles file before deploying        | Explicit     | FAIL (deterministic `icontains: pmtiles verify`)                                                          | PASS — clean (previously a false FAIL from truncation, see above)          |
| 5   | Wrong tool for live PostGIS data               | Negative     | PASS † — correctly refuses PMTiles for 30-second updates                                                  | PASS † — same, correct                                                     |
| 6   | tiles array bypasses PMTiles header zoom range | Anti-pattern | FAIL — blames 404s / protocol-not-invoked, suggests regenerating (the wrong-cause claim the rubric names) | PASS — clean                                                               |

**Result: baseline 4 FAIL + 1 correct negative / with-skill 6/6 PASS — launch bar cleared.**

A seventh test (raster-dem terrain with PMTiles) was dropped: it passed at baseline (the model already knows this pattern), so it wasn't testing a real gap under this repo's "target demonstrated gaps only" rule.

A probe of "PMTiles is a container, not a source type" (there is no `pmtiles` type in the style spec; the source `type` is the type of the tiles inside the archive) was run at baseline on 2026-08-28 against `groq:openai/gpt-oss-120b` with the `google:gemini-2.5-flash-lite` judge, in two phrasings — one naming the question outright, one asking only for the source and layer JSON for imagery held in a `.pmtiles` file. Both PASSED: the model writes `type: 'raster'` with a `pmtiles://` URL and never invents a `pmtiles` source type. No gap, so no test and no content were added; recorded so it isn't rediscovered.
