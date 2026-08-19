# Eval Results: maplibre-fonts-glyphs

Canonical results table for this skill. One row per eval test; baseline is the model's
answer with the skill omitted (`--var injectSkill=false`), with-skill is the same prompt
with the skill injected. See `evals/prompts/maplibre-fonts-glyphs.yaml`.

Run: 2026-08-19 · model `groq:openai/gpt-oss-120b` · judge: manual (Claude Sonnet 5,
read by hand against each test's rubric). Not yet run on the pinned `cerebras:gpt-oss-120b`
provider — `CEREBRAS_API_KEY` returned 402 Payment Required in this environment.

| #   | Test                                               | Type         | Baseline (no skill)                                                                                                 | With skill                                                                           |
| --- | -------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Omitted `glyphs`, text renders in wrong font       | Explicit     | FAIL — invents a fictitious default glyphs URL, never mentions the 5.11.0 fallback                                  | PASS — correctly explains the GL JS ≥ 5.11.0 local-fonts fallback                    |
| 2   | Offline local fonts on MapLibre Native, not GL JS  | Implicit     | FAIL — never mentions `font-faces`; claims Native can't read local fonts at all                                     | PASS — recommends `font-faces` (Android ≥ 11.13.0) with local files + Unicode ranges |
| 3   | Porting a `font-faces` config from Native to GL JS | Anti-pattern | FAIL — correctly says "no" but recommends generating glyph-PBFs, not the omit-`glyphs` fallback the rubric requires | PASS — says no, cites `gl-js#6637`, recommends the omit-`glyphs` fallback            |
| 4   | Hillshade/terrain — out of scope                   | Negative     | PASS                                                                                                                | PASS                                                                                 |

**Result: baseline 3 FAIL + 1 correct negative / with-skill 4/4 PASS.** Status kept
`provisional` pending a run on the pinned provider.
