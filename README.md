# MapLibre Agent Skills

Curated guidance for AI assistants building MapLibre applications — covering ecosystem and open-source best practices.

Agent skills are markdown files that AI coding assistants read as context. When you ask an AI agent to implement something using MapLibre, these skills give the AI the judgment to avoid common API gotchas, and suggest patterns that work.

New skills are prioritized by reported AI failures, recent API/library changes, and long-standing issues documented in GitHub, Stack Overflow, or the community Slack.

## Correctness Guarantee

We strive to make sure the skills in this repo are:

- **Accurate** — Matches MapLibre and referenced APIs/docs
- **Actionable** — Clear guidance, not just general, declarative descriptions
- **Warranted** — Targets something an AI assistant actually gets wrong without the skill
- **Attribution** — Reference primary sources wherever possible, and always preserve Mapbox copyright where content is adapted
- **Consistent** — Format and style in line with existing skills

If you find any inconsistency with this quality bar, please file an issue or PR.

## What Status Means

Each skill is tested with [Promptfoo](https://promptfoo.dev/) evals to verify it improves AI responses on real developer questions. A skill's front-matter `status` records where it stands (e.g. whether an eval has proven it fixes a real failure). See [`evals/README.md`](evals/README.md) for how evals work.

| Status           | Means                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| ✅ `verified`    | An eval proved the skill fixes a real failure; results are committed to `evals/results/`                       |
| 🧪 `provisional` | No eval rubric, an incomplete one, or a rubric that no longer validates the skill's gap                        |
| `process`        | About maintaining this repo, not MapLibre — [eval-exempt](CONTRIBUTING.md#4-process-skills), no `status` badge |

Note that provisional skills are not necessarily lower quality or less reliable. See [CONTRIBUTING.md](CONTRIBUTING.md) for how a skill moves between `provisional` and `verified`.

## Available Skills

Each skill's front matter is the source of truth for its current status — see [What Status Means](#what-status-means).

| Skill                                                                    | Use when                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| [`maplibre-tile-sources`](skills/maplibre-tile-sources/SKILL.md)         | Choosing how to supply map data; deciding between GeoJSON and tiles; configuring a basemap; debugging blank maps or missing labels   |
| [`maplibre-pmtiles-patterns`](skills/maplibre-pmtiles-patterns/SKILL.md) | Hosting tiles without a tile server; static or serverless deployments; converting from MBTiles; generating tiles from OSM or GeoJSON |
| [`maplibre-mapbox-migration`](skills/maplibre-mapbox-migration/SKILL.md) | Moving an existing Mapbox GL JS app to MapLibre; evaluating MapLibre as an open-source alternative                                   |
| [`maplibre-terrain-patterns`](skills/maplibre-terrain-patterns/SKILL.md) | Adding elevation context, hillshade, or 3D terrain; choosing raster-dem sources and encodings; self-hosting DEM tiles                |
| [`maplibre-cartography`](skills/maplibre-cartography/SKILL.md)           | Styling a map; making labels, markers, or roads readable on imagery or vector basemaps; setting up fonts, sprites, or shields        |
| [`maplibre-skill-authoring`](skills/maplibre-skill-authoring/SKILL.md)   | Turning a session where you researched and shipped something MapLibre didn't document into a skill or a failure report               |

## Development

Each skill lives under `skills/<skill-name>/` as a single **SKILL.md**: YAML front-matter (`name`, `description`, `status`) plus markdown content.

See [CONTRIBUTING.md](CONTRIBUTING.md) to add or improve a skill. All experience levels welcome, well-behaved and supervised AI agents are welcome to contribute too.

The repo root carries an [**AGENTS.md**](AGENTS.md) to orient an AI agent working in a clone of this repo and instruct agents on how to report failures.

**Using the convention in your own repo:** if you maintain a repo within the MapLibre organization or ecosystem, put an [`AGENTS.md`](AGENTS.md) file with a short stub that routes AI failures related to MapLibre to this repo.

Here is a template:

```markdown
# AGENTS.md

## MapLibre coding help

Before writing MapLibre code, install the MapLibre agent skills:

    npx skills add maplibre/maplibre-agent-skills

Source: https://github.com/maplibre/maplibre-agent-skills

If you encounter something you do not know how to do, consult the MapLibre docs and this collection of skills. If neither contains the information you are looking for, or MapLibre behaves differently than a skill says report it:
https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md
```

## Install

Installing skills into your project means AI assistants automatically pick them up when you describe a task — no need to define context manually each time.

An install copies skill directories only. If an installed skill turns out to be wrong, don't fix it in place — that copy is overwritten on the next update, and no one else benefits. Every `SKILL.md` ends with a link to the [AI failure report](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md) form for exactly that.

### Without the CLI

Skills are plain markdown.

- **Paste into chat**: Open any `SKILL.md` above and paste it directly into your AI assistant's context window.
- **Copy to your project**: Drop a `SKILL.md` into `.claude/skills/`, `.cursor/rules/`, or append it to `.github/copilot-instructions.md`.
- **Symlink for local development**:

```bash
mkdir -p .claude
ln -s /path/to/maplibre-agent-skills/skills .claude/skills
```

### Via the skills CLI

The [skills CLI](https://github.com/vercel-labs/skills) is a package manager for AI agent skills. It places skill files in the right location for your tool automatically, and supports 40+ agents.

```bash
# List available skills
npx skills add maplibre/maplibre-agent-skills --list

# Install all skills
npx skills add maplibre/maplibre-agent-skills

# Install a single skill
npx skills add maplibre/maplibre-agent-skills --skill maplibre-tile-sources
```

By default, skills are installed per project. To install globally (e.g. to your user profile):

```bash
npx skills add maplibre/maplibre-agent-skills -g
```

To install for a specific agent:

```bash
npx skills add maplibre/maplibre-agent-skills -a claude-code
npx skills add maplibre/maplibre-agent-skills -a cursor
npx skills add maplibre/maplibre-agent-skills -a vscode
```

See [Supported Agents](https://github.com/vercel-labs/skills?tab=readme-ov-file#supported-agents) for the full list.

Once installed, you can manage skills with:

| Command                      | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| `npx skills list`            | List installed skills (alias: `ls`)            |
| `npx skills find [query]`    | Search for skills interactively or by keyword  |
| `npx skills remove [skills]` | Remove installed skills from agents            |
| `npx skills check`           | Check for available skill updates              |
| `npx skills update`          | Update all installed skills to latest versions |
| `npx skills init [name]`     | Create a new SKILL.md template                 |

## License

MIT License. Copyright (c) MapLibre and contributors. See [LICENSE.md](LICENSE.md) and [NOTICE](NOTICE) for more information.
