---
name: maplibre-tile-hosting
description: Where finished tiles live for MapLibre GL JS — hosted providers (OpenFreeMap, MapTiler), serverless single-file PMTiles on static storage (S3, R2, GitHub Pages), and self-hosted tile servers (Martin, tileserver-gl), with the attribution, cost, and operational tradeoffs of each. Use when choosing or moving tile infrastructure.
status: provisional
---

# MapLibre Tile Hosting

Once you know you need tiles, you have to decide where they come from. This skill covers
the three options and what each one costs you. For deciding whether you need tiles at all,
see [maplibre-tile-sources](../maplibre-tile-sources/SKILL.md); for getting a source to
render once you have a URL, see [maplibre-source-wiring](../maplibre-source-wiring/SKILL.md).

## When to Use This Skill

- Choosing between a hosted tile provider, static file hosting, and running your own server
- Evaluating the cost, attribution, and ops burden of a tile source before committing
- Moving off a provider, or off `tile.openstreetmap.org`
- Deciding whether a project needs tile infrastructure at all

## Two meanings of "hosting"

"Hosting" tile data can mean two different things, and they have very different operational profiles:

- **Storing files on the web** — A `.pmtiles` archive (or a pre-generated tile directory) lives on static storage like S3, R2, or GitHub Pages. No server process runs; MapLibre fetches tiles over HTTP using range requests or standard HTTP. Updates require regenerating and re-uploading the file.
- **Running a tile server** — A server process handles tile requests dynamically, often from a database (PostGIS) or a source file (MBTiles, PMTiles). Supports live data and on-the-fly generation, but requires deployment and ongoing maintenance.

The three options below map to these two approaches: PMTiles is file-based and serverless; hosted tile services run tile server infrastructure on your behalf; self-hosted means you run your own server.

## Serverless (PMTiles)

[PMTiles](https://docs.protomaps.com/pmtiles/) is an open single-file tile format that supports vector or raster tiles — MapLibre fetches only the byte ranges it needs via HTTP range requests, with no tile server. Extract only the geographic scale you need, and host a `.pmtiles` file on static storage (S3, R2, GitHub Pages).

- ✅ No server process; lowest ops burden
- ✅ Cheap at rest; CDN-friendly (range responses cache well)
- ⚠️ Updates mean regenerating and re-uploading the archive
- ⚠️ The host must support HTTP `Range` requests and send CORS headers

See [maplibre-pmtiles-patterns](../maplibre-pmtiles-patterns/SKILL.md) for generation, hosting specifics, and the protocol setup.

## Hosted tile services

Many providers offer hosted vector or raster tiles and pre-built style and tile URLs — no server to run. See [Map/Tile Providers in awesome-maplibre](https://github.com/maplibre/awesome-maplibre#maptile-providers) for a full list.

For a no-key starting point, [OpenFreeMap](https://openfreemap.org/) provides free hosted OpenStreetMap tiles with MapLibre-ready styles (`https://tiles.openfreemap.org/styles/liberty` or `/positron`). It is community-funded — if your app depends on it in production, consider [donating](https://openfreemap.org) or self-hosting to reduce load on shared infrastructure.

**Do not use tile.openstreetmap.org** in production or for anything beyond very limited testing. The OpenStreetMap Foundation prohibits bulk and high-traffic use of their tile server; violating this blocks your IP. Use a hosted provider or self-host instead. See [switch2osm.org/providers](https://switch2osm.org/providers/) for a current provider list.

- ✅ Global CDN; pre-built styles available
- ✅ Handles global to local scale
- ⚠️ Custom style layer definitions must match the schema of the hosted tile source
- ⚠️ Vendor dependency
- ⚠️ API keys required by most; check license, usage limits and pricing
- ⚠️ Attribution required for OpenStreetMap-based tiles — at the same visual prominence as any other credit. OpenStreetMap data is licensed under the [ODbL](https://opendatacommons.org/licenses/odbl/); if you create an adapted database from OSM data, the share-alike clause requires you to release it under ODbL as well. Community-funded free services have usage policies; respect them, and give back through self-hosting or donations when your usage grows

Store API keys in environment variables; never commit to source control.

## Self-hosted tile server

Run your own server for full control over data, cost, and deployment. See [Tile Servers in awesome-maplibre](https://github.com/maplibre/awesome-maplibre#tile-servers) for options, including the MapLibre-maintained 💙 [Martin](https://maplibre.org/martin/). Use an existing tile schema or generate custom tiles with [Planetiler](https://github.com/onthegomap/planetiler) or [tippecanoe](https://github.com/felt/tippecanoe).

- ✅ Full control; no per-request cost at scale
- ✅ Can serve dynamic data and convert to tiles on the fly
- ✅ Supports air-gapped deployments
- ⚠️ Data to process, and infrastructure to deploy and maintain. A global OpenStreetMap dataset requires approximately 1 TB of storage and 24 GB of RAM; a city-scale extract needs 10–20 GB of storage and 4 GB of RAM. See [switch2osm.org](https://switch2osm.org/serving-tiles/) for current hardware guidance.
- ⚠️ You must configure CORS and supply glyphs and sprite in your style

## Choosing between them

| Situation                                              | Host this way                                        |
| ------------------------------------------------------ | ---------------------------------------------------- |
| Prototype, or a bounded dataset you control            | PMTiles on static storage                            |
| Standard basemap, no key wanted, low volume            | OpenFreeMap                                          |
| Production basemap with a support relationship and SLA | A commercial hosted provider                         |
| Data changes continuously, or comes out of PostGIS     | Self-hosted tile server (Martin)                     |
| Air-gapped or on-premises deployment                   | Self-hosted tile server                              |
| Global coverage, high traffic, no ops team             | Hosted provider — self-hosting a planet is expensive |

Whichever you choose, the basemap and your own data are almost always separate sources. You rarely need tile infrastructure of your own just to put your data on a map.

## Related Skills

- [**maplibre-tile-sources**](../maplibre-tile-sources/SKILL.md) — Deciding whether you need tiles at all, and which source type fits your data.
- [**maplibre-pmtiles-patterns**](../maplibre-pmtiles-patterns/SKILL.md) — Generating, hosting, and wiring up serverless PMTiles archives.
- [**maplibre-source-wiring**](../maplibre-source-wiring/SKILL.md) — Connecting a tile URL to a style so it renders.

## References

1. **PMTiles format and HTTP range request protocol** — [docs.protomaps.com/pmtiles/](https://docs.protomaps.com/pmtiles/)
2. **OpenFreeMap** — [openfreemap.org](https://openfreemap.org/)
3. **Martin tile server** — [maplibre.org/martin/](https://maplibre.org/martin/)
4. **Planetiler** (generate vector tiles from OSM) — [GitHub](https://github.com/onthegomap/planetiler)
5. **tippecanoe** (generate vector tiles from GeoJSON) — [github.com/felt/tippecanoe](https://github.com/felt/tippecanoe)
6. **awesome-maplibre** — [github.com/maplibre/awesome-maplibre](https://github.com/maplibre/awesome-maplibre)
7. **switch2osm.org** — Community guide to switching from Google Maps to OSM-based tile hosting, including provider list, self-hosting stack, hardware requirements, and ODbL licensing guidance — [switch2osm.org](https://switch2osm.org)
8. **ODbL license** — [opendatacommons.org/licenses/odbl/](https://opendatacommons.org/licenses/odbl/)

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
