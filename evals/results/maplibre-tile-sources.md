# Eval Results: maplibre-tile-sources

Canonical results table for this skill. One row per eval test; baseline is the model's
answer with the skill omitted (`--var injectSkill=false`), with-skill is the same prompt
with the skill injected. See `evals/prompts/maplibre-tile-sources.yaml`.

Run: 2026-08-27 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite`
(`npm run eval:graded`, automated). Raw CSVs:
[`maplibre-tile-sources-baseline_2026-08-27.csv`](latest/maplibre-tile-sources-baseline_2026-08-27.csv),
[`maplibre-tile-sources-with-skill_2026-08-27.csv`](latest/maplibre-tile-sources-with-skill_2026-08-27.csv).

Follow-up run: 2026-08-28 · same model, judge, and command · with-skill only, test 7 only
(the one row the 2026-08-27 run rate-limited before answering). Raw CSV:
[`maplibre-tile-sources-with-skill-test7_2026-08-28.csv`](latest/maplibre-tile-sources-with-skill-test7_2026-08-28.csv).

This is the first full run against the skill as narrowed to the source-selection question.
Tests 5–7 are new and had no prior baseline.

| #   | Test                                                  | Type         | Baseline (no skill)                                                                             | With skill                                                                                                                                                                    |
| --- | ----------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GeoJSON vs. tiles for 8,000 trail segments            | Explicit     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 2   | Dataset outgrew GeoJSON, user never says tiles        | Implicit     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 3   | Merging basemap and application data into one tileset | Anti-pattern | **FAIL** — supplies the merge pipeline without pushing back on the premise                      | **FAIL** — supplies the pipeline again; the skill's guidance did not change the answer                                                                                        |
| 4   | Small dataset, no tile server needed                  | Negative     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 5   | Georeferencing a scanned map image                    | Implicit     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 6   | Vector tiles for a restylable basemap                 | Explicit     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 7   | Leaflet cannot render vector tiles natively           | Implicit     | **FAIL** — recommends Leaflet.VectorGrid, and inverts the package name to `leaflet-maplibre-gl` | **PASS** — states Leaflet is raster-only and names `maplibre-gl-leaflet` for the integration (2026-08-28 run; completion truncated ~11.9k chars, after the gradeable content) |

**Result: the launch bar is not cleared. `status: provisional`.**

Two tests fail at baseline, which is what the skill exists to fix. One (test 7) is now
demonstrated fixed with the skill; the other (test 3) fails in both directions:

- **Test 3 fails in both directions.** The skill states the principle plainly — a style holds
  any number of sources, the basemap supplies context while your own source supplies your
  data, and merging means regenerating the whole tileset whenever your data changes — and the
  model still answers the question as asked and supplies the merge pipeline. This reads as a
  behavioral failure rather than a knowledge one: the user asked _how to merge_, and stating
  a principle in prose does not overcome the pull to comply with the premise. Closing it
  likely needs the skill to say what to do when asked for this, not only what is true. Filed
  rather than patched at the end of a session.
- **Test 7 is closed with the skill (2026-08-28 follow-up run).** Baseline names
  Leaflet.VectorGrid as a way to consume vector tiles in Leaflet, and gives the integration
  package as `leaflet-maplibre-gl` — the correct name, `maplibre-gl-leaflet`, inverted. A
  plausible-looking wrong package name is the failure mode the `icontains` tripwire exists to
  catch, and an `llm-rubric` alone would likely have scored the answer as broadly correct.
  With the skill injected, the answer states Leaflet is raster-only and names
  `maplibre-gl-leaflet` correctly; both the `icontains` tripwire and the rubric pass. This
  closes one gap, but the anti-pattern test (3) still fails in both directions, so the launch
  bar is not cleared and `status: provisional` holds.

## Truncation

Groq truncates completions mid-sentence at roughly 11,900 characters, and six of the seven
baseline rows and four of the seven with-skill rows here are affected. This is a property of the
provider pin, not of these tests: the ceiling is the same at `max_tokens: 8192` and at `4096`
(see `evals/prompts/lib/providers.yaml`).

Every FAIL above was checked against its raw completion before being recorded. Test 3's
truncation is immaterial — the full merge pipeline is delivered well before the cut, in both
directions. Test 7's baseline likewise: the inverted package name appears in the delivered
text. Test 7's with-skill PASS (2026-08-28) is also truncated at ~11.9k chars, but the
`maplibre-gl-leaflet` name and the raster-only statement both appear well before the cut, and
the grader (which sees the full completion) scored "All assertions passed" — a truncated PASS
with the disqualifying-free content intact.

Five tests (1, 2, 4, 5, 6) pass in both directions: they confirm the skill does not regress
answers the model already gets right, and are not evidence of a gap being closed. Test 7
passes only with the skill against a baseline FAIL — the one gap this run demonstrates closed.
Test 3 fails in both directions.

## Note on the 2026-08-26 `maplibre-tile-hosting` baseline

The withdrawn `maplibre-tile-hosting` skill baselined 4/4 with no skill loaded. That result
shows the skill as written cleared no bar. It does not show that tile hosting has no gap —
the four questions asked were topic-level, and this suite's results split consistently by the
kind of knowledge asked for rather than by difficulty. Failures here cluster on specific
names, numeric defaults, and version boundaries; passes cluster on architectural judgment.
Re-probing hosting at the level of its primitives is tracked separately.
