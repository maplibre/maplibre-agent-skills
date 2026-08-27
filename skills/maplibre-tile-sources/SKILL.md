---
name: maplibre-tile-sources
description: Choosing what form your data needs for MapLibre GL JS — GeoJSON read straight from a file versus vector or raster tiles, the feature-count and file-size thresholds where each stops working, and how a basemap and your own data combine as separate sources. Use when deciding which source type a dataset needs, not when hosting or configuring one.
status: provisional
---

# MapLibre Tile Sources

MapLibre GL JS does not ship with map data. You provide a **style** that references **sources** — URLs or inline data that MapLibre fetches and renders. MapLibre works equally well for a store locator with 200 addresses, a city transit map, and a global basemap — the right source type depends on geographic scale and level of detail, update frequency, infrastructure constraints, and use case.

This skill is about **choosing** that source type. For getting a configured source to render see [maplibre-source-wiring](../maplibre-source-wiring/SKILL.md).

## When to Use This Skill

- Setting up a new MapLibre map and choosing where your data comes from
- Deciding between GeoJSON and tiles for a dataset of a given size
- Working out whether you need tile infrastructure at all
- Planning how a basemap and your own data fit together

## How styles and sources work

A **style** (a style JSON, style document, or style object) is the configuration you pass to MapLibre. It contains the specific rendering rules governed by the [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/), maintained with parity for MapLibre GL JS and MapLibre Native.

You can use a **style URL** from a provider — that URL references a style with sources, layers, glyphs, and sprite. Or you can **build your own style** and configure each yourself.

A style has three main components:

- **Sources** — Point to the actual data. Each source has a `type` and either inline data or a URL. MapLibre requests tiles or data as the viewport changes. The same source can back many layers (e.g. roads, water, and labels all from one vector URL).
- **Layers** — An ordered list defining what to draw and how. Each layer references a source (and for vector tiles, a `source-layer` name) and specifies paint/layout properties.
- **Glyphs and sprite** — URLs to font SDF stacks and icon spritesheets. `sprite` has no fallback: a missing icon is silently omitted. `glyphs` does have one on GL JS ≥ 5.11.0 (text still renders, in a local/system font) — see [maplibre-fonts-glyphs](../maplibre-fonts-glyphs/SKILL.md) for the mechanism and its limits. Production styles should still supply both explicitly.

**Source types:**

| Type         | Description                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `vector`     | Vector tiles — binary-encoded geometry and attributes; the primary format for basemaps and data overlays |
| `raster`     | Raster tile imagery — satellite photos, WMS/WMTS layers                                                  |
| `raster-dem` | Elevation tiles — for terrain rendering and hillshading                                                  |
| `geojson`    | GeoJSON data — inline object or URL; no tile server needed                                               |
| `image`      | A single georeferenced image — scanned maps, annotated overlays                                          |
| `video`      | Georeferenced video                                                                                      |

`vector` and `raster` are the most common for basemaps and data overlays. `geojson` is ideal for small datasets or interactive data that doesn't need tiling. `raster-dem` is used for terrain and hillshade effects, as well as emerging use cases in scientific visualization. `image` and `video` sources are the least common, but let you georeference static images (such as a scanned map, chart, or overlay) or georeferenced videos as map layers.

## GeoJSON and Direct Data Sources

For many use cases you don't need a tile service. MapLibre can render points, lines, or polygons directly from an inline GeoJSON object or a URL to a GeoJSON file. The entire dataset is downloaded and parsed in the browser; MapLibre handles rendering client-side.

```javascript
map.addSource('my-data', {
  type: 'geojson',
  data: '/path/to/data.geojson' // or an inline GeoJSON object
});
map.addLayer({
  id: 'my-layer',
  type: 'fill',
  source: 'my-data',
  paint: { 'fill-color': '#0080ff', 'fill-opacity': 0.5 }
});
```

### GeoJSON performance thresholds

GeoJSON downloads the entire file on every load. This works well at small scale and degrades predictably:

| Range      | File size / feature count        | Behavior                                                                                                    |
| ---------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sweet spot | < 2 MB / < 5,000 features        | Instantaneous loading, smooth interaction                                                                   |
| Lag zone   | 5–20 MB / up to ~50,000 features | 1–3s parse delay; mobile may struggle; optimize by simplifying geometries and reducing coordinate precision |
| Crash zone | > 50 MB / > 100,000 features     | High risk of browser freeze or crash; switch to vector tiles                                                |

GeoJSON is **lossless** (exact coordinates preserved) and gives you full client-side access to feature properties — ideal for interactive data, dynamic updates, and datasets where you need to query or modify features without a server round-trip.

If your dataset exceeds these thresholds, or if you need zoom-dependent rendering (less detail at lower zoom levels), consider vector tiles instead.

### Other formats and the cloud-native ecosystem

The choice of data source is shaped by more than performance: data type, update frequency, access patterns, and the broader geospatial ecosystem all factor in. Many formats (FlatGeobuf, GeoParquet, Cloud-Optimized GeoTIFF, KML, GPX, and more) can be displayed in MapLibre via plugins and custom protocols. The cloud-native geospatial ecosystem — formats designed for HTTP range requests and distributed storage — is evolving rapidly and increasingly relevant for web maps. A separate skill will cover this in depth; for now, see the [Map Rendering Plugins](https://github.com/maplibre/awesome-maplibre#map-rendering-plugins) and [Utility Libraries](https://github.com/maplibre/awesome-maplibre#utility-libraries) sections of awesome-maplibre.

## When You Need Tiles

Vector tiles load only the data visible in the current viewport, in a compact binary format. Use them when:

- Your dataset exceeds GeoJSON's practical limits
- You need zoom-dependent rendering (different levels of detail at different zoom levels)
- You need global or regional reference layers, such as land and water, roads, place names, etc. (i.e., basemap data)
- Bandwidth efficiency matters at scale

### Vector tiles vs. raster tiles

When you need tiles, you'll choose between two tile types:

**Vector tiles** encode geometry and feature attributes as compact binary data (Mapbox Vector Tile format, or the newer [MapLibre Tile / MLT](https://maplibre.org/maplibre-tile-spec/)). MapLibre renders and styles them client-side:

- Styles can be changed without regenerating tiles
- Features are queryable (click, hover interactions)
- Text renders crisply at any zoom or screen density
- Significantly smaller file sizes than equivalent raster tiles

**Raster tiles** are pre-rendered images (PNG, JPEG, or WebP) at each zoom level, displayed by MapLibre as-is:

- No client-side styling or feature querying
- Larger file sizes, but simpler to generate and serve
- Good fit for satellite/aerial imagery, WMS/WMTS integration, or rendered styles that don't need client-side customization

Most MapLibre workflows use vector tiles; increasing numbers are integrating `raster-dem` sources e.g. for terrain rendering. Use raster tiles when you need satellite/aerial imagery, when integrating with existing WMS or WMTS services, or when you need a pre-rendered cartographic style.

### Using MapLibre with Leaflet

[Leaflet](https://leafletjs.com/) is a widely used JavaScript mapping library that supports only raster tiles. If your app is built on Leaflet, [MapLibre GL Leaflet](https://github.com/maplibre/maplibre-gl-leaflet) lets you pre-render a MapLibre GL compatible style as a raster layer — allowing you to use hosted vector tile sources in your Leaflet app.

## Combining source types

A MapLibre style can have any number of sources of any types simultaneously. Layers from different sources are composited in draw order. This makes it natural to mix sources for different purposes.

- **Vector basemap + GeoJSON overlay** — the most common pattern. Use a provider's style URL (or any vector tile source) as your basemap and add your own data on top. To keep labels readable, insert your layer before the first symbol layer rather than appending to the top of the stack (see [maplibre-source-wiring](../maplibre-source-wiring/SKILL.md)).
- **Raster imagery + vector labels** — add a raster source for satellite imagery, weather radar, historical imagery, heatmaps rendered server-side, or any imagery that isn't available as vector data. Add a vector source for roads, place names and other labels. This gives crisp imagery with crisp, resolution-independent vector geometries and labels on top.
- **Vector basemap + raster-dem terrain** — add hillshading or 3D terrain to any vector basemap using a `raster-dem` source (elevation tiles). This is how MapLibre renders terrain and hillshade without a separate basemap style.

### When to choose each approach

Most real-world apps combine source types — a hosted basemap for the reference layer and your own data as a separate source. You rarely need to build a custom tile pipeline just for your data.

| Scenario                                                        | Recommended source setup                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| < ~5,000 features, need click/hover interaction or live updates | GeoJSON — no tile server needed                                                  |
| 5,000–100,000 features                                          | GeoJSON if you can simplify and accept 1–3s load delay; otherwise vector tiles   |
| > 100,000 features or > 50 MB                                   | Vector tiles — generate with tippecanoe or Planetiler                            |
| Street, terrain, or place basemap                               | Hosted tile service (OpenFreeMap, MapTiler) or self-hosted (Martin)              |
| Your own data over any basemap                                  | Hosted basemap style URL + your data as a separate GeoJSON or vector tile source |
| Satellite/aerial imagery + labels                               | Raster tile source for imagery + vector source for roads and labels              |

The key distinction: the basemap and your data are almost always separate sources, even if both are vector tiles. The basemap provides context; your sources provide your application's data. Mixing them into a single custom tile source is rarely the right approach unless you are building a self-hosted map with full control of the tile pipeline.

## Related Skills

- [**maplibre-fonts-glyphs**](../maplibre-fonts-glyphs/SKILL.md) — Setting up the `glyphs` URL, self-hosting or generating font PBFs, and non-Latin script support.
- [**maplibre-source-wiring**](../maplibre-source-wiring/SKILL.md) — TileJSON, `source-layer`, layer order, CORS, and blank-map debugging.
- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md) — Serverless PMTiles hosting and MapLibre integration.
- [**maplibre-mapbox-migration**](../maplibre-mapbox-migration/SKILL.md) — Replacing Mapbox tiles with MapLibre-compatible sources.

## References

1. **GeoJSON performance thresholds** (file size / feature count ranges) — community rules of thumb aggregated from Stack Overflow, Reddit, Medium, and Cesium Community Forum discussions. ⚑ _not authoritative or canonical_
2. **MapLibre Style Specification** — [maplibre.org/maplibre-style-spec/](https://maplibre.org/maplibre-style-spec/)
3. **MapLibre Tile (MLT) specification** — [maplibre.org/maplibre-tile-spec/](https://maplibre.org/maplibre-tile-spec/)
4. **Planetiler** (generate vector tiles from OSM) — [GitHub](https://github.com/onthegomap/planetiler)
5. **tippecanoe** (generate vector tiles from GeoJSON) — [github.com/felt/tippecanoe](https://github.com/felt/tippecanoe)
6. **Leaflet** — [leaflet.js](https://leafletjs.com/)
7. **MapLibre GL Leaflet** — [github.com/maplibre/maplibre-gl-leaflet](https://github.com/maplibre/maplibre-gl-leaflet)
8. **Cloud-native geospatial formats**: FlatGeobuf ([flatgeobuf.org](https://flatgeobuf.org/)), GeoParquet ([GeoParquet](https://geoparquet.org/)), Cloud-Optimized GeoTIFF ([COG website](https://cogeo.org/))
9. **awesome-maplibre** — [github.com/maplibre/awesome-maplibre](https://github.com/maplibre/awesome-maplibre)

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
