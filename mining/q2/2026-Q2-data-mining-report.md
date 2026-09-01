# Q2 2026 MapLibre Data Mining Report

See the consolidated [Q2 2026 mining](./README.md) and the [Q2 2026 strategy](./2026-Q2-strategy.md) for the full archive.

**Status:** In progress — Slack data pending manual query  
**Sources:** [Discussion #33](https://github.com/maplibre/maplibre-agent-skills/discussions/33) · [Discussion #34](https://github.com/maplibre/maplibre-agent-skills/discussions/34)  
**Last updated:** May 11, 2026  
**GitHub queries run:** May 11, 2026 via GitHub REST API (unauthenticated)  
**SO queries run:** May 11, 2026 via Stack Exchange API v2.3

---

## 1. Overview

This document is the working output of the Q2 2026 MapLibre issue mining run. It implements the dual-lens methodology described in Discussion #34, running two simultaneous extraction passes over every source:

- **Developer intent lens** — what was the person trying to _build or accomplish_? (feeds the GL JS example taxonomy, [#7576](https://github.com/maplibre/maplibre-gl-js/issues/7576))
- **AI failure lens** — is there evidence AI was involved and gave a wrong or incomplete answer? (feeds the skills backlog and eval prompts, [maplibre-agent-skills](https://github.com/maplibre/maplibre-agent-skills))

The mining run supersedes the Q1 2026 run. All Q1 keyword queries are re-run to establish Q2 volume baselines. New queries are marked **[NEW]**.

### What this report informs

| Output                                    | Downstream project                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Developer intent clusters (ranked)        | Example taxonomy — [gl-js #7576](https://github.com/maplibre/maplibre-gl-js/issues/7576)            |
| Confirmed gaps (surface column populated) | Example curation — [gl-js #7574](https://github.com/maplibre/maplibre-gl-js/issues/7574)            |
| AI failure threads + eval prompts         | Skills backlog + evals — [maplibre-agent-skills](https://github.com/maplibre/maplibre-agent-skills) |
| Updated priority ranking                  | Skills backlog — Q1 rankings revised with Q2 volumes                                                |

---

## 2. Key Findings

_Written after query run. Findings are observations, not conclusions — the mining output table in Section 10 is the primary record._

### 2.1 Volume shifts from Q1

The most significant changes from Q1 to Q2 reflect both organic growth and the removal of the Q1 ceiling (many Q1 queries maxed at 50):

**Largest absolute volumes (gl-js):** Mapbox (1,862), example (1,443), TypeScript (1,149), performance (584), terrain (503), GeoJSON (453), expression (428), worker (436) — these dominate by raw count.

**Sharpest growth rates (Q1 → Q2):**

- heatmap: 22 → 135 (6×)
- fill-extrusion: 33 → 151 (5×)
- terrain: 50 → 503 (10×, though Q1 was likely already above the ceiling)
- sprite: 40 → 116 (3×)
- popup: 37 → 154 (4×)

**Key new finds:**

- **TypeScript at 1,149** was not queried in Q1 and is now the third-largest topic on gl-js after `Mapbox` and `example`. This is the strongest signal that TypeScript setup and typing questions are a major undocumented developer need — a clear guide gap.
- **`example` at 1,443** — developers opening issues specifically requesting examples — is the highest-volume new query. This directly validates the example curation work (#7574) and confirms that developer demand for examples is actively outpacing supply.
- **`migration` at 190** — separate from the 1,862 `Mapbox` issues — confirms the Mapbox→MapLibre migration path is a sustained concern warranting dedicated guide coverage.
- **`globe` at 293** — substantially higher than the ~10 existing globe/atmosphere examples would predict. Globe may be under-served relative to its demand signal.
- **`feature-state` at 168 on gl-js + 18 on style-spec** (total 186 cross-repo) — this confirms the "feature-state" gap identified in the preliminary analysis is real and significant. Currently no dedicated guide or example.
- **`accessibility` at 67** — non-trivial volume for a topic with zero existing coverage.
- **`animation` at 132** — supports treating animation as a meaningful cross-cutting tag rather than a minor concern.

### 2.2 AI failure signals

**Behavioral signals (gl-js):**

- "nothing works": 9 threads — conservative inferred signal
- "tried everything": 5 threads — conservative inferred signal
- "spent hours": 4 threads — conservative inferred signal
- `accessToken` in gl-js: 14 — anachronistic Mapbox-only API appearing in gl-js issues; each is a candidate for `inferred` AI failure classification
- `setWellKnownTileServer` in gl-js: 0 — not appearing in gl-js issues (correct: it's a Native/RN concept)

**Anachronistic API in react-native:**

- `styleURL`: 25 issues — this is a renamed/removed prop; 25 is non-trivial and each is a candidate for `inferred` AI failure
- `setWellKnownTileServer`: 0 in the react-native repo (may appear in issue bodies rather than searchable text)
- `accessToken`: 1 in react-native

**AI mentions (org-wide, all repos):**

| Term           | Count | Note                                                                                       |
| -------------- | ----- | ------------------------------------------------------------------------------------------ |
| Copilot        | 1,209 | Inflated — includes GitHub Copilot feature/integration discussions; needs manual filtering |
| Claude         | 163   | Strong signal; likely genuine AI-assistance mentions                                       |
| language model | 69    | Good signal — developers describing AI-generated code                                      |
| ChatGPT        | 44    | Genuine; lower than expected given ChatGPT's prevalence                                    |
| AI said        | 17    | Explicit attribution phrases                                                               |
| Gemini         | 11    |                                                                                            |
| asked AI       | 9     |                                                                                            |
| hallucin       | 0     | Developers don't use this word in issue reports                                            |

The `Claude` count (163) being higher than `ChatGPT` (44) org-wide is notable. Both should be investigated for failure threads. `language model` at 69 is a useful behavioral signal: developers describing AI-generated code without naming the tool.

### 2.3 Cross-repo signals

| Repo                  | Query         | Count | Significance                                                                                                                                      |
| --------------------- | ------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| martin                | config        | 508   | Confirms martin configuration is a major friction point; validates guide gap for Martin/tile server integration                                   |
| maplibre-style-spec   | expression    | 264   | Expression complexity spans both the rendering engine and spec — combined with gl-js's 428, expressions are the single largest spec-level concern |
| maplibre-style-spec   | feature-state | 18    | Adds to gl-js's 168; confirms feature-state is a cross-repo issue                                                                                 |
| maplibre-native       | terrain       | 31    | Terrain is a concern on native platforms too, though lower volume                                                                                 |
| maplibre-react-native | v11           | 83    | v11 is already generating significant issues 24 days after release (April 17 → May 11)                                                            |
| maplibre-react-native | styleURL      | 25    | Anachronistic prop — strong AI failure signal                                                                                                     |

**The v11 signal is the most urgent finding in this run.** 83 issues in 24 days means v11 is generating issues at ~3.5/day. AI tools trained before the April 17 release will give wrong answers on all of them. This should be prioritized for skill content immediately.

### 2.4 Stack Overflow

**Total questions tagged `maplibre-gl`: 129**

SO volumes are lower than GitHub because SO's `maplibre-gl` tag is not consistently applied. The top-voted questions are the more actionable signal.

**Key SO question signals:**

| Votes | Views | Title                                                                                                  | Intent cluster         | AI failure?                                                                                                                   |
| ----- | ----- | ------------------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 7     | 1,384 | MapLibre GL JS with terrain layer: How to pin a horizontal plane to specific altitude?                 | Terrain and elevation  | No signal                                                                                                                     |
| 6     | 6,382 | How to use MapLibre GL Js in react native                                                              | Framework integration  | No signal                                                                                                                     |
| 6     | 2,289 | How do I use MapLibre-GL from TypeScript?                                                              | Map setup / TypeScript | No signal                                                                                                                     |
| 5     | 3,115 | How to show/hide labels according to zoom levels with expressions                                      | Layers / expressions   | No signal                                                                                                                     |
| 5     | 1,242 | text-field: use of text-field requires a style glyphs property                                         | Symbols / self-hosting | No signal                                                                                                                     |
| 4     | 7,739 | maplibre-gl-js: load offline (local) glyphs, sprites and mbtiles                                       | Self-hosting / offline | No signal — but title mentions "afraid of hallucinations" in body (see notes)                                                 |
| 4     | 5,219 | Load local .mbtiles with maplibre-gl-js                                                                | Sources / data loading | No signal                                                                                                                     |
| 4     | 2,892 | Expression to get value from nested objects                                                            | Expressions            | No signal                                                                                                                     |
| 3     | 2,806 | Mapbox warning setAccessToken requires setWellKnownTileServer for MapLibre Blank Screen - React Native | Framework integration  | **Inferred** — `setWellKnownTileServer` is a Mapbox-only API; its appearance signals AI-generated code trained on Mapbox docs |
| 3     | 1,963 | No labels on my map using MapLibre GL JS (serving tiles locally)                                       | Self-hosting / glyphs  | No signal                                                                                                                     |

**Highest-views SO question (7,739 views):** "maplibre-gl-js: load offline (local) glyphs, sprites and mbtiles" — the author explicitly stated in the body they avoided asking AI because they were "afraid of hallucinations." This is an exceptional data point: it's a _negative_ AI signal (developer chose not to use AI), which itself confirms this is a known AI-unreliable area.

**Notable newest questions (signals for emerging demand):**

- Camera resets on Android using maplibre in react native (v11-era issue)
- PMTiles Request aborted by Firefox (PMTiles/browser compatibility)
- MapLibre GL JS CSP version with Angular (framework integration gap)
- Svelte Maplibre Popup open issues (Svelte integration gap)
- `maplibre-gl-native` fails without error message on nodejs (native/non-browser gap)

### 2.5 Preliminary intent cluster validation

The Q2 volume data allows first-pass validation of the provisional example clusters from Discussion #34:

| Provisional group              | Supporting signals                                                                                   | Validation status                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Globe and atmosphere           | gl-js `globe`: 293 — substantially higher than ~10 examples suggests                                 | ✅ Under-served; globe demand signal exceeds example inventory              |
| Terrain and elevation          | gl-js `terrain`: 503; native `terrain`: 31; SO top question; highest-voted SO question about terrain | ✅ Confirmed highest-demand cluster                                         |
| 3D models and custom renderers | gl-js `3D`: 320                                                                                      | ✅ High volume — but overlap with terrain/globe needs intent disambiguation |
| Layers and visual styling      | expression: 428 + style-spec 264; filter: 284; fill-extrusion: 151                                   | ✅ Confirmed core cluster                                                   |
| Data visualization             | heatmap: 135 (6× growth); cluster: 62                                                                | ✅ heatmap growth is notable; separate from layers                          |
| Sources and data loading       | GeoJSON: 453; PMTiles: 41; MLT: 39                                                                   | ✅ High volume; PMTiles + MLT emerging alongside                            |
| Symbols, icons, and labels     | sprite: 116; glyph: 192; SO glyph question at 7,739 views                                            | ✅ Validate as **Category** — demand signal is strong enough                |
| Markers and popups             | marker: 275; popup: 154                                                                              | ✅ Confirmed; consolidation candidates still relevant                       |
| Camera and navigation          | flyTo: 66; fitBounds: 25                                                                             | ⚠️ Lower than expected — may be a tag rather than a category                |
| Interactivity and events       | queryRenderedFeatures: 66; filter: 284                                                               | ✅ filter is partially interactivity-driven                                 |
| Map setup and controls         | TypeScript: 1,149; worker: 436; performance: 584; example: 1,443                                     | ✅ TypeScript and setup are the biggest unmet needs                         |
| Animation                      | animation: 132                                                                                       | ✅ Sufficient for a cross-cutting tag                                       |
| Third-party integrations       | (not directly queried)                                                                               | ⚠️ Needs targeted query run                                                 |

**Revised taxonomy recommendation from Q2 data:**

- Promote **Symbols, icons, and labels** from "needs validation" to **Category** — the combined glyph + sprite signal and SO views are strong enough.
- Reconsider **Camera and navigation** — flyTo at 66 and fitBounds at 25 may not support a full tab; could be a tag or merged into Map Setup.
- **TypeScript / Map Setup** emerges as the most under-served category in terms of issue-to-example ratio.

---

## 3. Documentation Landscape

_From Discussion #33._

### 3.1 Platform and wrapper inventory

| Platform / wrapper                                | Official docs                                                     | Examples                                                                    | Status                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **MapLibre GL JS** (web, vanilla JS)              | `maplibre.org/maplibre-gl-js/docs/`                               | ~133 examples — primary scope of #7576 and #7574                            | Active                                                                                                                      |
| **MapLibre React Native**                         | `maplibre.org/maplibre-react-native/`                             | Full Docusaurus site: Setup, Guides, Components, Modules, Types             | Active — **v11 released April 17, 2026**; requires React Native's new architecture; API fully overhauled                    |
| **MapLibre Native (Android)**                     | `maplibre.org/maplibre-native/android/api/`                       | Separate MkDocs examples site at `android/examples/`, organized by category | Active                                                                                                                      |
| **MapLibre Native (iOS)**                         | `maplibre.org/maplibre-native/ios/latest/documentation/maplibre/` | DocC site integrating examples as articles alongside API reference          | Active                                                                                                                      |
| **react-map-gl** (`react-map-gl/maplibre` import) | `visgl.github.io/react-map-gl`                                    | Community wrapper; primary React web integration path for GL JS             | Active — consolidated source from archived `vis.gl/react-maplibre`                                                          |
| **vis.gl/react-maplibre**                         | Archived                                                          | Was a standalone React wrapper for `maplibre-gl`                            | **Archived January 29, 2025** — consolidated into `react-map-gl`; correct install is `npm install react-map-gl maplibre-gl` |

### 3.2 Native platform taxonomy comparison

| Category theme           | iOS (DocC articles)                                                      | Android (MkDocs examples)                             |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| Getting started          | Essentials (Getting Started, Add Marker)                                 | Quickstart, Configuration                             |
| Styling and data         | Styling and Dynamic Data (GeoJSON, vector tiles, PMTiles, animated line) | Styling, GeoJSON Source, Data (Vector Tiles, PMTiles) |
| Map interaction / camera | Map Interaction (gestures, annotations, fill extrusion)                  | Camera (animation types, bounds, zoom, gestures)      |
| Location                 | Features (User Location & Location Privacy)                              | LocationComponent                                     |
| Offline                  | Offline (Download Pack, Manage Regions)                                  | —                                                     |
| Observability            | Observability (low-level events, action journal)                         | Observability (action journal, observe map events)    |
| Advanced / snapshots     | Advanced (Metal API, plugin layers), Features (snapshots)                | Snapshotter                                           |
| Conceptual articles      | Other Articles (fonts, predicates, tile URL templates, style authoring)  | —                                                     |

### 3.3 Documentation surface scope

| Surface                          | Best for                                                                                                       | Not for                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **API Reference** (`/docs/API/`) | Method signatures, parameters, return types                                                                    | Not a gap-filling target                        |
| **Guides** (`/docs/guides/`)     | Installation/config, conceptual explanation, decision-making, troubleshooting without compelling visual output | Techniques with a clear interactive map outcome |
| **Examples** (`/docs/examples/`) | Techniques with a clear map outcome; API patterns that benefit from a live, runnable result; discovery         | Configuration or setup with no visual component |

---

## 4. Confirmed Gaps (updated with Q2 evidence)

| Gap                                               | Surface | Q2 evidence                                                            | Rationale                                                                                 |
| ------------------------------------------------- | ------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **TypeScript setup and typing**                   | Guide   | gl-js `TypeScript`: 1,149; SO question at 2,289 views                  | Third-largest topic on gl-js; no guide exists; clear setup/config concern → guide only    |
| **Bundler/worker setup (Vite, Webpack, esbuild)** | Guide   | gl-js `worker`: 436; behavioral signal (Q1)                            | First thing new developers hit before rendering a map; setup prose, no visual outcome     |
| **Style switching at runtime**                    | Example | Identified in #7574                                                    | Visual demonstration of behavior                                                          |
| **Feature state**                                 | Both    | gl-js `feature-state`: 168; style-spec: 18; total 186 cross-repo       | Concept explanation → guide; implementation demo → example                                |
| **Offline / service worker tile caching**         | Both    | SO: offline glyphs question at 7,739 views; PMTiles example exists     | Architecture explanation → guide; implementation demo → example                           |
| **Accessibility**                                 | Both    | gl-js `accessibility`: 67; zero coverage across all surfaces           | Principles → guide; implementation demo → example                                         |
| **Self-hosting glyphs and sprites**               | Guide   | SO question at 7,739 views + 1,963 views; author explicitly avoided AI | Server/file configuration; example shows resulting map but can't demonstrate server setup |
| **Martin / tile server integration**              | Guide   | martin `config`: 508                                                   | Configuration and deployment; no visual component from the GL JS side                     |
| **Mapbox → MapLibre migration**                   | Guide   | gl-js `migration`: 190; gl-js `Mapbox`: 1,862                          | Sustained migration concern distinct from general Mapbox confusion; needs dedicated guide |

---

## 5. Mining Methodology Summary

### 5.1 Dual-lens design

Every mined item produces three fields:

| Field                | Question                                                  | Feeds                        |
| -------------------- | --------------------------------------------------------- | ---------------------------- |
| **Developer intent** | What was the person trying to build or do?                | Example taxonomy             |
| **API / concept**    | What technical area or API?                               | Skills backlog               |
| **AI failure**       | `explicit` / `inferred` / `no signal` + brief description | Skills content, eval prompts |

### 5.2 AI failure classification

| Classification | Meaning                                                                               |
| -------------- | ------------------------------------------------------------------------------------- |
| `explicit`     | Developer names an AI tool (ChatGPT, Claude, Copilot, Gemini, etc.)                   |
| `inferred`     | Anachronistic API, friction language, hallucination-shaped code, elaborate workaround |
| `no signal`    | No evidence either way                                                                |

### 5.3 Hallucination fingerprints to flag proactively

- Code calling **non-existent MapLibre methods**
- **Anachronistic APIs**: `setWellKnownTileServer`, `accessToken` (Mapbox-only); `styleURL` (old RN/Mapbox prop)
- Correct-sounding but **wrong parameter types**
- **Elaborate workarounds** for problems with simple documented solutions
- `addLayer` + `before` combined with wrong layer type

---

## 6. Preliminary Example Inventory

_~133 examples as of Q2 2026. Clusters are provisional — Q2 mining validates and refines, does not confirm._

### 6.1 Provisional clusters with Q2 validation

| Provisional group              | Est. count | Q2 issue volume (gl-js)                           | Validation                                                         |
| ------------------------------ | ---------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Globe and atmosphere           | ~10        | globe: 293                                        | ✅ Under-served — demand >> example count                          |
| Terrain and elevation          | ~8         | terrain: 503                                      | ✅ Highest-demand cluster confirmed                                |
| 3D models and custom renderers | ~8         | 3D: 320                                           | ✅ High; overlaps globe/terrain                                    |
| Layers and visual styling      | ~15        | expression: 428; filter: 284; fill-extrusion: 151 | ✅ Core cluster, high volume                                       |
| Data visualization             | ~8         | heatmap: 135; cluster: 62                         | ✅ heatmap 6× growth — strong demand                               |
| Sources and data loading       | ~10        | GeoJSON: 453; PMTiles: 41; MLT: 39                | ✅ High volume; MLT emerging                                       |
| Symbols, icons, and labels     | ~15        | sprite: 116; glyph: 192                           | ✅ **Promote to Category** — demand signal strong                  |
| Markers and popups             | ~8         | marker: 275; popup: 154                           | ✅ High; consolidation candidates                                  |
| Camera and navigation          | ~12        | flyTo: 66; fitBounds: 25                          | ⚠️ Lower than expected; may merge into Map Setup                   |
| Interactivity and events       | ~12        | queryRenderedFeatures: 66                         | ✅ Underestimated by keyword — filter (284) partially belongs here |
| Map setup and controls         | ~10        | TypeScript: 1,149; worker: 436; performance: 584  | ✅ **Most under-served** category by issue:example ratio           |
| Animation                      | ~8         | animation: 132                                    | ✅ Cross-cutting tag                                               |
| Third-party integrations       | ~8         | (not queried)                                     | ⚠️ Needs targeted run                                              |

### 6.2 Provisional category vs. tag split

| Provisional cluster            | Likely role                | Rationale                                                             |
| ------------------------------ | -------------------------- | --------------------------------------------------------------------- |
| Map setup and controls         | **Category**               | Foundational; biggest unmet need (TypeScript, bundler, worker)        |
| Layers and visual styling      | **Category**               | Core capability, highest volume                                       |
| Sources and data loading       | **Category**               | Foundational, high volume                                             |
| Symbols, icons, and labels     | **Category** (promoted Q2) | Strong glyph + sprite signal; 7,739-view SO question                  |
| Data visualization             | **Category**               | Distinct from general layers; heatmap growth notable                  |
| Markers, popups, and UI        | **Category**               | High demand; distinct from interactivity                              |
| Interactivity and events       | **Category**               | High volume, clear developer goal                                     |
| Terrain and elevation          | **Category**               | Confirmed highest-demand cluster                                      |
| Globe and atmosphere           | **Tag**                    | Globe demand spans terrain/layers/viz; under-served but cross-cutting |
| 3D models and custom renderers | **Tag**                    | Sub-concern of terrain/layers; `three.js`, `custom-renderer` as tags  |
| Camera and navigation          | **Tag** (reconsidered Q2)  | flyTo + fitBounds volumes don't support a full tab; cross-cutting     |
| Animation                      | **Tag**                    | Cuts across camera, markers, data viz                                 |
| Third-party integrations       | **Tag**                    | Examples also belong to other categories                              |

**Target: 7–8 categories post-consolidation** (reduced from the Q1 estimate of 6–10 after Camera is reclassified).

---

## 7. Q2 GitHub Query Results

### 7.1 Core keyword queries — gl-js

| Query                 | Q1 volume     | Q2 volume | Change | Notes                                                      |
| --------------------- | ------------- | --------- | ------ | ---------------------------------------------------------- |
| React                 | 50+ (ceiling) | 374       | —      | React framework demand remains largest framework concern   |
| glyph                 | 50+           | 192       | —      | Combined with sprite: 308 total glyph/sprite issues        |
| filter                | 50+           | 284       | —      | Spans interactivity and expressions                        |
| expression            | 50+           | 428       | —      | Core concern; + 264 in style-spec = 692 cross-repo         |
| GeoJSON               | 50+           | 453       | —      | Sources & data loading primary concern                     |
| Mapbox                | 50+           | 1,862     | —      | Migration friction still dominant                          |
| worker                | 50+           | 436       | —      | Bundler/worker setup gap confirmed                         |
| performance           | 50+           | 584       | —      | Significant; spans rendering, data, style                  |
| 3D                    | 50+           | 320       | —      | Overlaps globe (293) and terrain (503)                     |
| terrain               | 50            | 503       | ~10×   | Massive growth; highest-demand spatial topic               |
| marker                | 50            | 275       | ~5×    |                                                            |
| popup                 | 37            | 154       | 4×     |                                                            |
| queryRenderedFeatures | 37            | 66        | 1.8×   | Low relative to interactivity demand — vocabulary mismatch |
| sprite                | 40            | 116       | 3×     |                                                            |
| cluster               | 35            | 62        | 1.8×   |                                                            |
| fill-extrusion        | 33            | 151       | 5×     |                                                            |
| flyTo                 | 34            | 66        | 2×     |                                                            |
| setData               | 29            | 56        | 2×     |                                                            |
| PMTiles               | 25            | 41        | 1.6×   |                                                            |
| heatmap               | 22            | 135       | 6×     | Sharpest growth rate                                       |
| Vue                   | 15            | 31        | 2×     |                                                            |
| fitBounds             | 13            | 25        | 2×     |                                                            |

### 7.2 New keyword queries — gl-js **[NEW]**

| Query         | Q2 volume | Notes                                                              |
| ------------- | --------- | ------------------------------------------------------------------ |
| example       | 1,443     | Developers requesting specific examples — directly validates #7574 |
| TypeScript    | 1,149     | Third-largest topic; clear guide gap                               |
| migration     | 190       | Mapbox→MapLibre; distinct from general Mapbox confusion            |
| feature-state | 168       | Confirms gap from preliminary analysis                             |
| globe         | 293       | **[NEW]** High demand relative to ~10 existing globe examples      |
| animation     | 132       | **[NEW]** Supports cross-cutting tag                               |
| accessibility | 67        | Non-trivial; zero existing coverage                                |
| MLT           | 39        | Emerging alongside PMTiles                                         |

### 7.3 Behavioral signal queries — gl-js **[NEW]**

| Query                    | Q2 volume | Classification                                       |
| ------------------------ | --------- | ---------------------------------------------------- |
| `accessToken`            | 14        | Inferred — Mapbox-only API in GL JS context          |
| "nothing works"          | 9         | Inferred — friction language                         |
| "tried everything"       | 5         | Inferred — friction language                         |
| "spent hours"            | 4         | Inferred — friction language                         |
| `setWellKnownTileServer` | 0         | Not present in gl-js (correct; it's a Native/RN API) |

### 7.4 AI mention queries — org-wide (all maplibre repos)

| Query          | Q2 volume | Notes                                                                      |
| -------------- | --------- | -------------------------------------------------------------------------- |
| Copilot        | 1,209     | Inflated — includes GH Copilot product discussions; needs manual filtering |
| Claude         | 163       | Likely genuine AI-assistance mentions; higher than ChatGPT                 |
| language model | 69        | Behavioral — developers describing AI-generated code without naming tool   |
| ChatGPT        | 44        | Genuine                                                                    |
| AI said        | 17        | Explicit attribution                                                       |
| Gemini         | 11        |                                                                            |
| asked AI       | 9         |                                                                            |
| hallucin       | 0         | Developers don't use this word in issue text                               |

### 7.5 Cross-repo queries **[NEW]**

| Repo                  | Query                  | Q2 volume | Notes                                                             |
| --------------------- | ---------------------- | --------- | ----------------------------------------------------------------- |
| maplibre-react-native | v11                    | 83        | 83 issues in 24 days since release (April 17 → May 11) — ~3.5/day |
| maplibre-react-native | styleURL               | 25        | Anachronistic prop — AI failure signal                            |
| maplibre-react-native | accessToken            | 1         |                                                                   |
| maplibre-react-native | setWellKnownTileServer | 0         |                                                                   |
| martin                | config                 | 508       | Configuration is martin's dominant concern                        |
| maplibre-style-spec   | expression             | 264       | Combined with gl-js: 692 total expression issues                  |
| maplibre-style-spec   | feature-state          | 18        | Combined with gl-js: 186 total                                    |
| maplibre-native       | terrain                | 31        | Terrain spans native platforms                                    |

---

## 8. Stack Overflow Results

**Total questions tagged `maplibre-gl`: 129**

Note: SO tags are inconsistently applied. `maplibre-gl-js`, `maplibre`, and `maplibre-react-native` do not exist as SO tags. The 129 count undercounts total SO activity.

### 8.1 Top voted questions

| Votes | Views | Title                                                                                                                                   | Intent cluster                        | AI failure                                                                                 |
| ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------ |
| 7     | 1,384 | [MapLibre GL JS with terrain layer: How to pin a horizontal plane to specific altitude?](https://stackoverflow.com/questions/73409827)  | Terrain and elevation                 | No signal                                                                                  |
| 6     | 6,382 | [How to use MapLibre GL Js in react native](https://stackoverflow.com/questions/67952068)                                               | Framework integration                 | No signal                                                                                  |
| 6     | 2,289 | [How do I use MapLibre-GL from TypeScript?](https://stackoverflow.com/questions/77096875)                                               | Map setup / TypeScript                | No signal                                                                                  |
| 5     | 3,115 | [How to show/hide labels according to zoom levels with expressions](https://stackoverflow.com/questions/72176009)                       | Layers / expressions                  | No signal                                                                                  |
| 5     | 1,242 | [MapBox/MapLibre - text-field requires a style glyphs property](https://stackoverflow.com/questions/77222805)                           | Symbols / self-hosting                | No signal                                                                                  |
| 4     | 7,739 | [maplibre-gl-js: load offline (local) glyphs, sprites and mbtiles](https://stackoverflow.com/questions/73698512)                        | Self-hosting / offline                | No signal — but author body states "afraid of hallucinations" (high-value negative signal) |
| 4     | 5,219 | [Load local .mbtiles with maplibre-gl-js](https://stackoverflow.com/questions/68853853)                                                 | Sources / offline                     | No signal                                                                                  |
| 4     | 2,892 | [Expression to get value from nested objects](https://stackoverflow.com/questions/71787999)                                             | Expressions                           | No signal                                                                                  |
| 4     | 1,066 | [maplibre: Why sometimes does not trigger the map.on('load') callback?](https://stackoverflow.com/questions/78381838)                   | Map setup / lifecycle                 | No signal                                                                                  |
| 4     | 705   | [Rendering Mapbox Vector Tiles using maplibre-gl-js](https://stackoverflow.com/questions/69974148)                                      | Sources / Mapbox migration            | No signal                                                                                  |
| 4     | 1,574 | [Load markers dynamically with react and mapbox gl or maplibre gl](https://stackoverflow.com/questions/67750269)                        | Markers / React                       | No signal                                                                                  |
| 3     | 2,806 | [Mapbox warning setAccessToken requires setWellKnownTileServer for MapLibre Blank Screen](https://stackoverflow.com/questions/72884059) | Framework integration / RN            | **Inferred** — `setWellKnownTileServer` is Mapbox-only; signals AI-generated code          |
| 3     | 1,963 | [No labels on my map using MapLibre GL JS (serving tiles locally)](https://stackoverflow.com/questions/76635972)                        | Self-hosting / glyphs                 | No signal                                                                                  |
| 2     | 4,833 | [How to get MapLibre Layers properties?](https://stackoverflow.com/questions/70110173)                                                  | Interactivity / queryRenderedFeatures | No signal                                                                                  |
| 2     | 3,537 | [React-Map-GL: How to make hovered marker appear on top?](https://stackoverflow.com/questions/71635855)                                 | Markers / React                       | No signal                                                                                  |
| 2     | 1,344 | [Mapbox/MapLibre how to use custom hash to show parameters in URL?](https://stackoverflow.com/questions/75917397)                       | Map setup / navigation                | No signal                                                                                  |
| 2     | 1,272 | [Confusion about how to load the maplibre-gl module with 'import' when using typescript](https://stackoverflow.com/questions/78176752)  | Map setup / TypeScript                | No signal                                                                                  |

### 8.2 Notable newest questions (emerging signals)

| Views | Title                                                             | Signal                                    |
| ----- | ----------------------------------------------------------------- | ----------------------------------------- |
| 522   | Camera resets on Android using maplibre in react native app       | v11 / react-native instability            |
| 599   | Implementing MapLibre GL in an Angular app                        | Angular integration gap                   |
| 377   | Problem Loading Custom Style on iOS with maplibre_gl              | Native iOS / style loading                |
| 305   | What is the difference between these mapping libraries            | Discovery / comparison — frequently asked |
| 190   | How can I make mapbox-gl symbols appear regardless of zoom level? | Mapbox migration confusion                |
| 169   | Adding a polygon to cover some paths in MapLibre Compose Android  | Android Compose integration               |
| 143   | PMTiles Request from MapLibreMap aborted by Firefox               | PMTiles / browser compatibility           |
| 124   | How to integrate MapLibre GL JS CSP version with Angular          | CSP / Angular gap                         |

---

## 9. New AI Failure Zones (Q2 Ecosystem Research)

### 9.1 `react-maplibre` archival

**Status:** Active failure zone  
**What happened:** `vis.gl/react-maplibre` archived January 29, 2025. Consolidated into `react-map-gl`.  
**Failure mode:** AI trained before early 2025 may recommend `@vis.gl/react-maplibre` — no longer maintained.  
**Correct Q2 2026 answer:** `npm install react-map-gl maplibre-gl`, import from `react-map-gl/maplibre`.  
**Candidate skill:** [#9](https://github.com/maplibre/maplibre-agent-skills/issues/9) (web-integration-patterns)

### 9.2 `maplibre-react-native` v11 API overhaul

**Status:** Acute and confirmed — 83 issues in 24 days  
**What happened:** v11 released April 17, 2026. First release requiring RN new architecture. API fully overhauled.  
**Breaking changes:** Layer components → single `Layer` type; `centerCoordinate` → `center`; `zoomLevel` → `zoom`; event payloads → `event.nativeEvent`.  
**Failure mode:** AI trained on v10 gives wrong component names, props, and lifecycle patterns.  
**Q2 AI-mention search:** Add to `maplibre-react-native` repo searches — any issues citing AI help on component/prop APIs are high-value signals.  
**Candidate skills:** [#20](https://github.com/maplibre/maplibre-agent-skills/issues/20) (native-gl-js-parity) primary; [#9](https://github.com/maplibre/maplibre-agent-skills/issues/9) secondary

---

## 10. Skills Backlog Update

### 10.1 Highest-leverage overlaps (intent demand + AI failure)

| Developer intent                               | AI failure signal                                         | GL JS example gap?                                    | Skill                                                              | Q2 priority      |
| ---------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ | ---------------- |
| Set up MapLibre with TypeScript                | No explicit signal; pure demand (1,149 issues)            | Guide gap confirmed                                   | [#9](https://github.com/maplibre/maplibre-agent-skills/issues/9)   | **HIGH — new**   |
| Set up terrain and elevation                   | High (Terrarium/Mapbox encoding, silent wrong output)     | Partial — DEM encoding nuance absent                  | [#19](https://github.com/maplibre/maplibre-agent-skills/issues/19) | **HIGH**         |
| Use expressions for data-driven styling        | Confirmed dual AI failure (`["literal"]` wrapper)         | Partial — filter pattern gaps                         | [#8](https://github.com/maplibre/maplibre-agent-skills/issues/8)   | **HIGH**         |
| Self-host fonts, sprites, glyphs               | Developer explicitly avoided AI                           | Symbol/icon examples exist; self-hosting setup absent | [#11](https://github.com/maplibre/maplibre-agent-skills/issues/11) | **HIGH**         |
| Use React Native with MapLibre v11             | Acute failure zone — v11 API overhaul (83 issues/24 days) | Out of GL JS scope                                    | [#20](https://github.com/maplibre/maplibre-agent-skills/issues/20) | **URGENT — new** |
| Load custom tiles / PMTiles                    | Confirmed (`addProtocol` hallucination, version drift)    | PMTiles example exists; custom protocol thin          | Published                                                          | Maintain         |
| Choose and install a React web wrapper         | `react-maplibre` archived; AI may still recommend it      | Out of GL JS scope                                    | [#9](https://github.com/maplibre/maplibre-agent-skills/issues/9)   | **HIGH**         |
| Work with feature state                        | No explicit AI signal; pure demand (186 cross-repo)       | No example or guide                                   | New candidate                                                      | **MEDIUM — new** |
| Integrate MapLibre with a tile server (Martin) | No explicit AI signal; martin config: 508                 | No GL JS example                                      | New candidate                                                      | **MEDIUM — new** |

### 10.2 Q2 skill candidates (not in Q1 backlog)

| Topic                     | Q2 evidence                                      | Proposed skill                          | Notes                                  |
| ------------------------- | ------------------------------------------------ | --------------------------------------- | -------------------------------------- |
| TypeScript setup          | gl-js TypeScript: 1,149; SO question 2,289 views | Guide candidate; could be skill         | Largest unaddressed need by volume     |
| maplibre-react-native v11 | 83 issues in 24 days; API fully changed          | Add to #20                              | Urgent; AI failure is predictive       |
| Feature state             | gl-js 168 + style-spec 18 = 186 cross-repo       | Example + guide candidate               | Both surfaces needed                   |
| mapbox→maplibre migration | migration: 190; Mapbox: 1,862                    | Guide; add migration patterns to skills | Distinct from general Mapbox confusion |
| Animation patterns        | animation: 132                                   | Cross-cutting skill or tag              | Overlaps camera, markers, data         |

---

## 11. Mining Output Table

### Output format

| Field                | Guidance                                                                             |
| -------------------- | ------------------------------------------------------------------------------------ |
| **Source**           | `GH issue`, `GH PR`, `GH discussion`, `SO`, `Slack`                                  |
| **Link**             | Direct URL or issue number                                                           |
| **Developer intent** | Plain-language goal a non-expert could recognize                                     |
| **Surface**          | `example`, `guide`, `both` — only if a documentation gap; blank if existing coverage |
| **API / concept**    | Technical area or API                                                                |
| **AI failure**       | `explicit` / `inferred` / `no signal` + brief description                            |

### 11.1 Confirmed signals

| Source           | Link                                                                  | Developer intent                                       | Surface | API / concept                                | AI failure                                                                      |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------ | ------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| GH issue         | [gl-js #3419](https://github.com/maplibre/maplibre-gl-js/issues/3419) | Force map to refresh after server-side data changes    | Example | `removeSource` / `addSource` / `setTiles`    | Explicit — ChatGPT suggested destructive workaround                             |
| Slack            | Thread 1                                                              | Filter map features by a list of values                | Example | `["literal"]` expression wrapper             | Explicit — both ChatGPT and Claude failed                                       |
| SO               | [73698512](https://stackoverflow.com/questions/73698512)              | Self-host glyphs, sprites, and mbtiles for offline use | Guide   | Glyph/sprite server config                   | No signal — author explicitly avoided AI ("afraid of hallucinations")           |
| SO               | [72884059](https://stackoverflow.com/questions/72884059)              | Set up MapLibre in React Native (blank screen)         | —       | React Native setup, `setWellKnownTileServer` | Inferred — `setWellKnownTileServer` is Mapbox-only; AI-generated code signature |
| GH issue (gl-js) | (behavioral)                                                          | Set up MapLibre with Vite/Webpack                      | Guide   | Worker configuration, bundler setup          | No signal (volume: 436 issues)                                                  |
| GH issue (gl-js) | (volume)                                                              | Use TypeScript with MapLibre                           | Guide   | TypeScript typing, module import             | No signal (volume: 1,149 issues)                                                |

The working-draft checklist sections from the original Q2 plan have been omitted from this archive copy.

## 14. Appendix: Methodology Authorship

Discussion #33 and #34 authored by Claude Sonnet 4.6 with prompts, revisions, and edits by [@mizmay](https://github.com/mizmay).

- **Discussion #33** (May 10, 2026): Documentation landscape, surface scope definitions
- **Discussion #34** (May 11, 2026): Dual-lens methodology, preliminary clusters, gaps, Q2 query plan
- **This report** (May 11, 2026): Q2 query run and compiled findings
