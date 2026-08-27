# Eval Results: maplibre-source-wiring

Canonical results table for this skill. One row per eval test; baseline is the model's
answer with the skill omitted (`--var injectSkill=false`), with-skill is the same prompt
with the skill injected. See `evals/prompts/maplibre-source-wiring.yaml`.

Run: 2026-08-27 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite`
(`npm run eval:graded`, automated). Raw CSVs:
[`maplibre-source-wiring-baseline_2026-08-27.csv`](latest/maplibre-source-wiring-baseline_2026-08-27.csv),
[`maplibre-source-wiring-with-skill-partial_2026-08-27.csv`](latest/maplibre-source-wiring-with-skill-partial_2026-08-27.csv)
(with-skill data for tests 1 and 3).

Follow-up run: 2026-08-28 · same model, judge, and command · with-skill only, tests 6, 7, and
9 (the three the 2026-08-27 run rate-limited before answering). Raw CSV:
[`maplibre-source-wiring-with-skill-tests-6-7-9_2026-08-28.csv`](latest/maplibre-source-wiring-with-skill-tests-6-7-9_2026-08-28.csv)
— test 9 returned a verdict; tests 6 and 7 errored again (see table).

The baseline is complete: all 13 tests. **The with-skill run is not** — the 2026-08-27 run
rate-limited partway, and the 2026-08-28 follow-up cleared test 9 but tests 6 and 7 timed out
in the provider queue (300s, promptfoo's ceiling) with no completion returned. Only the tests
below marked with a verdict have with-skill data. Rows marked "not run" or "ERROR" are gaps in
the evidence, not passes.

| #   | Test                                                      | Type         | Baseline (no skill)                                                                   | With skill                                                                                                                                                                      |
| --- | --------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Custom style layers invisible (`source-layer` mismatch)   | Implicit     | **FAIL**                                                                              | **PASS** — names the mismatch and the `vector_layers` lookup                                                                                                                    |
| 2   | `addLayer` covering basemap labels                        | Anti-pattern | PASS                                                                                  | not run                                                                                                                                                                         |
| 3   | No text labels at all is not a missing `glyphs`           | Implicit     | **FAIL** — asserts adding `glyphs` restores the labels                                | **PASS** — directs diagnosis at `text-field` and GL JS version                                                                                                                  |
| 4   | TileJSON `url` vs. hand-wired `tiles`                     | Explicit     | PASS                                                                                  | not run                                                                                                                                                                         |
| 5   | Unrelated question, expression syntax                     | Negative     | PASS                                                                                  | not run                                                                                                                                                                         |
| 6   | Naming published tile schemas and their doc URLs          | Explicit     | **FAIL** — names OpenMapTiles only; substitutes other schemas and a doubtful citation | **ERROR** — 2026-08-27 rate-limited; 2026-08-28 re-run timed out in the provider queue (300s, promptfoo's ceiling). No data.                                                    |
| 7   | "Hillshade"-named JPEG endpoint is raster, not raster-dem | Implicit     | **FAIL**                                                                              | **ERROR** — 2026-08-27 rate-limited; 2026-08-28 re-run timed out in the provider queue (300s, promptfoo's ceiling). No data.                                                    |
| 8   | Literal `{z}/{x}/{y}` fetched by hand is not an outage    | Implicit     | PASS                                                                                  | not run                                                                                                                                                                         |
| 9   | Raster `tileSize` defaults to 512, OSM tiles are 256      | Implicit     | **FAIL**                                                                              | **PASS** (2026-08-28) — states `tileSize: 256` is required and explains the wrong-effective-zoom consequence; completion complete (~6.6k chars), grader "All assertions passed" |
| 10  | A glyphs URL is not a vector tile source (`.pbf`)         | Anti-pattern | PASS                                                                                  | not run                                                                                                                                                                         |
| 11  | A whole style document is not itself a source             | Implicit     | PASS                                                                                  | not run                                                                                                                                                                         |
| 12  | A `mapbox://` URL is not directly usable                  | Implicit     | PASS                                                                                  | not run                                                                                                                                                                         |
| 13  | GeoParquet has no native MapLibre source                  | Implicit     | PASS                                                                                  | not run                                                                                                                                                                         |

**Result: three gaps demonstrated closed with the skill (tests 1, 3, and 9); two confirmed
gaps (6 and 7) still lack with-skill evidence — both errored again on the 2026-08-28 re-run.
The frontmatter still reads `status: provisional`; whether tests 6 and 7 need a verdict before
that changes is a maintainer call, not one this run settles.**

## Test 3 is worth reading closely

It passed at baseline for months under its previous rubric, which required the answer "the
style is missing a `glyphs` property." That was correct until GL JS 5.11.0, after which an
absent `glyphs` renders text in a local system font rather than omitting it — so a map with
_no_ text has some other cause. The test had not been measuring whether the model knew the
answer; it was measuring whether the model shared the rubric's outdated assumption, and
scoring agreement as success. Reworded to current behavior, the same model fails it. The
baseline row above is from the reworded test, re-run rather than carried over.

Its with-skill verdict also located a real limit on deduplication. When the glyphs material
was consolidated into `maplibre-fonts-glyphs`, this skill initially lost the _consequence_
along with the mechanism, and test 3 then failed **with the skill injected** — the skill could
no longer answer the question it poses. Restoring one sentence (an absent `glyphs` yields the
wrong font, not absent text) makes it pass. Mechanism can live behind a pointer; a fact the
pointing skill needs in order to reason cannot.

## Truncation

Groq truncates completions mid-sentence at roughly 11,900 characters, affecting two baseline
rows here (tests 1 and 4). This is a property of the provider pin rather than of these tests —
the ceiling is identical at `max_tokens: 8192` and at `4096`; see
`evals/prompts/lib/providers.yaml`.

Test 1 is the row that matters, since its FAIL is one of the gaps this skill closes. It is
sound: the grader's objection is that `vector_layers` is never named as the authoritative
lookup, and `vector_layers` appears nowhere in the completion, cut or uncut. Test 4 is a
truncated PASS, which is the safe direction — the grader found what it needed before the cut.

Test 9's with-skill PASS (2026-08-28) is **not** truncated — the completion runs ~6,600
characters and ends cleanly. `256` and the wrong-zoom consequence both appear, and the grader
scored "All assertions passed".

Rows in the raw CSVs are in run order, not the order above: test 3 was reworded and re-run
after the rest of the baseline, and the 2026-08-28 follow-up CSV holds only tests 6, 7, and 9.
Match rows by description, never by position.

## Eight baseline passes

Tests 2, 4, 5, 8, 10, 11, 12, 13 pass without the skill. They are not evidence of a gap, and
the sections behind them are candidates for compression rather than expansion. Four of them
(10–13) came from a source-identification exercise whose original evidence was a _program's_
misclassification, not a model's — a regex scored 0/12 on these inputs while the model answers
them unaided. Worth recording as a methodological caution: a failure captured from a program
is not evidence of a model gap.
