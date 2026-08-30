---
name: maplibre-dem-sources
description: The elevation data behind terrain in MapLibre GL JS — telling a real `raster-dem` tileset from a picture of relief, the `encoding` property and the Terrarium and Mapbox Terrain-RGB pixel formulas behind it, `tileSize`, where open elevation tiles come from, and generating your own. Use when terrain or hillshade renders wrong, spiky, inverted, or flat and nothing is logged.
status: provisional
---

# MapLibre DEM Sources

Every terrain feature in MapLibre GL JS — 3D terrain, hillshade, color-relief, runtime contours — reads
elevation from one place: a `raster-dem` source whose tiles pack a height in meters into RGB pixels. When
that packing is misread, nothing errors. The tiles decode, the map draws, and the numbers are wrong.

## When to Use This Skill

These are symptoms as you would observe them, before you know the cause:

- Terrain is a violently spiky surface, or the sea is a plateau and the peaks are pits
- Terrain is enabled and the surface is perfectly flat, or the relief is far too shallow
- Hillshade draws, but the shading has no relationship to the real landscape
- Everything looks a zoom level off, or terrain detail stops early and never sharpens
- Elevation values read back from the map are plausible-looking and wrong
- You have an endpoint whose name or docs say "terrain", "hillshade", or "DEM" and you need to know
  whether MapLibre can use it as elevation at all
- You are producing your own elevation tiles and have to choose what to write into the pixels

**Not this skill.** Configuring the layers that depict elevation — hillshade, color-relief, contours, 3D
terrain and its sky — [maplibre-terrain-rendering](../maplibre-terrain-rendering/SKILL.md). Choosing
between GeoJSON, vector, and raster for ordinary map data —
[maplibre-tile-sources](../maplibre-tile-sources/SKILL.md). Serving your finished tiles from a single
file — [maplibre-pmtiles-patterns](../maplibre-pmtiles-patterns/SKILL.md).

## A `raster-dem` source is a number format, not a subject matter

`raster-dem` means the tiles carry elevation **encoded in the pixel values**, which MapLibre decodes back
to meters.[1] Nothing about an endpoint's name, its subject, or its file extension makes it one:

- **A pre-rendered hillshade or relief basemap is not a DEM.** It is a picture of shading. The elevation
  was consumed when the image was made and is not recoverable. Wire it as an ordinary `raster` source and
  `raster` layer; it can look excellent, and it can never drive `setTerrain`, `hillshade`, `color-relief`,
  or runtime contours.
- **JPEG cannot carry an encoding at all.** Both packings depend on exact per-channel byte values, and
  lossy compression rewrites them. Elevation tiles are PNG or WebP (lossless).[4], [5]
- **A GeoTIFF DEM is not a `raster-dem` source either.** MapLibre reads tiled, RGB-packed PNG/WebP, not
  float rasters; a GeoTIFF has to be converted first (below).

If the tileset publishes TileJSON, its `encoding` field — when present — is the authoritative statement of
which packing it uses.[1]

## `encoding` defaults to `"mapbox"`, and the wrong one fails silently

The single most productive terrain bug: the source property is `encoding`, its default value is
`"mapbox"` (Mapbox Terrain-RGB), and most open elevation tiles — AWS Open Data, Mapterhorn, and anything
else out of the Tilezen/Mapzen lineage — are **Terrarium**.[1], [4], [5] Decoding Terrarium pixels with
the Mapbox formula is arithmetically valid on every pixel, so there is no error, no warning, and no
console message. There is only a wrong landscape.

| `encoding`    | Meters from a pixel                                                                                     | Written by                                          |
| ------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `"terrarium"` | `(red * 256 + green + blue / 256) - 32768`                                                              | AWS Open Data terrain tiles, Mapterhorn, Tilezen[4] |
| `"mapbox"`    | `-10000 + ((red * 256 * 256 + green * 256 + blue) * 0.1)`                                               | Mapbox Terrain-RGB, and tilesets built to it[5]     |
| `"custom"`    | `(red * redFactor + green * greenFactor + blue * blueFactor) - baseShift`, per the source's own factors | A packing of your own[1]                            |

The encoding is a property of the data. Read it off the provider's documentation and set it explicitly;
never leave it to the default because a source "looks like terrain."

```json
{
  "terrain-dem": {
    "type": "raster-dem",
    "tiles": ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"],
    "encoding": "terrarium",
    "tileSize": 512,
    "maxzoom": 12
  }
}
```

`redFactor`, `greenFactor`, `blueFactor`, and `baseShift` (all default `1.0`, `1.0`, `1.0`, `0.0`) apply
only under `encoding: "custom"` and have been available in GL JS since 3.4.0.[1]

### Reading the symptom backwards

| What you see                                                      | Most likely cause                                                           |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Extreme spikes and walls; coastlines become cliffs; peaks sit low | Terrarium tiles decoded as `"mapbox"` — set `encoding: "terrarium"`         |
| Relief nearly flat, mountains as gentle swells                    | Mapbox Terrain-RGB tiles decoded as `"terrarium"`                           |
| Detail is a zoom level coarser or finer than the imagery          | `tileSize` not matching the tileset (default is 512; many DEMs are 256)     |
| Relief stops sharpening past some zoom, then stays blocky         | The source's `maxzoom` is reached; MapLibre overzooms the last level it has |
| Nothing draws at all and the network tab shows 403 or 404         | A wrong URL template or a missing API key — not an encoding problem         |

## Where open elevation tiles come from

| Source                                                                                | Tiles                                                                     | Encoding  | `tileSize` |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------- | ---------- |
| [AWS Open Data terrain tiles](https://registry.opendata.aws/terrain-tiles/) (Tilezen) | `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png` | Terrarium | 256        |
| [Mapterhorn](https://mapterhorn.com/)                                                 | `https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`                           | Terrarium | 512        |

Both are keyless. Mapterhorn also publishes TileJSON at `https://tiles.mapterhorn.com/tilejson.json`,
which is what MapLibre's own 3D terrain example points `url` at — preferring `url` over a hand-written
`tiles` template gets the zoom range and attribution without stating them.[7], [10] Mapterhorn documents
the migration from the AWS tiles as a three-line diff: same Terrarium encoding, new URL, `tileSize` 256 to 512.[7]

Commercial providers (MapTiler, Stadia Maps, and others) serve elevation tiles behind an API key. Take the
encoding from the provider's own documentation rather than assuming it; a hosted product is as likely to be
Terrain-RGB as Terrarium.

## Generating and hosting your own

MapLibre consumes elevation tiles; it does not produce them. The pipeline is outside MapLibre entirely:

1. Get a DEM as a float raster (GeoTIFF) — a national LiDAR product, Copernicus DEM, or SRTM.
2. Reproject to Web Mercator (EPSG:3857) and build a tile pyramid, with GDAL.
3. Pack each tile's elevation into RGB with the formula for the encoding you intend to declare — Mapbox's
   `rio-rgbify` writes Terrain-RGB, and the Tilezen formats document specifies Terrarium.[4], [8]
4. Serve the pyramid as PNG or WebP over HTTPS with CORS, or bundle it into a single PMTiles archive.[9]

Whichever you write, the number you declare in `encoding` must be the number you packed. Round-trip one
pixel by hand against the formula in the table above before generating a continent.

## Related Skills

- [**maplibre-terrain-rendering**](../maplibre-terrain-rendering/SKILL.md) — Hillshade, color-relief, runtime contours, and 3D terrain drawn from a working DEM source.
- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md) — Serving `raster-dem` tiles from a single PMTiles file, and the CORS and range-request requirements.
- [**maplibre-tile-sources**](../maplibre-tile-sources/SKILL.md) — Source types for ordinary map data, and where `raster-dem` sits among them.

## References

1. **Style Specification: sources** — `raster-dem` properties, `encoding` values and default, `tileSize`, `redFactor`/`greenFactor`/`blueFactor`/`baseShift` — <https://maplibre.org/maplibre-style-spec/sources/>
2. **GL JS `dem_data.ts`** — the unpack implementation: `red * redFactor + green * greenFactor + blue * blueFactor - baseShift`, with `"terrarium"` = `(256, 1, 1/256, 32768)` and `"mapbox"` = `(6553.6, 25.6, 0.1, 10000)` — <https://github.com/maplibre/maplibre-gl-js/blob/main/src/data/dem_data.ts>
3. **Style Specification: terrain** — <https://maplibre.org/maplibre-style-spec/terrain/>
4. **Tilezen `joerd` terrain formats** — the Terrarium formula and its 32768 offset — <https://github.com/tilezen/joerd/blob/master/docs/formats.md>
5. **Mapbox Terrain-RGB v1** — the `-10000 + (… * 0.1)` formula — <https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/>
6. **AWS Open Data terrain tiles** — <https://registry.opendata.aws/terrain-tiles/>
7. **Mapterhorn** — hosted Terrarium WebP tiles and the AWS migration diff — <https://mapterhorn.com/> and <https://github.com/mapterhorn/mapterhorn>
8. **`rio-rgbify`** — writes Terrain-RGB tiles from a DEM — <https://github.com/mapbox/rio-rgbify>
9. **PMTiles** — <https://docs.protomaps.com/pmtiles/>
10. **3D Terrain example (GL JS)** — the Mapterhorn TileJSON source it ships with — <https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/>

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
