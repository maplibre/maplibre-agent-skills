# Eval Results: maplibre-mapbox-migration

These results show the skill's effect on model responses. Each test was run twice:
once without the skill injected (baseline) and once with it.

Eval config: [`evals/prompts/maplibre-mapbox-migration.yaml`](../prompts/maplibre-mapbox-migration.yaml)

## Summary

| Test                                                 | Type         | Baseline | With skill |
| ---------------------------------------------------- | ------------ | -------- | ---------- |
| CLI tool to validate exported style JSON             | Explicit     | 0.75     | 1.00       |
| Test against a tile service with no API key          | Implicit     | 0.00     | 1.00       |
| Mapbox GL JS v2 features broken after migration      | Anti-pattern | 0.00     | 1.00       |
| Which Mapbox plugins will still work in MapLibre?    | Implicit     | 0.00     | 1.00       |
| Adding a geocoder to an existing Mapbox GL JS v2 app | Negative     | 1.00     | 1.00       |

---

## Test 1 — Explicit: CLI tool to validate exported style JSON

**Question:**

> I'm migrating from Mapbox to MapLibre and want to check whether my exported style JSON
> is compatible before deploying. Is there a CLI tool I can run on the file?

**What the skill teaches:** The correct package is `@maplibre/maplibre-style-spec`; the
command is `gl-style-validate`. The model's training data has a plausible-sounding explanation but
confuses the tool (`@maplibre/maplibre-gl-style-validate`) with the style spec package name.

<details>
<summary>Baseline response (score: 0.75 — FAIL)</summary>

> Yes! There are a few CLI tools you can use to validate your MapLibre-compatible style
> JSON and check for potential compatibility issues when migrating from Mapbox. Here are
> the best options:
>
> ### 1. **`maplibre-gl-style-validate` (Recommended)**
>
> This is the official style validation tool from the MapLibre project.
>
> #### Install:
>
> ```bash
> npm install -g @maplibre/maplibre-gl-style-validate
> ```
>
> #### Use:
>
> ```bash
> maplibre-gl-style-validate your-style.json
> ```
>
> It will:
>
> - Check for valid JSON structure
> - Validate against the MapLibre style specification
> - Report errors or warnings (e.g., unsupported properties, deprecated syntax)
> - Highlight potential Mapbox-specific features that may not work
>
> ### 2. **`jsonlint` (Basic JSON validation)**
>
> Use this first to ensure your JSON is syntactically correct.
>
> ```bash
> npm install -g jsonlint
> jsonlint -v your-style.json
> ```
>
> ### 3. **Manual Checks for Mapbox → MapLibre Migration**
>
> Even with validation, watch for these common issues:
>
> - **`"glyphs"` URL**: Change from Mapbox URL to your own or a public one
> - **`"sprite"` URL**: Update to your hosted sprites
> - **Remove Mapbox-specific fields**: `"owner"`, `"id"`, `"draft"`

Judge note: The package name `@maplibre/maplibre-gl-style-validate` does not exist.
The correct package is `@maplibre/maplibre-style-spec`. The judge scored 0.75 because
the response was otherwise well-structured and mentioned the correct general purpose,
but the wrong package name would cause `npm install` to fail.

</details>

<details>
<summary>With-skill response (score: 1.00 — PASS)</summary>

> Yes! You can use the **`gl-style-validate`** CLI tool from the
> [`@maplibre/maplibre-style-spec`](https://github.com/maplibre/maplibre-style-spec)
> package to validate your style JSON for compatibility with MapLibre GL JS.
>
> This tool checks your style against the MapLibre Style Specification and will catch
> issues like:
>
> - Invalid property values
> - Unsupported layer types or expressions
> - References to `mapbox://` sources, glyphs, or sprites (which won't work in MapLibre)
> - Deprecated or Mapbox-specific constructs
>
> ### Step-by-Step: Validate Your Style
>
> 1. **Install the package:**
>
> ```bash
> npm install -g @maplibre/maplibre-style-spec
> ```
>
> 2. **Run the validator on your style file:**
>
> ```bash
> gl-style-validate your-style.json
> ```
>
> 3. **Review the output:**
>
> - If valid: `No errors found.`
> - If invalid: You'll get detailed error messages like:
>   ```
>   Error: "source" property "mapbox://styles/mapbox/streets-v12" uses mapbox:// URL
>   ```
>
> ### Fix Common Issues Found by the Validator
>
> - Replace `"glyphs": "mapbox://..."` → point to a public or self-hosted glyph server
> - Replace `"sprite": "mapbox://..."` → host your own sprites or use a compatible URL
> - Replace sources with `mapbox://` URLs → switch to your chosen tile provider
>   (e.g., OpenFreeMap, MapTiler, PMTiles, self-hosted)
> - Remove any `"owner"` or `"draft"` fields (Mapbox Studio metadata)
>
> ### Summary
>
> Yes — use:
>
> ```bash
> gl-style-validate your-style.json
> ```
>
> It's the official, reliable way to check if your exported Mapbox style is ready for
> MapLibre. Fix any reported issues (especially `mapbox://` references), and your style
> will load cleanly.

</details>

---

## Test 2 — Implicit: Test against a tile service with no API key

**Question:**

> I'm migrating from Mapbox to MapLibre and removed my access token, but now my
> mapbox:// style won't load. How can I test my map against a tile service that
> doesn't require an API key?

**What the skill teaches:** OpenFreeMap is the right starting point — a production-ready
vector tile style that requires no key and is designed for MapLibre.

<details>
<summary>Baseline response (score: 0.00 — FAIL)</summary>

> You're encountering this issue because MapLibre doesn't support Mapbox's proprietary
> `mapbox://` URL scheme and requires an access token for Mapbox services.
>
> ## Option 1: Use OpenStreetMap Tile Services
>
> Replace your Mapbox style with a free OSM-based style:
>
> ```javascript
> map.setStyle('https://demotiles.maplibre.org/style.json');
> ```
>
> Or use other free tile services:
>
> ```javascript
> map.setStyle({
>   version: 8,
>   sources: {
>     osm: {
>       type: 'raster',
>       tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
>       tileSize: 256
>     }
>   },
>   layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
> });
> ```
>
> ## Option 2: Use MapLibre's Demo Tiles
>
> MapLibre provides a demo tile server for testing:
>
> ```javascript
> map.setStyle('https://demotiles.maplibre.org/style.json');
> ```
>
> ## Option 3: Self-Host or Use Alternative Providers
>
> Consider these free tile providers:
>
> - **OpenStreetMap**: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
> - **OpenTopoMap**: `https://tile.opentopomap.org/{z}/{x}/{y}.png`
> - **CartoDB**: `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png`

Judge note: No mention of OpenFreeMap. The demo tiles and raw OSM raster options are
reasonable for a quick test but neither is the right starting point for a production
migration. The skill points directly to OpenFreeMap.

</details>

<details>
<summary>With-skill response (score: 1.00 — PASS)</summary>

> You're encountering this issue because **MapLibre cannot load `mapbox://` style URLs**
> — they're proprietary to Mapbox and require Mapbox's infrastructure (and an access
> token) to resolve.
>
> ### Recommended: Use **OpenFreeMap** (No API Key Required)
>
> [OpenFreeMap](https://openfreemap.org/) is a community-funded, open tile service
> designed specifically for use with MapLibre. It's free to use and **requires no
> API key**.
>
> ```javascript
> import maplibregl from 'maplibre-gl';
> import 'maplibre-gl/dist/maplibre-gl.css';
>
> const map = new maplibregl.Map({
>   container: 'map',
>   style: 'https://tiles.openfreemap.org/styles/liberty', // No token needed
>   center: [-122.4, 37.8],
>   zoom: 12
> });
> ```
>
> Benefits:
>
> - No API key
> - OpenStreetMap-based
> - Supports vector and raster tiles
> - Actively maintained
>
> **Note:** If your app uses OpenFreeMap in production, consider
> [donating to support the project](https://openfreemap.org/).
>
> ### Alternative: MapLibre Demo Tiles
>
> ```js
> style: 'https://demotiles.maplibre.org/style.json';
> ```
>
> This points to simple demo tiles at `https://demotiles.maplibre.org/tiles/v3/`.
> Not for production — just for testing.
>
> ### Summary
>
> | Option                                         | API Key? | Production Use? | Notes              |
> | ---------------------------------------------- | -------- | --------------- | ------------------ |
> | `https://tiles.openfreemap.org/styles/liberty` | No       | Yes             | Best for real apps |
> | `https://demotiles.maplibre.org/style.json`    | No       | No              | Quick testing only |
>
> **Next Step:** Replace your `mapbox://styles/...` URL with:
>
> ```js
> style: 'https://tiles.openfreemap.org/styles/liberty';
> ```

</details>

---

## Test 3 — Anti-pattern: Mapbox GL JS v2 features broken after migration

**Question:**

> I was using Mapbox GL JS v2 in my app, including map.setFog() and some v2-specific
> camera features. After migrating to MapLibre, these are broken. Did I do something
> wrong in the migration?

**What the skill teaches:** MapLibre forked from Mapbox GL JS **v1.13** in **December
2020**, before Mapbox v2 was released. Knowing the fork version helps developers reason
about which Mapbox features predate the fork and which are v2-only additions.

<details>
<summary>Baseline response (score: 0.00 — FAIL)</summary>

> You didn't do anything wrong in your migration — **MapLibre GL JS doesn't support
> `setFog()` or the v2-specific camera features** that were available in Mapbox GL JS v2.
>
> **Mapbox GL JS v2** included experimental features like:
>
> - `map.setFog()` for atmospheric effects
> - Advanced camera controls and 3D terrain features
> - Some proprietary rendering enhancements
>
> **MapLibre GL JS** (a community fork) removed:
>
> - Proprietary Mapbox-specific features
> - Some experimental APIs that weren't part of the open specification
> - The fog and advanced camera APIs you're missing
>
> ### Solutions
>
> For fog effects, MapLibre doesn't have built-in fog, but you can:
>
> ```javascript
> // Option A: Use custom WebGL layer
> // Option B: Apply CSS filters as workaround
> map.getCanvas().style.filter = 'blur(1px) opacity(0.9)';
> ```
>
> For camera features, replace with MapLibre's supported camera methods:
>
> ```javascript
> map.easeTo({ pitch: 45, bearing: 0, duration: 2000 });
> ```

Judge note: The response correctly explains the mismatch but never states the specific
fork version (v1.13) or date (December 2020), which the rubric requires. Without knowing
the fork point, a developer cannot reason about which Mapbox features are pre-fork vs
v2-only.

</details>

<details>
<summary>With-skill response (score: 1.00 — PASS)</summary>

> You didn't do anything wrong in the migration — **this is expected behavior**, and it
> highlights a key difference between Mapbox GL JS v2 and MapLibre GL JS.
>
> ### Why `setFog()` and v2 Camera Features Are Missing
>
> - **Mapbox GL JS v2+** introduced new features like `setFog()`, improved camera
>   controls, and globe view — but these were developed **after** the MapLibre fork.
> - **MapLibre forked from Mapbox GL JS v1.13** in December 2020, before Mapbox v2
>   was released.
> - Therefore, **MapLibre GL JS does not include Mapbox v2 features** like `setFog()`
>   or certain advanced camera APIs.
>
> However, MapLibre has since developed its **own** modern features — including support
> for fog and globe view — but **under different APIs and in later versions**.
>
> ### What You Should Do Instead
>
> MapLibre **added fog and globe view in v5**. These are **not drop-in replacements**
> for Mapbox v2 APIs, but they provide similar functionality.
>
> Example: Enabling fog in MapLibre v5+:
>
> ```js
> const map = new maplibregl.Map({
>   container: 'map',
>   style: 'https://tiles.openfreemap.org/styles/liberty',
>   projection: 'globe'
> });
>
> map.setFog({
>   range: [0.5, 8],
>   color: 'white',
>   'horizon-blend': 0.1
> });
> ```
>
> Note: `setFog()` only works when `projection: 'globe'` is set.
>
> | Mapbox v2                        | MapLibre v5+ Equivalent                               |
> | -------------------------------- | ----------------------------------------------------- |
> | `map.setProjection('globe')`     | `map.setProjection(new maplibregl.GlobeProjection())` |
> | `map.setFog()`                   | `map.setFog({...})` (same name, different options)    |
> | `map.easeTo({ pitch, bearing })` | Same, works in globe mode                             |
>
> ### Summary
>
> You didn't make a mistake — MapLibre forked at v1.13, so Mapbox v2 features like
> `setFog()` were never part of MapLibre's starting point. MapLibre has developed
> its own equivalents, but with different APIs.

</details>

---

## Test 4 — Implicit: Finding compatible plugins after migration

**Question:**

> I use several Mapbox GL JS plugins in my app and I'm migrating to MapLibre. How do
> I know which ones will still work?

**What the skill teaches:** `awesome-maplibre` is the single authoritative list for
plugin discovery. The MapLibre GitHub and ecosystem page don't serve the same purpose.

<details>
<summary>Baseline response (score: 0.00 — FAIL)</summary>

> When migrating from **Mapbox GL JS** to **MapLibre GL JS**, compatibility with plugins
> depends on how closely the plugin relies on Mapbox-specific APIs.
>
> ### Plugins That Will Likely Work
>
> Most Mapbox GL JS plugins that only use the **public rendering and interaction APIs**
> will work with MapLibre GL JS because MapLibre is a drop-in replacement for
> Mapbox GL JS v1.x.
>
> Examples of compatible plugins: `mapbox-gl-draw`, `mapbox-gl-geocoder` (if using
> non-Mapbox geocoding services), `mapbox-gl-directions`, `mapbox-gl-heatmap`.
>
> ### Plugins That May Not Work
>
> Plugins that depend on **Mapbox-specific services** or **private APIs** will not work:
>
> - Geocoding via `mapbox-gl-geocoder` using Mapbox's API
> - Directions via Mapbox Directions API
> - Tiles from `api.mapbox.com`
>
> ### How to Check Plugin Compatibility
>
> 1. Review the plugin's source code for `api.mapbox.com` or `mapbox://`
> 2. Test by replacing `mapbox-gl` with `maplibre-gl` in your `package.json`
> 3. Check community forks — search npm or GitHub for `maplibre-gl-[plugin-name]`
>
> ### Resources
>
> - [MapLibre GL JS GitHub](https://github.com/maplibre/maplibre-gl-js)
> - [MapLibre Ecosystem Projects](https://maplibre.org/projects/)

Judge note: No mention of `awesome-maplibre`. The ecosystem page and GitHub don't serve
the same purpose for plugin discovery — `awesome-maplibre` is the curated canonical list.

</details>

<details>
<summary>With-skill response (score: 1.00 — PASS)</summary>

> When migrating from **Mapbox GL JS** to **MapLibre GL JS**, plugin compatibility is a
> common concern. The good news is that **many Mapbox plugins continue to work with
> MapLibre**, but it depends on how the plugin was built and whether it has been updated
> or forked for MapLibre.
>
> ### 1. Check for MapLibre-Native or Forked Versions
>
> Many popular Mapbox plugins have been officially forked or rewritten to support
> MapLibre. Check these resources:
>
> - **[awesome-maplibre](https://github.com/maplibre/awesome-maplibre)** — The official
>   curated list of MapLibre-compatible tools, including plugins.
>   - Look under: User Interface Plugins, Geocoding & Search Plugins, Map Rendering
>     Plugins, Other Plugins
>
> Examples of popular plugins with MapLibre support:
>
> | Plugin     | Mapbox Version         | MapLibre Version         |
> | ---------- | ---------------------- | ------------------------ |
> | Draw       | `mapbox-gl-draw`       | `maplibre-gl-draw`       |
> | Geocoder   | `mapbox-gl-geocoder`   | `maplibre-gl-geocoder`   |
> | Directions | `mapbox-gl-directions` | `maplibre-gl-directions` |
>
> ### 2. Many Mapbox Plugins Work Unchanged
>
> Because MapLibre GL JS v1.x is API-compatible with Mapbox GL JS v1.x, plugins that
> only use public APIs (`map.addLayer`, `map.on`, `map.project`) often work without
> changes.
>
> Plugins that may break: those accessing private properties (`map._canvas`,
> `map.style._layers`), depending on Mapbox-specific services, or using Mapbox
> access token logic.
>
> ### Recommended Migration Path
>
> 1. **Audit your plugins** — List them and check
>    [awesome-maplibre](https://github.com/maplibre/awesome-maplibre).
> 2. **Replace with MapLibre-native versions** where available.
> 3. **Test remaining plugins** — keep only those that work reliably.

</details>

---

## Test 5 — Negative: Adding a geocoder to an existing Mapbox GL JS app

**Question:**

> I use Mapbox GL JS v2 and want to add a geocoder search box to my map. What are my
> options?

This is a negative test — the user is staying on Mapbox GL JS, not migrating. An
over-eager skill would incorrectly push migration advice. Both baseline and with-skill
responses answered the geocoding question directly without recommending a library switch.

Both runs: **PASS 1.00** — the skill does not over-apply.
