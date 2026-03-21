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
2. **Browse open issues** — Check [open issues](https://github.com/maplibre/maplibre-agent-skills/issues) for planned skills and comment on one you'd like to write
3. **Open an issue** — Use the [issue template](./.github/ISSUE_TEMPLATE/skill_request.md) if you have an idea not yet on the list — we’re happy to help refine scope and requirements
4. **Understand the requirements** — Review this page for skill structure, format, and quality guidelines
5. **Review examples** — Use existing skills (e.g. [maplibre-tile-sources](skills/maplibre-tile-sources/SKILL.md)) as a reference for style and depth

New to [Agent Skills](https://agentskills.io)? The [skills specification](https://github.com/anthropics/skills) describes the general format. See [SKILL.md format](#3-skillmd-format) for how skills are structured in this repo specifically.

## Editing Skills

### Skill Quality Standards

Skills in this repo must be:

- **Accurate** — Matches MapLibre and referenced APIs/docs
- **Actionable** — Clear guidance, not just description
- **Attribution** — Reference primary sources wherever possible, and always preserve Mapbox copyright (see [A note about adapted content](#a-note-about-adapted-content))
- **Consistent** — Format and style in line with existing skills

If you spot an error, omission, or quality gap, open an issue — or comment on an existing one you'd like to fix to confirm a maintainer is available to review.

### Quality assurance mechanisms

Two automated systems enforce quality in this repository:

- **`npm run check`** — formatting, spelling, markdown lint, and terminology. Runs as a pre-push hook. See [Check format and spelling](#check-format-and-spelling).
- **Evals** — [Promptfoo](https://promptfoo.dev/) test prompts and rubrics that verify a skill answers questions correctly. They serve two purposes:
  1. **Requirements** — Written before the skill, reviewed by a qualified reviewer. The rubric defines what a correct answer must include, independent of the skill's phrasing.
  2. **Regression gate** — CI runs evals on every PR that touches a skill. All assertions must pass before the PR can merge.

When modifying an existing skill: update or add eval tests to cover the change, [run evals locally](#running-evals-locally) to confirm nothing breaks, and do not remove tests to make a PR pass — update them with reviewer sign-off instead.

See [`evals/README.md`](evals/README.md) for full guidance on writing prompts and rubrics.

### Development Setup

**1. Clone the repo and install dependencies:**

```bash
git clone https://github.com/maplibre/maplibre-agent-skills.git
cd maplibre-agent-skills
npm install
```

`npm install` installs a pre-push git hook that runs checks before every push.

**2. Set up eval providers** — See [evals/README.md](evals/README.md#setup) for current recommended providers, API keys, and setup instructions.

### Running evals locally

Evals are stored in `evals/prompts`. Run the eval for the skill you are working on:

```bash
npx promptfoo@latest eval \
  --config evals/prompts/<skill-name>.yaml \
  --grader google:gemini-2.5-flash-lite \
  --no-cache -j 1
```

Omit `--grader google:gemini-2.5-flash-lite` if you don't have a `GOOGLE_API_KEY` — Cerebras will be used as judge instead.

Promptfoo will prompt to install if it isn't already. Results will show up in your terminal; optionally you can view and scroll through past results in your browser locally.

### Check format and spelling

Run `npm run check` frequently while developing — it runs all checks and stops at the first failure:

1. **Formatting** — Prettier (`.md`, `.json`, `.js`)
2. **Spelling** — cspell (markdown)
3. **Markdown linting** — markdownlint
4. **Terminology** — proper noun capitalization (e.g. `MapLibre` not `Maplibre`)
5. **Skills validation** — YAML frontmatter and structure

All checks pass when the output ends with:

```text
✅ All skills are valid
```

See [Fixing Issues](#fixing-issues) below for how to resolve errors from each check.

### Fixing Issues

Most issues are auto-fixable:

| Check            | Fix                                                                       |
| ---------------- | ------------------------------------------------------------------------- |
| Formatting       | `npm run format`                                                          |
| Terminology      | `npm run fix:terminology`                                                 |
| Markdown linting | `npm run format` fixes MD060 (table spacing); others require manual edits |
| Spell check      | Correct manually                                                          |

**Markdown linting details:** Error output includes the rule ID and line number. The most common manual fix is **MD051** (invalid link fragment) — verify the heading exists and the anchor is lowercase with hyphens.

**Terminology details:** Flags incorrect capitalization of proper nouns in prose (e.g. `maplibre` → `MapLibre`). Applies to standalone words only; package names and URL paths are ignored.

**Adding new words:** When a check flags a word that is correct:

- **Proper nouns** — add to [`terminology.txt`](terminology.txt) (used by both the spell checker and terminology checker)
- **Other technical terms** — add to the `words` array in [`cspell.config.json`](cspell.config.json), alphabetically sorted
- **Do not add URL slugs** — fix the link text instead (e.g. `[Service Name](https://...)`)

**Bypass pre-push:** `git push --no-verify`. Use this if you are stuck or unsure how to resolve a check. CI will still run checks; your reviewer can help resolve them before merge.

### Submitting a Change

For bug fixes, typos, and documentation edits:

1. Create a branch: `git checkout -b fix-your-description`
2. Make your edit.
3. Run `npm run check` and fix any issues.
4. If you edited skill content, run evals to confirm nothing regressed — see [Running evals locally](#running-evals-locally).
5. Push and open a PR describing what you changed and why.

For new skills, follow the full workflow in [Creating a New Skill](#creating-a-new-skill).

## Creating a New Skill

Follow these steps to add a new skill to the collection.

### 1. Write Evals First

Before writing any skill content, write the eval prompts and rubric. Evals define what a correct answer must include — independently of what the skill says. This is the quality control mechanism.

1. Copy `evals/prompts/TEMPLATE.yaml`, rename it to `evals/prompts/maplibre-your-skill-name.yaml`.
2. Write a rubric in `evals/rubrics/maplibre-your-skill-name.md` — a checklist of what correct answers must include. Keep each item specific enough for an LLM judge to evaluate objectively.
3. Create a branch: `git checkout -b add-maplibre-your-skill-name`
4. Open a draft PR with only the eval and rubric files for reviewer sign-off.
5. Run the baseline check to confirm all tests fail without the skill — see [Proving tests fail without the skill](evals/README.md#proving-tests-fail-without-the-skill). If any test passes, the prompt is not testing skill-specific knowledge; revise it before continuing.
6. Write the skill to make the evals pass.
7. Run evals locally to confirm all pass (see [Running evals locally](#running-evals-locally)), then push.

### 2. Skill Structure

```text
skills/maplibre-your-skill-name/
├── SKILL.md              # Required: main skill file
└── AGENTS.md             # Optional: short reference for the AI
```

### 3. SKILL.md Format

Every SKILL.md must have YAML frontmatter followed by markdown:

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

- `name` must match the directory name exactly (e.g. `maplibre-tile-sources`).
- `description` should be concise (1–2 sentences).
- Content must include actionable guidance, not just reference text.

### 4. Content Guidelines

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

**Reference:** Include links to primary sources wherever possible. See [Attribution and References](#attribution-and-references) for a curated list.

### 5. Test Your Skill

Before publishing your PR:

1. **Run all checks:** `npm run check` (fix any issues before continuing)
2. **Run evals** and confirm all assertions pass — see [Running evals locally](#running-evals-locally)
3. **Test with an AI assistant:** `npx skills add . -a claude-code`, then ask questions the skill should answer

## Attribution and References

Reference these sources in skill content wherever possible:

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
