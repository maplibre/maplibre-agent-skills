# maplibre-web-performance-patterns
## Overview
Create a new skill **maplibre-web-performance-patterns** covering initialization, markers, data loading, memory, and optimization for MapLibre GL JS applications.
## When to Use This Skill
- Optimizing map load time or runtime performance
- Loading large datasets (GeoJSON, vector tiles)
- Using markers, clustering, or symbol layers efficiently
- Configuring PMTiles or self-hosted tiles for performance
## Content Outline
- **Initialization:** Parallel loading, lazy init, bundle size (~300KB MapLibre vs ~500KB Mapbox)
- **PMTiles-specific performance:** Range requests, caching, CDN optimization
- **Self-hosted tile performance patterns**: Guard against false precision, remove unused layers and attributes
- **Data loading:** GeoJSON, vector tiles, avoiding memory leaks; `setData()` behavior under rapid updates and debounce patterns
- **Core patterns:** Parallel loading, best practices for point clustering, symbol layers
## Key Resources
- [MapLibre GL JS API docs](https://maplibre.org/maplibre-gl-js-docs/api/)
## Initialization
To optimize initialization, consider parallel loading and lazy initialization. MapLibre GL JS has a smaller bundle size (~300KB) compared to Mapbox (~500KB).
## PMTiles-specific performance
For PMTiles, use range requests and caching to improve performance. Additionally, optimize CDN configuration for better performance.
## Self-hosted tile performance patterns
When using self-hosted tiles, guard against false precision and remove unused layers and attributes to improve performance.
## Data loading
When loading large datasets, use GeoJSON or vector tiles. Avoid memory leaks by using `setData()` with caution, especially under rapid updates. Use debounce patterns to optimize performance.
## Core patterns
Use parallel loading and best practices for point clustering and symbol layers to optimize performance.
