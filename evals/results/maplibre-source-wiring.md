# Eval Results: maplibre-source-wiring

Canonical results table for this skill. Baseline is the same prompt with the skill omitted
(`--var injectSkill=false`). Tests that pass at baseline are summarized below the table rather
than listed: they are not evidence of a gap. See `evals/prompts/maplibre-source-wiring.yaml`.

Model `groq:openai/gpt-oss-120b` · judge `google:gemini-2.5-flash-lite` · `npm run eval:graded`.
Raw CSVs under [`latest/`](latest/), matching `maplibre-source-wiring-*`. Numbering follows the
current config; earlier CSVs use the numbering in force when they were written and are in run
order, so match rows by description, never by position.

| #   | Test                                                    | Type     | Baseline (no skill)                                                                   | With skill                                                          |
| --- | ------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Custom style layers invisible (`source-layer` mismatch) | Implicit | **FAIL**                                                                              | **PASS** — names the mismatch and the `vector_layers` lookup        |
| 4   | Unrelated question, expression syntax                   | Negative | PASS                                                                                  | not run                                                             |
| 5   | Naming published tile schemas and their doc URLs        | Explicit | **FAIL** — names OpenMapTiles only; substitutes other schemas and a doubtful citation | **PASS** — all three schemas with layer-list URLs                   |
| 7   | Raster `tileSize` defaults to 512, OSM tiles are 256    | Implicit | **FAIL**                                                                              | **PASS** — requires `tileSize: 256`, explains the wrong zoom effect |
| 12  | `setFeatureState` is silent without a feature `id`      | Implicit | **FAIL** — gives `generateId`, never names `promoteId`                                | **PASS** — names `promoteId` and why `generateId` is wrong here     |

**Result: the launch bar is cleared. `status: verified`.** Four gaps demonstrated closed, none
open. Seven further tests (2, 3, 6, 8–11) pass at baseline and have no with-skill run; they are
not gap evidence, and a sweep to confirm the skill does not regress them is worth doing but is
not part of the bar.

## Candidates rejected at baseline

Drafted, baselined before any skill content was written, and dropped because the model already
answers them unaided. Recorded so nobody re-proposes them:

- **gdal2tiles output is TMS while MapLibre defaults to XYZ.** Baseline PASS at `1.00` — names
  the scheme mismatch, `scheme: "tms"`, and gdal2tiles' `--xyz` flag.
- **Leaflet's `{s}` subdomain placeholder.** No verdict (judge returned 503), but the raw
  baseline completion already states MapLibre does not substitute `{s}` and gives the
  multiple-URL fix. Dropped as a near-certain non-gap rather than re-run.
- **Four source-identification tests (8–11)**, which remain in the config as baseline passes.
  Their original evidence was a _program's_ misclassification — a regex scored 0/12 on these
  inputs while the model answers them unaided. A failure captured from a program is not evidence
  of a model gap.

## Tests removed

- **A `raster-dem` identification test.** It could not pass in either direction: both runs
  scored `0.50` on `Expected output to not contain "raster-dem"` while the `llm-rubric` passed
  both times. The tripwire contradicted the rubric beside it, which required the answer to
  identify the source as `raster` and _not_ `raster-dem`. Removing it discards no evidence.
  Capturing the real failure mode — reading an endpoint's name as evidence of its encoding —
  needs an assertion `not-icontains` cannot express.
- **The no-text-labels test**, on ownership: it graded the GL JS ≥ 5.11.0 local-font fallback,
  which `maplibre-fonts-glyphs` already tests directly. It was also failing when removed, having
  graded both ways against identical skill content on consecutive days. Source-wiring keeps the
  symptom-to-cause routing and points at `maplibre-fonts-glyphs` for the mechanism; that routing
  is now untested here.

## Test 5: two blemishes the rubric does not reach

All three primary URLs were checked before recording and resolve `200`, no schema name is
fabricated, and the rubric asks for two schemas and one real URL — so the PASS is sound. Two
flaws no clause covers: a secondary Shortbread `/layers` link that `404`s (the real page is
`/schema/`), and an aside claiming `tiles.openstreetmap.org` "almost always means OpenMapTiles"
— it serves raster OpenStreetMap Carto.

## Truncation

Groq truncates mid-sentence at roughly 11,900 characters — a property of the provider pin, not
of these tests (see `evals/prompts/lib/providers.yaml`). Baseline tests 1 and 3 are affected.
Test 1's FAIL is sound: the grader's objection is that `vector_layers` is never named, and it
appears nowhere in the completion, cut or uncut. Test 3 is a truncated PASS, the safe direction.
Every with-skill completion ends cleanly, well clear of the ceiling.
