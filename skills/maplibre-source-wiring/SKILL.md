---
name: maplibre-source-wiring
description: Getting a MapLibre GL JS source to actually render — TileJSON `url` versus hand-wired `tiles` templates, matching `source-layer` names to the tile schema, layer order and inserting below labels, and the CORS and glyph failures behind a blank map. Use when a source is configured but nothing is drawing.
status: provisional
---

# MapLibre Source Wiring

You have a tile URL or a data file and a style, and the map is blank, missing labels, or
drawing in the wrong order. This skill covers connecting a source to a style correctly and
the failure modes that look identical from the outside.

For choosing a source type, see [maplibre-tile-sources](../maplibre-tile-sources/SKILL.md).

## When to Use This Skill

- The map loads but no tiles or features appear
- A custom style renders nothing against a tile source that works with the provider's own style
- Your data layer covers up street names and labels
- Labels or icons are missing while tiles render fine
- Deciding between a `tiles` array and a TileJSON `url` in a source definition

## Referencing tiles: `url` vs `tiles`

Tiles are addressed by zoom (Z), column (X), and row (Y) — a universal scheme across raster and vector tile sources (see [the OpenStreetMap wiki](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames) for more information). In a MapLibre source, you reference tiles either directly via a `tiles` URL template or via a `url` pointing to a TileJSON endpoint.

**When a TileJSON endpoint is available, prefer `url`.** MapLibre fetches the document and reads the tile URL template, zoom range, bounds, attribution, and (for vector tiles) the available source-layers automatically. Tile servers like Martin and tileserver-gl generate TileJSON endpoints for every tileset they serve, as do many hosted providers.

When no TileJSON endpoint exists — for example, a raw raster tile service that gives you a URL template directly — use the `tiles` array and specify any metadata (minzoom, maxzoom, attribution) in the source definition yourself.

**`url` to a TileJSON endpoint:**

```json
{
  "type": "vector",
  "url": "https://example.com/tiles.json"
}
```

**`tiles` array:**

```json
{
  "type": "vector",
  "tiles": ["https://example.com/tiles/{z}/{x}/{y}.pbf"],
  "minzoom": 0,
  "maxzoom": 14
}
```

The cost of hand-wiring `tiles` is that MapLibre has no zoom range unless you supply one, and will assume `maxzoom: 22` — requesting zoom levels the tileset doesn't contain, which come back empty. This is why `url` is the default advice wherever a TileJSON endpoint exists. (For PMTiles specifically the same rule applies and the consequence is sharper — see [maplibre-pmtiles-patterns](../maplibre-pmtiles-patterns/SKILL.md).)

## Nothing renders: `source-layer` and the tile schema

The most common cause of a custom style rendering nothing against a working tile source is a `source-layer` mismatch.

A vector tile source contains named layers — `transportation`, `water`, `landuse` and so on — and every style layer that draws from it must name one exactly:

```json
{
  "id": "roads",
  "type": "line",
  "source": "basemap",
  "source-layer": "transportation"
}
```

`source-layer` is required for vector sources and must match the tile schema exactly. A typo or a name from a different schema produces no error and no output — the layer simply draws nothing.

**Find the real names in the TileJSON.** For vector sources, the TileJSON `vector_layers` field lists each available `source-layer`, its attribute fields, and its zoom range. This is the authoritative reference **when it is present** — but `vector_layers` is optional in TileJSON 3.0, and providers are inconsistent about supplying it. Its absence does not mean there is no schema: identify the schema by name (below) and work from its published layer list. If you use a provider's pre-built style URL, the schema is already matched for you; the mismatch only appears when you write your own layers.

### Pre-defined tile schemas

When building a custom style you need to know the **tile schema** — the source-layer names and their properties. Common schemas:

- **OpenMapTiles** — the most widely adopted schema, based on OpenStreetMap data. Rich and detailed, with source-layers like `transportation`, `water`, `landuse`, `poi`. The largest ecosystem of community styles targets this schema.
- **Shortbread** — an open standard designed to be minimal and interoperable, not tied to any single vendor. Simpler structure than OpenMapTiles; a clean foundation if you're building styles from scratch.
- **Protomaps** — purpose-built for the Protomaps PMTiles basemap ecosystem. Flat, simple structure with source-layers like `land`, `water`, `roads`, `places`; optimized for serverless delivery. Published layer list: [docs.protomaps.com/basemaps/layers](https://docs.protomaps.com/basemaps/layers).

Each of these publishes its layer list as documentation (see References). None carries a machine-readable version marker, so checking a schema means re-reading the page; nothing can poll it for changes.

When generating tiles with Planetiler or tippecanoe, the output embeds TileJSON metadata in the MBTiles or PMTiles file. Tile servers like Martin read this metadata and expose it as a TileJSON endpoint automatically.

## Layer order: drawing below labels

Layers are drawn bottom-to-top in the order they appear in the style. `map.addLayer()` with no second argument appends the layer **above everything**, including street names — which is why a data overlay added this way hides the basemap's labels.

Pass the ID of the first symbol layer as the second argument to insert beneath it:

```javascript
map.on('load', () => {
  // Find the first symbol (label) layer to insert below
  const firstSymbolId = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;

  map.addSource('my-data', { type: 'geojson', data: '/path/to/data.geojson' });
  map.addLayer(
    { id: 'my-layer', type: 'circle', source: 'my-data' },
    firstSymbolId // insert before labels; omit to append above everything
  );
});
```

Find the layer programmatically rather than hardcoding an ID from one provider's style — `road-label` and friends are schema-specific and break the moment you change basemaps.

A raster layer added after vector layers will obscure them for the same reason.

## Missing labels and icons: `glyphs` and `sprite`

If tiles render but text or icons do not, the style root is usually missing:

- **`glyphs`** — URL template for font stacks: `"glyphs": "https://example.com/fonts/{fontstack}/{range}.pbf"`
- **`sprite`** — base URL for the sprite sheet and metadata, serving both `.json` and `.png`: `"sprite": "https://example.com/sprites/basic"`

Pre-built style URLs from hosted providers include their own. When building a custom style or self-hosting, you must supply them.

For font stacks, self-hosting versus generating, script coverage, and the GL JS local-font fallback, see [maplibre-fonts-glyphs](../maplibre-fonts-glyphs/SKILL.md).

## CORS

If your tiles, glyphs, or sprites are on a different origin, the server must send CORS headers (`Access-Control-Allow-Origin`). Otherwise the browser blocks the requests and the map is blank or missing labels.

Hosted providers handle CORS for you. For self-hosted servers or static storage, configure CORS on the server or CDN. Range-request sources (PMTiles) additionally need `Access-Control-Allow-Headers: Range`.

## Diagnosing a blank map

Work down this list — the symptoms overlap heavily:

| Symptom                                       | Check first                                                          |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Nothing at all, network shows failed requests | CORS headers; the tile URL itself (404s in the network tab)          |
| Nothing at all, network shows 200s            | `source-layer` names against the TileJSON `vector_layers`            |
| Tiles appear then vanish as you zoom in       | Missing zoom range on a hand-wired `tiles` source; use `url` instead |
| Tiles render, no text                         | Missing `glyphs` at the style root                                   |
| Tiles render, no icons                        | Missing `sprite` at the style root                                   |
| Data draws but hides labels                   | Layer order; insert before the first `symbol` layer                  |
| Vector source draws nothing, raster fine      | `source-layer` missing entirely — it is required for vector sources  |

## Related Skills

- [**maplibre-tile-sources**](../maplibre-tile-sources/SKILL.md) — Choosing between GeoJSON and tiles for a dataset.
- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md) — Registering the `pmtiles://` protocol and PMTiles-specific source setup.
- [**maplibre-fonts-glyphs**](../maplibre-fonts-glyphs/SKILL.md) — Font stacks, glyph endpoints, and script coverage.

## References

1. **MapLibre Style Specification** — [maplibre.org/maplibre-style-spec/](https://maplibre.org/maplibre-style-spec/)
2. **TileJSON specification** — [github.com/mapbox/tilejson-spec](https://github.com/mapbox/tilejson-spec)
3. **Slippy map tilenames (Z/X/Y scheme)** — [OpenStreetMap wiki](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames)
4. **OpenMapTiles schema** — [openmaptiles.org/schema/](https://openmaptiles.org/schema/)
5. **Shortbread tile schema** — [shortbread-tiles.org](https://shortbread-tiles.org/)
6. **Protomaps basemap layers** — [docs.protomaps.com/basemaps/layers](https://docs.protomaps.com/basemaps/layers)
7. **Martin tile server** (TileJSON endpoints) — [maplibre.org/martin/](https://maplibre.org/martin/)
8. **MapLibre GL JS docs** — [maplibre.org/maplibre-gl-js/docs/](https://maplibre.org/maplibre-gl-js/docs/)

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
