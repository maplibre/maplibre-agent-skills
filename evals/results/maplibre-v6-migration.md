# Eval Results: maplibre-v6-migration

Canonical results table for this skill. One row per eval test: baseline is the model's
answer with the skill omitted (`--var injectSkill=false`), with-skill is the same
prompt with it injected. See `evals/prompts/maplibre-v6-migration.yaml`.

Run: 2026-08-21 (tests 1-5, 7), 2026-08-24 (test 6), 2026-08-25 (test 8) · model
`groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `--delay 20000`
(vs. `eval:graded`'s pinned `8000` — the full `SKILL.md` triples per-call tokens,
pushing Groq's TPM cap into timeouts at the pinned delay). Test 7's with-skill
grading hit a Gemini rate limit instead of a verdict; hand-confirmed PASS from the
raw completion. Test 8 ran filtered (`--filter-pattern`), not full-suite — one new
test doesn't need the other seven re-run. Test 8's raw CSVs:
[with-skill](latest/maplibre-v6-migration-setworkerurl-with-skill_2026-08-25.csv),
[baseline](latest/maplibre-v6-migration-setworkerurl-baseline_2026-08-25.csv).

Test 1 re-run 2026-10-22, three runs each way, after its rubric took over the `/dist/maplibre-gl.js` check from a tripwire the skill's own v5 example matched: with skill 3/3 PASS, baseline 3/3 FAIL. Raw CSVs: [with-skill](latest/maplibre-v6-migration-with-skill-test1_2026-10-22.csv), [baseline](latest/maplibre-v6-migration-baseline-test1_2026-10-22.csv).

| #   | Test                                            | Type         | Baseline (no skill)                                           | With skill                                                            |
| --- | ----------------------------------------------- | ------------ | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | CDN script tag, no bundler (ESM-only)           | Explicit     | FAIL — loads the dead v5 UMD bundle via `<script src>`        | PASS — `<script type="module">` against the `.mjs` build, pinned      |
| 2   | Convert a Mapbox import (default export gone)   | Implicit     | FAIL — carries the Mapbox default-import shape over unchanged | PASS — named/namespace import, no default import                      |
| 3   | Write a CommonJS script (require() unsupported) | Anti-pattern | FAIL — presents `require('maplibre-gl')` as working           | PASS — names `ERR_PACKAGE_PATH_NOT_EXPORTED`, uses dynamic `import()` |
| 4   | Dynamically supply a missing sprite icon        | Explicit     | FAIL — v5 `styleimagemissing` + `addImage()`, no caveat       | PASS — `map.setMissingStyleImageResolver()`, notes v5 pattern is dead |
| 5   | Read camera state + projection matrix           | Implicit     | FAIL — reads the internal `map.transform` directly            | PASS — public getters, matrix scoped to custom layer render           |
| 6   | Type-safe handler for the `data` event          | Implicit     | FAIL — imports `MapDataEvent` as a current type (¹)           | PASS — imports `MapSourceDataEvent`/`MapStyleDataEvent`               |
| 7   | Add a PMTiles vector source (unrelated to v6)   | Negative     | PASS                                                          | PASS (²)                                                              |
| 8   | Set up MapLibre in a Vite + TypeScript app      | Explicit     | FAIL — "no worker needed"; never calls `setWorkerUrl()`       | PASS — calls `setWorkerUrl()` before `Map`, via Vite's `?worker&url`  |

**Result: baseline 7 FAIL + 1 correct negative; with-skill 8/8 PASS — launch bar cleared.**

### Scope: how these seven patterns were chosen

Before any skill content existed, a `fail^5` sweep (12 phrasings, five runs each, no
skill) baseline-tested six candidate v6 breaking changes from the migration guide.
Five failed consistently and became this skill's first five sections:

- ESM-only build, UMD/CSP bundle removed (test 1)
- Default export removed (test 2)
- CommonJS `require()` unsupported (test 3)
- `styleimagemissing` no longer resolves via `addImage()` (test 4)
- `map.transform` removed (test 5)

Three candidates cleared the sweep and were cut, per this repo's "target a
demonstrated gap" rule — the model already answers them correctly unprompted:

- Nested GeoJSON properties (already read as objects, not JSON strings)
- "Why does `require()` throw" as a standalone question (only test 3's "write me a
  working script" phrasing trips the model up, not the explanation)
- `GeoJSONSource.setData()`'s dropped second parameter and return value (cut in a
  later scoping probe)

The sixth section (`MapDataEvent`, test 6) wasn't part of that sweep. It surfaced
later (2026-08-24) testing against other v6 breaking changes and was hand-confirmed.

The seventh section, bundler `setWorkerUrl()` (test 8), came from this skill's
originating v6 audit (`fix/v6-audit-confirmed-defects`), which flagged it as a
genuine coverage gap deferred here but never followed up until now. Confirmed with a
single hand check: the baseline's own reasoning states "MapLibre uses WebGL, no
worker needed" — wrong in exactly the way the skill corrects — tracing to the
official [install guide](https://maplibre.org/maplibre-gl-js/docs/)'s per-bundler
`setWorkerUrl()` requirement.

¹ The baseline's deterministic regex tallied 3/5 fail, missing TypeScript's
`import type { ... }` form. Both nominal "pass" rows actually wrote
`import type { Map, MapDataEvent }` and called it "the exact event type MapLibre GL
JS ships" — the same defect, just past the regex. Effectively fail⁵, corrected here;
the shipped test uses an `llm-rubric` instead.

² Gemini's grader hit `RateLimitExhaustedError` after 4 retries here (the other six
graded cleanly). The raw completion answers the PMTiles question directly.
