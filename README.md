# MapLibre Agent Skills

**Agent Skills** that help AI assistants build MapLibre GL JS applications with open tile sources, open-source tooling, and best practices. Covers tile source selection, framework integration patterns, performance, styling, and migration from other platforms.

## Quick Start

Install all MapLibre Agent Skills:

```bash
npx skills add maplibre/maplibre-agent-skills
```

Install a specific skill:

```bash
npx skills add maplibre/maplibre-agent-skills --skill maplibre-tile-sources
```

List available skills:

```bash
npx skills add maplibre/maplibre-agent-skills --list
```

(Replace `maplibre/maplibre-agent-skills` with your fork or local path if needed.)

## What Are Agent Skills?

Agent Skills are folders of instructions and resources that AI assistants (e.g. Claude, Cursor, GitHub Copilot) can discover and use to do tasks better. They provide **domain expertise** — the know-how for MapLibre and the open mapping ecosystem — so the assistant can suggest the right tile sources, patterns, and APIs.

## Available Skills

### maplibre-tile-sources

**Choosing and configuring tile sources for MapLibre GL JS.**

Use when:

- Setting up a new MapLibre map and need a base map
- Comparing free vs paid or hosted vs self-hosted options
- Configuring glyphs and sprites for a style
- Debugging blank maps or CORS issues
- Migrating from Mapbox and need equivalent tile sources

Covers: OpenFreeMap (no API key), MapTiler, Stadia Maps, PMTiles, Protomaps (pre-built downloads and CLI extracts), and self-hosted OpenMapTiles. Includes glyphs, sprites, and CORS.

[View skill →](skills/maplibre-tile-sources/SKILL.md)

### maplibre-pmtiles-patterns

**Serverless vector and raster tiles with PMTiles.** Use when hosting tiles without a tile server (S3, R2, GitHub Pages) or generating with Planetiler/tippecanoe. [View skill →](skills/maplibre-pmtiles-patterns/SKILL.md)

### maplibre-mapbox-migration

**Migrating from Mapbox GL JS to MapLibre GL JS.** Use when moving an existing Mapbox map to MapLibre or choosing tile sources and services after leaving Mapbox. Covers package/import swap, removing token, replacing style URLs, plugins, and Mapbox API alternatives. Lists sources used so contributors can be looped in. [View skill →](skills/maplibre-mapbox-migration/SKILL.md)

### Project plan — skills status

**In this repo (link to these only):**

| Skill                                                                  | Description                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [maplibre-tile-sources](skills/maplibre-tile-sources/SKILL.md)         | Tile sources, glyphs, sprites, OpenFreeMap, MapTiler, PMTiles, Protomaps, self-hosted |
| [maplibre-pmtiles-patterns](skills/maplibre-pmtiles-patterns/SKILL.md) | Serverless PMTiles: hosting, generating, MapLibre protocol                            |
| [maplibre-mapbox-migration](skills/maplibre-mapbox-migration/SKILL.md) | Mapbox GL JS → MapLibre migration                                                     |

**Planned (not yet in repo):**

- maplibre-open-search-patterns — Geocoding and search (Nominatim, Photon, Pelias)
- maplibre-geospatial-operations — Routing and geometry (OSRM, OpenRouteService, Turf.js)
- maplibre-style-patterns — Layer and source configuration for styles
- maplibre-web-integration-patterns — Framework integration (React, Vue, Svelte, etc.)
- maplibre-web-performance-patterns, maplibre-cartography, maplibre-style-quality, and others as needed

See [CONTRIBUTING.md](CONTRIBUTING.md) to add or request skills.

## How to Use

### With Claude Code

```bash
npx skills add maplibre/maplibre-agent-skills -a claude-code
```

Or symlink for local development:

```bash
mkdir -p .claude
ln -s /path/to/maplibre-agent-skills/skills .claude/skills
```

### With Cursor

```bash
npx skills add maplibre/maplibre-agent-skills -a cursor
```

### With VS Code (GitHub Copilot)

```bash
npx skills add maplibre/maplibre-agent-skills -a vscode
```

Skills are activated by the assistant when relevant to your task.

## Development

### Setup

```bash
git clone https://github.com/maplibre/maplibre-agent-skills.git
cd maplibre-agent-skills
nvm use
npm install
```

### Checks

```bash
npm run check
```

Runs format check, spellcheck, markdown lint, and skill validation. Pre-push hook runs the same checks.

### Skill layout

Each skill lives under `skills/<skill-name>/`:

- **SKILL.md** — Required. YAML frontmatter (`name`, `description`) plus markdown content.
- **AGENTS.md** — Optional. Short reference for the AI.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or change skills.

## Resources

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/)
- [Agent Skills](https://agentskills.io) / [Skills spec](https://github.com/anthropics/skills)

## License

MIT License. Copyright (c) MapLibre and contributors. Portions adapted from mapbox-agent-skills, Copyright (c) Mapbox, Inc. See [LICENSE.md](LICENSE.md) and [NOTICE](NOTICE).
