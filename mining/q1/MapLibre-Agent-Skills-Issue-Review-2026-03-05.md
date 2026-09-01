# MapLibre Agent Skills — Issue Review & Gap Analysis

**Revised:** 2026-03-05
**Based on:** Current issue text (post-edit), existing skills (tile-sources, mapbox-migration, pmtiles-patterns), and 2026-Q1 demand mining

---

## Notes on scope

The existing skills set a clear pattern: focused, actionable, with deliberate cross-references to companion skills rather than trying to cover everything. Suggestions below distinguish between:

- **Specificity within scope** — adding named examples or known gotchas to an existing outline item
- **Scope expansion** — adding a new section or topic that isn't implied by the current outline

Scope expansion is flagged explicitly. Where a topic doesn't fit cleanly into an existing issue, it's proposed as a new issue at the bottom.

---

## Open Issues

---

### #8 — `maplibre-style-patterns` · High Priority

**What changed in the edit:** Outline simplified and made less prescriptive (removed OpenMapTiles schema specifics, removed MapTiler from source configs, removed requirement to follow any particular schema). "Building custom styles" added to When to Use.

**Assessment:** The simplified framing is the right call — it lets the skill cover style patterns without being tied to a specific tile schema. The existing tile-sources skill already covers schemas. The current outline is well-scoped.

**Specificity to add within scope:**

The demand mining identified a cluster of AI failures concentrated specifically in the Expressions section of this skill. These are worth naming in the outline because they represent _known_ failure modes, not speculative ones:

- `["literal", [...]]` for array values — required when passing an array as data rather than an expression. Both ChatGPT and Claude have been documented giving wrong answers on this. Two independent Slack threads and Discussion #1985 in maplibre-gl-js confirm it.
- Token string syntax in `text-field` (e.g. `"{name:latin}"`) — used in many real-world styles, entirely absent from the style spec documentation (spec issue #772). AI tools have no training data for it.
- `$type` filter with multi-geometries — `["==", "$type", "Polygon"]` does not match `MultiPolygon` features despite the spec implying it should (spec issue #1346).

**Suggested issue comment:**

> We've done a round of research into where developers most commonly hit AI tool failures on MapLibre style topics. The Expressions section of this skill has the strongest concentration of documented failures.
>
> Three specific patterns where multiple developers have hit walls even after consulting AI:
>
> **`["literal", [...]]` for array values.** When passing an array as a _value_ inside a MapLibre expression (not as a nested expression), it must be wrapped in `["literal", [...]]`. There's no equivalent in plain JavaScript, so AI tools consistently miss it. We've found independent documented failures in Slack and in Discussion [#1985](https://github.com/maplibre/maplibre-gl-js/discussions/1985).
>
> **Token string syntax in `text-field`.** The `"{property-name}"` syntax (e.g. `"text-field": "{name:latin}"`) is widely used in real-world styles but is completely undocumented in the MapLibre Style Spec (see [maplibre-style-spec#772](https://github.com/maplibre/maplibre-style-spec/issues/772)). AI tools have no training data for it and typically suggest `["get", "name:latin"]` instead, which behaves differently.
>
> **`$type` filter and multi-geometries.** A `["==", "$type", "Polygon"]` filter does not match `MultiPolygon` features, even though the spec implies it should (see [maplibre-style-spec#1346](https://github.com/maplibre/maplibre-style-spec/issues/1346)).
>
> Suggesting these be named explicitly in the Expressions line of the content outline.

**Issue text update needed?** Yes — minor. Expand the Expressions line:

> - **Expressions:** Data-driven styling, filters, and conditional logic — including `["literal"]` for array values, token string syntax in `text-field`, and known multi-geometry filter behavior

---

### #9 — `maplibre-web-integration-patterns` · High Priority

**What changed in the edit:** "Choosing Data Sources" added to the content outline (references the tile-sources skill). "Common Questions & Issues:" added as an empty placeholder. Access token note removed. Requirements expanded to include code examples across all common frameworks.

**Assessment:** The "Common Questions & Issues" placeholder is where the mining data pays off most directly. The Choosing Data Sources section is a good pointer to the tile-sources skill rather than duplicating it.

**Specificity to add within scope — filling the "Common Questions & Issues" placeholder:**

- `map.on('load')` is not always reliable — it can fail to fire in hot-reload environments and some React lifecycle scenarios. SO question with 1,020 views. The `idle` event or `map.isStyleLoaded()` are more reliable alternatives.
- **`addProtocol` v3→v4 API change.** The `addProtocol` handler signature changed fundamentally in v4.0.0: the old callback-based API (`(params, callback) => { callback(null, data) }`) was replaced with a Promise + AbortController API (`async (params, abortController) => { return { data: ... } }`). Pre-v4 handler code silently breaks on v4+, and most AI-generated examples and pre-2024 Stack Overflow answers use the old pattern. This is almost certainly what caused Discussion [#4480](https://github.com/maplibre/maplibre-gl-js/discussions/4480) (developer exhausted ChatGPT + docs for 4 hours). Worth naming explicitly with both signatures and the version boundary.
- `addProtocol` registration is global and persists across component mounts — register at app startup, not inside each component; call `removeProtocol` on teardown. This is a general MapLibre API behavior, not a PMTiles-specific concern, and belongs here as the principle. The pmtiles-patterns skill already documents the PMTiles-specific example (line 107); web-integration-patterns should cover the principle with a cross-reference to pmtiles-patterns for the concrete case.
- Next.js SSR requires dynamic import to prevent MapLibre from loading server-side — a recurring question that isn't in the main docs.

**Skill architecture note:** `addProtocol` teardown is currently documented only in pmtiles-patterns, where it appears as a PMTiles example. But the underlying behavior — protocol registrations are global, need app-level management and cleanup — applies to any custom protocol. pmtiles-patterns is correctly scoped and does not need expanding. web-integration-patterns should cover the principle and reference pmtiles-patterns for the concrete PMTiles example.

**Suggested issue comment:**

> We've been researching the most common MapLibre + framework pain points, and this skill has the strongest evidence of any in the backlog. React-related issues hit the GitHub search ceiling (50+ issues), and React questions appear in 32 discussions. A few specific patterns worth putting in the "Common Questions & Issues" section:
>
> **`map.on('load')` is not always reliable.** In hot-reload environments and some React lifecycle scenarios, the `load` event may not fire as expected. This is a [top Stack Overflow question](https://stackoverflow.com/questions/tagged/maplibre-gl) for MapLibre. `map.isStyleLoaded()` or listening for `idle` are more reliable fallbacks in those contexts.
>
> **`addProtocol` — v3→v4 API change and global registration.** The `addProtocol` handler signature changed fundamentally in v4.0.0: the old callback-based API (`(params, callback) => { callback(null, data) }`) was replaced with a Promise + AbortController API (`async (params, abortController) => { return { data: ... } }`). Pre-v4 handler code silently fails on v4+, and most AI-generated examples and pre-2024 Stack Overflow answers use the old pattern — this is almost certainly what caused Discussion [#4480](https://github.com/maplibre/maplibre-gl-js/discussions/4480), where a developer spent 4 hours exhausting ChatGPT and the docs. Beyond the version change: protocol handlers are global and persist across component mounts. The general pattern (register at app startup, call `maplibregl.removeProtocol` on teardown) belongs in this skill; the [pmtiles-patterns skill](../../skills/maplibre-pmtiles-patterns/SKILL.md) documents the PMTiles-specific example and can serve as a concrete reference.
>
> **Next.js SSR.** MapLibre can't be imported during server-side rendering. The `dynamic(() => import(...), { ssr: false })` pattern is a recurring question that isn't documented in the main MapLibre docs.

**Issue text update needed?** Yes — fill the "Common Questions & Issues:" placeholder:

> - **Common Questions & Issues:** `map.on('load')` reliability and alternatives (`isStyleLoaded()`, `idle` event); `addProtocol` global registration and teardown — principle applies to any protocol, see [maplibre-pmtiles-patterns](../../skills/maplibre-pmtiles-patterns/SKILL.md) for the PMTiles example; Next.js SSR and dynamic import

---

### #10 — `maplibre-web-performance-patterns` · Nice to Have

**What changed in the edit:** Added "Guard against false precision, remove unused layers and attributes" to self-hosted tile performance patterns. Removed markers vs symbol layers and clustering from the outline. Removed the Mapbox bundle size comparison.

**Assessment:** The edit tightened scope appropriately — removing the markers vs. symbol layers trade-off (which is a style decision, not a performance pattern). The tile pipeline advice (false precision, unused layers) is well-placed.

**Specificity to add within scope:**

`setData()` throttling under rapid updates — when `setData()` is called faster than the renderer can process, pending updates are silently dropped. This is intentional behavior documented as "not a bug" in [maplibre-gl-js#6344](https://github.com/maplibre/maplibre-gl-js/issues/6344) but is not documented anywhere in the API docs. It belongs in the "Data loading" section.

**Suggested issue comment:**

> One specific runtime behavior worth adding to the Data loading section: `setData()` under rapid updates. When `setData()` is called faster than MapLibre can render a frame, pending updates are dropped — the last call wins, but intermediate states are lost. This is intentional ([maplibre-gl-js#6344](https://github.com/maplibre/maplibre-gl-js/issues/6344)) but isn't documented in the API and surprises developers building real-time data feeds. The recommended pattern is to debounce `setData()` calls, or to use `setFilter()` (which is synchronous and doesn't trigger a full redraw) when the underlying data hasn't changed.

**Issue text update needed?** Minor. Add `setData` throttling to the Data loading line:

> - **Data loading:** GeoJSON, vector tiles, avoiding memory leaks; `setData()` behavior under rapid updates and debounce patterns

---

### #11 — `maplibre-cartography` · High Priority

**What changed in the edit:** Significantly expanded. Added "Layer ordering: Injecting layers dynamically into a vector basemap." Expanded fonts to include sourcing, creating, and hosting a full font stack. Expanded sprites to include the markers vs. symbols distinction and sprite alternatives. Added "how to be a good citizen in the open source ecosystem" to the font/sprite section. Requirements now include "Explain performance trade-offs and opportunities."

**Assessment:** The additions are well-judged. Layer ordering (injecting before first symbol layer) is already in the tile-sources skill as a code example — the cartography skill should go deeper on the _why_, which is appropriate here. The "ecosystem citizenship" framing is a good differentiator.

**Specificity to add within scope:**

The highest-viewed Stack Overflow question for MapLibre (7,513 views) is "Load offline local glyphs, sprites and mbtiles" — a complete self-hosted workflow question. This is directly in scope for this skill. No single doc page walks through configuring all three together. The tile-sources skill covers glyphs and sprites individually but in the context of source selection, not the complete offline setup workflow.

**Suggested issue comment:**

> We've been looking at the MapLibre questions with the highest engagement on Stack Overflow. The single highest-viewed question (7,513 views) is ["Load offline local glyphs, sprites and mbtiles"](https://stackoverflow.com/questions/tagged/maplibre-gl) — a complete self-hosted setup question. Developers configuring a fully offline or self-hosted map need to get glyphs, sprites, and tile sources all working together, and no single documentation page currently walks through that complete workflow.
>
> Suggesting "complete offline/self-hosted workflow" be added as a section — covering what to serve, where to point each style property, and how to verify each piece is working.

**Issue text update needed?** Yes — add to Content Outline:

> - **Complete self-hosted workflow:** Assembling glyphs, sprites, and tile source together for offline or self-hosted deployment — what to serve, how to configure the style JSON, and how to verify each piece

---

### #12 — `maplibre-style-quality` · Nice to Have

**What changed in the edit:** Framing of Maputnik section changed to "Maputnik is not Mapbox Studio" — clarifies the distinction up front.

**Assessment:** Good clarification. The skill is clearly positioned as a companion to #8 (style-patterns) and explicitly depends on it. The scope is right.

**Note from Maputnik mining (2026-03-05):** We ran mining against the Maputnik repo directly. Zero AI mention threads. 87 open issues, primarily enhancements. Key findings relevant to this skill:

- "Mapbox" hits the 50+ ceiling in Maputnik issues — importing Mapbox-era style JSON into Maputnik to adapt it is a very common migration workflow, confirming "Maputnik is not Mapbox Studio" is the right framing
- PMTiles support in Maputnik is incomplete: [#807](https://github.com/maplibre/maputnik/issues/807) (PMTiles not supported) and [#1028](https://github.com/maplibre/maputnik/issues/1028) (no way to define maxzoom for PMTiles sources) are both open — worth documenting as a known limitation
- Martin font catalog discovery ([#961](https://github.com/maplibre/maputnik/issues/961)) is open — Maputnik can't auto-discover fonts from a live Martin server

**Specificity to add within scope:**

The Maputnik section should note its current PMTiles limitation — users working with a PMTiles-backed style won't be able to define `maxzoom` for the source in the UI. The workaround is to edit the style JSON directly and reload.

**Suggested issue comment:**

> We've looked at both demand signals for this skill and the Maputnik issue tracker directly. The validation side has solid evidence: type errors in style properties (like `clusterMaxZoom` requiring an integer, which ChatGPT helped diagnose in [maplibre-gl-js#5929](https://github.com/maplibre/maplibre-gl-js/issues/5929) but the docs still don't prevent) suggest that tooling-backed validation catches real problems.
>
> On Maputnik: the framing "Maputnik is not Mapbox Studio" is well supported — the Maputnik repo shows "Mapbox" at ceiling volume (50+), confirming this is a common entry point for developers adapting Mapbox-era styles. One practical limitation worth documenting: PMTiles support in Maputnik is currently incomplete ([#807](https://github.com/maplibre/maputnik/issues/807), [#1028](https://github.com/maplibre/maputnik/issues/1028)) — developers using PMTiles as a source can't define `maxzoom` for the source in the UI and will need to fall back to direct JSON editing. Worth naming as a known gap so users aren't surprised.
>
> Note: this skill depends on #8 (style-patterns) for layer context, per the issue.

**Issue text update needed?** Yes — add Maputnik PMTiles limitation note:

> - **Maputnik:** Maputnik is not Mapbox Studio — what it does and doesn't do; current limitations (PMTiles maxzoom field not exposed in UI — [#1028](https://github.com/maplibre/maputnik/issues/1028)); when to fall back to direct JSON editing

---

### #13 — `maplibre-data-visualization-patterns` · Nice to Have

**What changed in the edit:** Terrain added to title and description. "Expressions" renamed "Data-driven styles." Requirements now include "Explain cartographic best practices and trade-offs."

**Assessment — scope revision recommended:** Terrain and 3D have the strongest demand signal of any topic in this skill (50+ GH issues, 41 discussions, highest-voted SO question). That's exactly the argument for pulling terrain _out_ and giving it a dedicated skill (see Proposed Issue D below). Terrain setup — picking a DEM source, understanding encoding, calling `map.setTerrain()`, adding a hillshade layer — is base map configuration, not data visualization. A choropleth of census data is data viz; rendering the earth's topography is not. Keeping terrain in this skill blurs that distinction and splits the terrain workflow across two skills.

**Recommendation:** Remove terrain from the #13 title and scope. Add a cross-reference to `maplibre-terrain-patterns` (Issue D). The remaining scope — choropleth, heatmap, clustering, fill-extrusion for buildings, data-driven styles — is coherent and well-evidenced on its own.

**Specificity to add within the narrowed scope:**

`fill-extrusion-color` with a transparent/alpha color renders as black, not transparent. This is "by design" ([maplibre-gl-js#4954](https://github.com/maplibre/maplibre-gl-js/issues/4954)) but consistently surprises developers coming from 2D layer styling. The fix (`fill-extrusion-opacity` instead of alpha in the color value) belongs here — fill-extrusion is used for building extrusions as a _data_ layer, distinct from terrain.

**Suggested issue comment:**

> One specific fill-extrusion gotcha worth adding: **`fill-extrusion-color` with a transparent color renders as black**, not transparent. This is intentional behavior ([maplibre-gl-js#4954](https://github.com/maplibre/maplibre-gl-js/issues/4954)) but surprises developers who expect alpha channels to work as in 2D layers. The correct approach is `fill-extrusion-opacity`.

**Issue text update needed?** Yes — two changes:

1. Remove "terrain" from the title and description scope; add cross-reference to `maplibre-terrain-patterns`
2. Update the 3D line to focus on fill-extrusion as a data layer:

> - **3D data layers:** Fill-extrusion for buildings and data — `fill-extrusion-opacity` vs. alpha color for transparency; `fill-extrusion-color` transparent renders as black ([#4954](https://github.com/maplibre/maplibre-gl-js/issues/4954))
> - _(Terrain and hillshade: see `maplibre-terrain-patterns`)_

---

### #15 — `maplibre-google-maps-migration` · Nice to Have

**What changed in the edit:** Significantly simplified. Removed "Motivations: Cost savings" as the lead. Removed the detailed "Target" and API comparison framing. Content outline is now: open tile sources, API mapping, feature parity, migration guidance, honest trade-offs.

**Assessment:** Simpler framing is better. The previous version read like a sales pitch; this reads like a practical guide.

**One observation:** Most of the migration evidence in the mining (Mapbox confusion in 50+ issues, `setWellKnownTileServer` SO question) is for Mapbox→MapLibre, not Google Maps→MapLibre. The existing `maplibre-mapbox-migration` skill covers the Mapbox case. The Google Maps case has a distinct conceptual challenge that isn't evidenced in MapLibre's repos (Google Maps developers don't show up there), but it's a reasonable gap to fill given that Google Maps is the most widely used web mapping library.

The key conceptual gap for Google Maps developers is the paradigm shift: Google Maps uses an overlay model (controls added on top of a fixed raster basemap), while MapLibre uses a source/layer model (everything — including the basemap — is configured as sources and layers in a style document). This is the single thing that confuses Google Maps developers most; it's worth naming explicitly in the content outline.

**Cross-reference opportunity:** The overlay paradigm creates natural continuations into two other skills. Google Maps developers who used `HeatmapLayer`, `Data` layer, or `OverlayView` for custom rendering will need to understand how to accomplish those patterns in MapLibre's source/layer model — that's `maplibre-data-visualization-patterns`. Developers who used Google Maps' terrain map type will need to understand `raster-dem` sources and `setTerrain()` — that's `maplibre-terrain-patterns`. Neither topic needs content here; the migration skill's job is to name the paradigm shift and point onward.

**Suggested issue comment:**

> Most of the migration-related demand we've found in MapLibre's repos is Mapbox→MapLibre (already covered by the existing `maplibre-mapbox-migration` skill). Google Maps developers tend not to ask questions in MapLibre's repos directly, so direct evidence is harder to find. That said, this is a valuable skill given the scale of Google Maps adoption.
>
> One structural suggestion: the most important thing for a Google Maps developer to understand is the **paradigm shift** — Google Maps uses an overlay model (you add controls and layers on top of a fixed raster basemap), while MapLibre uses a source/layer model (everything, including the basemap, is a source and a set of layers in a style document). This is the concept that causes the most confusion for Google Maps developers, even more than specific API differences. Worth naming explicitly in the content outline as the lead concept before the API mapping table.
>
> The overlay paradigm also creates natural continuations into companion skills — the migration skill can stay focused on the conceptual shift and API mapping, and cross-reference from there:
>
> - Google Maps `HeatmapLayer`, `Data` layer, custom overlays → `maplibre-data-visualization-patterns` (how to do data overlays in the source/layer model)
> - Google Maps terrain map type → `maplibre-terrain-patterns` (how `raster-dem` sources and `setTerrain()` work)

**Issue text update needed?** Yes — reframe the outline lead and add Related Skills:

> - **Conceptual model:** Google Maps overlay model vs. MapLibre source/layer model — why there is no "basemap object" to configure separately
> - **Open tile sources** instead of Google Maps tiles
> - **Related skills:** `maplibre-data-visualization-patterns` (data overlays in source/layer model); `maplibre-terrain-patterns` (terrain map type equivalent)

---

## Evidence for Existing Skills

The three published skills were created by the author from judgment, not from demand mining. The 2026-Q1 mining now provides post-hoc evidence — and surfaces specific update candidates. These are handled differently from the backlog issues: rather than a public comment, the action is to propose a GitHub issue for any skill update that is warranted.

---

### `maplibre-tile-sources`

**Mining evidence:**

- SO "Load local .mbtiles" — 5,125 views (rank #7) — tile source configuration is actively searched
- PMTiles: 25 GH issues, 26 discussions — significant and growing
- Mapbox compatibility: 50+ ceiling — migration to non-Mapbox tile sources is a top-of-funnel question that this skill directly answers
- Terrain: 50 GH issues — high demand, but now owned by `maplibre-terrain-patterns` (Issue D)

**Assessment:** The mining confirms this skill addresses real demand for source selection and configuration. The `raster-dem` source type is correctly listed in the skill's source type table — that entry stays. The deeper DEM content (encoding distinction, source selection, Mapterhorn vs. AWS/Tilezen, production caveats) has been assigned to `maplibre-terrain-patterns` (Issue D), which is the better home: terrain setup is a complete workflow, not just a source selection decision.

**What stays in tile-sources:** The `raster-dem` row in the source type table with a brief description and a cross-reference to `maplibre-terrain-patterns`. The skill's existing placeholder for cloud-native formats (line 76: "A separate skill will cover this in depth") points toward `maplibre-cloud-native-sources` (Issue C) — that relationship is unchanged.

**Proposed action:** No new issue needed. When `maplibre-terrain-patterns` is filed (Issue D), add a cross-reference from the `raster-dem` row in tile-sources — a minor edit, not a standalone issue.

**Is this better framed as proof of the current skill's value?** Yes — the terrain demand (50+ issues) is strong evidence that _some_ skill needs to cover DEM sources well. The decision to put that in terrain-patterns rather than tile-sources doesn't diminish tile-sources; it keeps tile-sources focused on its core job (choosing and configuring sources) while giving terrain the standalone treatment its demand warrants.

---

### `maplibre-mapbox-migration`

**Mining evidence:**

- Mapbox: 50+ ceiling in both GH issues and discussions (98 Mapbox-tagged discussions) — the highest-volume cross-cutting topic in maplibre-gl-js
- SO "setWellKnownTileServer" — 2,801 views — MapLibre/Mapbox compatibility actively searched
- Maputnik "Mapbox" 50+ ceiling — importing Mapbox-era style JSON into Maputnik for visual adaptation is a common migration step

**Assessment:** The mining strongly validates this skill. Two specific gaps:

1. **Mapbox Studio → Maputnik framing** — Maputnik is already mentioned in the skill (line 124) as a tool to "visually test and debug" after source URLs have been replaced. What's missing is positioning Maputnik as the _editing environment_ for the adaptation itself, not just a verification step at the end. The current flow reads: export → manually edit JSON → use Maputnik to test. The more useful framing for a developer with a complex Mapbox Studio style is: export → open in Maputnik → visually remap source URLs and layer references interactively → validate with `gl-style-validate`. This is a reframing of one sentence, not new content.
2. **Terrain source migration** — apps using `mapbox://mapbox.mapbox-terrain-rgb-v1` need a replacement `raster-dem` source with the correct encoding declared. The skill doesn't cover this; the right cross-reference is to `maplibre-terrain-patterns` (Issue D) once that skill is written.

**Proposed issue:** Update `maplibre-mapbox-migration` to: (1) reframe the Maputnik mention at line 124 — position it as the editing workspace for style adaptation, not just a testing step; (2) add a terrain source migration note pointing to `maplibre-terrain-patterns`.

**Is this better framed as proof of the current skill's value?** The "Google Maps migration" skill (#15) has weak mining evidence compared to the Mapbox migration skill. Rather than a separate Google Maps skill, it might be worth considering whether a broader "Migrating to MapLibre" framing (covering both Mapbox and Google Maps in one skill, or a landing page that branches) would serve developers better. That said, the conceptual gap for Google Maps developers (overlay model vs. source/layer model) is distinct enough that a separate skill is justified — just lower priority relative to updating the existing Mapbox migration skill.

---

### `maplibre-pmtiles-patterns`

**Mining evidence:**

- PMTiles: 25 GH issues, 26 discussions — significant volume across the ecosystem
- Maputnik #807, #1028: PMTiles in Maputnik is incomplete — worth cross-referencing from this skill
- `addProtocol` (#4480, #4475, Slack Thread 1): v3→v4 API change is the primary undocumented breakage point

**Assessment:** The mining validates this skill's existence. The main gap is the v3→v4 `addProtocol` API change — most AI-generated PMTiles examples use the pre-v4 callback pattern that silently fails on v4+. This should be addressed once `maplibre-web-integration-patterns` (#9) is written (it will own the principle); pmtiles-patterns should then add a cross-reference and note the version boundary explicitly in any `addProtocol` code examples.

**Proposed issue:** No new issue needed — the v3→v4 update should be a minor edit after #9 is written.

**Is this better framed as proof of the current skill's value?** The `maplibre-cloud-native-sources` proposal (Issue C) covers COG and FlatGeobuf — formats that also use `addProtocol` but are distinct in purpose (raster/vector source formats vs. tile archives). The PMTiles skill's strength is in the "serverless tiles" workflow end-to-end. COG evidence doesn't undermine the PMTiles skill; it identifies a genuine gap alongside it. Both are warranted.

---

## Gap Analysis: Proposed New Issues

These are topics the mining data clearly identified that don't fit within any of the 8 open issues.

---

### Proposed Issue A: `martin-configuration-patterns`

**Why now:** Martin is the MapLibre-maintained tile server (💙 in the tile-sources skill). It has 133 GitHub issues specifically about configuration — the highest single-topic volume in the repo. One ChatGPT hallucination is confirmed on the record: a developer was told Martin accepts TOML config; it only accepts YAML. The operational gotchas (DATABASE_URL override, `--config` + CLI args mutual exclusion, reverse proxy TileJSON host, no built-in auth by design) are documented in multiple issues and are exactly the kind of thing AI tools get wrong.

This is a gap because: the tile-sources skill mentions Martin as a self-hosted option and links to its docs, but intentionally doesn't cover configuration. No other skill does. Martin configuration is far enough from GL JS styling/rendering that it needs its own skill.

**Draft issue body:**

> ## Overview
>
> Create a new skill **martin-configuration-patterns** covering deployment and configuration for the Martin tile server.
>
> ## When to Use This Skill
>
> - Setting up Martin for the first time (Docker, binary, or source build)
> - Configuring PostgreSQL function sources, MBTiles, or PMTiles serving
> - Deploying Martin behind a reverse proxy (Nginx, Caddy, etc.)
> - Understanding why Martin has no built-in authentication and how to add security upstream
> - Debugging a config file that isn't being read, or unexpected behavior from environment variables
>
> ## Content Outline
>
> - **Config format:** YAML only — not TOML, not JSON; common source of AI-hallucinated wrong answers
> - **Config vs. CLI args:** `--config` and CLI connection parameters are mutually exclusive with no runtime warning
> - **`DATABASE_URL` env var:** Silently overrides config file when set — commonly auto-set by PaaS platforms (DigitalOcean, Railway, Render)
> - **Reverse proxy setup:** TileJSON `tiles` field reflects internal host by default — must configure `base_path` or proxy headers for the correct external URL
> - **CORS:** Configuring CORS in Martin vs. at the proxy layer
> - **No built-in authentication:** Martin is intentionally auth-free — JWT/bearer token security must be layered at the proxy or CDN
> - **Font and sprite serving:** File naming conventions and directory structure
> - **PostgreSQL function sources:** Setup, naming, and parameter conventions
>
> ## Key Resources
>
> - [Martin documentation](https://maplibre.org/martin/)
> - [Martin GitHub](https://github.com/maplibre/martin)
> - Issue [#1892](https://github.com/maplibre/martin/issues/1892) — config format confusion (confirmed ChatGPT hallucination)
> - Issue [#1050](https://github.com/maplibre/martin/issues/1050) — DATABASE_URL silently overrides config
> - Issue [#938](https://github.com/maplibre/martin/issues/938) — `--config` vs. CLI mutual exclusion
> - Issue [#1054](https://github.com/maplibre/martin/issues/1054) — TileJSON host behind reverse proxy
>
> ## Requirements
>
> - Follow [CONTRIBUTING.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/CONTRIBUTING.md) for skill structure
> - Write from Martin's own documentation and confirmed issue patterns
> - Include concrete examples for each operational gotcha

---

### Proposed Issue B: `maplibre-native-gl-js-parity`

**Why now:** The MapLibre ecosystem includes MapLibre Native (Android, iOS, desktop) alongside GL JS. The `js-parity` label in the `maplibre-native` repo has 26 open + 16 closed issues documenting features present in GL JS that are not implemented or behave differently in Native. An LLM trained on GL JS documentation will confidently suggest `addProtocol`, globe projection, `interpolate-hcl`/`interpolate-lab`, and RasterDEM custom encoding to Native developers — none of these work. This is a predictable AI failure mode even without documented incidents in the repo (no AI mention threads were found in maplibre-native, likely because developers don't know where to report that the LLM confused them).

This is a gap because: no existing skill mentions Native at all. The scope is narrower than a full Native integration guide — it's specifically about what differs from GL JS, which is where the AI failure risk is highest.

**Draft issue body:**

> ## Overview
>
> Create a new skill **maplibre-native-gl-js-parity** documenting the feature gaps between MapLibre GL JS and MapLibre Native — helping developers avoid using GL JS APIs that aren't yet implemented in Native.
>
> ## When to Use This Skill
>
> - Building a MapLibre Native app (iOS or Android) and drawing on GL JS documentation
> - Migrating a GL JS implementation to Native
> - Evaluating whether a GL JS feature you rely on is available in Native
>
> ## Content Outline
>
> - **What is MapLibre Native:** Separate codebase from GL JS — iOS (Swift/Objective-C), Android (Kotlin/Java), desktop; different development pace and feature set
> - **Parity gap overview:** Features in GL JS that are not yet in Native, with current status
>   - `addProtocol` (custom URL scheme registration) — not supported
>   - Globe projection — not supported
>   - `interpolate-hcl` / `interpolate-lab` color interpolation — not supported
>   - `queryRenderedFeatures` — behavior differs between Android and iOS
>   - RasterDEM custom encoding factors (`redFactor`, etc.) — not supported
> - **Units difference:** Properties documented as "pixels" in the style spec are device-independent pixels (dp) in Native — not CSS pixels
> - **Where to track parity:** `js-parity` label in the [maplibre-native repo](https://github.com/maplibre/maplibre-native/issues?q=label%3Ajs-parity)
>
> ## Key Resources
>
> - [MapLibre Native GitHub](https://github.com/maplibre/maplibre-native)
> - [`js-parity` open issues](https://github.com/maplibre/maplibre-native/issues?q=is%3Aopen+label%3Ajs-parity)
> - [MapLibre Style Spec issue #926](https://github.com/maplibre/maplibre-style-spec/issues/926) — pixels vs. dp units
>
> ## Requirements
>
> - Scope: parity gaps only — not a full Native setup guide
> - Follow [CONTRIBUTING.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/CONTRIBUTING.md) for skill structure
> - Include a parity status table that can be updated as gaps close

---

### Proposed Issue C: `maplibre-cloud-native-sources`

**Why now:** The existing tile-sources skill (line 76) contains an explicit placeholder: _"A separate skill will cover this in depth."_ This is a promised skill that hasn't been filed as an issue yet. The formats in question — Cloud-Optimized GeoTIFF (COG), FlatGeobuf, GeoParquet — are increasingly common in the cloud native geospatial ecosystem, and MapLibre can read them via `addProtocol` handlers. The demand mining found `@geomatico/maplibre-cog-protocol` as an established, actively maintained library for COG; it has no coverage in any current or proposed skill.

This is different from PMTiles (a serverless _tile_ format) — COG and related formats are raster and vector _source_ formats. They're relevant to developers coming from a GIS background who work with cloud-hosted rasters (Sentinel, Landsat, analysis-ready data) and want to display them in MapLibre without building a tile server. The LLM failure mode is recommending a tile server when one isn't needed, or not knowing `addProtocol`-based COG reading is possible at all.

**Draft issue body:**

> ## Overview
>
> Create a new skill **maplibre-cloud-native-sources** covering how to load cloud-native geospatial formats directly in MapLibre GL JS without a tile server.
>
> This skill was promised from the tile-sources skill, which contains an explicit placeholder for it.
>
> ## When to Use This Skill
>
> - Loading a Cloud-Optimized GeoTIFF (COG) directly in MapLibre without a tile server
> - Working with FlatGeobuf or GeoParquet files hosted on S3, R2, or other object storage
> - Evaluating whether a format requires a tile server or can be read directly in the browser
>
> ## Content Outline
>
> - **What "cloud-native" means for MapLibre:** Formats designed for HTTP range requests — no tile server required; works with S3, R2, GitHub Pages, and any static hosting
> - **Cloud-Optimized GeoTIFF (COG):**
>   - What a COG is and why it's browser-friendly
>   - `@geomatico/maplibre-cog-protocol` — registers `cog://` handler; basic setup and usage
>   - Limitations: single-band vs. multi-band, band math/rendering options, performance vs. pre-tiled
> - **FlatGeobuf:** Browser-native streaming reads via the `flatgeobuf` library; when to use over GeoJSON
> - **GeoParquet:** Current browser support status; tools available
> - **Comparing to PMTiles:** When to use COG/FlatGeobuf vs. PMTiles; overlap and differences
> - **`addProtocol` — v4 API reminder:** Any custom protocol handler must use the v4 Promise + AbortController API
>
> ## Key Resources
>
> - [tile-sources SKILL.md placeholder](../../skills/maplibre-tile-sources/SKILL.md) (line 76)
> - [`@geomatico/maplibre-cog-protocol`](https://github.com/geomatico/maplibre-cog-protocol)
> - [FlatGeobuf](https://flatgeobuf.org/)
> - [Cloud Native Geospatial Forum](https://cloudnativegeo.org/)
>
> ## Requirements
>
> - Follow [CONTRIBUTING.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/CONTRIBUTING.md) for skill structure
> - Scope: browser-side reads via `addProtocol` and direct fetch — not server-side tile generation
> - Should cross-reference maplibre-pmtiles-patterns for comparison
> - Note `addProtocol` v4 API in any code examples

---

### Proposed Issue D: `maplibre-terrain-patterns`

**Why now:** Terrain is the highest-volume topic not fully owned by any current or proposed skill — 50+ GH issues, 41 discussions, and the single highest-viewed Stack Overflow question in the MapLibre tag is terrain setup. The content is currently fragmented: `tile-sources` covers `raster-dem` as a source type entry; `pmtiles-patterns` covers self-hosted raster-dem PMTiles; `#13 data-viz` was planned to include terrain visualization. None of these give a developer building a terrain map what they actually need: a single place that walks from source selection through encoding through visualization.

The encoding distinction — Terrarium vs. Mapbox Terrain-RGB — is a documented AI failure zone: the default is `"mapbox"`, most open/free sources use Terrarium, and the wrong choice produces silently incorrect elevation values. The most accessible open terrain tile source (Mapterhorn) is not documented anywhere in the skills. `maplibre-contour` — the standard pattern for dynamic contour lines, listed in awesome-maplibre and production-used — has no current home.

Pulling terrain out of #13 also tightens that skill's scope to pure data overlays (choropleth, heatmap, clustering, fill-extrusion), which is a cleaner and more coherent user story.

**Draft issue body:**

> ## Overview
>
> Create a new skill **maplibre-terrain-patterns** covering terrain and hillshade rendering in MapLibre GL JS — from choosing and configuring a DEM source through to 3D terrain, hillshade, and dynamic contour lines.
>
> ## When to Use This Skill
>
> - Adding hillshade or 3D terrain to a MapLibre map
> - Choosing a `raster-dem` source and understanding encoding formats
> - Migrating from Mapbox terrain tiles to an open alternative
> - Adding dynamic contour lines from terrain data
> - Self-hosting terrain tiles (PMTiles or XYZ)
>
> ## Content Outline
>
> - **`raster-dem` source type:** What it is, how it differs from `raster`; the `encoding` property — `"terrarium"` vs. `"mapbox"` use different pixel-to-elevation formulas; the default is `"mapbox"` but most open/free sources use Terrarium; wrong encoding produces silently incorrect values ([style spec](https://maplibre.org/maplibre-style-spec/sources/#encoding_1))
> - **Open DEM tile sources:**
>   - AWS/Tilezen (`s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`) — the original Mapzen Terrarium dataset, now on AWS Open Data; free, no key; 256px PNG; can be slow from the browser
>   - [Mapterhorn](https://mapterhorn.com/) — Terrarium WebP PMTiles; free, no key; 512px; up to z12 global; open source; NLnet-funded; led by former MapLibre board member Oliver Wipfli
>   - Stadia Maps Terrarium — key required for production
>   - MapTiler terrain-rgb — Mapbox encoding; key required
>   - `demotiles.maplibre.org` — in official MapLibre examples; **not for production**
> - **Hillshade layer:** `hillshade` layer type; `hillshade-illumination-direction`; common style settings
> - **3D terrain:** `map.setTerrain({ source, exaggeration })`; sky layer; camera pitch; performance implications
> - **Dynamic contour lines:** [`maplibre-contour`](https://github.com/onthegomap/maplibre-contour) (`onthegomap/maplibre-contour`) — registers a custom protocol handler that generates contour vector tiles from a `raster-dem` source; listed in awesome-maplibre; 261 stars; v0.1.0 December 2024; powers onthegomap.com terrain mode
> - **Generating your own DEM tiles:** Overview — source DEM → GDAL reproject to EPSG:3857 → RGB encode (Terrarium or Mapbox via `rio-rgbify`) → tile with `gdal2tiles.py` → optionally package as PMTiles; cross-reference to `maplibre-pmtiles-patterns` for hosting
>
> ## Key Resources
>
> - [MapLibre Style Spec: raster-dem encoding](https://maplibre.org/maplibre-style-spec/sources/#encoding_1)
> - [MapLibre 3D Terrain example](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/)
> - [Mapterhorn](https://mapterhorn.com/)
> - [AWS Terrain Tiles (Open Data)](https://registry.opendata.aws/terrain-tiles/)
> - [`onthegomap/maplibre-contour`](https://github.com/onthegomap/maplibre-contour)
> - [Tilezen/joerd formats](https://github.com/tilezen/joerd/blob/master/docs/formats.md) — Terrarium encoding formula
> - [mapbox/rio-rgbify](https://github.com/mapbox/rio-rgbify) — Mapbox RGB encoding tool
>
> ## Requirements
>
> - Follow [CONTRIBUTING.md](https://github.com/maplibre/maplibre-agent-skills/blob/main/CONTRIBUTING.md) for skill structure
> - Cross-reference `maplibre-tile-sources` for general source setup, `maplibre-pmtiles-patterns` for self-hosted PMTiles
> - Cross-reference `maplibre-data-visualization-patterns` for fill-extrusion (building extrusions as data layers, not terrain)
> - Encoding distinction must be documented with both formulas or clear links — this is the primary AI failure zone for terrain

---

### Consider: Should `maplibre-expressions` be a standalone skill?

The mining data shows the expression system is the single most-documented AI failure zone in MapLibre — confirmed failures across Slack, GitHub discussions, and the style spec repo. Issue #8 (style-patterns) includes an Expressions line in its outline. The question is whether expressions need a standalone skill.

Arguments for a standalone skill:

- The expression sub-language is large enough to warrant dedicated coverage
- The known failure patterns (`["literal"]`, token strings, `$type`/Multi\*, TypeScript type gaps) could each have their own examples
- A dedicated skill would be easier to invoke specifically ("I'm working with MapLibre expressions")

Arguments against:

- #8 already covers expressions; splitting creates thin coverage in each skill
- Expression usage is always in the context of styling — the two topics aren't naturally separable
- The existing skills are focused; a standalone expressions skill risks being too reference-like

Recommendation: Write the expressions content inside #8 first. If the expressions section grows to the point where #8 becomes unwieldy, split then. Don't split prematurely.

---

## Summary Table

**Backlog issues (open):**

| Issue              | Comment                                                        | Outline update                                 | New issue?                                                                                    |
| ------------------ | -------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| #8 style-patterns  | Yes — name the 3 confirmed AI failure patterns                 | Yes — expand Expressions line                  | —                                                                                             |
| #9 web-integration | Yes — fill "Common Questions & Issues" incl. v3→v4 API change  | Yes — fill the placeholder                     | —                                                                                             |
| #10 performance    | Yes — setData throttling                                       | Minor — add setData line                       | —                                                                                             |
| #11 cartography    | Yes — offline workflow SO evidence                             | Yes — add complete offline workflow section    | —                                                                                             |
| #12 style-quality  | Yes — Maputnik PMTiles limitation, migration workflow framing  | Yes — add Maputnik PMTiles caveat              | —                                                                                             |
| #13 data-viz       | Yes — remove terrain from scope; fill-extrusion opacity gotcha | Yes — remove terrain line, add cross-reference | —                                                                                             |
| #15 google-maps    | Yes — paradigm shift framing                                   | Yes — add conceptual model as lead             | —                                                                                             |
| #6 geospatial-ops  | Optional — note lower relative priority                        | No                                             | —                                                                                             |
| New A              | —                                                              | —                                              | `martin-configuration-patterns`                                                               |
| New B              | —                                                              | —                                              | `maplibre-native-gl-js-parity`                                                                |
| New C              | —                                                              | —                                              | `maplibre-cloud-native-sources` (promised by tile-sources skill)                              |
| New D              | —                                                              | —                                              | `maplibre-terrain-patterns` (consolidates fragmented terrain content; strong demand evidence) |

**Existing skills — proposed updates:**

| Skill                       | Update needed                                                                                                                                           | Action                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `maplibre-tile-sources`     | DEM deep-dive moves to terrain-patterns (Issue D); skill keeps `raster-dem` table entry + cross-reference; cloud-native placeholder (line 76) unchanged | No new issue needed — minor cross-reference edit follows from filing Issue D |
| `maplibre-mapbox-migration` | Add Maputnik as visual style adaptation step; add terrain source migration note                                                                         | Propose new issue                                                            |
| `maplibre-pmtiles-patterns` | Note v3→v4 `addProtocol` version boundary in code examples                                                                                              | Minor edit after #9 is written — no new issue needed                         |
