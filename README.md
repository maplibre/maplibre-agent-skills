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

### maplibre-mapbox-migration

**Migrating from Mapbox GL JS to MapLibre GL JS.** Use when moving an existing Mapbox map to MapLibre or choosing tile sources and services after leaving Mapbox. Covers package/import swap, removing token, replacing style URLs, plugins, and Mapbox API alternatives. Lists sources used so contributors can be looped in.

[View skill →](skills/maplibre-mapbox-migration/SKILL.md)

### maplibre-tile-sources

**Choosing and configuring tile sources for MapLibre GL JS.**

Use when:

- Setting up a new MapLibre map and need a base map
- Comparing free vs paid or hosted vs self-hosted options
- Configuring glyphs and sprites for a style
- Debugging blank maps or CORS issues
- Migrating from Mapbox and need equivalent tile sources

Covers: The full range of hosted and self-hosted options. Should you want to host your own, explains ancillary requirements around styles, glyphs, sprites, and CORS.

[View skill →](skills/maplibre-tile-sources/SKILL.md)

### maplibre-pmtiles-patterns

Use when hosting vector or raster tiles without a tile server (S3, R2, GitHub Pages) or generating with Planetiler/tippecanoe.

[View skill →](skills/maplibre-pmtiles-patterns/SKILL.md)

Each issue includes content outlines, requirements, and references from the project plan. See [CONTRIBUTING.md](CONTRIBUTING.md) to add or request skills.

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

Runs format check, spellcheck, terminology check, markdown lint, and skill validation. Pre-push hook runs the same checks.

### Skill layout

Each skill lives under `skills/<skill-name>/`:

- **SKILL.md** — Required. YAML frontmatter (`name`, `description`) plus markdown content.
- **AGENTS.md** — Optional. Short reference for the LLM.

See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute a skill — whether you're fixing an error, improving an example, or adding new expertise in areas like framework integration, tile pipelines, geocoding, or routing. All experience levels are welcome.

## License

MIT License. Copyright (c) MapLibre and contributors. Portions adapted from mapbox-agent-skills, Copyright (c) Mapbox, Inc. See [LICENSE.md](LICENSE.md) and [NOTICE](NOTICE).
