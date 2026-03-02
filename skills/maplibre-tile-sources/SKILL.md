---
name: maplibre-tile-sources
description: How to choose and configure tile sources for MapLibre GL JS — hosted vs self-hosted, free vs paid, including OpenFreeMap, PMTiles, MapTiler, and self-hosted OpenMapTiles. Use when setting up a map style or switching from Mapbox.
---

# MapLibre Tile Sources

MapLibre GL JS does not ship with tiles. You must provide a **style** that references tile **sources**. This skill helps you choose and configure sources for base maps and overlays.

## When to Use This Skill

- Setting up a new MapLibre map and need a base map (or a pre-built style URL that includes sources)
- Choosing **source URLs** (and glyphs/sprite) for a **custom style** you’re building
- Comparing free vs paid or hosted vs self-hosted tile options
- Configuring glyphs (fonts) and sprites so labels and icons render
- Debugging blank maps or missing tiles (e.g. wrong source URL, CORS, or missing glyphs/sprite in the style)
- Deciding between using a provider’s style URL (sources already set) vs defining your own style with your own sources
- Migrating from Mapbox and need equivalent tile sources and style setup

## Tiles and styles: how they relate

A **style** (a `style.json` or style object) is the configuration you pass to MapLibre. It tells the map _what_ to draw and _where to get the data_. It does **not** contain the tile data itself.

- **Sources** (in the style) — Point to the actual tile data. Each source has a `type` (`vector`, `raster`, or `raster-dem`) and a **URL** (e.g. a tile endpoint, or a PMTiles URL). The tiles are served from that URL; MapLibre requests them when the viewport needs them. So: **tiles live at the source URL; the style only references that URL.**
- **Layers** (in the style) — Define what to draw and how. Each layer references a source (and for vector tiles, a `source-layer` name) and specifies paint/layout (colors, line width, labels, etc.). The same tile source can back many layers (e.g. roads, water, labels from one vector URL).
- **Glyphs and sprite** (in the style) — Required for rendering text and icons. These are also URLs: glyphs for fonts, sprite for icon images. Without them, labels or symbols won’t appear even if the tile source loads.

So when you “choose a tile source,” you’re choosing the URL (and type) that goes into the style’s `sources`. You can use a **style URL** from a provider (e.g. OpenFreeMap, MapTiler)—that style JSON already has sources, layers, glyphs, and sprite—or you can **build your own style** and set the source URLs (and glyphs/sprite) yourself.

## Decision Framework

| Need                       | Prefer            | Options                                                                          |
| -------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| Zero config, no API key    | Hosted free       | OpenFreeMap                                                                      |
| Serverless, static hosting | Single-file tiles | PMTiles (see [maplibre-pmtiles-patterns](../maplibre-pmtiles-patterns/SKILL.md)) |
| Free tier, good quality    | Hosted commercial | MapTiler, Stadia Maps                                                            |
| Full control, no vendor    | Self-hosted       | OpenMapTiles (martin)                                                            |

## OpenFreeMap (Free, No API Key)

**Best for:** Prototyping, demos, and projects that can use a public style without an API key.

- **Styles:** Pre-built styles you can use as the map `style` URL (no need to define sources yourself).
- **Liberty (default):** `https://tiles.openfreemap.org/styles/liberty`
- **Positron (light):** `https://tiles.openfreemap.org/styles/positron`

**Usage with MapLibre:**

```javascript
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [0, 0],
  zoom: 2
});
```

**Limitations:** Rate limits may apply for heavy use; check OpenFreeMap terms. For production at scale, consider self-hosted or a provider with a clear SLA.

## MapTiler (Free Tier, API Key)

**Best for:** Production apps that want a free tier with good global coverage and optional paid scaling.

- Sign up at [MapTiler](https://www.maptiler.com/), get an API key.
- Use MapTiler Cloud styles (vector) or build your own with MapTiler Data.

**Example style URL (replace YOUR_KEY):**

```text
https://api.maptiler.com/maps/streets-v2/style.json?key=YOUR_KEY
```

**In MapLibre:** Use that URL as `style`. MapTiler style JSON already includes sources, glyphs, and sprites. Keep the key in environment variables and never commit it.

## Stadia Maps (Free Tier)

**Best for:** Stamen-style aesthetics (e.g. Stamen Toner, Terrain) with a free tier.

- Sign up at [Stadia Maps](https://stadiamaps.com/), get an API key.
- Styles and tile endpoints require the key; use their style JSON or build a custom style with their source URLs.

## Self-Hosted OpenMapTiles

**Best for:** Full control, no per-request cost, and air-gapped or custom data.

- **Schema:** [OpenMapTiles](https://openmaptiles.org/) defines a vector tile schema (layers like `transportation`, `water`, `landuse`, `poi`).
- **Servers:** Run a tile server that serves OpenMapTiles-compatible vector tiles:
  - **martin:** Serves MBTiles/PMTiles or PostGIS-backed dynamic vector tiles. See [Martin basemap from PostGIS](https://maplibre.org/martin/recipe-basemap-postgis.html) for a comprehensive guide
- **Data:** Use OpenMapTiles data build or other OSM-derived data in the same schema.

**Example source in a style JSON (self-hosted server at `https://tiles.example.com`):**

```json
{
  "type": "vector",
  "url": "https://tiles.example.com/data.json"
}
```

You must also provide `glyphs` and `sprite` in the style; see Glyphs and Sprites below.

## Protomaps and PMTiles (Serverless)

**PMTiles** is an open single-file tile format: one file per map (all layers, all zoom levels); MapLibre requests byte ranges via the **pmtiles** protocol—no tile server. You can **generate** your own (Planetiler, tippecanoe) or **obtain** tiles from [**Protomaps**](https://protomaps.com): a provider where you can download pre-built PMTiles (e.g. global or regional basemaps) and serve them yourself from static storage (S3, R2, GitHub Pages), or create custom extracts via the [PMTiles CLI](https://docs.protomaps.com/pmtiles/cli). Either way, host the `.pmtiles` file and point your style at it.

- Use the **pmtiles** protocol with MapLibre; see [maplibre-pmtiles-patterns](../maplibre-pmtiles-patterns/SKILL.md) for setup, hosting, and performance.

## Glyphs (Fonts) and Sprites

The style’s **sources** point to tile data; the style’s **glyphs** and **sprite** point to fonts and icons. All three are URLs in the style—MapLibre loads tiles, glyphs, and sprite from those URLs. Every MapLibre style that shows text or icons needs:

- **glyphs:** URL template for font stacks (e.g. `https://example.com/fonts/{fontstack}/{range}.pbf`).
- **sprite:** Base URL for sprite sheet and metadata (e.g. `https://example.com/sprites/basic` for `basic.json` and `basic.png`).

**OpenFreeMap styles** include glyphs and sprites; no extra config.

**MapTiler / Stadia** style JSONs include their own glyph and sprite URLs.

**Self-hosted:** Use MapLibre’s default glyphs or host your own (e.g. [OpenMapTiles fonts](https://github.com/openmaptiles/fonts)); for sprites, use [Maki](https://github.com/mapbox/maki) or OpenMapTiles sprites and host the JSON + PNG.

**Example style snippet with glyphs and sprite:**

```json
{
  "glyphs": "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  "sprite": "https://demotiles.maplibre.org/styles/osm-bright-gl-style/sprite"
}
```

## CORS and Self-Hosted Tiles

If your tiles (or glyphs/sprites) are on another origin, the server must send CORS headers (e.g. `Access-Control-Allow-Origin: *` or your domain). Otherwise the browser will block requests and the map may be blank or missing labels/icons.

- **Hosted providers** (OpenFreeMap, MapTiler, Stadia) already set CORS.
- **Self-hosted:** Configure your tile server or CDN to allow the origin of your map page.

## Quick Reference

| Provider    | API key | Style URL / usage                                                       |
| ----------- | ------- | ----------------------------------------------------------------------- |
| OpenFreeMap | No      | `https://tiles.openfreemap.org/styles/liberty` or `/positron`           |
| MapTiler    | Yes     | `https://api.maptiler.com/maps/streets-v2/style.json?key=KEY`           |
| Stadia Maps | Yes     | Use Stadia style JSON with key                                          |
| PMTiles     | No      | Use pmtiles protocol + your PMTiles URL (see maplibre-pmtiles-patterns) |
| Self-hosted | No      | Your tile server URL + glyphs + sprite in your style JSON               |

## Related Skills

- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md) — Serverless PMTiles hosting and MapLibre integration.
- **maplibre-style-patterns** — Layer and source configuration for common use cases. (Not yet in repo.)
- [**maplibre-mapbox-migration**](../maplibre-mapbox-migration/SKILL.md) — Replacing Mapbox tiles with MapLibre-compatible sources.
