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

Re-run: 2026-08-27 · same model, judge, and command · test 3 only, both directions, after the
skill and the rubric were both corrected (see [Test 3](#test-3-re-run-after-correcting-both-the-skill-and-the-rubric)).
Raw CSVs:
[`maplibre-tile-sources-baseline-test3_2026-08-27.csv`](latest/maplibre-tile-sources-baseline-test3_2026-08-27.csv),
[`maplibre-tile-sources-with-skill-test3_2026-08-27.csv`](latest/maplibre-tile-sources-with-skill-test3_2026-08-27.csv).

This is the first full run against the skill as narrowed to the source-selection question.
Tests 5–7 are new and had no prior baseline.

| #   | Test                                                  | Type         | Baseline (no skill)                                                                             | With skill                                                                                                                                                                    |
| --- | ----------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GeoJSON vs. tiles for 8,000 trail segments            | Explicit     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 2   | Dataset outgrew GeoJSON, user never says tiles        | Implicit     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 3   | Merging basemap and application data into one tileset | Anti-pattern | **FAIL** — supplies the merge pipeline without pushing back on the premise                      | **PASS** — corrects the premise and gives the two-source pattern (2026-08-27 re-run, after the skill and rubric corrections; 6,707 chars, not truncated)                      |
| 4   | Small dataset, no tile server needed                  | Negative     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 5   | Georeferencing a scanned map image                    | Implicit     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 6   | Vector tiles for a restylable basemap                 | Explicit     | PASS                                                                                            | PASS                                                                                                                                                                          |
| 7   | Leaflet cannot render vector tiles natively           | Implicit     | **FAIL** — recommends Leaflet.VectorGrid, and inverts the package name to `leaflet-maplibre-gl` | **PASS** — states Leaflet is raster-only and names `maplibre-gl-leaflet` for the integration (2026-08-28 run; completion truncated ~11.9k chars, after the gradeable content) |

**Result: the launch bar is cleared. `status: verified`.** Both tests that fail at baseline pass
with the skill, the other five pass in both directions, and a
[regression re-run](#regression-check-after-the-skill-edit) after the skill was edited confirms
none of them broke.

Two tests fail at baseline, which is what the skill exists to fix, and both now pass with the
skill injected:

- **Test 3 is closed with the skill (2026-08-27 re-run).** See below; this row required
  correcting the skill and the rubric before it could be graded meaningfully in either
  direction.
- **Test 7 is closed with the skill (2026-08-28 follow-up run).** Baseline names
  Leaflet.VectorGrid as a way to consume vector tiles in Leaflet, and gives the integration
  package as `leaflet-maplibre-gl` — the correct name, `maplibre-gl-leaflet`, inverted. A
  plausible-looking wrong package name is the failure mode the `icontains` tripwire exists to
  catch, and an `llm-rubric` alone would likely have scored the answer as broadly correct.
  With the skill injected, the answer states Leaflet is raster-only and names
  `maplibre-gl-leaflet` correctly; both the `icontains` tripwire and the rubric pass.

## Test 3: re-run after correcting both the skill and the rubric

The 2026-08-27 run recorded this test failing in both directions, and neither verdict survived
scrutiny. Two separate defects had to be fixed before the test could grade what it claimed to.

**The skill stated a principle where the request needed an instruction.** The original guidance
said merging was "rarely the right approach" and explained why a style can hold any number of
sources. The model agreed with all of it and supplied the merge pipeline anyway. The user asked
_how to merge_, and a true statement does not overcome the pull to comply with the premise.
`3b48398` reshapes the section around the request: it names the form the question arrives in,
corrects the premise, gives the three costs so the request does not survive a bare refusal, and
states the two-source answer to give instead.

**The rubric was grading against a position the skill no longer held.** Its closing clause
allowed a combined tileset "when self-hosting with full control of the pipeline" — a quote of
the skill's own pre-`3b48398` wording, replaced there precisely because it reads as permission
to most of this audience. Left in the rubric, it passed a completion that justified merging for
kiosk bundle size, a demo, and a proof-of-concept. This is the same defect class as the stale
glyphs rubric: **the test scored agreement with its own outdated assumption as success, so it
failed green.** `8757f4e` narrows it to the offline single-artifact case the skill actually
states and names the tempting false exceptions as disqualifying.

Because the rubric wording changed, the prior baseline row could not be carried forward. Both
directions were re-recorded against the new wording on 2026-08-27:

- **Baseline FAIL** (11,452 chars). Supplies a full merge pipeline — PostGIS, `osm2pgsql`,
  `imposm3`, Planetiler, tippecanoe with commands, `ogr2ogr`, SQL views — with no pushback of
  any kind. The completion is truncated, but the entire pipeline lands before the cut, so the
  FAIL does not depend on the missing tail. The grader's reason is substantive and carries no
  `Error:`.
- **With-skill PASS** (6,707 chars, not truncated). Corrects the premise, gives the two-source
  pattern, and confines the exception to the offline single-artifact case.

**One gap logged rather than patched.** The skill tells the model not to write out the build
(`SKILL.md` — "Name the tools that would do it (tippecanoe, Planetiler) and point at their
documentation"). No rubric clause encodes that, so a completion that pushes back correctly _and_
supplies build commands still passes. The rubric as written measures a defensible bar and this
run cleared it; adding a `must NOT` clause for build commands would invalidate the baseline row
again and is deferred rather than rushed. Recorded here so the next person does not read the
PASS as evidence of a prohibition that was never tested.

## Regression check after the skill edit

`3b48398` edited `SKILL.md`, which is injected into every test in this config, so every
with-skill row recorded before it needed re-confirming. Re-run 2026-08-27, with-skill, tests 1,
2, 4, 5, 6, 7. Raw CSV:
[`maplibre-tile-sources-with-skill-regression_2026-08-27.csv`](latest/maplibre-tile-sources-with-skill-regression_2026-08-27.csv).

Five of the six re-passed cleanly — tests 1, 2, 4, 5, 6, all "All assertions passed", no
grader reason carrying `Error:`. No test regressed. Test 3, the one the edit was written for,
was itself re-run after the edit and is covered above.

**Test 7 is the one row not re-confirmed.** Its canonical with-skill PASS was recorded at 13:21,
28 minutes before `3b48398` landed at 13:49, so it grades the pre-edit skill. Three attempts to
re-run it have all ended in a 300-second provider-queue timeout with a zero-character
completion, which is no data rather than a FAIL. The verdict stands on the earlier run; what is
untested is whether the edit disturbed it. The risk is small and worth stating rather than
glossing: `3b48398` touched only the merge anti-pattern section, and test 7 asks about Leaflet.
Re-confirm it opportunistically on the next run of this config.

## Truncation

Groq truncates completions mid-sentence at roughly 11,900 characters, and six of the seven
baseline rows and four of the seven with-skill rows here are affected. This is a property of the
provider pin, not of these tests: the ceiling is the same at `max_tokens: 8192` and at `4096`
(see `evals/prompts/lib/providers.yaml`).

Every FAIL above was checked against its raw completion before being recorded. Test 3's
baseline truncation is immaterial — the full merge pipeline is delivered well before the cut —
and its with-skill PASS is not truncated at all. Test 7's baseline likewise: the inverted
package name appears in the delivered text. Test 7's with-skill PASS (2026-08-28) is also truncated at ~11.9k chars, but the
`maplibre-gl-leaflet` name and the raster-only statement both appear well before the cut, and
the grader (which sees the full completion) scored "All assertions passed" — a truncated PASS
with the disqualifying-free content intact.

Five tests (1, 2, 4, 5, 6) pass in both directions: they confirm the skill does not regress
answers the model already gets right, and are not evidence of a gap being closed. Tests 3 and 7
pass only with the skill against a baseline FAIL — the two gaps this suite demonstrates closed.

## Note on the 2026-08-26 `maplibre-tile-hosting` baseline

The withdrawn `maplibre-tile-hosting` skill baselined 4/4 with no skill loaded. That result
shows the skill as written cleared no bar. It does not show that tile hosting has no gap —
the four questions asked were topic-level, and this suite's results split consistently by the
kind of knowledge asked for rather than by difficulty. Failures here cluster on specific
names, numeric defaults, and version boundaries; passes cluster on architectural judgment.
Re-probing hosting at the level of its primitives is tracked separately.
