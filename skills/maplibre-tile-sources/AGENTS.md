# MapLibre Tile Sources — Quick Reference

Use when the user needs a base map or tile source for MapLibre GL JS.

## Tiles vs style

- **Style** = the JSON (or style URL) you pass to MapLibre. It defines **sources** (URLs to tile data), **layers** (what to draw from those sources), and **glyphs** + **sprite** (fonts and icons). The style does _not_ contain the tiles—it only points to them.
- **Tiles** = the actual tile data (vector or raster) served at the source URLs. MapLibre fetches tiles when the viewport needs them. So: sources in the style = references to where the tiles live; layers = how to draw that data.
- **Pre-built style URL** (e.g. OpenFreeMap, MapTiler) = a full style that already has sources, layers, glyphs, and sprite. **Custom style** = you set the source URLs (and glyphs/sprite) yourself.

## Decision

- **No API key, quick start:** OpenFreeMap — `style: 'https://tiles.openfreemap.org/styles/liberty'` or `/positron`.
- **Free tier + production:** MapTiler or Stadia Maps (sign up, use style URL with key).
- **Serverless / static host:** PMTiles (see maplibre-pmtiles-patterns).
- **Self-hosted:** Build or serve your own vector tiles.
  - **Generate tiles:** [Planetiler](https://github.com/onthegomap/planetiler) (OSM → PMTiles/MBTiles or [MLT](https://maplibre.org/maplibre-tile-spec/), OpenMapTiles schema) or [OpenMapTiles data build](https://openmaptiles.org/docs/).
  - **Serve tiles:** [tileserver-gl](https://github.com/maptiler/tileserver-gl) (MBTiles/PMTiles + style) or [Martin](https://maplibre.org/martin/) (PostGIS → vector tiles).
- **MLT (MapLibre Tile):** Open vector tile format (successor to MVT); better compression and 3D/elevation support. MapLibre GL JS and Native support MLT; see [MapLibre demo tiles](https://demotiles.maplibre.org).

## Must-haves in a style

A style must reference (1) where the tiles come from and (2) where fonts and icons come from. The tiles themselves are not in the style.

- **Sources:** Each source has `type` (e.g. `vector`, `raster`) and a **URL** that points to the tile data. MapLibre requests tiles from that URL as the user pans/zooms.
- **Glyphs:** `"glyphs": "https://.../{fontstack}/{range}.pbf"` — required for any text labels.
- **Sprite:** `"sprite": "https://.../sprite"` (base URL for .json + .png) — required for symbol/icons. Layers reference the source; glyphs and sprite are style-level.

## Blank map checklist

1. Style URL loads (no 404).
2. Source URLs load (check Network tab).
3. Glyphs and sprite URLs load and CORS allows the page origin.
4. Style JSON is valid (no syntax errors).

## Do not

- Assume Mapbox style URLs or `mapbox://` work in MapLibre (they do not).
- Commit API keys; use env vars for MapTiler/Stadia.
