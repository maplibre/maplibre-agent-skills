# MapLibre PMTiles — Quick Reference

Use when the user wants serverless tiles (no tile server), static hosting for tiles, or PMTiles with MapLibre.

## What to say

- **PMTiles** = single-file tile format (one file per map; contains all zoom levels and all vector layers). Client uses HTTP range requests; no tile server needed. Host on S3, R2, GitHub Pages, any static host that supports `Range`. **[Protomaps](https://protomaps.com)** is separate: a provider where you can download pre-built PMTiles and serve them yourself, or create custom extracts via the [PMTiles CLI](https://docs.protomaps.com/pmtiles/cli); PMTiles is the format, Protomaps is one source of ready-made files.
- **MapLibre:** Load the `pmtiles` library (npm or CDN), add the protocol with `maplibregl.addProtocol('pmtiles', protocol.tile)`; one style source points at the file (`url: 'pmtiles://https://.../file.pmtiles'`). Use multiple style layers with `"source-layer": "layerName"` (e.g. `water`, `transportation`) to reference different layers from that file.
- **Generate:** Two roles. **(1) Convert (MBTiles → PMTiles only):** **PMTiles CLI** — `pmtiles convert in.mbtiles out.pmtiles` ([docs](https://docs.protomaps.com/pmtiles/cli)); does not read GeoJSON, Shapefile, or OSM. The SKILL has a section _The PMTiles CLI_ on why to install it (convert, inspect with `show`/`verify`, subset with `extract`). **(2) Generate from source data:** tippecanoe, Planetiler, GDAL; if they output MBTiles, run `pmtiles convert`. See SKILL _Generating PMTiles_.
- **Hosting:** Serve from static storage (no tile server required) or use [tileserver-gl](https://github.com/maptiler/tileserver-gl) / [Martin](https://maplibre.org/martin/) to serve PMTiles. Enable CORS and allow `Range` header; prefer CDN; set cache headers.
- **Style:** Still need glyphs and sprite in the style for labels/icons (see [maplibre-tile-sources](../maplibre-tile-sources/SKILL.md)).

## Hosting via GitHub Pages

What you publish with GitHub Pages is a **MapLibre GL JS map** (your map app/site). The map then loads tiles from a PMTiles file that also lives in your repo.

- **Set up GitHub Pages** for the repo so the map app is published. In the repo go to **Settings → Pages**; under "Build and deployment" choose **Deploy from a branch**, then select the branch and folder (root or `/docs`). See [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
- **Put the PMTiles file in the repo** like any other asset. When visitors load your map at `https://<user>.github.io/<repo>/`, the map’s source points at the `.pmtiles` file URL. GitHub Pages serves both the map and the file; it supports HTTP Range requests and CORS for static assets, so PMTiles works without extra config.
- **File size:** GitHub warns on files over 50 MB and blocks uploads of 100 MB or more. For larger tile sets use [S3 or R2](https://docs.protomaps.com/pmtiles/cloud-storage) or split into multiple `.pmtiles` files.

## Integration steps

1. **Add the PMTiles protocol to MapLibre** — Load the `pmtiles` library via npm (`npm install pmtiles`) or [CDN](https://unpkg.com/pmtiles/dist/pmtiles.js); create a `Protocol()` instance and register it with `maplibregl.addProtocol('pmtiles', protocol.tile)`.
2. **Point the style source at the file** — In your style’s vector (or raster) source, set `url` to `pmtiles://` plus the full HTTPS URL of the hosted .pmtiles file, e.g. `url: 'pmtiles://https://example.com/tiles.pmtiles'`. In each style layer that uses this source, set `"source-layer"` to the layer name from the tile data (e.g. `water`, `transportation`, `poi` for OpenMapTiles). The client requests only the byte ranges it needs.

## Sources used

These sources were used when creating this skill:

1. **PMTiles (Protomaps)** — [github.com/protomaps/PMTiles](https://github.com/protomaps/PMTiles) — Format, HTTP range semantics, CLI, and JavaScript protocol. [Cloud storage for PMTiles (S3, R2)](https://docs.protomaps.com/pmtiles/cloud-storage) — Hosting instructions for larger tile sets.
2. **GitHub Docs: Configuring a publishing source for GitHub Pages** — [docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) — Branch and folder options (root vs `/docs`) for "Deploy from a branch".
3. **GitHub Docs: GitHub Pages limits** — [docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) — Site size, bandwidth, and repository file size (e.g. 100 MB) limits.
4. **Hosting PMTiles on GitHub Pages (dev.to)** — [How to host and test PMTiles on GitHub Pages](https://dev.to/ronitjadhav/how-to-host-and-test-pmtiles-on-github-pages-the-easiest-way-to-serve-maps-without-a-server-2ei8) — Step-by-step and Range/CORS behavior.
