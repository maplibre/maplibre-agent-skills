---
name: maplibre-terrain-patterns
description: Terrain and hillshade in MapLibre GL JS — raster-dem sources, Terrarium vs. Mapbox RGB encoding, hillshade layer configuration (single and multi-pass), 3D terrain, dynamic contour lines, and self-hosting DEM tiles. Use when adding elevation context, hillshade, or 3D terrain to a map.
status: provisional
---

# MapLibre Terrain Patterns

MapLibre GL JS can render terrain in several ways: **hillshade** (a 2D lighting effect from elevation data), **3D terrain** (extruded mesh that uses elevation values and camera pitch), **color-relief** (direct coloring based on elevation values), and **dynamic contour lines** (vector contours generated at runtime).[1], [7] These methods are often combined in the same map to create rich terrain visualizations.

All of these methods use a `raster-dem` source, colloquially referred to as “terrain tiles”, which encodes elevation values into PNG/WebP pixel values.[1], [3]

There are additional earth observation analysis layers traditionally derived from a DEM, like slope, aspect, and curvature.[11], [14] When these are needed, they are typically precomputed in GIS workflows and served as raster layers, rather than computed client-side in MapLibre.

## When to Use This Skill

- Adding hillshade, color-relief, contours, or 3D terrain to a MapLibre map
- Choosing a `raster-dem` source and understanding encoding formats
- Migrating from Mapbox terrain tiles to an open alternative
- Adding dynamic contour lines from terrain data
- Self-hosting terrain tiles in `raster-dem` format
- Troubleshooting terrain that looks flat, inverted, or visually wrong

### Differences Between DEM, `raster-dem`, and Hillshade

Digital Elevation Model (DEM), `raster-dem`, and hillshade are distinct concepts that are often confused.

A **DEM** is a raster where each cell stores elevation as a numeric value (for example, GeoTIFF in meters).[15], [17]

MapLibre does not read those GeoTIFFs directly. Elevation is first encoded as RGB tiles (Terrain‑RGB or Terrarium), then exposed to MapLibre as a **`raster-dem` source**.[5], [6] A `raster-dem` source always represents elevation per pixel, decoded using one of the supported encodings (`"mapbox"` or `"terrarium"`).[1], [3]

When creating a hillshade (or color‑relief, contours, or 3D terrain) in MapLibre, the key prerequisite is to choose and configure an appropriate `raster-dem` source; generating the DEM tiles yourself is computationally intensive, difficult, and usually unnecessary because high‑quality terrain services are freely or commercially available.[4], [8]

### When to use precomputed rasters (instead of `raster-dem`)

In many cases it is simpler to use terrain visualizations that have already been computed in external workflows and exported as tiles. In these cases, configure your tiles as source type `raster` rather than `raster-dem`.

Services like OpenTopography or Blender and standard GIS workflows (GDAL, QGIS, ArcGIS) can generate hillshade and color-relief rasters with full artistic control over lighting, texture, and color ramps.[14], [21] Slope rasters and blended “color shaded relief” products must be created directly from DEMs in these tools.[11], [20]

The advantage is that you get rich terrain visualization with minimal layer and source configuration, and performance is better because the client only draws pre-rendered tiles.[14], [22]

The limitation is that these rasters do not contain encoded elevation values (Terrain-RGB/Terrarium), so they cannot power client-side hillshade/color-relief, 3D terrain, or runtime contours in MapLibre.[3], [23]

Precomputed rasters are a good fit when you:

- Only need terrain as a static background (terrain basemap, shaded relief backdrop).
- Want consistent cartography across platforms and don’t need MapLibre to recompute hillshade or color-relief client-side.
- Prefer to avoid the complexity of DEM encoding and `raster-dem` configuration.

When you need MapLibre features that depend on elevation (3D terrain via `setTerrain()`, client-side hillshade or color-relief, dynamic contours), point those layers at a `raster-dem` source backed by Terrain‑RGB or Terrarium tiles—for example AWS Terrain Tiles, Mapterhorn, Stadia Terrarium, or MapTiler Terrain RGB.[1], [4]

## The `raster-dem` Source and Encoding

A `raster-dem` source provides elevation data encoded into PNG/WebP pixel values. MapLibre reads pixel colors and converts them to meter elevations using a formula specific to the encoding format.[1], [3]

**This is the primary AI failure zone for terrain setup.** MapLibre's default encoding is `"mapbox"` (Mapbox Terrain‑RGB formula), but many major open and free DEM sources (for example, AWS Terrain Tiles and Mapterhorn) use the Terrarium format.[5], [6] Using the wrong encoding produces silently incorrect elevations — terrain may appear flat, inverted, or wildly exaggerated with no error in the console.

| Encoding      | Formula                                       | Common sources                                   |
| ------------- | --------------------------------------------- | ------------------------------------------------ |
| `"terrarium"` | `(R * 256 + G + B / 256) - 32768`             | AWS Terrain Tiles, Mapterhorn, most open sources |
| `"mapbox"`    | `(R * 256 * 256 + G * 256 + B) * 0.1 - 10000` | MapTiler terrain-rgb, Mapbox Terrain             |

Terrarium and Mapbox formulas are defined by the Tilezen/Mapzen terrain pipeline and the Mapbox Terrain‑RGB specification.[5], [6]

**Always verify the encoding of your DEM source before configuring the style.** The encoding is a property of the data, not a preference.

```json
{
  "terrain": {
    "type": "raster-dem",
    "url": "pmtiles://terrain.pmtiles",
    "tileSize": 512,
    "encoding": "terrarium"
  }
}
```

### Open terrain tile sources

| Source                                                            | Encoding  | Key required              | Notes                                                                                                                                                     |
| ----------------------------------------------------------------- | --------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) | Terrarium | No                        | Original Mapzen dataset; `s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`; global; 256px PNG; can be slow from the browser without a CDN |
| [Mapterhorn](https://mapterhorn.com/)                             | Terrarium | No                        | WebP PMTiles; 512px; global up to z12; NLnet-funded open source; self-host from a single file                                                             |
| Stadia Maps Terrarium                                             | Terrarium | Yes (free tier available) | Hosted; fast CDN                                                                                                                                          |
| MapTiler terrain-rgb                                              | Mapbox    | Yes                       | Hosted; fast CDN                                                                                                                                          |
| `demotiles.maplibre.org`                                          | Terrarium | No                        | Used in official MapLibre examples; **not for production**                                                                                                |

For production without a key, Mapterhorn is the recommended open option.[4], [8] See [Mapterhorn](https://mapterhorn.com/) for available hosted endpoints. See [maplibre-pmtiles-patterns](../maplibre-pmtiles-patterns/SKILL.md) for extracting and self-host.

## Hillshade layers

A `hillshade` layer must be defined in the layers array of the map style, referencing a `raster-dem` source. It does not require `map.setTerrain()` — hillshade and 3D terrain are independent.

```json
{
  "id": "hillshade",
  "type": "hillshade",
  "source": "terrain",
  "paint": {
    "hillshade-illumination-direction": 315,
    "hillshade-illumination-anchor": "map",
    "hillshade-exaggeration": 0.5,
    "hillshade-shadow-color": "rgba(30,40,80,0.45)",
    "hillshade-highlight-color": "rgba(255,240,200,0.4)",
    "hillshade-accent-color": "rgba(10,15,50,0.5)"
  }
}
```

`hillshade-method` controls the shading algorithm (`standard`, `basic`, `combined`, `igor`, `multidirectional`); multidirectional hillshade can soften shadows by simulating light from multiple directions without stacking several layers.[9] Some cartographers use multiple hillshade layers with different `hillshade-illumination-direction` values to fine tune the multidirectional shading.[10], [11] This approach can impact performance.

For a basic hillshade configuration driven by a raster-dem source, see [Add a hillshade layer](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-hillshade-layer/).

**Color scheme for imagery basemaps:** Warm golden highlights (`rgba(255,240,200,0.4)`) and cool blue-purple shadows (`rgba(30,40,80,0.45)`) enhance imagery contrast without creating muddy grey overlays. This is the John Nelson multi-pass aesthetic adapted for single layers.[10] Use neutral grey/white highlights and dark shadows for vector basemaps where you want a cleaner look.

## Dynamic Contour Lines

[`maplibre-contour`](https://github.com/onthegomap/maplibre-contour) generates vector contour tiles at runtime from a `raster-dem` source. No pre-generated contour tiles needed.[7]

```javascript
import mlcontour from 'maplibre-contour';

const demSource = new mlcontour.DemSource({
  url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
  encoding: 'terrarium',
  maxzoom: 13,
  worker: true
});

demSource.setupMaplibre(maplibregl);

map.on('load', () => {
  map.addSource(
    'contour-source',
    demSource.contourSource({
      thresholds: { 11: [200, 1000], 12: [100, 500], 14: [50, 200] },
      elevationKey: 'ele',
      levelKey: 'level',
      contourLayer: 'contours'
    })
  );

  map.addLayer({
    id: 'contours',
    type: 'line',
    source: 'contour-source',
    'source-layer': 'contours',
    paint: {
      'line-color': ['interpolate', ['linear'], ['get', 'level'], 0, '#8b6914', 1, '#5c4a00'],
      'line-width': ['interpolate', ['linear'], ['get', 'level'], 0, 0.8, 1, 1.5]
    }
  });
});
```

`maplibre-contour` uses a custom protocol handler registered via `setupMaplibre`. The `thresholds` object maps zoom level to `[minor, major]` contour intervals in meters.[7]

For a contour-lines example using `maplibre-contour` with raster-dem tiles, see [Add Contour Lines](https://maplibre.org/maplibre-gl-js/docs/examples/add-contour-lines/).

## Color-relief terrain

Unlike hillshade, color-relief assigns colors based on ranges of elevation values, which makes it ideal for subtly showing elevation patterns within a complex landscape visualization, or for applications where elevation differences must be legible at a glance.[14], [15]

MapLibre’s `color-relief` layer type performs this client-side on terrain tiles (`raster-dem` as source).[9], [16]

```json
{
  "id": "color-relief",
  "type": "color-relief",
  "source": "terrain",
  "paint": {
    "color-relief-color": [
      "interpolate",
      ["elevation"],
      0,
      "#00429d",
      1000,
      "#73c1c6",
      2000,
      "#f4777f",
      3000,
      "#93003a"
    ]
  }
}
```

For a full demo of DEM-based color-relief styling, see [Add a color relief layer](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-color-relief-layer/).

## 3D Terrain

3D terrain extrudes the map surface based on elevation data. It requires a `raster-dem` source and is enabled with `map.setTerrain()`.[2], [3]

```javascript
map.on('load', () => {
  map.addSource('terrain', {
    type: 'raster-dem',
    url: 'pmtiles://terrain.pmtiles',
    tileSize: 512,
    encoding: 'terrarium'
  });

  map.setTerrain({ source: 'terrain', exaggeration: 1.5 });
});
```

3D terrain is best for interactive scenes where users tilt and rotate the map to understand relative heights or to see overlays (buildings, routes, hazards) draped over real relief.[2]

For a complete working 3D terrain example, see [3D Terrain](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/).

### Camera pitch

3D terrain is only visible when the camera is pitched. Set `pitch` on map init or programmatically.[2]

```javascript
const map = new maplibregl.Map({
  container: 'map',
  style: myStyle,
  center: [lng, lat],
  zoom: 12,
  pitch: 60,
  bearing: -30
});
```

### Sky layer

With 3D terrain enabled and the camera pitched, the horizon line becomes visible. Add a sky layer above the terrain to fill it.[2], [3]

```json
{
  "id": "sky",
  "type": "sky",
  "paint": {
    "sky-type": "atmosphere",
    "sky-atmosphere-sun": [0, 90],
    "sky-atmosphere-sun-intensity": 15
  }
}
```

For terrain combined with sky and fog, see [Sky, Fog, Terrain](https://maplibre.org/maplibre-gl-js/docs/examples/sky-fog-terrain/).

## Performance notes for `raster-dem` sources

On lower-end devices or at high pitch/zoom, the additional operations required to enable hillshade and 3D terrain (decoding `raster-dem` tiles, building a terrain mesh, and drawing layers draped over that mesh) can lead to extra tile loads at lower zoom levels and visible detail differences across the screen.[13], [26]

Performance depends on device, zoom/pitch, tile size, and style complexity. As a rule of thumb, treat terrain as a **small, focused stack** (DEM source plus a handful of visualization layers) and shift heavy cartographic workflows (complex multi-pass shaded relief, artistic blends from GIS or Blender) into precomputed rasters when you need richer visuals without extra client-side cost.[22], [24]

Additional considerations when optimizing terrain performance:

- **Limit terrain-dependent layers per `raster-dem` source.** Hillshade, color-relief, and 3D terrain all read from the same elevation tiles.[1], [9] Each additional layer draped over terrain (hillshade, `raster`, `fill`, `line`) contributes to total rendering cost, so keep the terrain stack minimal: a small number of background layers (for example, one hillshade or color-relief plus imagery) and the necessary data overlays.[12]

- **Prefer `hillshade-method` over many stacked hillshade layers.** When you need softer, multi-direction shading, use `hillshade-method` options (such as `"multidirectional"`) before stacking several `hillshade` layers with different illumination directions.[18], [25] Multiple hillshade layers against the same `raster-dem` source add draw passes and increase GPU work.

- **Avoid duplicating `raster-dem` sources without a reason.** The 3D Terrain example uses separate `terrainSource` and `hillshadeSource` for render-quality reasons, but both point to the same tiles.[12] In most cases, use one shared `raster-dem` source for terrain-related layers (terrain, hillshade, color-relief) to avoid extra source configuration and potential tile crosstalk.[3], [19]

- **Be especially conservative when enabling 3D terrain.** 3D terrain loads additional DEM tiles and renders a mesh, which can cause noticeable delay, especially at higher zooms and pitches.[2], [26] Use conservative exaggeration, avoid extreme pitch on low-end devices, and keep the number of layers draped over terrain small.

### Tile size vs zoom in terrain pyramids

Because per-tile bytes change across the pyramid, any archive-size estimate that assumes a constant KB per tile across zooms will be biased and should be treated with caution. Unlike raster tiles, terrain tiles do not have a fixed size in kilobytes across zoom levels. Tile size varies with both zoom and terrain complexity: very low zoom tiles may be generalized or compressed more aggressively, while very high zoom tiles cover small, often homogeneous patches of terrain; tiles at mid zooms over major mountain ranges frequently contain the most detailed relief and tend to be largest.[23]

## Generating Your Own DEM Tiles

To create a custom DEM tileset from source elevation data, follow standard DEM processing workflows used in Tilezen/Mapzen and community terrain tutorials.[5], [8] Note that MapLibre does not provide a DEM tile generation tool; it only consumes `raster-dem` tiles.

## Related Skills

- [**maplibre-tile-sources**](../maplibre-tile-sources/SKILL.md) — General source configuration, raster-dem source type reference.
- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md) — Self-hosting DEM and imagery tiles from a single PMTiles file.
- [**maplibre-cartography**](../maplibre-cartography/SKILL.md) — Canonical layer ordering for styles that include hillshade.

## References

1. **MapLibre Style Spec: raster-dem source** — encoding property, tileSize — <https://maplibre.org/maplibre-style-spec/sources/#raster-dem>
2. **MapLibre 3D terrain example** — <https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/>
3. **RasterDEMTileSource API (MapLibre GL JS)** — <https://maplibre.org/maplibre-gl-js/docs/API/classes/RasterDEMTileSource/>
4. **AWS Terrain Tiles (Open Data)** — <https://registry.opendata.aws/terrain-tiles/>
5. **Tilezen/joerd encoding formats (Terrarium)** — <https://github.com/tilezen/joerd/blob/master/docs/formats.md>
6. **Mapbox Terrain‑RGB v1 tileset** — <https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/>
7. **`maplibre-contour`** — runtime contour generation — <https://github.com/onthegomap/maplibre-contour>
8. **Mapterhorn terrain PMTiles (Protomaps)** — <https://protomaps.com/blog/mapterhorn-terrain/>
9. **MapLibre Style Spec: layers (hillshade, color-relief)** — <https://maplibre.org/maplibre-style-spec/layers/>
10. **John Nelson hillshade technique** — <https://adventuresinmapping.com/2014/10/31/a-world-of-hillshading/>
11. **Creating color relief and slope shading with `gdaldem` (MasterMaps)** — <https://blog.mastermaps.com/2012/06/creating-color-relief-and-slope-shading.html>
12. **PMTiles cloud storage considerations** — <https://docs.protomaps.com/pmtiles/cloud-storage>
13. **Style terrain with color relief (MapTiler guide)** — <https://docs.maptiler.com/guides/map-design/terrain/color-relief/>
14. **OpenTopography raster visualization tools** — <https://opentopography.org/blog/new-raster-visualization-tools-opentopography>
15. **Terrain cartography overview** — <https://en.wikipedia.org/wiki/Terrain_cartography>
16. **Add a color-relief layer (MapLibre example)** — <https://www.maplibre.org/maplibre-gl-js/docs/examples/add-a-color-relief-layer/>
17. **Building terrain layers (GEOG 486, Penn State)** — <https://courses.ems.psu.edu/geog486/node/868>
18. **Additional hillshade options (MapLibre GL JS Issue #5665)** — origin of `hillshade-method` (`combined`, `multidirectional`, `igor`); closed via PR #5768 — <https://github.com/maplibre/maplibre-gl-js/issues/5665>
19. **Hillshade behavior with 3D terrain (MapLibre GL JS Discussion #4131)** — documents real quality tradeoffs: hillshade re-lighting does not rotate under 3D terrain (texture caching) and resolution can degrade — <https://github.com/maplibre/maplibre-gl-js/discussions/4131>
20. **Raster terrain analysis (QGIS docs)** — deriving slope/aspect/curvature from a DEM — <https://docs.qgis.org/latest/en/docs/user_manual/processing_algs/qgis/rasterterrainanalysis.html>
21. **`gdal_raster_hillshade` (GDAL docs)** — <https://gdal.org/en/stable/programs/gdal_raster_hillshade.html>
22. **Raster vs. vector tiles (MapTiler guide)** — <https://docs.maptiler.com/guides/how-maps-work/raster-vector-tiles/>
23. **Hosting Terrain-RGB tiles (MapTiler guide)** — <https://docs.maptiler.com/guides/map-tiling-hosting/data-hosting/rgb-terrain-by-maptiler/>
24. **Shaded relief in Blender (TerraLab GIS)** — <https://www.terralabgis.com/blog/blender-hillshade>
25. **Add a multidirectional hillshade layer (MapLibre GL JS example)** — <https://www.maplibre.org/maplibre-gl-js/docs/examples/add-a-multidirectional-hillshade-layer/>
26. **Severe FPS drop at high zoom with terrain enabled (MapLibre GL JS Issue #7699)** — open/unresolved as of writing; root-caused to `getDEMElevation` + placement/collision cost at close zoom — <https://github.com/maplibre/maplibre-gl-js/issues/7699>

## Further Reading (not currently cited in this skill — for review)

- **Hillshade function (Esri)** — <https://doc.esri.com/en/arcgis-pro/latest/help/analysis/raster-functions/hillshade-function.html>
- **TileMill terrain data and color-relief guide** — <https://tilemill-project.github.io/tilemill/docs/guides/terrain-data/>
- **PMTiles CLI** — <https://docs.protomaps.com/pmtiles/cli>
- **PMTiles intro (Cloud-Native Geo Guide)** — <https://guide.cloudnativegeo.org/pmtiles/intro.html>
- **Color relief maps — history and applications (Golden Software)** — <https://www.goldensoftware.com/color-relief-maps-history-purpose/>
- **Custom hillshade / shaded relief (Learn ArcGIS)** — <https://learn.arcgis.com/en/projects/illuminate-terrain-with-a-custom-hillshade/>
- **Terrain data for maps (MapTiler)** — <https://www.maptiler.com/terrain/>
- **MapLibre GL JS examples overview** — <https://www.maplibre.org/maplibre-gl-js/docs/examples/>
- **3D terrain tutorial (MapLibre video)** — <https://www.youtube.com/watch?v=D5iwM32GOpY>
- **Slope visualization tutorial (Michael Minn)** — <https://michaelminn.net/tutorials/arcgis-pro-terrain/>
- **Creating hillshade imagery in a GIS (video walkthrough)** — <https://www.youtube.com/watch?v=tGbJnpySAJY>
- **Generating DEMs and hillshades on OpenTopography (video walkthrough)** — <https://www.youtube.com/watch?v=f1m-qa-6YXo>

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
