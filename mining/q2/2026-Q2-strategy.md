# MapLibre — Q2 2026 Mining Strategy

See the consolidated [Q2 2026 mining](./README.md) and the [Q2 2026 report](./2026-Q2-data-mining-report.md) for the full archive.

## Goals

1. Line up the usage questions developers ask about MapLibre with the community-driven examples provided on the [MapLibre GL JS examples](https://maplibre.org/maplibre-gl-js/docs/examples/), initially to inform a taxonomy, eventually to inform a curation approach.
2. Evaluate and update what supplemental agent skills to prioritize creating, in order to address confusion and AI agent hallucinations, confusion, and mistakes.

**Informs:**

- [maplibre-agent-skills](https://github.com/maplibre/maplibre-agent-skills) — skills backlog and eval content
- [maplibre-gl-js #7576](https://github.com/maplibre/maplibre-gl-js/issues/7576) — example page topic taxonomy
- [maplibre-gl-js #7574](https://github.com/maplibre/maplibre-gl-js/issues/7574) — example curation (consolidation and gaps)

**Supersedes:** Q1 2026 run (`2026-Q1.md`), a first attempt at capturing the AI failure signals associated with MapLibre

---

## Why a shared strategy

The Q1 mining run was designed to answer one question: where does AI give wrong or incomplete answers about MapLibre? The example taxonomy (#7576) requires a different question: what are developers trying to _build or accomplish_? Taxonomy categories should emerge from clustering developer goals. A developer who wants to show building heights searches for "3D buildings," not "fill-extrusion." A developer who wants a clickable map searches for "click event" or "popup on click," not `queryRenderedFeatures`.

These two questions share sources (GitHub issues, Stack Overflow, Slack) but require different extraction. Q2 mining runs both lenses simultaneously on every available source-—producing output that feeds both projects from a single pass, and keeping the two workstreams genuinely complementary rather than parallel-but-separate.

---

## Ecosystem documentation landscape

Before diving in to organizing community-submitted examples and AI failures, we must first look at the MapLibre documentation landscape (it is a complex ecosystem), and analyze it holistically to identify where we might expect a developer or AI agent should go to get different types of questions answered.

Here is an incomplete inventory of MapLibre documentation from across the ecosystem:

| Platform / wrapper                                | Official docs                                                     | Examples                                                                                                                                                                                                      | Status                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **MapLibre GL JS** (web, vanilla JS)              | `maplibre.org/maplibre-gl-js/docs/`                               | ~133 examples — this is the scope of #7576 and #7574                                                                                                                                                          | Active                                                                                             |
| **MapLibre React Native**                         | `maplibre.org/maplibre-react-native/`                             | Full Docusaurus site: Setup, Guides, Components, Modules, Types                                                                                                                                               | Active — v11 (released April 17, 2026) requires React Native's new architecture and overhauled API |
| **MapLibre Native (Android)**                     | `maplibre.org/maplibre-native/android/api/`                       | Separate MkDocs examples site at `android/examples/`, organized by category (Quickstart, Camera, Data, Styling, Annotations, Observability, LocationComponent, Snapshotter, Configuration)                    | Active                                                                                             |
| **MapLibre Native (iOS)**                         | `maplibre.org/maplibre-native/ios/latest/documentation/maplibre/` | DocC site integrating examples as articles alongside API reference, organized by category (Essentials, Styling and Dynamic Data, Map Interaction, Features, Offline, Observability, Advanced, Other Articles) | Active                                                                                             |
| **react-map-gl** (`react-map-gl/maplibre` import) | `visgl.github.io/react-map-gl`                                    | Community wrapper; the primary React web integration path for MapLibre GL JS                                                                                                                                  | Active — consolidated from `react-maplibre` (see below)                                            |
| **vis.gl/react-maplibre**                         | Archived                                                          | Was a standalone React wrapper for maplibre-gl                                                                                                                                                                | **Archived January 29, 2025** — consolidated into `react-map-gl`                                   |

**Special note on frameworks:**

What we have learned from mining efforts in the past is that there is a very high volume framework-related GL JS issues (React, Vue, Angular, Svelte) with the bulk of these issues coming from React. Thus we include React documentation in our inventory and analysis as part of the documentation ecosystem without comprehensively listing the documentation from all frameworks.

The purpose of GL JS examples is to demonstrate vanilla JS patterns that are wrapper-agnostic. However, to the extent we can separate and address issues with using MapLibre, including within a framework, from issues with the framework itself, we should mine for the signals framework users are sending about MapLibre and incorporate these into our analyses.

In addition, mining should still record framework intent signals because they inform the skills work (#9 web-integration-patterns).

**Native platform taxonomies (iOS and Android)**

Both iOS and Android have examples organized by category, though in different documentation systems and with independently developed taxonomies. Neither is formally shared with the other. Neither has had as many community contributions to the documentation as GL JS.

| Category                 | iOS (DocC articles)                                                      | Android (MkDocs examples)                             |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------- |
| Getting started          | Essentials (Getting Started, Add Marker)                                 | Quickstart, Configuration                             |
| Styling and data         | Styling and Dynamic Data (GeoJSON, vector tiles, PMTiles, animated line) | Styling, GeoJSON Source, Data (Vector Tiles, PMTiles) |
| Map interaction / camera | Map Interaction (gestures, annotations, fill extrusion)                  | Camera (animation types, bounds, zoom, gestures)      |
| Location                 | Features (User Location & Location Privacy)                              | LocationComponent                                     |
| Offline                  | Offline (Download Pack, Manage Regions)                                  | —                                                     |
| Observability            | Observability (low-level events, action journal)                         | Observability (action journal, observe map events)    |
| Advanced / snapshots     | Advanced (Metal API, plugin layers), Features (snapshots)                | Snapshotter                                           |
| Conceptual articles      | Other Articles (fonts, predicates, tile URL templates, style authoring)  | —                                                     |

**Observability** is the one category name shared verbatim by both platforms, covering nearly identical content (action journal, map events). Styling and data loading overlap substantially in content but differ in naming. Camera/navigation and location have equivalent coverage under different labels.

The two taxonomies share themes but were not designed in coordination. Whether they should converge is a question for the Native platform teams. The GL JS taxonomy work can produce patterns that are useful reference points for that conversation, but alignment across platforms is out of scope for this effort.

---

## Documentation surface scope: guides vs. examples vs. API reference

The MapLibre GL JS docs comprise three distinct surfaces that serve different purposes. Gap analysis must route findings to the right surface — not every missing topic belongs in the examples.

**API Reference** (`/docs/API/`): Authoritative for method signatures, parameters, and return types. Not a gap-filling target for this work.

**Guides** (`/docs/guides/`): Narrative documentation for concepts, setup, and decisions that require explanation rather than visual demonstration. Best for:

- Installation and bundler/worker configuration
- Conceptual explanations (how the style spec works, how sources are resolved)
- Decision-making (choosing a tile format, picking a projection, when to use feature state vs. data-driven styling)
- Troubleshooting patterns with no compelling visual component

**Examples** (`/docs/examples/`): Interactive code demonstrations for capabilities best understood visually and likely to be copy-pasted as starting points. Best for:

- Techniques with a clear map outcome the developer can see
- API usage patterns that benefit from a live, runnable result
- Showcasing what MapLibre can do (discovery function)

**Why this matters for mining:** Some confirmed gap areas are guide candidates, not example candidates. When mining produces an intent signal without a clear visual component or copy-paste outcome, it should be flagged as a guide gap rather than an example gap,or perhaps both:

The mining output should record a `surface` field alongside the intent field for any newly identified gap: `example`, `guide`, or `both`.

---

## The dual-lens design

Every mined item — issue, SO question, Slack thread — should produce three recorded fields:

| Field                | Question                                                                                                                             | Feeds                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| **Developer intent** | What was the person trying to build or do? (stated in their own words where possible)                                                | Example taxonomy             |
| **API / concept**    | What technical area or API were they working with?                                                                                   | Skills backlog               |
| **AI failure**       | Is there evidence AI was involved and gave a wrong or incomplete answer? (`explicit` / `inferred` / `no signal` + brief description) | Skills content, eval prompts |

**Developer intent is the new field.** It is often buried in the issue title or first sentence rather than in the technical details — the part Q1 queries were not designed to surface. It is also frequently different from the API topic. An issue about `addProtocol` (API/concept) usually reflects a developer trying to load custom tile data without a server (intent). An issue about `queryRenderedFeatures` usually reflects a developer trying to build click-to-inspect behavior. The intent is what determines the example taxonomy bucket; the API/concept is what determines skill content.

**Intent extraction heuristic:** Read the first sentence of the issue or question body, ignoring the technical details. What one-phrase goal does it express? If it expresses a goal a non-expert could recognize without knowing the MapLibre API (e.g., "show terrain on my map," "make my map interactive," "display data from a database"), that is the intent. If it only makes sense in terms of the API (e.g., "addProtocol callback signature"), use the containing goal the API serves.

---

## Prerequisite: mine the examples themselves

Before running external sources, the examples directory in `maplibre-gl-js` (`test/examples/`) is itself a primary source. Mining the existing examples answers the question the taxonomy work most immediately needs: which topic areas are currently over-represented, which are under-represented, and where are the gaps?

### Current inventory (~133 examples as of Q2 2026)

A preliminary clustering of the current flat list by developer intent produces the following approximate groups. **Note: the goal of Q2 mining is to identify gaps, validate and refine these, not to treat them as settled.**

| Provisional group              | Example count | Notes                                                                                                 |
| ------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------- |
| Globe and atmosphere           | ~10           | Distinct enough from general 3D to cluster separately; atmosphere, custom layers on globe, vector map |
| Terrain and elevation          | ~8            | Hillshade, DEM, contour, sky/fog, 3D terrain — confirmed highest-voted SO question                    |
| 3D models and custom renderers | ~8            | ThreeJS (6 variants) + BabylonJS + 3D tiles — heavily over-represented, see #7574                     |
| Layers and visual styling      | ~15           | Data-driven styling, expressions, patterns, raster, WMS, line gradients                               |
| Data visualization             | ~8            | Heatmap, clusters, choropleth, real-time updates, time slider                                         |
| Sources and data loading       | ~10           | GeoJSON, PMTiles, MBTiles, COG, canvas, video, MLT                                                    |
| Symbols, icons, and labels     | ~15           | Icon generation, sprite, fonts, label placement, i18n, right-to-left                                  |
| Markers and popups             | ~8            | Default marker, custom icons, draggable, popup variants — some consolidation candidates               |
| Camera and navigation          | ~12           | flyTo (4 variants), fitBounds, pitch/bearing, padding, game controls                                  |
| Interactivity and events       | ~12           | Click, hover, drag, box zoom, filter, measure, draw                                                   |
| Map setup and controls         | ~10           | Display map, fullscreen, navigation controls, attribution, WebGL check, performance metrics           |
| Animation                      | ~8            | Line, marker, point, image series, camera — overlaps with camera and interactivity groups             |
| Third-party integrations       | ~8            | deck.gl, terra-draw, mapbox-gl-draw, Nominatim — may not warrant a top-level category                 |

### Gaps (confirmed absent)

| Gap                                               | Evidence                                                                                        | Surface         | Rationale                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| **Bundler/worker setup (Vite, Webpack, esbuild)** | `worker / bundler` at 50-issue ceiling; first thing new developers hit before rendering a map   | Guide           | Setup prose and config files; no visual outcome                                                           |
| **Style switching at runtime**                    | Identified in #7574; common user need, no example                                               | Example         | Visual demonstration of behavior                                                                          |
| **Feature state**                                 | 8 issues in style-spec; `queryRenderedFeatures` at 37 issues in gl-js; no feature-state example | Guide + Example | API usage pattern with visible outcome; concept explanation → guide, implementation demo → example        |
| **Offline / service worker tile caching**         | PMTiles example exists but no service worker or IndexedDB pattern                               | Guide + Example | Architecture explanation → guide; implementation demo → example                                           |
| **Accessibility**                                 | WCAG/keyboard/screen reader — zero coverage across all surfaces                                 | Guide + Example | Principles and decision-making → guide; implementation demo → example                                     |
| **Self-hosting glyphs and sprites**               | 7,513-view SO question; 50+ issues; developer explicitly avoided AI for this                    | Guide           | Server/file configuration concern; example shows the resulting map but can't demonstrate the server setup |
| **Martin / tile server integration**              | martin has 133 config issues; no GL JS-side example                                             | Guide           | Configuration and deployment; no visual component from the GL JS side                                     |

---

## Q2 mining queries

### Preliminary observations

**New AI failure zone — `react-maplibre` archival:**

`vis.gl/react-maplibre` was archived on January 29, 2025, and its source consolidated into `react-map-gl`. The archived repo remains publicly visible and will continue to surface in search results. Any AI tool trained before early 2025 may still recommend `@vis.gl/react-maplibre` as a standalone package — a package that is no longer maintained and whose `npm install` leads to the archived repo. This is a candidate skill content addition to #9 (web-integration-patterns): the correct Q2 2026 install is `npm install react-map-gl maplibre-gl`, with MapLibre components imported from the `react-map-gl/maplibre` endpoint.

**New AI failure zone — `maplibre-react-native` v11 API overhaul:**

`maplibre-react-native` v11 (released April 17, 2026) is the first release to require React Native's new architecture, with the entire API overhauled to align with GL JS — layer components consolidated into a single `Layer` type, props renamed to match GL JS conventions (`centerCoordinate` → `center`, `zoomLevel` → `zoom`, etc.), and event payloads moved to `event.nativeEvent`. AI trained on v10 documentation will give wrong answers: wrong component names, wrong prop APIs, wrong lifecycle patterns. This is an acute and confirmed predictive failure zone for the `native-gl-js-parity` skill (#20) and should be added as a primary target for Q2 AI-mention searches in the `maplibre-react-native` repo.

### Sources to run (with Q1 comparison)

All Q1 keyword searches should be re-run verbatim to establish Q2 volume baselines. New additions are marked **[NEW]**.

**GitHub issues (`gh search issues`):**

| Query                                                       | Q1 volume     | Notes                                                                                                          |
| ----------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| `React`                                                     | 50+ (ceiling) | Re-run; check if new ceiling                                                                                   |
| `font / glyph`                                              | 50+           | Re-run                                                                                                         |
| `filter`                                                    | 50+           | Re-run                                                                                                         |
| `expression`                                                | 50+           | Re-run                                                                                                         |
| `GeoJSON`                                                   | 50+           | Re-run                                                                                                         |
| `Mapbox`                                                    | 50+           | Re-run                                                                                                         |
| `worker / bundler`                                          | 50+           | Re-run                                                                                                         |
| `performance`                                               | 50+           | Re-run                                                                                                         |
| `3D`                                                        | 50+           | Re-run                                                                                                         |
| `terrain`                                                   | 50            | Re-run; trending?                                                                                              |
| `marker`                                                    | 50            | Re-run                                                                                                         |
| `popup`                                                     | 37            | Re-run                                                                                                         |
| `queryRenderedFeatures`                                     | 37            | Re-run; omitted from Q1 table but confirmed Q1 volume                                                          |
| `sprite`                                                    | 40            | Re-run                                                                                                         |
| `cluster`                                                   | 35            | Re-run                                                                                                         |
| `fill-extrusion`                                            | 33            | Re-run                                                                                                         |
| `flyTo`                                                     | 34            | Re-run                                                                                                         |
| `setData`                                                   | 29            | Re-run                                                                                                         |
| `PMTiles`                                                   | 25            | Re-run; MLT emerging alongside?                                                                                |
| `heatmap`                                                   | 22            | Re-run                                                                                                         |
| `Vue`                                                       | 15            | Re-run                                                                                                         |
| `fitBounds`                                                 | 13            | Re-run                                                                                                         |
| `example`                                                   | Not run       | **[NEW]** Developers requesting specific examples                                                              |
| `feature-state`                                             | Not run       | **[NEW]** Underrepresented in examples                                                                         |
| `MLT`                                                       | Not run       | **[NEW]** Next-gen tile format adoption                                                                        |
| `React Native`                                              | Not run       | **[NEW]** Run in `maplibre-react-native` repo, not gl-js; v11 API overhaul is active failure zone              |
| `migration`                                                 | Not run       | **[NEW]** Mapbox→MapLibre, separate from general Mapbox confusion                                              |
| `TypeScript`                                                | Not run       | **[NEW]** Setup/typing questions                                                                               |
| `accessibility`                                             | Not run       | **[NEW]** Confirmed gap, check if there's demand                                                               |
|                                                             |               | **Cluster vocabulary — validate that developers use these terms**                                              |
| `globe` / `atmosphere`                                      | Not run       | Does demand match the ~10 examples? Or is globe over-represented?                                              |
| `elevation` / `hillshade` / `DEM` / `raster-dem`            | Not run       | Alternate vocabulary for terrain cluster                                                                       |
| `animation` / `animate` / `transition`                      | Not run       | Cross-cutting tag candidate; how large is the demand signal?                                                   |
| `camera` / `pan` / `zoom`                                   | Not run       | Validates camera & navigation as a category                                                                    |
| `click` / `hover` / `event` / `interaction`                 | Not run       | Validates interactivity & events as a category                                                                 |
| `visualization` / `choropleth` / `real-time`                | Not run       | Validates data visualization as a distinct category from layers                                                |
| `symbol` / `icon` / `label` / `text-field`                  | Not run       | Validates symbols/icons/labels cluster size alongside existing font/glyph/sprite queries                       |
| `ThreeJS` / `three.js` / `custom layer` / `custom renderer` | Not run       | How much demand for 3D model examples specifically vs. general 3D? Informs whether this is a category or a tag |
| `source` / `raster` / `vector tiles`                        | Not run       | Validates sources & data as a category                                                                         |
| `setup` / `install` / `getting started`                     | Not run       | Validates map setup as a category; may inform guide gaps                                                       |

**GitHub AI-mention searches (explicit, all repos):**

Re-run `ChatGPT`, `Claude`, `Copilot`, `Gemini`, `asked AI`, `AI said`, `language model` across `maplibre-gl-js`, `maplibre-native`, `martin`, `maplibre-style-spec`, `maputnik`. **[NEW]** Also run against `maplibre-react-native` — v11 API overhaul is a confirmed predictive AI failure zone; any issues citing AI help on component or prop APIs are high-value signals. Record any new threads with developer intent field populated.

**GitHub behavioral signal searches (inferred AI involvement, all repos) [NEW]:**

These queries target the pattern of AI-assisted development without an explicit AI mention — the developer tried the AI answer, it didn't work, and they filed an issue or question. Run across `maplibre-gl-js` and `maplibre-react-native` at minimum.

| Query                                                | Signal type         | Rationale                                           |
| ---------------------------------------------------- | ------------------- | --------------------------------------------------- |
| `"tried everything"`                                 | Friction signal     | Exhausted options including AI                      |
| `"spent hours"` OR `"spent days"`                    | Friction signal     | Time investment typical of AI-first debugging       |
| `"nothing works"` OR `"doesn't work"`                | Friction signal     | Broad but filters for stuck developers              |
| `"setWellKnownTileServer"`                           | Anachronistic API   | Mapbox-only method; AI gives this to MapLibre users |
| `"accessToken"`                                      | Anachronistic API   | Mapbox-only; AI trained on Mapbox docs              |
| `"styleURL"`                                         | Anachronistic API   | Old React Native / Mapbox prop name                 |
| `"addLayer" "before"` combined with wrong layer type | Hallucination shape | AI commonly gets layer ordering wrong               |

When reviewing results from any source (not just these queries), also flag: plausible-looking code that calls non-existent MapLibre methods, correct-sounding but wrong parameter types, and elaborate workarounds for problems with simple documented solutions — all are hallucination fingerprints.

**Stack Overflow:**

- Re-run top-voted (`maplibre-gl` tag, sorted by votes) — compare to Q1 baseline
- **[NEW]** Run `maplibre-gl` tag sorted by newest — catches emerging questions before they accumulate votes
- **[NEW]** Run `maplibre-gl` + `React`, `maplibre-gl` + `Vue`, `maplibre-gl` + `TypeScript` as targeted searches

**GitHub Discussions:**

- Re-run GraphQL AI-mention search across all repos (Q1 found 4 genuine threads in gl-js)
- **[NEW]** Search for `example` in discussion titles — captures requests for examples that don't yet exist
- Check #7576 and #7574 for community comments; these are primary data on how the MapLibre community itself thinks about categorization

**Slack:**

- Re-run full Q1 search string for AI mentions (one-year window ending Q2 date)
- **[NEW]** Add `"example"` and `"how do I"` to the search strings to capture intent-rich threads that don't mention AI

---

## Mining output format

Each mined item should be recorded in a table row with all four lens fields populated:

```
| Source | Link | Developer intent | Surface | API / concept | AI failure |
```

The **surface** field applies only when the intent represents a documentation gap: `example`, `guide`, or `both`. Leave blank for items that have existing coverage. For the **developer intent** field, write the goal in plain language a non-expert could recognize — prefer the developer's own words if they state a goal clearly.

For the **AI failure** field, use one of three classifications:

- `explicit` — developer names an AI tool (ChatGPT, Claude, Copilot, etc.)
- `inferred` — no AI mention, but behavioral signals suggest AI involvement (anachronistic API usage, friction language, hallucination-shaped code, elaborate workaround for a simple problem)
- `no signal` — no evidence either way

"No signal" is not the same as "AI was not involved." Treat `inferred` conservatively: note the specific signal that prompted it.

| Source         | Link        | Developer intent                                    | Surface                | API / concept                             | AI failure                                                           |
| -------------- | ----------- | --------------------------------------------------- | ---------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| GH issue       | gl-js #3419 | Force map to refresh after server-side data changes | Example                | `removeSource` / `addSource` / `setTiles` | Explicit — ChatGPT suggested destructive workaround                  |
| SO             | [link]      | Use MapLibre in a React app                         | — (out of GL JS scope) | framework integration, map lifecycle      | Inferred — AI typically omits cleanup on unmount; no mention in post |
| Slack Thread 1 | —           | Filter map features by a list of values             | Example                | `["literal"]` expression wrapper          | Explicit — both ChatGPT and Claude failed                            |
| GH issue       | gl-js #XXXX | Set up MapLibre with Vite                           | Guide                  | worker configuration, bundler setup       | No signal                                                            |

At the end of the run, intent fields are clustered (not pre-assigned) to produce candidate taxonomy groups. Surface fields route gap findings to examples or guides. API/concept and AI failure fields feed the skills backlog and eval prompts as in Q1.

---

## Expected outputs

### For the example taxonomy (#7576)

The mining run should produce, at a minimum:

1. **A ranked list of developer intent clusters** — what developers are most commonly trying to do, grounded in issue/question volume and stated goals, not API keyword counts
2. **Validated gap list** — intents with high demand but no current example (extending the preliminary gap list above)
3. **Validation confirmation** — intents where examples exist, interpret for signals for where and how to consolidate redundant or duplicate examples
4. **Example rewrite signal** indents expressed that current examples do not fully address
5. **Proposed taxonomy** — a set of topic group names and tag vocabulary that emerge from the clustered intents, expressed in developer-goal language, sufficient to implement as Zensical content tabs + tag frontmatter without presupposing the answer

**Categories vs. tags — explicit distinction:**

The Zensical implementation (#7576) proposes to use two complementary mechanisms that serve different navigation needs and have different design constraints.

_Categories_ are the primary navigation layer. An example belongs to exactly one category. Categories should be:

- Broad enough that each tab contains a meaningful number of examples after the consolidation pass in #7574 (target: 8+ examples per category post-consolidation)
- Distinct enough that most examples clearly belong to one, not three
- Named in developer-goal language, not API or spec language
- Few enough to fit without overwhelming the page (target: 6–10)

_Tags_ (rendered as frontmatter chips and a separate tags index) are the cross-cutting layer. An example can carry multiple tags. Tags should:

- Handle concerns that span categories — `animation` appears in camera, markers, and data; `globe` appears in terrain and layers; `third-party` appears in visualization and drawing
- Cover technique or API specifics that are searchable but too narrow for a tab (`expressions`, `pmtiles`, `terrain`, `geojson`, `real-time`)
- Not duplicate the category system — if something is already navigable via a category, a matching tag adds little

From the 13 provisional clusters, the likely split is:

| Provisional cluster            | Likely scale     | Rationale                                                                         |
| ------------------------------ | ---------------- | --------------------------------------------------------------------------------- |
| Map setup and controls         | Category         | Foundational; getting-started entry point                                         |
| Layers and visual styling      | Category         | Core capability, highest volume                                                   |
| Camera and navigation          | Category         | Distinct developer goal, clear cluster                                            |
| Working with data (sources)    | Category         | Foundational, high volume                                                         |
| Markers, popups, and UI        | Category         | Distinct enough from interactivity; high demand                                   |
| Interactivity and events       | Category         | High volume, clear developer goal                                                 |
| Data visualization             | Category         | Distinct from general layers; heatmap/cluster/choropleth                          |
| Terrain and elevation          | Category         | Confirmed highest-voted SO question; large enough cluster                         |
| Globe and atmosphere           | Tag              | Globe examples belong to terrain, layers, viz simultaneously; `globe` as tag      |
| 3D models and custom renderers | Tag              | Sub-concern of terrain/layers; `three.js`, `custom-renderer` as tags              |
| Symbols, icons, and labels     | Needs validation | High demand (SO rank 6 at 7,513 views) but may be a sublayer of styling           |
| Animation                      | Tag              | Cuts across camera, markers, data viz; `animation` as cross-cutting tag           |
| Third-party integrations       | Tag              | deck.gl/terra-draw examples also belong to other categories; `third-party` as tag |

The mining run should validate this split, particularly for the clusters marked "needs validation," by checking whether the intent signals cluster at category scale or tag scale.

**Success criteria check (from #7576):** The taxonomy is ready to implement when:

- Categories are named in developer-goal language (what you're trying to do, not which API you're using)
- 6–10 categories, each with enough examples to fill a meaningful tab
- Every current example can be assigned to exactly one category
- A tag vocabulary covers the cross-cutting concerns, with each tag defined and scoped so it doesn't duplicate the category system
- The gap list, with surface column, has been incorporated into the proposed next steps for #7574

### For the skills backlog and evals (agent skills)

1. **Updated priority ranking** — Q1 rankings revised with Q2 volume baselines; flag any topics that have grown significantly
2. **New AI-mention threads** — any new confirmed failures since Q1, with developer intent + API/concept + failure mode recorded
3. **Eval prompt candidates** — each AI failure thread produces at minimum one explicit prompt, one implicit prompt, and one negative control (see eval README for format)
4. **Q2 skill candidates** — any new topics not in the Q1 backlog with sufficient signal

---

## How the two projects reinforce each other

The highest-leverage examples to write — and the highest-value skills to publish — are where developer intent demand and AI failure overlap. When developers frequently want to do X _and_ AI reliably fails at X, an authoritative example of X fixes the discoverability problem (for humans via the example page) and the accuracy problem (for AI via the skill) simultaneously.

From Q1 data and Q2 ecosystem research, preliminarily, the clearest overlaps are:

| Developer intent                             | AI failure signal                                                           | GL JS example gap?                                            | Skill status     |
| -------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------- |
| Set up terrain and elevation                 | High (Terrarium/Mapbox encoding, silent wrong output)                       | Partial (3D terrain exists, DEM encoding nuance absent)       | Backlog #19      |
| Use expressions for data-driven styling      | Confirmed dual AI failure (`["literal"]` wrapper)                           | Partial (some expression examples, gaps in filter patterns)   | Backlog #8       |
| Load custom tiles / PMTiles without a server | Confirmed (`addProtocol` hallucination, version drift)                      | PMTiles example exists; custom protocol pattern thin          | Published        |
| Self-host fonts, sprites, glyphs             | Developer explicitly avoided AI ("afraid of hallucinations")                | Symbol/icon examples exist; self-hosting setup absent         | Backlog #11      |
| Use React Native with MapLibre               | Predictive failure zone (v11 API overhaul; AI trained on v10 will be wrong) | Out of GL JS scope — gap is in `maplibre-react-native` docs   | Backlog #9 / #20 |
| Choose and install a React web wrapper       | `react-maplibre` archived Jan 2025; AI may still recommend it               | Out of GL JS scope — gap is in wrapper docs and cross-linking | Backlog #9       |

The React-related rows are noted here because they remain high-priority for the skills work even though they're out of scope for GL JS examples. Any new examples written in the terrain, expressions, PMTiles, or glyphs areas should be coordinated with the corresponding skill; any skill update in those areas should link to the corresponding example.

---

## Q2 work plan (historical)

The Q2 run was planned to verify React Native v11 coverage, rerun the Q1 search set with additional queries, record each result with intent/surface/AI-failure fields, and produce the taxonomy, gap, and backlog outputs that now live in the archived report and README.
