# Eval Results: maplibre-fonts-glyphs

Canonical results table for this skill. One row per eval test; baseline is the model's
answer with the skill omitted (`--var injectSkill=false`), with-skill is the same prompt
with the skill injected. See `evals/prompts/maplibre-fonts-glyphs.yaml`.

Run: 2026-09-07 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` (`npm run eval:graded`, with-skill only). Raw CSV: [`maplibre-fonts-glyphs-with-skill_2026-09-07.csv`](latest/maplibre-fonts-glyphs-with-skill_2026-09-07.csv). First run with the generator's reasoning excluded from the graded output (`showThinking: false`), so every assertion sees the answer only. The with-skill column is this run; the baseline column is still the 2026-08-20 measurement.

Previous run: 2026-08-20 · same model and judge (`npm run eval:graded`, automated). Raw CSVs: [`maplibre-fonts-glyphs-with-skill_2026-08-20.csv`](latest/maplibre-fonts-glyphs-with-skill_2026-08-20.csv), [`maplibre-fonts-glyphs-baseline_2026-08-20.csv`](latest/maplibre-fonts-glyphs-baseline_2026-08-20.csv). Supersedes the 2026-08-19 manually-graded run.

| #   | Test                                               | Type         | Baseline (no skill)                                                                                                 | With skill                                                                           |
| --- | -------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Omitted `glyphs`, text renders in wrong font       | Explicit     | FAIL — invents a fictitious default glyphs URL, never mentions the 5.11.0 fallback                                  | PASS — correctly explains the GL JS ≥ 5.11.0 local-fonts fallback                    |
| 2   | Offline local fonts on MapLibre Native, not GL JS  | Implicit     | FAIL — never mentions `font-faces`; claims Native can't read local fonts at all                                     | PASS — recommends `font-faces` (Android ≥ 11.13.0) with local files + Unicode ranges |
| 3   | Porting a `font-faces` config from Native to GL JS | Anti-pattern | FAIL — correctly says "no" but recommends generating glyph-PBFs, not the omit-`glyphs` fallback the rubric requires | PASS — says no, cites `gl-js#6637`, recommends the omit-`glyphs` fallback            |
| 4   | Hillshade/terrain — out of scope                   | Negative     | PASS                                                                                                                | FAIL\* — substance on-topic, `llm-rubric` passed; one `glyphs` aside in the answer   |

\* On the 2026-08-20 and 2026-09-06 runs, test 4's `not-icontains: glyphs` tripwire matched the skill's own name inside the reasoning Promptfoo prepended to the output, not anything in the answer. That is resolved: since this run the generator's reasoning is excluded (`showThinking: false`), so the assertion grades the answer.

The assertion still fails on 2026-09-07, now on the answer itself: one line of a tuning table tells the reader to update the style's `glyphs`/`sprite` URLs when switching to 512 px DEM tiles. Everything else in the answer is hillshade, and the paired `llm-rubric` passes (Score 0.50: one of two assertions). That single aside is mild over-application, and it is the kind of thing the tripwire exists to catch. Left as-is per repo policy against weakening assertions to pass.

**Result: baseline 3 FAIL + 1 correct negative / with-skill 3/4 PASS; the negative fails on a single `glyphs`/`sprite` aside in an otherwise on-topic answer, so `status: provisional` stands until the skill stops volunteering font configuration on terrain questions.**
