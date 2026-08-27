# Eval Results: maplibre-tile-sources

Canonical results table for this skill. One row per eval test; baseline is the model's
answer with the skill omitted (`--var injectSkill=false`), with-skill is the same prompt
with the skill injected. See `evals/prompts/maplibre-tile-sources.yaml`.

Run: 2026-08-27 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite`
(`npm run eval:graded`, automated). Raw CSVs:
[`maplibre-tile-sources-baseline_2026-08-27.csv`](latest/maplibre-tile-sources-baseline_2026-08-27.csv),
[`maplibre-tile-sources-with-skill_2026-08-27.csv`](latest/maplibre-tile-sources-with-skill_2026-08-27.csv).

This is the first full run against the skill as narrowed to the source-selection question.
Tests 5–7 are new and had no prior baseline.

| #   | Test                                                  | Type         | Baseline (no skill)                                                                             | With skill                                                                             |
| --- | ----------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | GeoJSON vs. tiles for 8,000 trail segments            | Explicit     | PASS                                                                                            | PASS                                                                                   |
| 2   | Dataset outgrew GeoJSON, user never says tiles        | Implicit     | PASS                                                                                            | PASS                                                                                   |
| 3   | Merging basemap and application data into one tileset | Anti-pattern | **FAIL** — supplies the merge pipeline without pushing back on the premise                      | **FAIL** — supplies the pipeline again; the skill's guidance did not change the answer |
| 4   | Small dataset, no tile server needed                  | Negative     | PASS                                                                                            | PASS                                                                                   |
| 5   | Georeferencing a scanned map image                    | Implicit     | PASS                                                                                            | PASS                                                                                   |
| 6   | Vector tiles for a restylable basemap                 | Explicit     | PASS                                                                                            | PASS                                                                                   |
| 7   | Leaflet cannot render vector tiles natively           | Implicit     | **FAIL** — recommends Leaflet.VectorGrid, and inverts the package name to `leaflet-maplibre-gl` | **ERROR** — no result; Groq returned HTTP 429 before the model answered                |

**Result: the launch bar is not cleared. `status: provisional`.**

Two tests fail at baseline, which is what the skill exists to fix. Neither is demonstrated
fixed:

- **Test 3 fails in both directions.** The skill states the principle plainly — a style holds
  any number of sources, the basemap supplies context while your own source supplies your
  data, and merging means regenerating the whole tileset whenever your data changes — and the
  model still answers the question as asked and supplies the merge pipeline. This reads as a
  behavioral failure rather than a knowledge one: the user asked _how to merge_, and stating
  a principle in prose does not overcome the pull to comply with the premise. Closing it
  likely needs the skill to say what to do when asked for this, not only what is true. Filed
  rather than patched at the end of a session.
- **Test 7 has no with-skill data.** The baseline failure is real: the answer names
  Leaflet.VectorGrid as a way to consume vector tiles in Leaflet, and gives the integration
  package as `leaflet-maplibre-gl` — the correct name, `maplibre-gl-leaflet`, inverted. A
  plausible-looking wrong package name is the failure mode the `icontains` tripwire exists to
  catch, and an `llm-rubric` alone would likely have scored the answer as broadly correct. The
  with-skill call was rate-limited, so no claim is made about whether the skill closes it.

## Truncation

Groq truncates completions mid-sentence at roughly 11,900 characters, and six of the seven
baseline rows and three of the six with-skill rows here are affected. This is a property of the
provider pin, not of these tests: the ceiling is the same at `max_tokens: 8192` and at `4096`
(see `evals/prompts/lib/providers.yaml`).

Every FAIL above was checked against its raw completion before being recorded. Test 3's
truncation is immaterial — the full merge pipeline is delivered well before the cut, in both
directions. Test 7's likewise: the inverted package name appears in the delivered text.

The five passing tests pass in both directions. They confirm the skill does not regress
answers the model already gets right, and they are not evidence of a gap being closed.

## Note on the 2026-08-26 `maplibre-tile-hosting` baseline

The withdrawn `maplibre-tile-hosting` skill baselined 4/4 with no skill loaded. That result
shows the skill as written cleared no bar. It does not show that tile hosting has no gap —
the four questions asked were topic-level, and this suite's results split consistently by the
kind of knowledge asked for rather than by difficulty. Failures here cluster on specific
names, numeric defaults, and version boundaries; passes cluster on architectural judgment.
Re-probing hosting at the level of its primitives is tracked separately.
