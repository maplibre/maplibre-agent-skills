# Contributing to MapLibre Agent Skills

Thank you for your interest in contributing! This repository helps AI assistants build better MapLibre applications with open tile sources and open-source tooling through structured domain expertise.

## Types of Contributions

We welcome:

- **New skills** — Add expertise in areas not yet covered (tile sources, framework integration, performance, styling, geocoding, migration, etc.)
- **Skill improvements** — Better examples, patterns, or guidance for existing skills
- **Bug fixes** — Correct errors in instructions or examples
- **Documentation** — Clearer README, CONTRIBUTING, or in-skill examples

## Before You Start

1. **Check existing skills** — Review `skills/` to avoid duplication
2. **Open an issue** — For new skills, discuss the idea first to ensure it fits
3. **Review examples** — Look at existing skills (e.g. `skills/maplibre-tile-sources/`) for format and style

## Attribution and Adapted Content

This project may adapt structure or content from [mapbox-agent-skills](https://github.com/mapbox/mapbox-agent-skills) (MIT © Mapbox). When you add or change content that is adapted from that repository:

- **Preserve Mapbox’s copyright.** The [NOTICE](NOTICE) file and [LICENSE.md](LICENSE.md) already state that portions are adapted from mapbox-agent-skills and remain Copyright (c) Mapbox, Inc.
- For a skill or file that is substantially adapted from a Mapbox skill, you may add a short line at the top of the file, e.g.:  
  `Adapted from mapbox-agent-skills. Copyright (c) Mapbox, Inc. Modifications (c) MapLibre and contributors.`
- New, original content only needs the project’s usual license (see [LICENSE.md](LICENSE.md)).

## Development Setup

### Initial Setup

When you clone the repository and run `npm install`, git hooks are installed. The pre-push hook runs quality checks before you push.

**What gets checked:**

1. **Formatting** — Prettier (`.md`, `.json`, `.js`)
2. **Spelling** — cspell (markdown)
3. **Markdown linting** — markdownlint
4. **Skills validation** — YAML frontmatter and structure

### Running Checks Manually

```bash
npm run check
```

Individual checks:

```bash
npm run format:check    # Check formatting
npm run spellcheck      # Check spelling
npm run lint:markdown   # Lint markdown
npm run validate:skills # Validate skill structure
```

### Fixing Issues

**Auto-fix formatting:**

```bash
npm run format
```

**Spell check (cspell):** When `npm run spellcheck` flags a word that is correct (e.g. a project name, library, or acronym), add it to the `words` array in `cspell.config.json`. A few rules:

- **Keep the array alphabetically sorted** (case-insensitive). Insert new entries in the correct position.
- **One form per word.** cspell matching is case-insensitive and strips possessives, so `mapbox` covers `Mapbox`, `MAPBOX`, and `Mapbox's`. Do not add redundant variants.
- **Do not add URL slugs or domain names.** If the flagged word is in link display text (e.g. `[service-name.com](https://service-name.com/)` instead of `[Service Name](https://service-name.com/)`), fix the link text to use the service's readable name. Descriptive link text is also better for accessibility.

**When CI fails on a PR:** The same checks run in CI as locally. If a check fails after you open or update a PR:

- **Formatting:** Run `npm run format`, commit the result.
- **Spelling:** Run `npm run spellcheck` locally to see the flagged words. Fix link text if the flagged word is a URL slug or domain; otherwise add the term to `cspell.config.json` (alphabetically, one form only).
- **Markdown lint:** Run `npm run lint:markdown` locally.
- **Skill validation:** Run `npm run validate:skills` locally.

**Bypass pre-push (not recommended):** `git push --no-verify`. CI will still run checks.

## Creating a New Skill

### 1. Skill Structure

```
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

**Reference:** Prefer [MapLibre GL JS docs](https://maplibre.org/maplibre-gl-js/docs/) and the open ecosystem (OpenFreeMap, OSRM, Nominatim, etc.). When adapting from mapbox-agent-skills, preserve Mapbox copyright as above.

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

- [MapLibre docs](https://maplibre.org/maplibre-gl-js/docs/)
- [Other links]
```

## Testing Your Skill

Before submitting:

1. **Validate structure:** `npm run validate:skills`
2. **Spell check:** `npm run spellcheck` (add terms to `cspell.config.json` if needed)
3. **Lint markdown:** `npm run lint:markdown`
4. **Full check:** `npm run check`
5. **Test with an AI assistant:** e.g. `npx skills add . -a claude-code`, then ask questions the skill should help with

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

- Be respectful, constructive, and collaborative
- No harassment, spam, or unprofessional behavior

Issues or PRs that violate these standards may be closed; repeat offenders may be blocked.

## Questions

- **General or skill ideas:** Open an issue in this repository
- **Security:** Open an issue or contact the maintainers as appropriate

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [LICENSE.md](LICENSE.md)).

Thank you for helping improve MapLibre guidance for AI assistants and developers.
