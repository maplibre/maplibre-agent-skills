# Eval Results: maplibre-pmtiles-patterns

These results show the skill's effect on model responses. Each test was run twice:
once without the skill injected (baseline) and once with it.

Eval config: [`evals/prompts/maplibre-pmtiles-patterns.yaml`](../prompts/maplibre-pmtiles-patterns.yaml)

## Summary

| Test                                                         | Type         | Baseline | With skill |
| ------------------------------------------------------------ | ------------ | -------- | ---------- |
| How do I load a .pmtiles file in MapLibre GL JS?             | Explicit     | 0.00     | 1.00       |
| Host tiles on GitHub Pages without a backend                 | Implicit     | 0.00     | 1.00       |
| addProtocol with callback broke after upgrading to v4        | Anti-pattern | 0.75\*   | 1.00       |
| Add elevation terrain using a PMTiles elevation file         | Implicit     | 0.50     | 1.00       |
| Inspect and verify a PMTiles file before uploading           | Explicit     | 0.00     | 1.00       |
| Bus positions updating every 30s from PostGIS — use PMTiles? | Negative     | 1.00     | 1.00       |

\* Cerebras passes this (score 1.00 — leniency). The model recommended `transformRequest`
instead of the Promise-based `addProtocol` — a wrong answer. Gemini correctly scores it
0.75 FAIL. See the annotation in Test 3 below.

---

## Test 1 — Explicit: Loading a PMTiles file in MapLibre GL JS

**Question:**

> How do I load a .pmtiles file as a source in MapLibre GL JS?

**What the skill teaches:** `addProtocol` is the correct integration point and
`pmtiles://` URLs are the right way to reference files in a style source.

<details>
<summary>Baseline response (score: 0.00 — FAIL)</summary>

> To load a `.pmtiles` file as a source in **MapLibre GL JS**, you can use the
> **[pmtiles](https://github.com/protomaps/PMTiles)** JavaScript library.
>
> ### Step 1: Include Required Libraries
>
> ```html
> <script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
> <script src="https://unpkg.com/pmtiles@2.2.0/dist/pmtiles.js"></script>
> ```
>
> ### Step 2: Load and Register the PMTiles Archive
>
> ```html
> <script>
>   const pmt = new PMTiles('path/to/your/file.pmtiles');
>
>   pmt.then((p) => {
>     const map = new maplibregl.Map({
>       container: 'map',
>       style: { version: 8, sources: {}, layers: [] },
>       center: [0, 0],
>       zoom: 2
>     });
>
>     map.on('load', function () {
>       map.addSource('pmtiles-source', {
>         type: 'vector',
>         url: p.tilejson().tiles[0]
>       });
>
>       map.addLayer({
>         id: 'pmtiles-layer',
>         type: 'line',
>         source: 'pmtiles-source',
>         'source-layer': 'your-source-layer-name',
>         paint: { 'line-color': '#000', 'line-width': 2 }
>       });
>     });
>   });
> </script>
> ```

Judge note: Uses `p.tilejson().tiles[0]` — an outdated approach. Does not register a
protocol handler via `addProtocol` and does not use `pmtiles://` URLs. The correct
modern approach relies on `Protocol` and `pmtiles://https://...` source URLs.

</details>

<details>
<summary>With-skill response (score: 1.00 — PASS)</summary>

> To load a `.pmtiles` file as a source in **MapLibre GL JS**, you need to use the
> **PMTiles library** to register a custom protocol (`pmtiles://`) that enables
> MapLibre to fetch and parse tiles using HTTP range requests.
>
> ### Step 1: Install the PMTiles Library
>
> ```bash
> npm install pmtiles
> ```
>
> ### Step 2: Register the PMTiles Protocol
>
> Register the `pmtiles` protocol **before** creating the map:
>
> ```javascript
> import * as pmtiles from 'pmtiles';
> import maplibregl from 'maplibre-gl';
> import 'maplibre-gl/dist/maplibre-gl.css';
>
> const protocol = new pmtiles.Protocol();
> maplibregl.addProtocol('pmtiles', protocol.tile);
> ```
>
> ### Step 3: Use the `.pmtiles` File in Your Style
>
> ```javascript
> const map = new maplibregl.Map({
>   container: 'map',
>   style: {
>     version: 8,
>     sources: {
>       'my-vector-tiles': {
>         type: 'vector',
>         url: 'pmtiles://https://your-domain.com/data.pmtiles'
>       }
>     },
>     layers: [
>       {
>         id: 'water-layer',
>         type: 'fill',
>         source: 'my-vector-tiles',
>         'source-layer': 'water',
>         paint: { 'fill-color': '#0088ff' }
>       }
>     ]
>   },
>   center: [-74.5, 40],
>   zoom: 9
> });
> ```
>
> For raster-dem (elevation):
>
> ```javascript
> sources: {
>   'terrain': {
>     type: 'raster-dem',
>     url: 'pmtiles://https://your-domain.com/elevation.pmtiles',
>     encoding: 'terrarium'
>   }
> }
> ```
>
> ### Step 4: Host the `.pmtiles` File Properly
>
> Your file must be hosted on a server that supports **HTTP Range Requests** and
> CORS headers:
>
> ```http
> Access-Control-Allow-Origin: *
> Access-Control-Allow-Headers: Range
> ```
>
> Supported hosts: AWS S3 (with CloudFront), Cloudflare R2, GitHub Pages (< 100MB),
> Netlify, Vercel.

</details>

---

## Test 2 — Implicit: Host tiles on GitHub Pages without a backend

**Question:**

> I want to host map tiles on GitHub Pages without running any backend. Is that possible
> with MapLibre GL JS?

**What the skill teaches:** PMTiles is the right answer — a single-file format that
works via HTTP range requests on any static host, including GitHub Pages.

<details>
<summary>Baseline response (score: 0.00 — FAIL)</summary>

> Yes, **you can absolutely host map tiles on GitHub Pages using MapLibre GL JS without
> any backend!**
>
> ### Steps to Host Map Tiles on GitHub Pages
>
> #### 1. Prepare Your Map Tiles
>
> You need tiles in a format like `z/x/y.png` (raster) or `z/x/y.pbf` (vector):
>
> ```
> tiles/
>   10/
>     500/
>       600.pbf
> ```
>
> #### 2. Host Tiles on GitHub Pages
>
> Place your tiles in your repo (e.g. in a `tiles/` folder). GitHub Pages will serve
> them at:
>
> ```
> https://<username>.github.io/<repo>/tiles/10/500/600.pbf
> ```
>
> #### 3. Use MapLibre GL JS to Load Tiles
>
> ```javascript
> const map = new maplibregl.Map({
>   container: 'map',
>   style: {
>     version: 8,
>     sources: {
>       'my-tiles': {
>         type: 'vector',
>         tiles: ['https://<username>.github.io/<repo>/tiles/{z}/{x}/{y}.pbf'],
>         minzoom: 0,
>         maxzoom: 14
>       }
>     },
>     layers: [{ ... }]
>   }
> });
> ```

Judge note: Describes a tile directory structure (`z/x/y.pbf`) that doesn't scale and
ignores GitHub's file size limits. Does not mention PMTiles at all — which is the reason
this approach is practical in the first place. A moderate region's tiles as individual
files would exceed repo limits; as a single PMTiles file they often don't.

</details>

<details>
<summary>With-skill response (score: 1.00 — PASS)</summary>

> Yes, **you can absolutely host map tiles on GitHub Pages without any backend** using
> **PMTiles** and **MapLibre GL JS**. This is a fully static, serverless approach.
>
> ### Why This Works
>
> - **GitHub Pages supports HTTP `Range` requests** — required for PMTiles.
> - **PMTiles is a single-file format** — you upload one `.pmtiles` file and serve it
>   directly.
> - **MapLibre + PMTiles protocol** — loads tiles via byte-range requests over HTTPS,
>   no server logic needed.
>
> ### Step-by-Step
>
> #### 1. Generate a PMTiles File
>
> ```bash
> tippecanoe -zg -o map.pmtiles input.geojson
> ```
>
> #### 2. Upload to GitHub Pages
>
> Place `map.pmtiles` in your repo (e.g. in `/docs/map.pmtiles`). After push:
>
> ```
> https://<username>.github.io/<repo>/map.pmtiles
> ```
>
> **File size limit:** GitHub Pages allows files up to 100 MB. For larger files,
> use Cloudflare R2 or S3.
>
> #### 3. Set Up MapLibre with PMTiles Protocol
>
> ```html
> <script src="https://unpkg.com/pmtiles@latest/dist/pmtiles.js"></script>
> <script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
> <script>
>   const protocol = new pmtiles.Protocol();
>   maplibregl.addProtocol('pmtiles', protocol.tile);
>
>   const map = new maplibregl.Map({
>     container: 'map',
>     style: {
>       version: 8,
>       sources: {
>         tiles: {
>           type: 'vector',
>           url: 'pmtiles://https://<username>.github.io/<repo>/map.pmtiles'
>         }
>       },
>       layers: [
>         { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
>         { id: 'water', type: 'fill', source: 'tiles', 'source-layer': 'water', paint: { 'fill-color': '#a0c8f0' } }
>       ]
>     },
>     center: [0, 0],
>     zoom: 2
>   });
> </script>
> ```

</details>

---

## Test 3 — Anti-pattern: addProtocol with callback broke after upgrading to v4

**Question:**

> My code uses addProtocol with a callback function to serve custom tiles, but after
> upgrading from MapLibre GL JS v3 to v4 it stopped working. How do I fix it?

**What the skill teaches:** `addProtocol` still exists in v4, but changed from a
callback to a Promise-based API. The wrong answer is to replace it with
`transformRequest`.

**Judge leniency note:** Cerebras scored the baseline response 1.00 despite the answer
being incorrect — it recommended `transformRequest` instead of the updated `addProtocol`
signature. Gemini correctly scores it 0.75 FAIL. This test illustrates why
`--grader google:gemini-2.5-flash-lite` is recommended for local runs.

<details>
<summary>Baseline response (score: 0.75* — FAIL with Gemini; 1.00 with Cerebras)</summary>

> The issue you're experiencing is due to a breaking change in MapLibre GL JS v4.
> The `addProtocol` method was removed and replaced with a new request transformer system.
>
> ## Old v3 Code (No longer works in v4)
>
> ```javascript
> maplibregl.addProtocol('custom', function (request, callback) {
>   const url = request.url.replace('custom://', '');
>   fetch(url)
>     .then((response) => response.arrayBuffer())
>     .then((data) => callback(null, data))
>     .catch((error) => callback(error));
> });
> ```
>
> ## New v4 Solution
>
> In v4, you need to use the `transformRequest` option when creating the map:
>
> ```javascript
> const map = new maplibregl.Map({
>   container: 'map',
>   style: 'your-style.json',
>   transformRequest: (url, resourceType) => {
>     if (url.startsWith('custom://')) {
>       const actualUrl = url.replace('custom://', '');
>       return { url: actualUrl };
>     }
>     return undefined;
>   }
> });
> ```

\* **This answer is wrong.** `addProtocol` was not removed in v4 — it changed from a
callback API to a Promise-based API. `transformRequest` is a different feature that
modifies outgoing requests; it cannot serve custom protocol handlers. Cerebras passed
this response; Gemini would not.

</details>

<details>
<summary>With-skill response (score: 1.00 — PASS)</summary>

> You're encountering a breaking change introduced in **MapLibre GL JS v4**. The way
> custom protocols are registered changed significantly.
>
> ### Problem: `addProtocol` with a callback no longer works in v4
>
> In **MapLibre GL JS v3**:
>
> ```js
> maplibregl.addProtocol('custom', (params, callback) => {
>   // fetch tile, call callback(err, data, contentType)
> });
> ```
>
> This **no longer works in v4** — `addProtocol` now expects a Promise-based interface.
>
> ### Solution: Use the new Promise-based `addProtocol`
>
> ```js
> maplibregl.addProtocol('custom', async (params) => {
>   const response = await fetch(params.url);
>   if (!response.ok) throw new Error(response.statusText);
>   const data = await response.arrayBuffer();
>   return {
>     data,
>     contentType: 'application/x-protobuf'
>   };
> });
> ```
>
> ### For PMTiles specifically
>
> The official `pmtiles` library already supports MapLibre v4 out of the box:
>
> ```js
> import * as pmtiles from 'pmtiles';
> const protocol = new pmtiles.Protocol();
> maplibregl.addProtocol('pmtiles', protocol.tile);
> ```
>
> `protocol.tile` is already v4-compatible — no manual migration needed.
>
> ### Migration Checklist
>
> | Step | Action                                                                                  |
> | ---- | --------------------------------------------------------------------------------------- |
> | 1    | Replace `(params, callback)` with a function returning `Promise<{ data, contentType }>` |
> | 2    | Ensure `data` is an `ArrayBuffer`                                                       |
> | 3    | Set correct `contentType` (`'application/x-protobuf'` for vector tiles)                 |
> | 4    | Handle errors with `throw`                                                              |

</details>

---

## Test 4 — Implicit: Add elevation terrain using a PMTiles elevation file

**Question:**

> How do I add elevation terrain to my MapLibre GL JS map using a PMTiles elevation file?

**What the skill teaches:** Use `raster-dem` source type with a `pmtiles://` URL and
the required `encoding` field. Omitting `encoding` is a common error.

<details>
<summary>Baseline response (score: 0.50 — FAIL)</summary>

> To add elevation terrain to your MapLibre GL JS map using a **PMTiles** elevation
> file, you'll need to use the `maplibre-gl-pmtiles` plugin.
>
> ### Step 2: Initialize PMTiles and Add Elevation
>
> ```javascript
> const pmtiles = new PMTiles("path/to/your-elevation.pmtiles");
>
> pmtiles.then(async (pmt) => {
>   const map = new maplibregl.Map({ ... });
>
>   map.on('load', () => {
>     map.addSource('terrain', {
>       type: 'raster-dem',
>       tiles: [pmt.tilejson.tiles[0]],  // no encoding, no pmtiles:// URL
>       tileSize: pmt.tilejson.tile_size || 256,
>       maxzoom: pmt.tilejson.maxzoom,
>     });
>
>     map.setTerrain({ source: 'terrain', exaggeration: 1.5 });
>   });
> });
> ```

Judge note: Correctly uses `raster-dem` and `setTerrain`, but omits `encoding` (required
for MapLibre to interpret elevation data correctly) and does not use a `pmtiles://` URL
scheme. The judge scored 0.50 because the source type and terrain setup were right but
the two key missing fields are load-bearing.

</details>

<details>
<summary>With-skill response (score: 1.00 — PASS)</summary>

> To add **elevation terrain** to your MapLibre GL JS map using a **PMTiles elevation
> file**, follow these steps:
>
> ### 1. Install and Register the PMTiles Protocol
>
> ```bash
> npm install pmtiles
> ```
>
> ```js
> import * as pmtiles from 'pmtiles';
> import maplibregl from 'maplibre-gl';
>
> const protocol = new pmtiles.Protocol();
> maplibregl.addProtocol('pmtiles', protocol.tile);
> ```
>
> ### 2. Add the Raster-DEM Source and Enable Terrain
>
> ```js
> const map = new maplibregl.Map({
>   container: 'map',
>   style: {
>     version: 8,
>     sources: {
>       elevation: {
>         type: 'raster-dem',
>         url: 'pmtiles://https://example.com/elevation.pmtiles',
>         encoding: 'terrarium', // or 'mapbox'
>         tileSize: 256,
>         maxzoom: 14
>       }
>     },
>     terrain: {
>       source: 'elevation',
>       exaggeration: 1.5
>     },
>     layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } }]
>   },
>   center: [-122.44, 37.77],
>   zoom: 10
> });
> ```
>
> ### 3. Add Hillshading (Optional)
>
> ```js
> map.on('load', () => {
>   map.addLayer({
>     id: 'hillshading',
>     source: 'elevation',
>     type: 'hillshade',
>     paint: {
>       'hillshade-illumination-direction': 335,
>       'hillshade-exaggeration': 0.6
>     }
>   });
> });
> ```
>
> **Terrarium format** (common): `(R * 256 + G + B / 256) - 32768`
> **Mapbox format**: `(R * 256² + G * 256 + B) * 0.1 - 10000`
>
> Ensure your PMTiles file uses one of these encodings and set `encoding` accordingly.

</details>

---

## Test 5 — Explicit: Inspect and verify a PMTiles file before deploying

**Question:**

> I generated a PMTiles file and want to check what layers it contains and verify it
> is valid before uploading. How?

**What the skill teaches:** Two specific CLI commands: `pmtiles show` to inspect
metadata and vector layer names, and `pmtiles verify` to check archive integrity.

<details>
<summary>Baseline response (score: 0.00 — FAIL)</summary>

> To check the layers in a PMTiles file and verify its validity, you can use a
> combination of command-line tools and libraries.
>
> #### Use `pmtiles` CLI (Recommended)
>
> ```bash
> npm install -g pmtiles
> pmtiles info your_file.pmtiles
> ```
>
> This will output metadata such as version, tile type, min/max zoom, bounds, center,
> and metadata (including layer names if available).
>
> #### Option A: Use `tippecanoe-decode`
>
> ```bash
> pmtiles extract your_file.pmtiles 5 10 11 tile.mvt
> tippecanoe-decode tile.mvt
> ```
>
> #### Option B: Use Python
>
> ```python
> import pmtiles
> import mapbox_vector_tile
> archive = pmtiles.PMTiles("your_file.pmtiles")
> tile = archive.get_tile(5, 10, 11)
> decoded = mapbox_vector_tile.decode(tile)
> print("Layers:", list(decoded.keys()))
> ```

Judge note: Recommended `pmtiles info` and fell back to third-party tools
(`tippecanoe-decode`, Python libraries) as the primary workflow for layer inspection.
The skill teaches the two specific commands developers need: `pmtiles show` (inspect
metadata and layer names) and `pmtiles verify` (check archive integrity). Neither
appears in the baseline response.

</details>

<details>
<summary>With-skill response (score: 1.00 — PASS)</summary>

> Before uploading your PMTiles file, use the official **PMTiles CLI** to inspect its
> contents and verify its integrity.
>
> ### Step 1: Install the PMTiles CLI
>
> Download from [github.com/protomaps/go-pmtiles/releases](https://github.com/protomaps/go-pmtiles/releases),
> make it executable, and add to your PATH:
>
> ```bash
> chmod +x pmtiles-linux-amd64
> sudo mv pmtiles-linux-amd64 /usr/local/bin/pmtiles
> ```
>
> ### Step 2: Inspect Layers and Metadata with `pmtiles show`
>
> ```bash
> pmtiles show your-file.pmtiles
> ```
>
> Look for `vector_layers` in the `json` field of metadata — this tells you the layer
> IDs to use in your MapLibre style:
>
> ```json
> "vector_layers": [
>   { "id": "water", "minzoom": 0, "maxzoom": 14 },
>   { "id": "roads", "minzoom": 0, "maxzoom": 14 }
> ]
> ```
>
> You'll use these IDs as `source-layer` in your style layers.
>
> ### Step 3: Verify File Integrity with `pmtiles verify`
>
> ```bash
> pmtiles verify your-file.pmtiles
> ```
>
> If valid:
>
> ```
> Verification successful: your-file.pmtiles
> ```
>
> If corrupted:
>
> ```
> ERROR: Failed to read tile at offset XXXX
> ```
>
> This catches issues before deployment — especially important when transferring large
> files or generating them on remote systems.

</details>

---

## Test 6 — Negative: Bus positions updating every 30s from PostGIS

**Question:**

> I'm building a map that shows bus positions updating every 30 seconds from a PostGIS
> database. Should I use PMTiles?

This is a negative test — PMTiles is the wrong tool for live-updating data. An
over-eager skill would recommend PMTiles anyway. Both baseline and with-skill responses
correctly advised against PMTiles and recommended a dynamic tile server or GeoJSON API.

Both runs: **PASS 1.00** — the skill does not over-apply.
