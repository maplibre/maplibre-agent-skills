# Eval Results: maplibre-fonts-glyphs

Canonical results table for this skill. One row per eval test; baseline is the model's
answer with the skill omitted (`--var injectSkill=false`), with-skill is the same prompt
with the skill injected. See `evals/prompts/maplibre-fonts-glyphs.yaml`.

Run: 2026-10-26 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`, three runs per test each way. With skill: the [full config](latest/maplibre-fonts-glyphs-with-skill_2026-10-26.csv), then [tests 4 to 6](latest/maplibre-fonts-glyphs-with-skill-tests-4-6_2026-10-26.csv) and [test 6 three more times](latest/maplibre-fonts-glyphs-with-skill-test6-repeat_2026-10-26.csv) after the skill's scope line gained `font-faces`; a re-run of tests 1 to 3 on that final text stopped at the generator's daily token limit. Baseline: [tests 3 to 5](latest/maplibre-fonts-glyphs-baseline-tests-3-4-5_2026-10-26.csv), [test 5 with its `6.15` check](latest/maplibre-fonts-glyphs-baseline-devanagari_2026-10-26.csv), and tests 1 and 2 from [2026-08-20](latest/maplibre-fonts-glyphs-baseline_2026-08-20.csv).

Run: 2026-10-26, on the final text with the judge `google:gemini-3.1-flash-lite` · all six tests once with the skill, then tests 1 to 3 twice more: every run passes ([all six](latest/maplibre-fonts-glyphs-with-skill-final_2026-10-26.csv), [tests 1 to 3](latest/maplibre-fonts-glyphs-with-skill-tests-1-3_2026-10-26.csv)).

| #   | Test                                              | Type         | Baseline (no skill)                                                                                     | With skill                                                                                  |
| --- | ------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Omitted `glyphs`, text renders in wrong font      | Explicit     | FAIL — invents a fictitious default glyphs URL, never mentions the 5.11.0 fallback                      | PASS 3/3                                                                                    |
| 2   | Offline local fonts on MapLibre Native, not GL JS | Implicit     | FAIL — never mentions `font-faces`; claims Native can't read local fonts at all                         | PASS 3/3                                                                                    |
| 3   | Porting a Native `font-faces` config to GL JS     | Anti-pattern | FAIL 3/3 — says GL JS does not support `font-faces`                                                     | PASS 3/3 — yes on GL JS ≥ 6.7.0, with URLs the browser can fetch                            |
| 4   | Right-to-left Arabic and Hebrew on GL JS 6        | Explicit     | FAIL 3/3 — never names 6.9.0; sends the user to glyph servers for shaping                               | PASS 3/3                                                                                    |
| 5   | Devanagari labels drawn letter by letter          | Implicit     | FAIL 3/3 — no fix, or an invented "shaping" glyph server (the judge passed one before the `6.15` check) | PASS 3/3 — upgrade to 6.15.0, or pin the font with `font-faces`                             |
| 6   | Hillshade/terrain — out of scope                  | Negative     | PASS                                                                                                    | PASS 6/6 on the final text; 2/3 before, one answer adding `font-faces` for hillshade labels |

**Result: every targeting test fails at baseline and passes with the skill, and the negative holds. `status: verified`.**

One test 6 answer carries a code comment saying a raster-dem source "can contain multiple font stacks"; no assertion catches it.

The 2026-11-11 scheduled run failed test 1 once, on an answer that never named 5.11. Seven of the 25 answers on record named it past their 700th character or not at all, each opening with a paraphrase of the "`glyphs` omitted entirely" bullet, so that bullet now starts with the version. Test 1 then passed 12 of 12, each answer naming 5.11.0 in its first 115 characters ([CSV](latest/maplibre-fonts-glyphs-with-skill-test1-repeats_2026-11-11.csv)), and the full config passed 6 of 6 ([CSV](latest/maplibre-fonts-glyphs-with-skill_2026-11-11.csv)).
