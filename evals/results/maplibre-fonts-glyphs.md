# Eval Results: maplibre-fonts-glyphs

Canonical results table for this skill. One row per eval test; baseline is the model's
answer with the skill omitted (`--var injectSkill=false`), with-skill is the same prompt
with the skill injected. See `evals/prompts/maplibre-fonts-glyphs.yaml`.

Run: 2026-08-20 · model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite`
(`npm run eval:graded`, automated). Raw CSVs:
[`maplibre-fonts-glyphs-with-skill_2026-08-20.csv`](latest/maplibre-fonts-glyphs-with-skill_2026-08-20.csv),
[`maplibre-fonts-glyphs-baseline_2026-08-20.csv`](latest/maplibre-fonts-glyphs-baseline_2026-08-20.csv).
Supersedes the 2026-08-19 manually-graded run.

| #   | Test                                               | Type         | Baseline (no skill)                                                                                                 | With skill                                                                           |
| --- | -------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Omitted `glyphs`, text renders in wrong font       | Explicit     | FAIL — invents a fictitious default glyphs URL, never mentions the 5.11.0 fallback                                  | PASS — correctly explains the GL JS ≥ 5.11.0 local-fonts fallback                    |
| 2   | Offline local fonts on MapLibre Native, not GL JS  | Implicit     | FAIL — never mentions `font-faces`; claims Native can't read local fonts at all                                     | PASS — recommends `font-faces` (Android ≥ 11.13.0) with local files + Unicode ranges |
| 3   | Porting a `font-faces` config from Native to GL JS | Anti-pattern | FAIL — correctly says "no" but recommends generating glyph-PBFs, not the omit-`glyphs` fallback the rubric requires | PASS — says no, cites `gl-js#6637`, recommends the omit-`glyphs` fallback            |
| 4   | Hillshade/terrain — out of scope                   | Negative     | PASS                                                                                                                | FAIL\* — substance on-topic, `llm-rubric` passed                                     |

\* Test 4's `icontains: not 'glyphs'` tripwire false-positives on the model's own
chain-of-thought, which names the skill (`maplibre-fonts-**glyphs**`) while deciding
whether it applies. The hillshade answer itself never touches fonts — confirmed by
reading the raw completion, and by the paired `llm-rubric` assertion passing (Score
0.50: one of two assertions passed). The baseline run doesn't hit this, since it has
no skill name in context to reason about. This is a test-tripwire defect, not a skill
or model defect. Left as-is per repo policy against weakening assertions to pass;
flagging for a maintainer to reword the tripwire (e.g. scope it to the answer only, or
exclude the skill's own name).

**Result: baseline 3 FAIL + 1 correct negative / with-skill 3/4 clean PASS + 1 false-fail
tripwire (substance correct) — launch bar cleared.**
