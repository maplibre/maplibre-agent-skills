# Eval Results: maplibre-sprites-icons

Canonical results table for this skill. One row per eval test; baseline is the model's answer with the skill omitted (`--var injectSkill=false`), with-skill is the same prompt with the skill injected. See `evals/prompts/maplibre-sprites-icons.yaml`.

Run: 2026-09-09 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs: [`maplibre-sprites-icons-baseline_2026-09-09.csv`](latest/maplibre-sprites-icons-baseline_2026-09-09.csv), [`maplibre-sprites-icons-with-skill_2026-09-09.csv`](latest/maplibre-sprites-icons-with-skill_2026-09-09.csv). First run for this skill, which was extracted from `maplibre-cartography` (issue #68).

| #   | Test                                            | Type         | Baseline (no skill)                                                                                  | With skill                                                                                        |
| --- | ----------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Route shields on the open OpenMapTiles stack    | Explicit     | **FAIL** — invents a `road-shield-us-interstate` scheme and never produces `ref_length`              | **PASS** — `us-interstate_N` / `{network}_{ref_length}`, missing icon silently omitted            |
| 2   | Own icon sheet alongside the basemap provider's | Implicit     | **FAIL** — "MapLibre can only use one sprite sheet per style"; offers merging and `addImage` instead | **PASS** — the `{id, url}` array form, `default`, the `my-icons:cafe` prefix, unique ids          |
| 3   | Shield detection that ignores `icon-text-fit`   | Anti-pattern | **FAIL** — rejects the bad heuristic but ranks sprite-name and `{ref}` cues above `icon-text-fit`    | **PASS** — `icon-text-fit` other than `none` as the definitional property, with the default noted |
| 4   | Draggable `Marker` with a popup (out of scope)  | Negative     | PASS                                                                                                 | PASS — `Marker({draggable: true})` + `Popup`, no detour into sprites                              |

**Result: baseline 3 FAIL + 1 correct negative / with-skill 4/4 PASS. The launch bar is cleared; `status: verified`.** Three gaps demonstrated closed, none open; the negative holds in both directions.

## Tests 2 and 3 arrive with prior baseline evidence

Both claims were first measured on 2026-08-28, while they still lived on a `maplibre-cartography` branch, and both failed at baseline then for the same reasons they fail here: the model asserted that a style declares exactly one sprite and never mentioned the `id:image` prefix, and it demoted `icon-text-fit` to one cue among many. That run is not promoted here — the 2026-09-09 baseline above supersedes it and grades the same prompts against the config as committed.

## Test 3's rubric was tightened before this run

On a first baseline pass this test passed, which the 2026-08-28 measurement had not. The raw completion showed why the pass was hollow: the answer named the sprite-name convention as "the **primary discriminator**" and filed `icon-text-fit` under "Fallback", while the `icontains: icon-text-fit` tripwire matched a table cell and the judge let the rest through. That is precisely the failure the 2026-08-28 judge had articulated ("it does not specifically identify `icon-text-fit` as the _definitional_ property").

The rubric now states that requirement explicitly and forbids promoting an `icon-image` name pattern, a `{ref}` token, an overlap flag, or a layer-id convention to primary discriminator. This is a strictly narrower rubric, not a weaker one, and the run above is against it: baseline fails, with-skill passes.

## Test 1 moved here from maplibre-cartography

Test 1 is the former explicit test of the `maplibre-cartography` suite, moved verbatim — prompt, the three deterministic tripwires, and rubric — along with the sprite and shield content it targets. Its earlier history, including what the `not-icontains: road_shield` tripwire caught that the rubric alone would not, is in [`maplibre-cartography.md`](maplibre-cartography.md).

## Truncation

Groq stops this model near 3,072 completion tokens (`finish_reason: length`). Three of the four with-skill completions hit it — test 2 inside a closing JSON example, test 3 inside a trailing comparison table, test 4 inside a code block — and no baseline completion did. In each case the graded substance was complete well before the cut.

One inaccuracy survives in a passing answer: with-skill test 1 lists `us-interstate_4` through `_6`, which the demotiles sheet does not carry (it has `_1`–`_3`; the openmaptiles.github.io sheet has `_1`–`_5`, both verified 2026-09-09). The skill itself does not enumerate those counts, and the answer's instruction — grep the sprite index for the keys before assuming they exist — is the correct one, so the assertions are unaffected.

## One copyedit postdates the with-skill run

After the with-skill run, one sentence in `## Runtime images with addImage` was reworded to drop two coined words that `cspell` rejected. No graded claim changed and no test targets that section.
