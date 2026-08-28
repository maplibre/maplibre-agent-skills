# Eval Results: maplibre-tile-sources

Canonical results table for this skill. Baseline is the same prompt with the skill omitted
(`--var injectSkill=false`). Tests that pass at baseline are summarized below the table rather
than listed: they are not evidence of a gap. See `evals/prompts/maplibre-tile-sources.yaml`.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`.
Raw CSVs under [`latest/`](latest/), matching `maplibre-tile-sources-*`.

| #   | Test                                                  | Type         | Baseline (no skill)                                                                             | With skill                                                                  |
| --- | ----------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 3   | Merging basemap and application data into one tileset | Anti-pattern | **FAIL** — supplies the merge pipeline without pushing back on the premise                      | **PASS** — corrects the premise and gives the two-source pattern            |
| 4   | Small dataset, no tile server needed                  | Negative     | PASS                                                                                            | PASS                                                                        |
| 7   | Leaflet cannot render vector tiles natively           | Implicit     | **FAIL** — recommends Leaflet.VectorGrid, and inverts the package name to `leaflet-maplibre-gl` | **PASS** — Leaflet is raster-only, names `maplibre-gl-leaflet` (2026-08-28) |

**Result: the launch bar is cleared. `status: verified`.** Two gaps demonstrated closed, none
open. Four further tests (1, 2, 5, 6) pass in both directions: they confirm the skill does not
regress answers the model already gets right, and every with-skill row was recorded or
re-confirmed after the last skill edit.

Test 7's baseline is the case for pairing every rubric with an `icontains` tripwire. It inverts
the package name to `leaflet-maplibre-gl`, which a rubric alone would likely have scored as
broadly correct.

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
