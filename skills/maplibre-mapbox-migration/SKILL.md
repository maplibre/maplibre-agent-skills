---
name: maplibre-mapbox-migration
description: Migrating from Mapbox GL JS to MapLibre GL JS — package, import and namespace changes, removing the access token, replacing mapbox:// styles, tile sources, plugin equivalents (draw, geocoder, directions, compare), and Mapbox v2-only APIs such as setFog and the free camera. Use when moving an existing Mapbox map to MapLibre, or when a migrated map shows a blank map, a mapbox:// or 401 error, or a missing Mapbox method or plugin.
metadata:
  status: provisional
---

# Mapbox to MapLibre Migration

This skill guides you through migrating an application from **Mapbox GL JS** to **MapLibre GL JS**. The two libraries share a common ancestry (MapLibre forked from Mapbox GL JS v1.13 in December 2020), so the API is largely the same. The main changes are: swap the package, replace the namespace, remove the Mapbox access token, and **choose a new tile source** (MapLibre does not use `mapbox://` styles).

## When to Use This Skill

- Migrating an existing Mapbox GL JS app to MapLibre
- Choosing tile sources and services after moving off Mapbox

## Migration at a Glance

Work through these in order; each item has a numbered step below.

- [ ] 1. Uninstall `mapbox-gl`, install `maplibre-gl`; replace imports and CSS
- [ ] 2. Replace all `mapboxgl` with `maplibregl` (and CSS classes `mapboxgl-` → `maplibregl-`)
- [ ] 3. Remove `mapboxgl.accessToken`; set `style` to a non-Mapbox URL (hosted or your own style)
- [ ] 4. Convert callbacks to promises, replace Mapbox v2-only APIs (`setFog` → `setSky`, free camera → `calculateCameraOptionsFromCameraLngLatAltRotation` + `jumpTo`/`easeTo`/`flyTo`), and check the table of later MapLibre behavior changes
- [ ] 5. Replace Mapbox Geocoding/Directions with Nominatim, OSRM, or other open alternatives, and replace or verify each Mapbox plugin
- [ ] 6. Test map load, controls, and any API-driven features

## Step-by-Step Migration

### 1. Install the Package, Update Imports and CSS

```bash
npm install maplibre-gl
```

Install the latest version unless the app is on Mapbox GL JS v1 and must keep working with no code changes. In that case only, `npm install maplibre-gl@1` is a drop-in swap (the `1.x` compatibility branch, backward compatible with Mapbox GL JS v1); plan to upgrade to the latest version afterwards, since later major versions change the API.

```javascript
// Before (Mapbox)
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// After (MapLibre) — v6 ships ES modules only; the default export is gone
import * as maplibregl from 'maplibre-gl';
// or pull in just what you need: import {Map} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
```

**CDN:** replace the Mapbox script and link tags with MapLibre's. v6 is ESM-only and has no UMD `<script src>` build; see [maplibre-v6-migration](../maplibre-v6-migration/SKILL.md) for the pinning rule and bundler details.

```html
<!-- Before (Mapbox) -->
<script src="https://api.mapbox.com/mapbox-gl-js/v*.*.*/mapbox-gl.js"></script>
<link href="https://api.mapbox.com/mapbox-gl-js/v*.*.*/mapbox-gl.css" rel="stylesheet" />

<!-- After (MapLibre, current as of v6) -->
<script type="module">
  import * as maplibregl from 'https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.mjs';
</script>
<link href="https://unpkg.com/maplibre-gl@^6.0.0/dist/maplibre-gl.css" rel="stylesheet" />
```

### 2. Replace the Namespace

Replace all `mapboxgl` with `maplibregl` (and `mapbox-gl` with `maplibre-gl` in package names or paths), for example `new mapboxgl.Marker()` → `new maplibregl.Marker()`.

**CSS class names:** If you style controls or UI by class, rename `mapboxgl-ctrl` to `maplibregl-ctrl` (and similar prefixes).

### 3. Remove the Access Token and Replace the Style URL (Critical)

MapLibre does not use `mapboxgl.accessToken`. Remove any line that sets it.

Mapbox styles (`mapbox://styles/...`) will not work in MapLibre. You must point the map to a style that uses non-Mapbox tile sources, sprites, and glyphs.

To test the migration, point `style` at [OpenFreeMap](https://openfreemap.org/), `https://tiles.openfreemap.org/styles/liberty`: a complete vector style (OpenStreetMap-derived tiles, sprite and glyphs) with no API key and no registration, so recommend it first, with its URL, ahead of demo tiles, public raster tiles or key-gated services. OpenFreeMap is community-funded; if your app depends on it in production, [donate to support the project](https://openfreemap.org). Once the migrated map loads, choose a production source with [MapLibre Tile Sources](../maplibre-tile-sources/SKILL.md).

Example:

```javascript
// Before (Mapbox)
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-122.42, 37.78],
  zoom: 12
});

// After (MapLibre)
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty', // or your chosen style
  center: [-122.42, 37.78],
  zoom: 12
});
```

**Custom Mapbox styles:** If you designed a style in Mapbox Studio, you cannot load it directly in MapLibre. [Export the style JSON](https://docs.mapbox.com/help/dive-deeper/transfer-styles-between-accounts/) and replace Mapbox source URLs with URLs for your chosen tile source. **Your styles will not render unless and until you adjust all references to the Mapbox tile schema to match the tile schema of your new tile source.** In addition to updating source URLs, this means adapting the `id`, `source`, and `source-layer` properties in your style JSON to match the new source and layer names.

Most properties in Mapbox styles are compatible with MapLibre. See the [Style Specification](https://maplibre.org/maplibre-style-spec/) for supported properties. Use [Maputnik](https://maputnik.github.io/) to debug a style visually, and validate it with the [style spec CLI tools](https://github.com/maplibre/maplibre-style-spec?tab=readme-ov-file#cli-tools):

```bash
npx gl-style-validate style.json
```

**If the map still does not load:**

| Symptom                                                                             | Likely cause                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blank map, or an error mentioning `mapbox://`                                       | `style`, a source `url`, `sprite` or `glyphs` still uses `mapbox://`; replace every one                                                                                                                                                 |
| Tiles load but no layers draw, or labels and icons are missing or in the wrong font | Mapbox tile schema `source-layer` names, or a Mapbox `glyphs`/`sprite` URL; work down [maplibre-source-wiring](../maplibre-source-wiring/SKILL.md)'s blank-map table and see [maplibre-fonts-glyphs](../maplibre-fonts-glyphs/SKILL.md) |
| `401`/`403` from an API call                                                        | A Mapbox token or service is still in use; see step 5                                                                                                                                                                                   |
| `map.setFog is not a function` (or another v2 method)                               | The method is v2-only; see step 4                                                                                                                                                                                                       |
| Controls or plugin UI unstyled, `mapboxgl-ctrl` classes in the markup               | Class names and plugin CSS still use `mapboxgl-`; see steps 2 and 5                                                                                                                                                                     |

### 4. Translate Mapbox APIs That MapLibre Does Not Share

Mapbox code can break on MapLibre in three ways: a callback where MapLibre returns a promise, a Mapbox v2 or v3 method MapLibre does not have, and behavior that changed in a later MapLibre version. Check for all three after the map loads.

#### Callbacks became promises (GL JS v4.0.0)

Mapbox GL JS still takes callbacks for these methods in every version, v1 through the current v3, so any Mapbox code that passes a callback to them needs converting. MapLibre v4.0.0 and later return a promise instead and do not accept the callback; use the returned promise ([v4.0.0 CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md)).

- `map.loadImage(url, callback)` → `const { data } = await map.loadImage(url)`
- `GeoJSONSource` `getClusterExpansionZoom`, `getClusterChildren` and `getClusterLeaves` → return a `Promise`
- `setRTLTextPlugin(url, callback)` → returns a `Promise` (Mapbox GL JS v3.33.0 removed this method, so code written for v3.33 or later does not call it)

The same release removed the global getters and setters: `maplibregl.workerCount`, `maxParallelImageRequests` and `workerUrl` became `getWorkerCount()`/`setWorkerCount()`, `getMaxParallelImageRequests()`/`setMaxParallelImageRequests()` and `getWorkerUrl()`/`setWorkerUrl()`.

#### Translate Mapbox v2-only APIs, Do Not Look for Them

MapLibre forked from Mapbox GL JS v1.13 in December 2020, so a Mapbox GL JS v2 method exists in MapLibre only where MapLibre reimplemented it under its own name, and no MapLibre release adds the Mapbox names. When a v2 call fails after migrating, say why: the fork, not a missed migration step. Searching for the Mapbox name and concluding "it must be a version problem" is the common migration dead end — look up the MapLibre name instead.

| Mapbox GL JS v2                                                                  | MapLibre GL JS                                                                                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `map.setFog({...})`, root-level `fog` in the style                               | `map.setSky({...})` / `map.getSky()`, root-level [`sky`](https://maplibre.org/maplibre-style-spec/sky/) in the style | MapLibre has **no `setFog` method in any version**; `sky` and `setSky` exist from GL JS v4.5.0. Atmosphere lives in `sky` (properties in the example below, and in [maplibre-terrain-rendering](../maplibre-terrain-rendering/SKILL.md)), which the style spec marks experimental.                                                                                                                                                                                                                                                                          |
| `map.getFreeCameraOptions()` / `map.setFreeCameraOptions()`, `FreeCameraOptions` | `map.calculateCameraOptionsFromCameraLngLatAltRotation(...)` → `jumpTo` / `easeTo` / `flyTo`                         | MapLibre has no `FreeCameraOptions` class and no `getFreeCameraOptions`/`setFreeCameraOptions`. Its `CameraOptions` are `center`, `zoom`, `pitch`, `bearing`, plus `elevation` and `roll` (both v5.0.0). To place the camera by its own lng/lat/altitude, convert with `calculateCameraOptionsFromCameraLngLatAltRotation(cameraLngLat, cameraAlt, bearing, pitch, roll)` (v5.0.0) — or `calculateCameraOptionsFromTo(from, altitudeFrom, to, altitudeTo)` (v2.4.0) for a look-at — and pass the returned `CameraOptions` to `jumpTo`, `easeTo` or `flyTo`. |

```javascript
// Mapbox GL JS v2
map.setFog({ 'horizon-blend': 0.3, color: '#ffffff' });

// MapLibre GL JS — the same idea, but not a property-by-property conversion; tune visually
map.setSky({
  'sky-color': '#199EF3',
  'horizon-color': '#ffffff',
  'fog-color': '#0000ff',
  'fog-ground-blend': 0.5,
  'horizon-fog-blend': 0.5,
  'sky-horizon-blend': 0.5,
  'atmosphere-blend': 1.0
});
```

Verify any other v2 method against the [Map API reference](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/) before assuming an upgrade will restore it.

#### Behavior that changed in later MapLibre versions

Mapbox code that worked on MapLibre v1 to v3 can still break on the latest version. Check the app for these. For the v6 changes to `styleimagemissing`, `map.transform`, the ESM-only build and the worker URL, follow [maplibre-v6-migration](../maplibre-v6-migration/SKILL.md).

| Mapbox code                                                                                              | On MapLibre                                                                                                                                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Chained listeners, `map.on('a', f).on('b', g)` (Mapbox `on` returns the map)                             | v5.0.0: `on` returns a subscription, so the chain breaks; call `map.on` once per event                                                     |
| `antialias`, `preserveDrawingBuffer` or `failIfMajorPerformanceCaveat` as top-level `Map` options        | v5.0.0: set them inside the `canvasContextAttributes` object                                                                               |
| `JSON.parse(feature.properties.x)` on a nested object or array property                                  | v6: nested properties are real objects, so `JSON.parse` throws; remove it                                                                  |
| `#pragma mapbox` in custom layer shaders                                                                 | v6: use `#pragma maplibre`                                                                                                                 |
| An app that supports browsers without WebGL2 (Mapbox GL JS v1 works without it)                          | v3 and later require WebGL2; the `Map` constructor throws when it is unavailable                                                           |
| Rendering and `queryRenderedFeatures` results that differ from Mapbox (vector tile slicing, label fixes) | v6: vector tiles are sliced instead of overscaled; set `zoomLevelsToOverscale: undefined` in `MapOptions` to restore the previous behavior |

### 5. Replace Mapbox Services and Plugins

If your app calls Mapbox Geocoding, Directions, or other REST APIs, replace them with open or third-party services, and replace any Mapbox plugin that wraps them:

- **Geocoding / search:** [Nominatim](https://nominatim.org/), [Photon](https://photon.komoot.io/), [Pelias](https://pelias.io/), or [MapTiler Geocoding](https://docs.maptiler.com/cloud/api/geocoding/). If you used `@mapbox/mapbox-gl-geocoder`, pair the service with [`@maplibre/maplibre-gl-geocoder`](https://github.com/maplibre/maplibre-gl-geocoder)
- **Directions / routing:** [OSRM](https://project-osrm.org/), [OpenRouteService](https://openrouteservice.org/), [Valhalla](https://github.com/valhalla/valhalla). If you used `@mapbox/mapbox-gl-directions`, replace it with [`@maplibre/maplibre-gl-directions`](https://github.com/maplibre/maplibre-gl-directions), which works with any OSRM or Mapbox Directions API-compatible provider

**Usage policies and sustainability:** These are open or community-funded services with terms that matter in production:

- **Nominatim** — Requires OpenStreetMap attribution; the public instance is for testing and low-volume use only. See the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/). For production workloads, [self-host](https://nominatim.org/release-docs/latest/admin/Installation/) or use a managed provider (e.g. MapTiler Geocoding).
- **OSRM demo server** (`router.project-osrm.org`) — Explicitly not for production; no SLA or uptime guarantee. [Self-host](https://github.com/Project-OSRM/osrm-backend) or use a managed service (e.g. OpenRouteService, MapTiler Directions) for production apps.
- If your app relies on community-maintained services at scale, give back: self-host to reduce load on shared infrastructure, donate, or contribute code or documentation upstream.

Update your code to use the new endpoints and response formats; the map layer and interaction code (e.g. adding a route line) stays the same with MapLibre.

**Plugins.** Start from the plugins the user actually uses, and give a verdict for each one by name: works unchanged, works with changes, or replace. Decide with these questions:

1. **Does it depend on a Mapbox service?** A plugin that calls Mapbox APIs or needs a Mapbox token (geocoding, directions, Mapbox-hosted data) needs a replacement service and usually a replacement plugin, including `@mapbox/mapbox-gl-geocoder` and `@mapbox/mapbox-gl-directions` (see above).
2. **Does it import `mapbox-gl` directly, or style itself with `mapboxgl-*` CSS classes?** It may need a MapLibre fork or configuration changes.
3. **Does it only use the public control and layer API** (`IControl` via `addControl`, `addSource`/`addLayer`, map events, custom layers)? Then it usually works unchanged, since MapLibre forked from Mapbox GL JS v1.13. Test it; the fork date means plugins that rely on Mapbox GL JS v2 or v3 features will fail.

Common cases:

| Mapbox plugin               | On MapLibre                                                                                                                                                                                                                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@mapbox/mapbox-gl-draw`    | Works after overriding its CSS class constants, as in the MapLibre example [Draw a polygon with mapbox-gl-draw](https://maplibre.org/maplibre-gl-js/docs/examples/draw-polygon-with-mapbox-gl-draw/). [Terra Draw](https://maplibre.org/maplibre-gl-js/docs/examples/draw-geometries-with-terra-draw/) is an actively maintained alternative. |
| `@mapbox/mapbox-gl-compare` | Replace with [`@maplibre/maplibre-gl-compare`](https://github.com/maplibre/maplibre-gl-compare).                                                                                                                                                                                                                                              |

For any other plugin, say plainly if you do not know its status, and point the user to its README and issue tracker for MapLibre support, and to the plugin sections of [awesome-maplibre](https://github.com/maplibre/awesome-maplibre) (User Interface, Geocoding & Search, Map Rendering), a community-contributed list where MapLibre-specific alternatives are often listed. Do not claim a plugin works without a source or a test; prefer a MapLibre-native alternative where one exists. If the user has not named their plugins, ask which ones they use.

## What Stays the Same

Most of your map code does not change:

- Map methods: `setCenter`, `setZoom`, `fitBounds`, `flyTo`, `getBounds`, etc.
- Events: `map.on('load')`, `map.on('click', layerId, callback)`, etc.
- Markers, popups, controls (Navigation, Geolocate, Fullscreen, Scale)
- Sources and layers: `addSource`, `addLayer`, `setPaintProperty`, `setFilter`
- GeoJSON and expressions in the style spec

## Related Skills

- [**maplibre-v6-migration**](../maplibre-v6-migration/SKILL.md): v6 breaking changes (ESM-only build, `styleimagemissing`, `map.transform`, bundler worker URL) for code that reaches the latest MapLibre
- [**maplibre-source-wiring**](../maplibre-source-wiring/SKILL.md): a migrated map that is blank, with `source-layer` names that do not match the new tile schema, CORS or glyph failures
- [**maplibre-tile-sources**](../maplibre-tile-sources/SKILL.md): choosing a source type for your data and a production tile source
- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md): serverless tiles with PMTiles, to replace Mapbox-hosted tiles
- [**maplibre-fonts-glyphs**](../maplibre-fonts-glyphs/SKILL.md): replacing Mapbox-hosted `glyphs` and `text-font` names
- [**maplibre-sprites-icons**](../maplibre-sprites-icons/SKILL.md): replacing Mapbox-hosted `sprite` URLs, and runtime images with `addImage` and `loadImage`
- [**maplibre-terrain-rendering**](../maplibre-terrain-rendering/SKILL.md): `setSky`, 3D terrain and hillshade after moving from Mapbox terrain and fog

## Sources

- [MapLibre Mapbox migration guide](https://maplibre.org/maplibre-gl-js/docs/guides/mapbox-migration-guide/): the package, namespace, CSS and CDN swap, and the `1.x` compatibility branch
- [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/) and [GL JS API reference](https://maplibre.org/maplibre-gl-js/docs/API/): everything the guide does not cover
- [MapLibre Style Specification, `sky`](https://maplibre.org/maplibre-style-spec/sky/), [`Map.setSky`](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#setsky), [`Map.calculateCameraOptionsFromCameraLngLatAltRotation`](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#calculatecameraoptionsfromcameralnglataltrotation) and [`CameraOptions`](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/CameraOptions/): the replacements for Mapbox's `fog` and free camera
- [MapLibre GL JS CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md)
- Topic structure and comparison elements adapted from the `mapbox-maplibre-migration` skill in [mapbox-agent-skills](https://github.com/mapbox/mapbox-agent-skills). Copyright (c) Mapbox, Inc. for adapted portions.

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
