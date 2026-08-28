# Eval Results: maplibre-terrain-patterns

Canonical results table for this skill. Baseline is the same prompt with the skill omitted (`--var injectSkill=false`). See `evals/prompts/maplibre-terrain-patterns.yaml`.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`. Raw CSVs under [`latest/`](latest/), matching `maplibre-terrain-patterns-*`. Re-run 2026-08-28 on the Groq pin, replacing the 2026-07-03 Cerebras run (#64).

| #   | Test                                             | Type         | Baseline (no skill)                                                                         | With skill                                                                                                       |
| --- | ------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Client-side hypsometric tint                     | Explicit     | **FAIL** — a `raster` layer with invented `raster-color` / `raster-value`                   | **PASS** on substance — `color-relief` + `color-relief-color` on `["elevation"]`; rubric call errored, see below |
| 2   | Runtime contour generation, off-the-shelf vs DIY | Implicit     | **FAIL** — `geotiff.js` → `marchingsquares` / `d3-contour` pipeline as the primary approach | not run — provider rejected the call, see below                                                                  |
| 3   | Stacking hillshade layers for soft shading       | Anti-pattern | **FAIL** — tunes six `hillshade-*` paint properties; never `hillshade-method`               | **PASS** — `hillshade-method: "multidirectional"` (run 1); **FAIL** in run 3, see below                          |
| 4   | Out-of-scope vector tile source question         | Negative     | PASS                                                                                        | PASS                                                                                                             |

**Result: the baseline reproduces the Cerebras-era table exactly; the with-skill half is not reproducible on Groq's on-demand tier at this pin.** Two with-skill rows are sound, one is substantively right with an errored judge call, one never ran. `status: verified` was set on the Cerebras run and is left for a maintainer.

## With-skill runs on this tier

This skill has the largest `SKILL.md` in the collection (≈22.5K characters; ≈5,500 prompt tokens with the skill injected). Groq's on-demand tier enforces an 8,000 tokens-per-minute window (#63 describes the accounting) and reported these with-skill requests at 8,310–8,602 tokens. Three attempts, unmodified `npm run eval:graded` each time:

- **Run 1** (the recorded CSV): three of four calls through. Test 2 rejected, `413` "Requested 8579 … Limit 8000".
- **Run 2**: every call rejected — `413` ×10 and `429` ×16 in two minutes, then Promptfoo's 300 s queue timeout on all four.
- **Run 3**: only test 3 through, and that answer failed the rubric at 0.50. It leads with `hillshade-method: "multidirectional"` (the tripwire passes) and then adds an optional "stack two hillshade layers" section, which the rubric forbids endorsing. Run 1's answer never offered it. The with-skill verdict on test 3 is not stable at `temperature: 0`.

Test 1's rubric failure in run 1 is separate: Gemini returned non-JSON ("Could not extract JSON from llm-rubric response"). The `color-relief` tripwire passed and the completion is a correct `color-relief` answer; it is reported as a substantive pass, not re-graded by hand.

The levers are a maintainer call: a paid Groq tier, a shorter system prompt for this skill, or a lower `max_tokens`. Every `length` stop today, at 8192 and at 4096, was exactly 3,072 completion tokens, so anything above that buys reservation and nothing else.

## Truncation

The baseline FAILs are content misses present in the delivered text: test 1 names its invented properties up front, test 2's library list is `geotiff.js`, `marchingsquares`, `d3-contour`, and test 3 never mentions `hillshade-method` in 11K characters.
