# Contributing to MapLibre Agent Skills

Thank you for your interest in contributing! This repository helps AI assistants build better MapLibre applications with open tile sources and open-source tooling through structured domain expertise.

We welcome:

- **New skills** — Add expertise in areas not yet covered (tile sources, framework integration, performance, styling, geocoding, migration, etc.)
- **Skill improvements** — Better examples, patterns, or guidance for existing skills
- **Bug fixes** — Correct errors in instructions or examples
- **Documentation** — Clearer README, CONTRIBUTING, or in-skill examples
- **Questions** — Open an issue or contact the maintainers as appropriate

## Contribute a Skill

We’d love your help expanding this collection. Whether you’re a student still learning, you build MapLibre maps from React, Vue, or Svelte, you use GL JS, Native, or React Native, or you’ve tackled geocoding, tile pipelines, routing, or map styling — **your experience can help AI assistants guide developers better**.

**Why contribute?**

- Share your hard-won knowledge with the open mapping community
- Shape how AI assistants recommend MapLibre patterns and open-source tools
- Small, focused contributions are welcome — even a single well-documented pattern helps

**How to get started:**

1. **Check existing skills** — Review [skills/](./skills) to avoid duplication
2. Browse [open issues](https://github.com/maplibre/maplibre-agent-skills/issues) for planned skills and comment if there is one that you would like to write
3. **Open an issue** — Open an issue using the [issue template](./.github/ISSUE_TEMPLATE/skill_request.md) if you have an idea that is not yet on the list — we’re happy to help refine scope and requirements
4. **Understand the requirements** — Review this page for skill structure, format, and quality guidelines
5. **Review examples** — Use existing skills (e.g. [maplibre-tile-sources](skills/maplibre-tile-sources/SKILL.md)) as a reference for style and depth

No prior experience with Agent Skills? The format is a `SKILL.md` file with YAML frontmatter and markdown content plus optional `AGENTS.md` with a quick summary. See the [skill template](CONTRIBUTING.md#4-example-template).

## Development Setup

```bash
git clone https://github.com/maplibre/maplibre-agent-skills.git
cd maplibre-agent-skills
npm install
```

`npm install` installs a pre-push git hook. Run `npm run check` frequently while developing — it runs all checks and stops at the first failure:

1. **Formatting** — Prettier (`.md`, `.json`, `.js`) — fix with `npm run format`
2. **Spelling** — cspell (markdown) — fix manually or add to [cspell.config.json](cspell.config.json) (see below)
3. **Markdown linting** — markdownlint — fix manually; see error output for rule and line number
4. **Terminology** — textlint (e.g. `MapLibre` not `Maplibre`) — fix all issues with `npm run fix:terminology`
5. **Skills validation** — YAML frontmatter and structure — fix manually in `SKILL.md`

### Fixing Issues

**Spell check:** When `npm run spellcheck` flags a word that is correct (e.g. a project name, library, or acronym), add it to the `words` array in [cspell.config.json](cspell.config.json):

- Keep entries alphabetically sorted.
- One form per word — cspell is case-insensitive, so `maplibre` covers `MapLibre`, `MAPLIBRE`, and `MapLibre's`. Do not add redundant variants.
- Do not add URL slugs or domain names. Fix the link text instead (e.g. `[Service Name](https://...)` not `[service-name.com](https://...)`). Descriptive link text is also better for accessibility.

**Terminology:** Run `npm run fix:terminology` to auto-fix all flagged terms across all files at once. Terms are defined in [.textlintrc.json](.textlintrc.json).

**Markdown linting:** Fix issues manually using the rule name and line number in the error output. The `DeprecationWarning: fs.R_OK is deprecated` message that appears during this check is a known Node.js compatibility notice from markdownlint-cli — it is harmless and can be ignored.

> **Note:** cspell and textlint serve different roles and cannot share a word list. cspell checks whether a word exists (case-insensitive); textlint enforces how it must be capitalized in prose. Terms with specific capitalization — like `MapLibre`, `GeoJSON`, or `PMTiles` — must be registered in both files: lowercased in `cspell.config.json` so cspell accepts them, and in their canonical form in `.textlintrc.json` so textlint enforces the correct casing.

**Bypass pre-push (not recommended):** `git push --no-verify`. Do this if you are not sure how to resolve an issue. CI will still run checks; your reviewer should be able to help. The issues should be addressed before your PR is merged.

## Creating a New Skill

Agent Skills are structured markdown files that give AI coding assistants domain expertise. [Learn more](https://agentskills.io) or read the [skills specification](https://github.com/anthropics/skills).

### 1. Skill Structure

```text
skills/maplibre-your-skill-name/
├── SKILL.md              # Required: main skill file
└── AGENTS.md             # Optional: short reference for the AI
```

### 2. SKILL.md Format

Every SKILL.md must have YAML frontmatter followed by markdown:

```markdown
---
name: maplibre-your-skill-name
description: Brief one-line description of what this skill covers
---

# Skill Title

[Your skill content here]
```

- `name` must match the directory name exactly (e.g. `maplibre-tile-sources`).
- `description` should be concise (1–2 sentences).
- Content must include actionable guidance, not just reference text.

### 3. Content Guidelines

**Good skills have:**

- Clear structure with headings
- Actionable guidance (“Use X when Y”)
- Decision tables or trees where helpful
- Code examples (MapLibre GL JS, open APIs) with ✅/❌ where useful
- Concrete thresholds or scenarios where relevant
- Links to MapLibre docs or other open-source docs

**Avoid:**

- Generic text that only repeats official docs
- Lists without context or prioritization
- Vague guidance (“might want to”, “could consider”)

**Reference:** Include references wherever possible, using the most stable and authoritative sources you can. See [Attribution and References](#attribution-and-references) below for a curated list of authoritative sources.

### 4. Example Template

```markdown
---
name: maplibre-example-skill
description: Expert guidance on [domain] for MapLibre applications
---

# MapLibre [Domain] Skill

Use this skill when:

- [Use case 1]
- [Use case 2]

## Core principles

[Guidance, examples, decision tables]

## Reference

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)
- [Other links]
```

## Attribution and References

Here are examples of the authoritative sources you can use and reference in developing skill patterns:

**MapLibre — core:**

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) — web maps JavaScript library. For MapLibre code patterns to reference while writing skills, see the [MapLibre GL JS examples](https://maplibre.org/maplibre-gl-js/docs/examples/).
- [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/) — JSON style schema for GL JS and Native
- [MapLibre Native](https://maplibre.org/maplibre-native/docs/book/) — C++ library for Android, iOS, and desktop, see [main README on GitHub](https://github.com/maplibre/maplibre-native) for instructions on how to _use_ MapLibre Native.
- [Martin tile server](https://maplibre.org/martin/) — PostGIS, MBTiles, and PMTiles tile server
- [MapLibre Tile Spec](https://maplibre.org/maplibre-tile-spec/) — next-generation vector tile format

**MapLibre — framework bindings:**

- [MapLibre React Native](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/) — Expo and React Native (Android & iOS)
- [maplibre-compose](https://maplibre.org/maplibre-compose/) — Jetpack Compose (Android)
- [ngx-maplibre-gl](https://maplibre.org/ngx-maplibre-gl/) — Angular
- [flutter-maplibre-gl](https://github.com/maplibre/flutter-maplibre-gl) — Flutter
- [swiftui-dsl](https://github.com/maplibre/swiftui-dsl) — SwiftUI

**MapLibre — plugins and tools:**

- [maplibre-gl-geocoder](https://maplibre.org/maplibre-gl-geocoder/) — geocoding UI control for GL JS
- [maplibre-gl-directions](https://maplibre.org/maplibre-gl-directions/) — routing/directions plugin for GL JS
- [Maputnik](https://maplibre.org/maputnik/) — visual style editor
- [awesome-maplibre](https://github.com/maplibre/awesome-maplibre) — curated ecosystem list

**Tile sources and basemaps:**

- [OpenFreeMap](https://openfreemap.org/quick_start/) — free hosted OpenStreetMap tiles with MapLibre-ready styles
- [PMTiles / Protomaps](https://docs.protomaps.com/) — single-file tile archive format for serverless deployments
- [Overture Maps](https://docs.overturemaps.org/) — open, structured map data

**Geocoding and routing:**

- [Nominatim API](https://nominatim.org/release-docs/latest/api/Overview/) — OpenStreetMap geocoding and reverse geocoding
- [OSRM API](https://project-osrm.org/docs/v5.24.0/api/) — open source routing engine

**Tile generation:**

- [tippecanoe](https://github.com/felt/tippecanoe) — build vector tilesets from GeoJSON

### A note about adapted content

Due to similarities and shared history, though it shouldn’t strictly be necessary, we acknowledge that this project may adapt structure or content from [mapbox-agent-skills](https://github.com/mapbox/mapbox-agent-skills) (MIT © Mapbox). Please, if you find yourself adding or change content that is adapted from that repository:

- **Preserve Mapbox’s copyright.** The [NOTICE](NOTICE) file and [LICENSE.md](LICENSE.md) already state that portions are adapted from mapbox-agent-skills and remain Copyright (c) Mapbox, Inc.
- For a skill or file that is substantially adapted from a Mapbox skill, you may add a short line at the top of the file, e.g.:
  `Adapted from mapbox-agent-skills. Copyright (c) Mapbox, Inc. Modifications (c) MapLibre and contributors.`
- New, original content only needs the project’s usual license (see [LICENSE.md](LICENSE.md)).

## Testing Your Skill

Before submitting:

1. **Run all checks:** `npm run check` (fix any issues before continuing)
2. **Test with an AI assistant:** `npx skills add . -a claude-code`, then ask questions the skill should answer

## Pull Request Process

1. Create a branch: `git checkout -b add-maplibre-your-skill-name`
2. Add or edit skills under `skills/maplibre-*/` (SKILL.md and optional AGENTS.md).
3. Run `npm run check`.
4. Commit with a clear message, e.g.:

   ```bash
   git commit -m "Add maplibre-your-skill-name skill

   - What the skill covers
   - Key topics"
   ```

5. Push and open a PR. The pre-push hook will run checks; CI will run them again. All must pass before merge.

In the PR, describe the skill’s purpose, example use cases, and any prerequisites.

## Skill Quality Standards

- **Accurate** — Matches MapLibre and referenced APIs/docs
- **Actionable** — Clear guidance, not just description
- **Attribution** — When adapting from mapbox-agent-skills, preserve Mapbox copyright (see above)
- **Consistent** — Format and style in line with existing skills

## Code of Conduct

This project follows the [MapLibre Code of Conduct](https://github.com/maplibre/.github/blob/main/CODE_OF_CONDUCT.md). Please read it before contributing.

- Be respectful, constructive, and collaborative
- No harassment, spam, or unprofessional behavior

Issues or PRs that violate these standards may be closed; repeat offenders may be blocked.

## AI-Generated Contributions

This project follows the [MapLibre AI Generated Contributions Policy](https://github.com/maplibre/maplibre/blob/main/AI_POLICY.md). In brief: AI tools are permitted, but contributors are responsible for the content they submit — including correctness, licensing, and the ability to explain and maintain it during review.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [LICENSE.md](LICENSE.md)).

Thank you for helping improve MapLibre guidance for AI assistants and developers.
