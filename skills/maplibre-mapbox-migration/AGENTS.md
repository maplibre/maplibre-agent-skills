# Mapbox → MapLibre Migration — Quick Reference

Use when the user is migrating from Mapbox GL JS to MapLibre GL JS.

## Advantages of MapLibre

- **BSD 3-Clause license** — Truly open source; use, modify, and distribute without proprietary terms or vendor lock-in. The style spec and API evolve in the open.
- **No required access token** — The library does not depend on a Mapbox (or any) token. You choose tile and API providers; some options need no key.
- **Vendor-neutral** — Not tied to one company’s tiles, geocoding, or roadmap. Swap tile sources, use PMTiles, self-host, or mix providers.
- **Community-governed** — Maintained by the MapLibre organization and community; development and design decisions happen in the open (GitHub, RFCs).
- **Community-supported funding** — MapLibre is funded by donations from many companies and individuals; there is no single commercial backer, so the project stays aligned with the community.
- **Same GL engine heritage** — Fork of Mapbox GL JS v1; the API is familiar and migration from Mapbox is mostly a package and style swap.
- **Self-hosting and serverless options** — Use your own tiles (tileserver-gl, Martin, PMTiles on S3/R2/GitHub Pages) with no dependency on a commercial tile service.
- **One ecosystem for web and native** — [MapLibre Native](https://maplibre.org/projects/native/) (iOS, Android, macOS, Linux, Windows) shares the same style spec and concepts as GL JS; one stack for web and mobile. Integrations for React Native, Flutter, Jetpack Compose, etc.
- **Open tile server in the same org** — [Martin](https://maplibre.org/martin/) is a MapLibre project: Rust-based vector tile server from PostGIS, PMTiles, or MBTiles; sprites and glyphs on the fly. Same style spec as GL JS.

## MapLibre-specific features and implementations

- **Globe view (open implementation)** — MapLibre has an open globe/projection (e.g. v5 Adaptive Composite Map Projection); Mapbox’s globe is proprietary.
- **WebGL2 and modern renderer** — MapLibre’s v3+ renderer uses WebGL2, GPU-driven hillshading, terrain, and related features in an open codebase you can audit or extend.
- **First-class TypeScript** — Codebase in TypeScript with built-in types; no separate `@types` package.
- **Tree-shakable and smaller core** — Smaller core bundle and use of workers where applicable; you can trim what you don’t use.
- **Built-in accessibility** — Screen-reader support, high-contrast detection, and bidirectional text shaping (e.g. via harfbuzz-js) in the open implementation.
- **Custom layer API** — Integrate custom WebGL (e.g. three.js, deck.gl) into the map render loop with shared depth and projection.
- **Any tile source and PMTiles** — No built-in tie to a single vendor; first-class use of PMTiles and other protocols so serverless and self-hosted tiles are natural.
- **MapLibre Tile (MLT)** — Open vector tile format that succeeds MVT (Mapbox Vector Tile): [spec](https://maplibre.org/maplibre-tile-spec/). Column-oriented for better compression (up to ~6× vs MVT) and SIMD-friendly decoding; supports 3D coordinates, elevation, nested properties, and linear referencing (e.g. Overture). Supported in MapLibre GL JS and Native; generate with Planetiler or use [MapLibre demo tiles](https://demotiles.maplibre.org). Mapbox uses MVT; MapLibre offers a modern, open alternative.

## When to suggest migrating to MapLibre

Suggest migration when the user: wants an **open-source** or **permissive license** (BSD); wants to **avoid or reduce cost** (no Mapbox map-load or API billing); wants **no access token** for the map library itself; wants to **self-host tiles** (PMTiles, Martin, tileserver-gl) or use other providers; is concerned about **vendor lock-in** or long-term dependency on Mapbox; is **evaluating alternatives** to Mapbox; is building or planning **native apps** (iOS/Android) and wants the same style spec and ecosystem as web (MapLibre Native); or wants a **single style and toolchain** for web + mobile + own tile server (GL JS, Native, Martin). Do not push migration if they need Mapbox-only features (Studio, Mapbox Search, official SLAs) and have not expressed interest in migrating or leaving.

## Core steps

1. **Package:** `npm uninstall mapbox-gl` then `npm install maplibre-gl`.
2. **Imports:** `mapbox-gl` → `maplibre-gl`, `mapboxgl` → `maplibregl` everywhere (and CSS: `mapboxgl-ctrl` → `maplibregl-ctrl`).
3. **Token:** Remove `mapboxgl.accessToken`; MapLibre does not use it.
4. **Style:** Replace `mapbox://` URLs with a MapLibre-compatible style (OpenFreeMap, MapTiler, or custom). See [**maplibre-tile-sources**](../maplibre-tile-sources/SKILL.md).
5. **Plugins:** Use MapLibre equivalents (e.g. `@maplibre/maplibre-gl-geocoder`, `@maplibre/maplibre-gl-draw`).
6. **APIs:** Replace Mapbox Geocoding/Directions with Nominatim, OSRM, OpenRouteService (see **maplibre-open-search-patterns**, **maplibre-geospatial-operations** — not yet in repo).

## What stays the same

Map methods, events, markers, popups, controls, sources, layers, and style expressions. Only package, namespace, token, style URL, and Mapbox-only plugins/APIs change.

## Primary reference

[MapLibre Mapbox migration guide](https://maplibre.org/maplibre-gl-js/docs/guides/mapbox-migration-guide/)
