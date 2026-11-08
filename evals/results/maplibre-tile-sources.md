# Eval Results: maplibre-tile-sources

Canonical results table for this skill. Baseline is the same prompt with the skill omitted
(`--var injectSkill=false`). Tests that pass at baseline are summarized below the table rather
than listed: they are not evidence of a gap. See `evals/prompts/maplibre-tile-sources.yaml`.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-3.1-flash-lite` · `npm run eval:graded`.
Raw CSVs under [`latest/`](latest/), matching `maplibre-tile-sources-*`.

| #   | Test                                                  | Type         | Baseline (no skill)                                                        | With skill                                                       |
| --- | ----------------------------------------------------- | ------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 3   | Merging basemap and application data into one tileset | Anti-pattern | **FAIL** — supplies the merge pipeline without pushing back on the premise | **PASS** — corrects the premise and gives the two-source pattern |
| 4   | Small dataset, no tile server needed                  | Negative     | PASS                                                                       | PASS                                                             |
| 7   | Leaflet cannot render vector tiles natively           | Implicit     | PASS 2/3 (2026-10-26)                                                      | PASS 3/3 (2026-10-26)                                            |

**Result: the launch bar is cleared. `status: verified`.** One gap demonstrated closed (test 3),
none open. Four further tests (1, 2, 5, 6) pass in both directions: they confirm the skill does not
regress answers the model already gets right, and every with-skill row was recorded or
re-confirmed after the last skill edit.

Test 7 re-run 2026-10-26, three runs each way, after its rubric stopped requiring a raster layer: MapLibre GL Leaflet adds a live MapLibre GL JS map to Leaflet as a layer. The baseline now passes 2 of 3, so the test is no longer evidence of a gap. Both sides cite a `@0.0.13` build of `@maplibre/maplibre-gl-leaflet` that does not exist, which no rubric checks. Raw CSVs: [with-skill](latest/maplibre-tile-sources-with-skill-leaflet_2026-10-26.csv), [baseline](latest/maplibre-tile-sources-baseline-leaflet_2026-10-26.csv).

Test 7 was re-run on 2026-11-04 with the judge `google:gemini-3.1-flash-lite`, after that day's scheduled run failed it on its first attempt and passed both re-runs. The failing answer opened with the plugin and never stated that Leaflet's core draws only raster tiles, which the rubric requires; the two re-runs that passed, and the 2026-10-28 answer, open with the same sentence. On the skill text before this change, three more runs the same day passed 1 of 3 ([CSV](latest/maplibre-tile-sources-with-skill-test7-before_2026-11-04.csv)). The Leaflet paragraph now has the model state the limit first and the plugin second: 6 of 6, every answer opening with the limit ([CSV](latest/maplibre-tile-sources-with-skill-test7-repeats_2026-11-04.csv)), and the full config 7 of 7 ([CSV](latest/maplibre-tile-sources-with-skill_2026-11-04.csv)). The baseline was not re-run, since the assertions are unchanged. Every answer still cites `@maplibre/maplibre-gl-leaflet@0.0.13`, which npm never published (its versions run from 0.0.14-rc.1 to 0.1.4); no rubric checks it.

## Test 3: two defects, both fixed before the row meant anything

The first run had this failing in both directions, and neither verdict survived scrutiny.

- **The skill stated a principle where the request needed an instruction.** It said merging was
  "rarely the right approach" and explained why. The model agreed with all of it and supplied
  the merge pipeline anyway. `3b48398` reshapes the section around the request: correct the
  premise, give the three costs, state the two-source answer instead.
- **The rubric quoted the skill's own pre-`3b48398` wording**, allowing a combined tileset "when
  self-hosting with full control of the pipeline" — and so passed a completion justifying the
  merge for bundle size, a demo, and a proof-of-concept. The test scored agreement with its own
  outdated assumption as success, so it **failed green**. `8757f4e` narrows it to the offline
  single-artifact case the skill actually states.

Both directions were re-recorded against the new wording.

**One gap logged rather than patched.** The skill tells the model not to write out the build,
but no rubric clause encodes that, so an answer that pushes back _and_ supplies build commands
still passes. Do not read this PASS as evidence of a prohibition that was never tested.

## Truncation

Groq truncates mid-sentence at roughly 11,900 characters — a property of the provider pin, not
of these tests (see `evals/prompts/lib/providers.yaml`). Six of seven baseline rows and four of
seven with-skill rows are affected. Every FAIL was read against its raw completion first: test
3's merge pipeline and test 7's inverted package name both land well before the cut. Test 7's
with-skill PASS is truncated too, but after the content the grader scored on.

## Note on the withdrawn `maplibre-tile-hosting` baseline

It baselined 4/4 with no skill loaded. That shows the skill as written cleared no bar; it does
not show tile hosting has no gap. The four questions were topic-level, and this suite's results
split by the kind of knowledge asked for rather than by difficulty — failures cluster on
specific names, numeric defaults, and version boundaries, passes on architectural judgment.
Re-probing hosting at the level of its primitives is tracked separately.
