# MapLibre Agent Skills — Demand Mining Results: 2026-Q1

**Run dates:** 2026-03-04 through 2026-03-05
**Method:** GitHub CLI search (`gh search issues`, `gh api graphql` for discussions) + Stack Overflow web search + MapLibre community Slack manual search
**Repos searched:** `maplibre/maplibre-gl-js`, `maplibre/maplibre-native`, `maplibre/martin`, `maplibre/maplibre-style-spec`, `maplibre/maplibre-tile-spec`, `maplibre/maputnik`
**Limitations:** GitHub search API caps results at 50 per query (ceiling hits are confirmed very-high-volume); SO results limited to top 20 by votes for `maplibre-gl` tag; Slack search was manual, not exhaustive

---

## Priority Ranking (Evidence-Based)

All skills ranked — published (P), backlog (B), and closed (C). Published skills are placed where their evidence would rank them relative to backlog.

1. **[`maplibre-mapbox-migration`](https://github.com/maplibre/maplibre-agent-skills/tree/main/skills/maplibre-mapbox-migration)** (P) — Very High: Mapbox is the highest-volume cross-cutting topic across the entire ecosystem (50+ issues, 98 discussions); Mapbox-first documentation is a confirmed real developer strategy
2. **[`web-integration-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/9) #9** (B) — Very High: React at the 50-issue ceiling; multiple high-view SO questions; `addProtocol` v3→v4 is the ecosystem's most-documented AI failure pattern; framework wrapper choice is underdocumented
3. **[`style-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/8) #8** (B) — Very High: `["literal"]` wrapper failed for both ChatGPT and Claude independently; token string syntax has zero documentation; `$type` filter behavior doesn't match spec; expressions and filters both at 50-issue ceiling
4. **[`maplibre-cartography`](https://github.com/maplibre/maplibre-agent-skills/issues/11) #11** (B) — Very High: Highest single SO view count in the dataset (7,513); font/glyph/sprite setup is a confirmed developer AI-avoidance trigger
5. **[`maplibre-terrain-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/19) #19** (B) — High: Highest-voted SO question is terrain setup; Terrarium/mapbox encoding mismatch produces silently wrong output — no error, incorrect elevation; Mapterhorn and maplibre-contour have no AI training coverage
6. **[`martin-configuration-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/18) #18** (B) — High: Only skill with a confirmed, verbatim ChatGPT hallucination quote on record; config is the highest-volume topic in the martin repo (133 issues)
7. **[`maplibre-tile-sources`](https://github.com/maplibre/maplibre-agent-skills/tree/main/skills/maplibre-tile-sources)** (P) — High: Source management is the first question new MapLibre developers face; ChatGPT hallucination on this topic is documented
8. **[`maplibre-pmtiles-patterns`](https://github.com/maplibre/maplibre-agent-skills/tree/main/skills/maplibre-pmtiles-patterns)** (P) — High: `addProtocol` confirmed AI failure in two separate threads; v3→v4 break is undocumented in official docs
9. **[`data-visualization-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/13) #13** (B) — High: 3D at 50-issue ceiling; fill-extrusion "by design" color behavior is a classic API surprise
10. **[`google-maps-migration`](https://github.com/maplibre/maplibre-agent-skills/issues/15) #15** (B) — High: Mapbox confusion dominates GH; SO migration question at 2.8k views
11. **[`web-performance-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/10) #10** (B) — High: `setData` throttling is an intentional "not a bug" that produces confusing behavior with no error message
12. **[`store-locator-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/14) #14** (B) — High: Direct unprompted report of AI failure on a real-world task; specific use case with documented AI inadequacy
13. **[`native-gl-js-parity`](https://github.com/maplibre/maplibre-agent-skills/issues/20) #20** (B) — Medium: Predictable LLM failure vector — any model trained primarily on GL JS docs will suggest APIs that don't exist in Native
14. **[`cloud-native-sources`](https://github.com/maplibre/maplibre-agent-skills/issues/21) #21** (B) — Medium: AI advice confirmed insufficient for serverless raster tile generation; explicitly promised by current tile-sources skill
15. **[`style-quality`](https://github.com/maplibre/maplibre-agent-skills/issues/12) #12** (B) — Medium: ChatGPT-aided case confirms validation gap; blocked on #8 style-patterns
16. **[`geospatial-operations`](https://github.com/maplibre/maplibre-agent-skills/issues/6) #6** (B) — Medium: Moderate volume, no AI confusion threads found in Q1 mining
17. **[`open-search-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/7) #7** (C) — Low: Geocoding questions route to plugin repos; no MapLibre-specific AI failure signals found

---

## Evidence vs. Skills: Complete Cross-Reference

All skills — published and backlog — ranked by signal strength. "Ceiling" = 50-issue GitHub API cap; any topic hitting it is confirmed very-high-volume. SO rank numbers refer to the [Stack Overflow Top Questions](#stack-overflow-top-questions-maplibre-gl-tag) table above.

| Skill                                                                                                                       | Status    | Signal        | Key Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------- | --------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`maplibre-mapbox-migration`](https://github.com/maplibre/maplibre-agent-skills/tree/main/skills/maplibre-mapbox-migration) | Published | **Very High** | Mapbox: 50+ issues, 98 discussions (ceiling) — highest cross-cutting volume in the dataset; [SO rank 13](#stack-overflow-top-questions-maplibre-gl-tag) "setWellKnownTileServer blank screen" 2.8k views; Mapbox-first documentation strategy confirmed as real developer approach (Slack Thread 4)                                                                                                                                                                                                                                                                                                  |
| [`web-integration-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/9) (#9)                               | Backlog   | **Very High** | React: 50+ issues (ceiling); [SO ranks 2, 3, 10, 11](#stack-overflow-top-questions-maplibre-gl-tag) (6.3k–1k views); `addProtocol` v3→v4 AI failure ([gl-js #4475](https://github.com/maplibre/maplibre-gl-js/issues/4475), [discussion #4480](https://github.com/maplibre/maplibre-gl-js/discussions/4480)); framework wrapper choice gap confirmed (Slack Thread 4)                                                                                                                                                                                                                                |
| [`style-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/8) (#8)                                         | Backlog   | **Very High** | expression/filter: 50+ issues each (ceiling); `["literal"]` wrapper: **both ChatGPT and Claude failed** (Slack Thread 1); [discussion #1985](https://github.com/maplibre/maplibre-gl-js/discussions/1985): second `["literal"]` failure; token strings completely undocumented ([style-spec #772](https://github.com/maplibre/maplibre-style-spec/issues/772)); `$type` filter excludes MultiPolygon ([style-spec #1346](https://github.com/maplibre/maplibre-style-spec/issues/1346)); `["literal"]` validation bug ([style-spec #545](https://github.com/maplibre/maplibre-style-spec/issues/545)) |
| [`maplibre-cartography`](https://github.com/maplibre/maplibre-agent-skills/issues/11) (#11)                                 | Backlog   | **Very High** | glyph/sprite: 50+ issues (ceiling); [SO rank 6](#stack-overflow-top-questions-maplibre-gl-tag) "Load offline local glyphs, sprites and mbtiles" **7,513 views** (highest single question in dataset); developer explicitly avoided AI for sprite advice: _"I'm afraid of hallucinations"_ (Slack Thread 5)                                                                                                                                                                                                                                                                                           |
| [`maplibre-terrain-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/19) (#19)                            | Backlog   | **High**      | terrain: 50+ issues, 52 discussions; [SO rank 1](#stack-overflow-top-questions-maplibre-gl-tag) (highest-voted question is terrain setup); Terrarium/mapbox encoding produces **silent wrong output** — no error, wrong elevation values ([native #2783](https://github.com/maplibre/maplibre-native/issues/2783)); Slack Thread 7: AI advice insufficient for LiDAR → raster-dem pipeline                                                                                                                                                                                                           |
| [`martin-configuration-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/18) (#18)                        | Backlog   | **High**      | **Confirmed ChatGPT hallucination**: TOML config format ([martin #1892](https://github.com/maplibre/martin/issues/1892)); config: [133 issues](#maplibremartin) (highest single topic in martin); `DATABASE_URL` silently overrides config ([martin #1050](https://github.com/maplibre/martin/issues/1050)); TileJSON breaks behind reverse proxy ([martin #1054](https://github.com/maplibre/martin/issues/1054))                                                                                                                                                                                   |
| [`maplibre-tile-sources`](https://github.com/maplibre/maplibre-agent-skills/tree/main/skills/maplibre-tile-sources)         | Published | **High**      | ChatGPT hallucinated `removeSource`/`addSource` for source refresh ([gl-js #3419](https://github.com/maplibre/maplibre-gl-js/issues/3419)); [SO rank 7](#stack-overflow-top-questions-maplibre-gl-tag) "Load local .mbtiles" 5.1k views; PMTiles: 25 issues                                                                                                                                                                                                                                                                                                                                          |
| [`maplibre-pmtiles-patterns`](https://github.com/maplibre/maplibre-agent-skills/tree/main/skills/maplibre-pmtiles-patterns) | Published | **High**      | `addProtocol` confirmed AI failure in [gl-js #4475](https://github.com/maplibre/maplibre-gl-js/issues/4475) and [discussion #4480](https://github.com/maplibre/maplibre-gl-js/discussions/4480); v3→v4 API break (callback → Promise + AbortController) undocumented; PMTiles: 25 issues, 26 discussions, 50+ in Martin                                                                                                                                                                                                                                                                              |
| [`data-visualization-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/13) (#13)                          | Backlog   | **High**      | 3D: 50+ issues, 41 discussions (ceiling); fill-extrusion: 33 issues; `fill-extrusion-color: transparent` renders black "not a bug" ([gl-js #4954](https://github.com/maplibre/maplibre-gl-js/issues/4954)); cluster: 35; heatmap: 22                                                                                                                                                                                                                                                                                                                                                                 |
| [`google-maps-migration`](https://github.com/maplibre/maplibre-agent-skills/issues/15) (#15)                                | Backlog   | **High**      | Mapbox: 50+ issues, 98 discussions (ceiling); [SO rank 13](#stack-overflow-top-questions-maplibre-gl-tag) "setWellKnownTileServer blank screen (React Native)" 2.8k views                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [`web-performance-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/10) (#10)                             | Backlog   | **High**      | performance: 50+ issues, 43 discussions (ceiling); `setData` throttling filed as bug, closed "not a bug" ([gl-js #6344](https://github.com/maplibre/maplibre-gl-js/issues/6344)); [SO rank 9](#stack-overflow-top-questions-maplibre-gl-tag) "Reduce xyz vector tile requests" 2.2k views                                                                                                                                                                                                                                                                                                            |
| [`store-locator-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/14) (#14)                               | Backlog   | **High**      | Direct unprompted AI failure report: _"gen AI really seems to struggle with maplibre... didn't work or broke quickly"_ (Slack Thread 4); marker: 50 issues; cluster: 35                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [`native-gl-js-parity`](https://github.com/maplibre/maplibre-agent-skills/issues/20) (#20)                                  | Backlog   | **Medium**    | `js-parity` label: 26 open issues in maplibre-native; `addProtocol` absent from Native ([native #3562](https://github.com/maplibre/maplibre-native/issues/3562)); globe projection absent ([native #3161](https://github.com/maplibre/maplibre-native/issues/3161)); `drawAsSdf=true` unknown to GL JS-trained models (Slack Thread 5); AI hallucinated explanation for Native tile error (Slack Thread 2)                                                                                                                                                                                           |
| [`cloud-native-sources`](https://github.com/maplibre/maplibre-agent-skills/issues/21) (#21)                                 | Backlog   | **Medium**    | Placeholder in `maplibre-tile-sources` SKILL.md (explicitly promised); Slack Thread 7: AI advice confirmed insufficient for serverless raster tile generation                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [`style-quality`](https://github.com/maplibre/maplibre-agent-skills/issues/12) (#12)                                        | Backlog   | **Medium**    | ChatGPT-aided `clusterMaxZoom` diagnosis ([gl-js #5929](https://github.com/maplibre/maplibre-gl-js/issues/5929)); Maputnik PMTiles `maxzoom` limitation ([maputnik #1028](https://github.com/maplibre/maputnik/issues/1028)); prototype pollution crashes validator ([style-spec #1025](https://github.com/maplibre/maplibre-style-spec/issues/1025)); blocked on #8 style-patterns                                                                                                                                                                                                                  |
| [`geospatial-operations`](https://github.com/maplibre/maplibre-agent-skills/issues/6) (#6)                                  | Backlog   | **Medium**    | Turf.js: 11 issues; routing: 5; no AI-mention threads found in Q1 mining                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [`open-search-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/7) (#7)                                   | Closed    | **Low**       | No geocoding GH issue volume; questions route to plugin repos rather than maplibre-gl-js                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## Evidence for Existing Skills

Evidence for published skills is incorporated into the [cross-reference table](#evidence-vs-skills-complete-cross-reference) above. Proposed updates from mining:

### `maplibre-tile-sources`

→ **Propose issue:** Update `maplibre-tile-sources` to add a DEM sources subsection with encoding distinction and current open sources (see also: #19 terrain-patterns)

### `maplibre-mapbox-migration`

→ Filed as [#22](https://github.com/maplibre/maplibre-agent-skills/issues/22): Update `maplibre-mapbox-migration` to add a Maputnik style adaptation workflow note and a terrain source migration subsection

### `maplibre-pmtiles-patterns`

→ **No new issue needed:** This update should follow naturally from writing #9 (web-integration-patterns), which will own the v3→v4 principle. Cross-reference from pmtiles-patterns is a minor edit.

---

## Skill Candidates from Ecosystem Mining

Four new skill areas not currently in the backlog, supported by this mining run:

| Proposed Skill                  | Evidence                                                                                                                                                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maplibre-native-gl-js-parity`  | 26 open `js-parity` issues; LLMs trained on GL JS will suggest non-working APIs to Native users                                                                                                                                                                                                                                 |
| `martin-configuration-patterns` | 133 config issues; 1 confirmed ChatGPT hallucination (TOML); 7 documented operational gotchas                                                                                                                                                                                                                                   |
| `maplibre-cloud-native-sources` | Explicitly promised by tile-sources skill placeholder; COG via `@geomatico/maplibre-cog-protocol`; FlatGeobuf; distinct from PMTiles (raster/vector source formats, not tile archives)                                                                                                                                          |
| `maplibre-terrain-patterns`     | terrain: 50+ GH issues, 52 discussions; highest-viewed SO question is terrain setup; Terrarium/Mapbox encoding distinction is a documented AI failure zone; content fragmented across tile-sources, pmtiles-patterns, and planned data-viz skill — consolidates into coherent workflow; removes scope overlap from #13 data-viz |

All four were filed as issues in March 2026: [#18](https://github.com/maplibre/maplibre-agent-skills/issues/18), [#19](https://github.com/maplibre/maplibre-agent-skills/issues/19), [#20](https://github.com/maplibre/maplibre-agent-skills/issues/20), [#21](https://github.com/maplibre/maplibre-agent-skills/issues/21).

A fifth candidate, `maplibre-ecosystem-overview`, emerged from Slack Thread 4 — a developer described needing a guide to platform selection, tile providers, and editing tools across the whole MapLibre org. Filed as [#26](https://github.com/maplibre/maplibre-agent-skills/issues/26).

---

## AI-Mention Threads (maplibre/maplibre-gl-js)

Queries run:

- `gh search issues --repo maplibre/maplibre-gl-js "ChatGPT"`
- `gh search issues --repo maplibre/maplibre-gl-js "Copilot"`
- `gh search issues --repo maplibre/maplibre-gl-js "Claude"`
- `gh search issues --repo maplibre/maplibre-gl-js "Gemini"`
- `gh search issues --repo maplibre/maplibre-gl-js "asked AI"`
- `gh search issues --repo maplibre/maplibre-gl-js "AI said"`
- `gh search issues --repo maplibre/maplibre-gl-js "language model"`

**Total results: 8 issues** (ChatGPT: 6, Copilot: 1, Claude: 1, Gemini: 0)

| Issue                                                           | State  | Date       | Title                                                                   | Developer's Underlying Question                                                                   | AI Tool                      | AI Wrong?                                                                                                                      |
| --------------------------------------------------------------- | ------ | ---------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [#3419](https://github.com/maplibre/maplibre-gl-js/issues/3419) | closed | 2023-11-28 | Map Source Refresh                                                      | How to force a tile source to reload after a server-side data change without resetting all layers | ChatGPT                      | Yes — ChatGPT suggested `removeSource`/`addSource` which destroys all layers; correct answer is `map.getSource(id).setTiles()` |
| [#4475](https://github.com/maplibre/maplibre-gl-js/issues/4475) | closed | 2024-07-31 | Having trouble writing a working `addProtocol` for a raster layer       | How to use `addProtocol` to render arbitrary pixel data as raster tiles                           | ChatGPT                      | Implicit — dev tried everything including ChatGPT for 4 hours; `addProtocol` API changed across versions                       |
| [#5929](https://github.com/maplibre/maplibre-gl-js/issues/5929) | closed | 2025-05-22 | API docs for `clusterMaxZoom` need to specify it needs to be an integer | Why do clusters disappear when `clusterMaxZoom` is a float?                                       | ChatGPT                      | Partial — ChatGPT helped diagnose the type issue, but docs didn't warn about it                                                |
| [#5038](https://github.com/maplibre/maplibre-gl-js/issues/5038) | open   | 2024-11-12 | raster-fade-duration is ignored after v4.2.0                            | Why does `raster-fade-duration: 0` stop working after an upgrade                                  | GitHub Copilot (in comments) | —                                                                                                                              |
| [#6879](https://github.com/maplibre/maplibre-gl-js/issues/6879) | closed | 2025-12-17 | Janky animation when setting zoom with small delta                      | Why `setZoom` with a tiny delta causes erratic origin-point movement                              | Claude                       | —                                                                                                                              |

**Key signals:**

- #3419: ChatGPT hallucinated a destructive workaround (`removeSource`/`addSource`) for a problem that has a non-destructive solution (`setTiles()`). Classic skill gap.
- #4475: Developer exhausted ChatGPT, Stack Overflow, docs, source code before filing. `addProtocol` API changed across versions — perfect skill candidate.

---

## High-Volume Topics (GitHub Issue Keyword Search)

Topics where search hit the 50-issue API ceiling = confirmed high volume.

| Topic                  | Count         | Notes                                                        |
| ---------------------- | ------------- | ------------------------------------------------------------ |
| React                  | 50+ (ceiling) | Framework integration #1 by far                              |
| font / glyph           | 50+           | Self-hosting fonts is a constant pain point                  |
| filter                 | 50+           | Expression-based filtering confuses many developers          |
| expression             | 50+           | Style spec expressions; LLMs frequently produce wrong syntax |
| GeoJSON                | 50+           | Source management, setData patterns                          |
| Mapbox (compatibility) | 50+           | Migration confusion; Mapbox APIs that no longer work         |
| worker / bundler       | 50+           | Vite, Webpack, esbuild setup issues                          |
| performance            | 50+           |                                                              |
| 3D                     | 50+           | Terrain, extrusions, globe mode                              |
| terrain                | 50            | Near ceiling                                                 |
| marker                 | 50            |                                                              |
| popup                  | 37            |                                                              |
| sprite                 | 40            | Icon/sprite setup                                            |
| queryRenderedFeatures  | 37            |                                                              |
| cluster                | 35            |                                                              |
| fill-extrusion         | 33            |                                                              |
| flyTo                  | 34            |                                                              |
| setData                | 29            |                                                              |
| PMTiles                | 25            |                                                              |
| heatmap                | 22            |                                                              |
| Vue                    | 15            |                                                              |
| fitBounds              | 13            |                                                              |
| Turf.js                | 11            |                                                              |
| routing                | 5             |                                                              |
| choropleth             | 3             |                                                              |

---

## "Not a Bug" / "By Design" API Surprises

These are the highest-quality confusion signals — developers expected behavior X, got Y, filed a bug.

All issues below are in `maplibre/maplibre-gl-js`.

| Issue                                                                  | Behavior                                                  | Why It Matters                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [#1325](https://github.com/maplibre/maplibre-gl-js/issues/1325) (open) | GeoJSON feature properties are stringified in map events  | Properties arrive as strings, not typed values — classic gotcha in click handlers |
| [#1952](https://github.com/maplibre/maplibre-gl-js/issues/1952) (open) | `querySourceFeatures()` returns empty if no layer defined | Underdocumented requirement; LLMs routinely omit the layer argument               |
| [#4954](https://github.com/maplibre/maplibre-gl-js/issues/4954)        | `fill-extrusion-color` transparent renders as black       | 3D extrusion color surprise; not obvious from style spec                          |
| [#3242](https://github.com/maplibre/maplibre-gl-js/issues/3242)        | `on("click")` fires different times on desktop vs mobile  | Touch vs mouse event model difference                                             |
| #6344 (open)                                                           | `setData` lag under rapid updates                         | Performance throttling is intentional but underdocumented                         |

---

## Stack Overflow Top Questions (`maplibre-gl` tag)

Note: The active SO tag is `maplibre-gl`, not `maplibre-gl-js` (the latter returns 0 results).

| Rank | Votes | Views | Title                                                                                  | Skill Relevance                          |
| ---- | ----- | ----- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1    | 7     | 1,345 | MapLibre GL JS with terrain layer: How to pin a horizontal plane to specific altitude? | #19 terrain-patterns                     |
| 2    | 6     | 6,326 | How to use MapLibre GL JS in React Native                                              | #9 web-integration                       |
| 3    | 6     | 2,195 | How do I use MapLibre-GL from TypeScript?                                              | #9 web-integration                       |
| 4    | 5     | 3,089 | Show/hide labels by zoom level with expressions                                        | #8 style-patterns                        |
| 5    | 5     | 1,209 | "text-field" requires a style "glyphs" property                                        | #11 cartography                          |
| 6    | 4     | 7,513 | Load offline local glyphs, sprites and mbtiles                                         | #11 cartography — **highest view count** |
| 7    | 4     | 5,125 | Load local .mbtiles with maplibre-gl-js                                                | tile sources skill                       |
| 8    | 4     | 2,861 | Expression to get value from nested objects                                            | #8 style-patterns                        |
| 9    | 4     | 2,166 | Reduce xyz vector tile requests                                                        | #10 performance                          |
| 10   | 4     | 1,555 | Load markers dynamically with React and maplibre                                       | #9 web-integration                       |
| 11   | 4     | 1,020 | Why doesn't `map.on('load')` always fire?                                              | #9 web-integration                       |
| 12   | 3     | 4,761 | How to get MapLibre layer properties?                                                  | #8 style-patterns                        |
| 13   | 3     | 2,801 | Mapbox warning setWellKnownTileServer blank screen (React Native)                      | #15 google-maps-migration                |
| 14   | 3     | 1,894 | No labels on map serving tiles locally                                                 | #11 cartography                          |
| 15   | 3     | 1,405 | Add custom icons to unclustered markers with filter                                    | #8 style-patterns                        |

---

## GitHub Mining: maplibre-style-spec and maplibre-tile-spec

**AI mentions:** Zero genuine threads in either repo. These are spec repos, not implementation repos — user confusion tends to surface in `maplibre-gl-js` and `maplibre-native` instead.

### maplibre/maplibre-style-spec (~1,498 total issues, 54 open)

**High-volume topics (issues):**

| Topic         | Count        | Notes                                                             |
| ------------- | ------------ | ----------------------------------------------------------------- |
| expression    | 50 (ceiling) | Expression system complexity dominates                            |
| layer         | 50 (ceiling) | Cross-cutting                                                     |
| case          | 50 (ceiling) | Includes `case` expression                                        |
| Mapbox        | 37           | Spec parity questions                                             |
| format        | 29           | `format` expression for rich text — not intuitive                 |
| color         | 26           | Color expressions, color spaces                                   |
| filter        | 24           | Legacy vs. expression filters, `$type` behavior                   |
| zoom          | 24           | Zoom-dependent expressions                                        |
| paint         | 25           | paint vs. layout confusion                                        |
| interpolate   | 16           | Interpolation expressions                                         |
| text-field    | 13           | `text-field` vs. token strings                                    |
| literal       | 10           | `["literal"]` gotchas — corroborates Slack + discussions findings |
| feature-state | 8            | Feature state limitations                                         |

**Notable open spec bugs and documentation gaps:**

| Issue                                                                | Gap                                                                                                                        | AI relevance                                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [#772](https://github.com/maplibre/maplibre-style-spec/issues/772)   | Token string syntax (`"{name:latin}"` in `text-field`) is widely used in real-world styles but **completely undocumented** | High — no training data exists; AI will either invent syntax or tell users to use `["get"]` |
| [#926](https://github.com/maplibre/maplibre-style-spec/issues/926)   | Spec says "units in pixels" but on Native they are device-independent pixels (dp)                                          | High — AI will confidently quote the spec and be wrong for Native users                     |
| [#545](https://github.com/maplibre/maplibre-style-spec/issues/545)   | `["literal", [...]]` with dynamic expressions inside fails validation even when semantically valid                         | Directly corroborates the Slack + Discussion #1985 `["literal"]` failure cluster            |
| [#1346](https://github.com/maplibre/maplibre-style-spec/issues/1346) | `["==", "$type", "Polygon"]` filter does not match `MultiPolygon` geometries                                               | AI will quote the spec correctly but the implementation doesn't match                       |
| [#939](https://github.com/maplibre/maplibre-style-spec/issues/939)   | `hillshade-illumination-direction` documented as `[0,359]` but should be `[0,360)`                                         | Minor but illustrates spec/implementation drift                                             |
| [#1025](https://github.com/maplibre/maplibre-style-spec/issues/1025) | Prototype pollution (`__proto__` key) crashes the validator instead of returning errors                                    | Security/reliability gap in validation tooling                                              |

**Skill implication:** The spec repo confirms that the expression system is where documentation debt is highest. Three of the spec issues (#772, #545, #1346) are directly in the AI failure zone — either undocumented behavior AI has no training data for, or spec text that doesn't match implementation behavior.

---

### maplibre/maplibre-tile-spec (~1,037 total issues, 52 open, 22 open PRs)

**AI mentions:** Zero. This is an active engineering-internal spec repo for MLT (MapLibre Tile format, the next-generation binary format replacing MVT). Most issues are implementation bugs in encoders/decoders across Java/Rust/JS/C++. Pre-production — not yet a source of user-facing AI confusion.

**High-volume topics:** MVT (50, ceiling), encoding (32), geometry (33), vector tile (30), feature (25), layer (22), Mapbox (18)

**Notable open spec questions:**

- [#190](https://github.com/maplibre/maplibre-tile-spec/issues/190): Layer order not preserved through MVT→MLT conversion (silent behavioral change)
- [#756](https://github.com/maplibre/maplibre-tile-spec/issues/756): No documentation for tileset-level metadata
- [#753](https://github.com/maplibre/maplibre-tile-spec/issues/753): Open RFC on nested List/Map type support (fundamental open question)

**Skill implication:** No skills content appropriate yet — format is pre-production. Revisit when MLT reaches wider adoption.

---

## GitHub Mining: maplibre-native and martin

### maplibre/maplibre-native

**AI mentions:** Zero genuine threads. Two false positives: Copilot bot issue (#3746), Android Studio "Ask Gemini" crash boilerplate (#3359, #3252).

**High-volume topics:**

| Topic        | Count | Notes                                              |
| ------------ | ----- | -------------------------------------------------- |
| Android      | 538   | Platform-specific issues dominate                  |
| iOS          | 413   |                                                    |
| style        | 398   | Style spec parity with GL JS is a major pain point |
| Mapbox       | 268   | Migration confusion, API porting                   |
| crash        | 194   | Renderer crashes (Vulkan, OpenGL, lifecycle)       |
| expression   | 58    | Style expression compatibility gaps vs GL JS       |
| Swift        | 64    |                                                    |
| Flutter      | 22    | Third-party wrapper                                |
| React Native | 22    | Third-party wrapper                                |
| migration    | 21    |                                                    |

**`js-parity` label (26 open, 16 closed)** — The deepest systemic confusion category: features that work in GL JS but are unimplemented or broken in Native. LLMs trained on GL JS docs will confidently suggest these as solutions to Native users. Notable open gaps:

- `addProtocol` (custom URL scheme registration) — [#3562](https://github.com/maplibre/maplibre-native/issues/3562)
- Globe projection — [#3161](https://github.com/maplibre/maplibre-native/issues/3161)
- `interpolate-hcl` / `interpolate-lab` expressions — [#2784](https://github.com/maplibre/maplibre-native/issues/2784)
- RasterDEM custom encoding factors (`redFactor`, etc.) — [#2783](https://github.com/maplibre/maplibre-native/issues/2783)
- `queryRenderedFeatures` inconsistency between Android and iOS — [#2828](https://github.com/maplibre/maplibre-native/issues/2828)

**Other notable API surprises:**

- Raster-DEM source auto-appends `@2x` to tile URLs, causing 404s — [#2717](https://github.com/maplibre/maplibre-native/issues/2717)
- `line-gradient` with interpolation expressions doesn't parse on Native — [#2582](https://github.com/maplibre/maplibre-native/issues/2582)

**Skill implication:** No AI hallucination threads, but the `js-parity` gap is a predictable AI failure vector — any LLM drawing on GL JS documentation will suggest APIs that don't work on Native. A skill documenting the GL JS ↔ Native parity gaps would directly address this.

---

### maplibre/martin

**AI mentions:** One confirmed ChatGPT hallucination.

| Issue                                                   | Developer's question                                          | AI tool | AI wrong?                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#1892](https://github.com/maplibre/martin/issues/1892) | Why does my TOML config produce a YAML deserialization error? | ChatGPT | **Yes** — ChatGPT told the user Martin accepts TOML config. Martin only accepts YAML. Developer's own words: _"I tried to take a shortcut by asking chatgpt.. lol and I am pretty sure it hallucinated the .toml format requirement."_ |

**High-volume topics:**

| Topic          | Count | Notes                                                   |
| -------------- | ----- | ------------------------------------------------------- |
| config         | 133   | Highest single topic — format, env vars, YAML structure |
| MBTiles        | 111   | Format handling, metadata, serving                      |
| PostgreSQL     | 76    | Connection strings, pool exhaustion, function sources   |
| style          | 67    | Style serving, sprite/font resolution                   |
| TileJSON       | 64    | Metadata, tiles field URL, layer IDs                    |
| PMTiles        | 51    | S3, authentication, local vs remote path                |
| font           | 42    | Font serving, 404s, naming conventions                  |
| Mapbox         | 39    | Style compatibility, GL JS integration                  |
| sprite         | 38    | Sprite sheet serving, SDF sprites                       |
| CORS           | 9     |                                                         |
| authentication | 8     |                                                         |

**Notable API surprises (from `question` label, 50 closed issues):**

| Issue                                                   | Surprise                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [#1892](https://github.com/maplibre/martin/issues/1892) | Config format is YAML only — ChatGPT hallucinated TOML support                                                          |
| [#1050](https://github.com/maplibre/martin/issues/1050) | `DATABASE_URL` env var silently overrides config file — PaaS deployments (DigitalOcean, Railway) set this automatically |
| [#938](https://github.com/maplibre/martin/issues/938)   | `--config` and connection string CLI args are mutually exclusive — no warning until runtime                             |
| [#1054](https://github.com/maplibre/martin/issues/1054) | TileJSON `tiles` field reflects internal host, not reverse proxy host — breaks behind Nginx                             |
| [#1284](https://github.com/maplibre/martin/issues/1284) | Font file path naming (underscores vs. spaces) affects URL routing                                                      |
| [#931](https://github.com/maplibre/martin/issues/931)   | CORS config not obvious; conflicts when also set via Nginx                                                              |
| [#78](https://github.com/maplibre/martin/issues/78)     | No built-in auth — martin is intentionally auth-free; security must be layered upstream                                 |

**Skill implication:** Martin has a dense cluster of operational gotchas around configuration and deployment. Config format (YAML only, not TOML), the `DATABASE_URL` override, reverse proxy TileJSON, and no-built-in-auth are all high-quality skill content — each is a real developer surprise with documented issues. The TOML hallucination is a confirmed AI failure.

---

## GitHub Mining: maplibre/maputnik

Maputnik is the MapLibre organization's style editor — a web app for creating and editing MapLibre style JSON. It is part of the MapLibre ecosystem and is referenced in the planned `maplibre-style-quality` skill (#12).

**AI mentions:** Zero genuine threads (searched "ChatGPT OR Copilot OR Claude OR Gemini" and "asked AI OR AI said OR AI suggested" — both returned empty results).

**Open issues:** 87 open. Label breakdown: enhancement (31), discussion (13), survey-mentioned (11), bug (7), help wanted (6).

**Keyword volumes:**

| Topic      | Count         | Notes                                                          |
| ---------- | ------------- | -------------------------------------------------------------- |
| layer      | 50+ (ceiling) |                                                                |
| source     | 50+ (ceiling) |                                                                |
| export     | 50+ (ceiling) | Style export workflows                                         |
| Mapbox     | 50+ (ceiling) | Importing Mapbox-era styles to adapt them                      |
| font       | 43            | Font setup and serving — corroborates #11 cartography evidence |
| expression | 28            |                                                                |
| glyph      | 27            |                                                                |
| sprite     | 24            |                                                                |
| plugin     | 16            |                                                                |
| import     | 15            | Style import workflows                                         |
| validate   | 14            |                                                                |

**Notable open issues:**

| Issue                                                     | Title                                                         | Relevance                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [#807](https://github.com/maplibre/maputnik/issues/807)   | Support PMTiles in Editor                                     | PMTiles sources not fully supported — users can't validate PMTiles-backed styles in Maputnik |
| [#1028](https://github.com/maplibre/maputnik/issues/1028) | Overzooming in PMTiles Data Source - No Way to Define maxzoom | UI doesn't expose `maxzoom` for custom sources                                               |
| [#961](https://github.com/maplibre/maputnik/issues/961)   | Support Martin's `/catalog` API for font discovery            | Maputnik can't auto-discover fonts from a live Martin server                                 |
| [#1294](https://github.com/maplibre/maputnik/issues/1294) | Sprite previewing via dropdowns                               | Sprite management in the UI is limited                                                       |
| [#819](https://github.com/maplibre/maputnik/issues/819)   | Add a default basemap                                         | No default basemap — users must supply a style URL to get started                            |
| [#950](https://github.com/maplibre/maputnik/issues/950)   | No entry field for `icon-padding`                             | Several style spec properties are missing from the UI                                        |
| [#911](https://github.com/maplibre/maputnik/issues/911)   | Allow drag-and-drop style.json for upload                     | Common UX pattern missing                                                                    |

**Assessment:** No AI failure threads — Maputnik issues are about the editor tool's own feature gaps, not about style knowledge gaps. The evidence is useful for the `#12 style-quality` skill in two ways: (1) Maputnik's PMTiles limitations are worth documenting so users know the tool's current constraints, and (2) the "Mapbox" ceiling confirms that importing Mapbox-era styles into Maputnik is a common migration workflow — exactly the use case the skill should address. Font (43) and glyph (27) volumes corroborate the #11 cartography evidence: font setup is a persistent pain point across the MapLibre ecosystem.

**Skill implication:** No new skill candidates from this repo. Evidence primarily strengthens #12 (style-quality) and #11 (cartography). The Maputnik PMTiles limitation (#807, #1028) should be noted in #12 as a known editor constraint.

---

## GitHub Discussions Mining (2026-03-04)

**Repos searched:** `maplibre/maplibre-gl-js`, `maplibre/maplibre-native`, `maplibre/martin`, `maplibre/maplibre-style-spec`
**Method:** GitHub GraphQL API via `gh api graphql`, searched by repo + AI tool name
**Result:** All genuine AI mentions are in `maplibre-gl-js`. Zero found in `maplibre-native`, `martin`, or `maplibre-style-spec`.

### AI-Mention Discussions: maplibre/maplibre-gl-js

| Discussion                                                           | Title                                           | Developer's question                                                    | AI tool       | AI wrong?                                                                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [#1985](https://github.com/maplibre/maplibre-gl-js/discussions/1985) | `icon-text-fit-padding` interpolate expressions | How to interpolate a 4-number array property by zoom level              | ChatGPT       | Yes — first two attempts failed at runtime; third worked but produced a TypeScript type error. Maintainer had to confirm.             |
| [#4480](https://github.com/maplibre/maplibre-gl-js/discussions/4480) | `addProtocol` for a raster layer                | How to supply custom 256×256 raster tiles via `addProtocol`             | ChatGPT       | Yes — after 4 hours including ChatGPT, still broken; maintainer pointed to reference implementation. API had changed across versions. |
| [#4304](https://github.com/maplibre/maplibre-gl-js/discussions/4304) | WebGL conformity testing                        | How long do conformance tests take; what do failures mean for MapLibre? | ChatGPT       | Partial — trivial estimate answered; substantive question not answered, which is why the developer posted                             |
| [#6710](https://github.com/maplibre/maplibre-gl-js/discussions/6710) | "Vibe code a Night Lights Globe demo"           | Showcase — not a help request                                           | ChatGPT Codex | Introduced a bug: Z/Y sun azimuth axes inverted in day/night shadow logic                                                             |

**Notable pattern:** Discussion #1985 (`icon-text-fit-padding` + `["literal"]`) is the second confirmed instance of ChatGPT failing on the `["literal"]` array wrapper requirement — the Slack thread about `setFilter` being the first. Same failure mode, different expression property.

**Notable pattern:** Discussion #4480 (`addProtocol`) was also found as issue #4475 in the issues mining. Same developer, same problem — posted as both an issue and a discussion. Confirms this is a genuine high-friction API.

### Discussion Volume: maplibre/maplibre-gl-js

| Topic       | Discussion count |
| ----------- | ---------------- |
| style       | 210              |
| Mapbox      | 98               |
| terrain     | 52               |
| marker      | 50               |
| performance | 43               |
| 3D          | 41               |
| expression  | 34               |
| React       | 32               |
| filter      | 32               |
| font        | 32               |
| PMTiles     | 26               |
| glyph       | 22               |
| popup       | 18               |
| cluster     | 17               |
| migration   | 11               |

`style` (210) and `Mapbox` (98) dominate — largest cluster is styling questions and migration, exactly where AI is most likely to give outdated Mapbox-era advice.

---

## Slack Mining Results (2026-03-04)

**Source:** MapLibre community Slack
**Date range:** 2025-03-06 through 2026-03-07 (one year)
**Channels searched:** #maplibre, #maplibre-tile-format, #maplibre-gl-js, #maplibre-i18n, #maplibre-native, #maplibre-android, #maplibre-rs, #maplibre-ios, #maplibre-tile-spec, #maplibre-style-spec, #maplibre-react-native, #maplibre-navigation, #maplibre-native-dev, #maplibre-martin, #maplibre-swiftui, #maplibre-swift, #maplibre-compose, #maplibre-flutter
**Search string used:**

```
asked +ai before:2026-03-07 after:2025-03-06 in:#maplibre in:#maplibre-tile-format in:#maplibre-gl-js in:#maplibre-i18n in:#maplibre-native in:#maplibre-android in:#maplibre-rs in:#maplibre-ios in:#maplibre-tile-spec in:#maplibre-style-spec in:#maplibre-react-native in:#maplibre-navigation in:#maplibre-native-dev in:#maplibre-martin in:#maplibre-swiftui in:#maplibre-swift in:#maplibre-compose in:#maplibre-flutter
```

### Thread 1: `setFilter` with array spread — confirmed dual AI failure

A developer's `in` expression filter failed when passing a spread array as a value. The fix — `["literal", [...]]` — is required whenever an array is passed as data rather than interpreted as an expression, a non-obvious requirement with no JavaScript equivalent. Both ChatGPT and Claude gave incorrect answers to this question.

_Skill relevance: **#8 style-patterns** — the `["literal"]` wrapper for array values in filters is the strongest multi-LLM failure signal in the dataset and must be an explicit example in the expressions skill._

---

### Thread 2: `invalid tag exception` in MapLibre Native — AI correct fix, wrong explanation

An AI identified a working fix for an `invalid tag exception` when using maplibre-contour-generated tiles in MapLibre Native — but its explanation hallucinated MVT spec requirements that don't actually exist. The developer confirmed the fix worked but noted "what the AI said seems like a lie."

_Skill relevance: `maplibre-contour` (#19 terrain-patterns — 261 stars, v0.1.0 Dec 2024, powers onthegomap.com). The "correct fix, hallucinated explanation" failure mode belongs in #20 native-parity as a caveat about AI debugging help._

---

### Thread 3: AI-assisted feature-state implementation for MapLibre iOS

A contributor used Cursor to implement `feature-state` for MapLibre iOS/Native. The thread pivoted to IP indemnification risk when AI codegen tools are trained on Mapbox's "source available" (non-open-source) iOS SDK — Anthropic and GitHub Copilot indemnification covers Commercial/Enterprise plans only; routing through Cursor may not qualify.

_Signal type: Community governance context, not a skill content signal._

---

### Thread 4: Store locator request — direct AI failure confirmation

A developer tried genAI multiple times for a MapLibre store locator before asking the community — _"gen AI really seems to struggle with maplibre... it didn't work or broke quickly."_ A maintainer's position that "GenAI can simply handle these questions" was directly contradicted by the developer's experience. Multiple React wrapper options were offered without trade-off guidance. A separate developer described a gap in ecosystem onboarding documentation spanning platform choices, tile providers, and editing tools.

_Skill relevance:_

- **#9 web-integration-patterns**: wrapper choice needs a decision framework
- **store-locator-patterns (archived)**: real demand + AI failure on this specific task confirmed — reconsider archive
- **maplibre-mapbox-migration**: Mapbox-first documentation strategy confirmed as real developer approach
- **potential new skill — `maplibre-ecosystem-overview`**: developer requested an onboarding guide spanning the full MapLibre org

---

### Thread 5: SVG icons / SDF sprites — AI confusion, explicit hallucination avoidance

A developer was told "the solution is SDF" (likely by AI) and asked the community for clarification on sprite tooling. When a maintainer suggested asking genAI, the developer explicitly declined: _"I like to speak with real humans, I'm afraid of hallucinations."_ A community member confirmed that SVG→PNG→sprite is a documented recurring new-developer misconception; the maplibre-compose `drawAsSdf=true` API is unknown to GL JS-trained models.

_Skill relevance:_

- **#11 maplibre-cartography**: SVG→PNG→sprite workflow and when SDF is actually needed — confirmed recurring pain point
- **#20 maplibre-native-gl-js-parity**: compose-specific `drawAsSdf=true` API invisible to GL JS-trained models

---

### Thread 6: MLT winding order — documentation gap at contributor level

A MapLibre contributor found that winding order is not yet explicitly documented in the MLT spec — confirmed by another contributor. If the answer isn't written down for contributors, AI tools cannot know it either.

_Skill relevance: Low immediate priority — MLT is pre-production. Revisit when adoption grows._

---

### Thread 7: Slippy map tile server (PDAL/GDAL/LiDAR) — AI consulted for serverless tile generation

A developer explicitly stated they had "been asking AI" for serverless tile generation advice for a LiDAR → cliff-edge raster tile pipeline, then came to the community anyway — AI advice was insufficient for this use case.

_Skill relevance:_

- **#21 maplibre-cloud-native-sources**: serverless tile generation and free-tier hosting is the exact scope of this skill
- **#19 maplibre-terrain-patterns**: LiDAR → raster-dem pipeline is a real community use case
- **#18 martin-configuration-patterns**: GDAL-generated tiles served via martin is a real deployment path

---

## Q2 2026 Follow-on

See the consolidated [Q2 2026 mining](../q2/README.md) for the full handoff to the second run; the strategy and report remain linked there.

**Completed this run:**

- [x] Searched `maplibre/maplibre-native`, `maplibre/martin`, `maplibre/maplibre-style-spec` — 2026-03-04
- [x] Searched `maplibre/maputnik` — 2026-03-05
- [x] MapLibre Slack searched manually for AI mentions — 2026-03-04
- [x] Four new skill issues filed: #18, #19, #20, #21
- [x] Issue comments and body updates filed on existing backlog issues (#8–#15)

**Addenda (post-publication, 2026-03-06):**

- [x] Thread 4: Store locator / AI failure confirmation + documentation gap — added to Slack Mining Results
- [x] Thread 5: SVG/SDF/sprite workflow + explicit hallucination avoidance — added to Slack Mining Results
- [x] Thread 6: MLT winding order / spec documentation gap at contributor level — added to Slack Mining Results
- [x] Thread 7: Slippy map tile server (PDAL/GDAL/LiDAR) / AI consulted for serverless tile generation — added to Slack Mining Results
- Threads 4–5 strengthen #9 (web-integration), #11 (cartography), #20 (native-parity); Thread 4 evidence contributed to unarchiving #14 (store-locator)
- Thread 7 strengthens #21 (cloud-native-sources), #19 (terrain-patterns), #18 (martin-configuration-patterns)

**Q2 tasks:**

- [x] Unarchived `store-locator-patterns` ([#14](https://github.com/maplibre/maplibre-agent-skills/issues/14)) — confirmed demand + AI failure (Thread 4)
- [x] Filed `maplibre-ecosystem-overview` ([#26](https://github.com/maplibre/maplibre-agent-skills/issues/26)) — under evaluation (Thread 4)

## Related doc

- [MapLibre-Agent-Skills-Issue-Review-2026-03-05.md](./MapLibre-Agent-Skills-Issue-Review-2026-03-05.md)
