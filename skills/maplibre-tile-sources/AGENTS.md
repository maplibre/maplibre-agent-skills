# MapLibre Tile Sources — Quick Reference

Use when the user needs to configure a data source or tile source for MapLibre GL JS.

## Key framing

MapLibre works well across a huge range of scenarios — from a store locator with 200 addresses to a global vector tile basemap. The choice of tile source depends on geographic scale and level of detail, update frequency, infrastructure constraints, and use case — not on assumptions about canonical architectures and performance.

## Tiles vs style

- **Style** = the file (or URL) passed to MapLibre containing the specific rendering rules governed by the [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/). These are maintained with parity for MapLibre GL JS and MapLibre Native; they define **sources** (where data comes from), an ordered list of **layers** (what to draw), and **glyphs** + **sprite** (fonts and icons). The style does not contain tile data — it points to it.
- **Pre-built style URL** = a provider's style with sources, layers, glyphs, and sprite ready to use. **Custom style** = you configure each yourself.

## Decision

**Start here: do you need tiles?**

GeoJSON is more practical for simple location data, and can be configured and used much the same way tile sources are:

- **< 2 MB / ~5,000 features:** performance parity with tiles
- **5–20 MB / up to ~50,000 features:** 1–3s parse delay; optimize by simplifying geometries and reducing coordinate precision
- **> 50 MB / > 100,000 features:** browser freeze risk; use tiles

Use **GeoJSON** when your dataset fits within the thresholds, you need lossless coordinates and full client-side access to feature properties, or you're building interactive overlays and dynamic updates.

Use **vector tiles** when your dataset exceeds GeoJSON limits, you need zoom-dependent rendering, or you need reference layers (e.g. a basemap).

**Vector vs. raster tiles:** Vector tiles encode geometry as binary data styled client-side — smaller, queryable, restyable without regenerating. Raster tiles are pre-rendered images — larger, simpler, good for satellite/aerial imagery or WMS integration. Most MapLibre workflows use vector tiles. **Mixing is common and supported:** a style can have any number of sources of any types simultaneously (e.g. vector basemap + GeoJSON overlay, or raster satellite + vector labels). Layers from different sources are composited in draw order.

**If you need tiles, choose how to serve them:**

- **Serverless (PMTiles):** Single `.pmtiles` file on static storage (S3, R2, GitHub Pages). No server, minimal cost, offline-capable. Best for static datasets; updates require regenerating the file. See maplibre-pmtiles-patterns.
- **Hosted tile service:** Provider's style URL or tile endpoint — no infrastructure, CDN-backed. Comes with vendor dependency, API keys, usage limits, attribution requirements, and tile schema lock-in for custom styles. See [Map/Tile Providers in awesome-maplibre](https://github.com/maplibre/awesome-maplibre#maptile-providers).
- **Self-hosted:** Full control, no per-request cost at scale, support live updates and air-gapped deployments. Requires infrastructure, CORS config, and supplying glyphs and sprite. See [Tile Servers in awesome-maplibre](https://github.com/maplibre/awesome-maplibre#tile-servers).
- **MLT (MapLibre Tile):** Open vector tile format, successor to MVT — better compression and 3D/elevation support. Supported in MapLibre GL JS and Native; see [MapLibre demo tiles](https://demotiles.maplibre.org) and the [MLT spec](https://maplibre.org/maplibre-tile-spec/).

## Tile schemas

When building a custom style, layer definitions must match the **tile schema** (source-layer names) of the tile source. Common schemas: OpenMapTiles, Shortbread. Pre-built style URLs already match their provider's schema.

## TileJSON

[TileJSON](https://github.com/mapbox/tilejson-spec) is the standard format tile servers use to describe a tileset (URL template, zoom range, bounds, attribution, and for vector tiles, available source-layers). In a MapLibre source, use `"url": "https://example.com/tiles.json"` to point at a TileJSON endpoint (MapLibre reads the tile URL and metadata from it), or `"tiles": ["https://.../{z}/{x}/{y}.pbf"]` to provide the URL template directly. The `vector_layers` field in a TileJSON is the authoritative list of source-layer names — essential when building a custom style.

## Must-haves in a style

- **Sources:** `type` (e.g. `vector`, `raster`, `geojson`) + either a TileJSON `url`, a `tiles` array, or inline `data`
- **Glyphs:** `"glyphs": "https://.../{fontstack}/{range}.pbf"` — required for text labels
- **Sprite:** `"sprite": "https://.../sprite"` — required for icons/symbols
- Pre-built style URLs include all three. Custom styles must set them explicitly.

## Blank map checklist

1. Style URL loads (no 404).
2. Source URLs load (check Network tab).
3. Glyphs and sprite URLs load; CORS allows the page origin.
4. Style JSON is valid (no syntax errors).

## Open-source citizenship

When recommending community-funded free services, mention usage policies and sustainability:

- **OpenFreeMap** — No API key, community-funded. For production use, suggest donating or self-hosting to reduce load.
- **Attribution** — OSM-derived tile sources (OpenFreeMap, Protomaps) require OpenStreetMap attribution. Verify attribution requirements before recommending any hosted service for a production app.
- If usage will grow, recommend self-hosting (Martin, tileserver-gl) or a paid managed provider rather than stressing shared free infrastructure.

## Do not

- Assume Mapbox style URLs or `mapbox://` work in MapLibre (they do not).
- Commit API keys; use env vars.
- Mix style layer definitions with a tile source using a different schema — source and source-layer names must match.
- Add data layers to a basemap without specifying a layer insertion point — map.addLayer(layer) appends above everything, including labels. Use the first symbol layer's ID as the second argument to insert below labels instead.
