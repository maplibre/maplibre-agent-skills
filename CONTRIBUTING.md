# Contributing to MapLibre Agent Skills

Thank you for your interest in contributing! This repository helps AI assistants build better MapLibre applications with open tile sources and open-source tooling through structured domain expertise.

We welcome new skills, improvements to existing ones, bug fixes, eval rubrics, and documentation fixes — see [Ways to contribute](#ways-to-contribute) below for entry points. Questions: open an issue or contact the maintainers.

Providers, API keys, commands, and how to write prompts and rubrics all live in [`evals/README.md`](evals/README.md).

## Correctness Validation

Please review [What a skill's status means](README.md#what-a-skills-status-means) in the README. Everything below is how a contribution actually gets to `status: verified`, and how that's maintained.

Correctness is established two ways:

- **Evals** — [Promptfoo](https://promptfoo.dev/) prompts and rubrics that test whether an AI assistant answers correctly with the skill loaded and incorrectly without it. The rubric is written before the skill and defines what a correct answer must contain, independent of the skill's phrasing. Judge-graded evals showing prompt responses that fail without the skill and pass with the skill are stored in [`evals/results/`](evals/results). See [`evals/README.md`](evals/README.md) for how to run these yourself.
- **Human review** — every merged claim is one a maintainer read and can defend. See [Note on AI usage](#note-on-ai-usage).

Content that passes an eval at baseline (i.e., the model already gets it right without the skill) is cut, however well written — see [Cutting content the model already gets right](#cutting-content-the-model-already-gets-right).

### Cutting content the model already gets right

**The rule: content the model already gets right is a cost, not a benefit.** A section covering something the model already handles costs context on every load and has to be maintained as the library moves, without changing an answer. So whenever possible, probe candidate content at baseline before writing it up, and cut what passes.

It isn't a waste of time to write tests that pass. They refine and sharpen what the skill necessarily needs to carry, and which candidates the model already covers is a finding in its own right. A baseline probe is the cheapest way to establish that, and it is what separates a skill that earns its context budget from one that merely reads well.

As an illustration of how this has gone in practice: three sections were drafted for `maplibre-tile-sources`, based on real indicators of what LLMs may not understand, and added to the skill:

- Planetiler vs. tippecanoe selection guidance
- archived tile services served from a demand-driven cache, where tiles that were never requested are permanently absent
- zoom range and overzoom behavior past a source's `maxzoom`

Probed separately at baseline, the model answered all three correctly with no skill injected. None was a demonstrated gap, so all three were removed before the skill shipped (added in `0bb2abd`, removed in `f4a4d67`). The eval suite was unchanged.

## Ways to contribute

There are many ways to contribute. We're glad to have you:

| Path                                                  | You provide                                          | A maintainer covers                       |
| ----------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| [Report a failure](#report-a-failure)                 | A wrong AI answer, and the right one if you know it  | Verifying it and folding it into a skill  |
| [Request a skill](#request-a-skill)                   | An idea for a skill, and why it's missing            | Scoping it into an issue                  |
| [Write a scaffolded skill](#write-a-scaffolded-skill) | Skill content, against a rubric already written      | Running the eval and confirming it passes |
| [Write a new skill](#write-a-new-skill)               | Content and the eval rubric                          | Review                                    |
| [Edit an existing skill](#edit-an-existing-skill)     | The change, plus a baseline probe if it adds content | Review                                    |
| [Improve an eval rubric](#improve-an-eval-rubric)     | A sharper prompt, assertion, or new rubric           | Confirming it against the pinned model    |

### Report a failure

AI agents fail to provide good reasoning about MapLibre for a variety of reasons: they lack domain depth or reliable code samples to draw on, the public APIs have changed since training, or they conflate MapLibre with Mapbox. These failures range from subtle to obvious.

If you hit one, open an [AI failure report](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md). AI agents working in this repo are encouraged to file these too; see [AGENTS.md](AGENTS.md#when-a-skill-contradicts-your-training-data).

A maintainer verifies the report against the model currently pinned for this purpose (see [evals/README.md](evals/README.md#setup)) and folds it into an existing skill or a new one.

### Request a skill

Have an idea for a skill but not ready to write it yourself? Open an [issue](https://github.com/maplibre/maplibre-agent-skills/issues) if it isn't already listed — use the [skill request template](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=skill_request.md).

A maintainer verifies relevance and that it isn't already covered by an existing skill or open issue, then scopes it into an issue someone can pick up as [a scaffolded skill](#write-a-scaffolded-skill) or [end to end](#write-a-new-skill).

### Write a scaffolded skill

If the eval prompts and rubric are already written, your job is to write `skills/maplibre-<name>/SKILL.md`, to satisfy the outline in the issue. See [SKILL.md format](#skillmd-format) for the file structure.

Run the eval yourself if you have the [eval setup](evals/README.md#setup); otherwise just open a PR when you are ready — a reviewer with the setup working will run the eval against your branch and submit the results.

### Write a new skill

Check [open issues](https://github.com/maplibre/maplibre-agent-skills/issues), particularly those labeled "help wanted," and comment where you know the subject matter. A maintainer will help you scope it — negotiate structure early so the eventual reviewer knows what to expect.

Then:

1. **Rubric first.** [Set up providers](evals/README.md#setup) and [write the rubric](evals/README.md#writing-eval-prompts) — the standard is four tests (explicit, implicit, anti-pattern, negative), more if the skill's scope calls for it. Favor documented AI failure reports as test cases. [Confirm the rubric fails without the skill](evals/README.md#proving-tests-fail-without-the-skill), then open a draft PR with just the eval and prompt files for reviewer sign-off before writing content.
2. **Write the skill** to cover the topic as described in the issue, not just make the evals pass — see [SKILL.md format](#skillmd-format).
3. **Confirm the eval passes** [with the skill loaded](evals/README.md#running-evals), then commit the raw CSVs to `evals/results/` and set `status: verified` in the front matter.
4. **Write the results doc**: `evals/results/maplibre-<name>.md`, one row per test — baseline and with-skill outcome, failure mode compressed into the cell — a `Run:` header line (date, model, judge), closing with a bold pass/fail tally. [`maplibre-cartography.md`](evals/results/maplibre-cartography.md) and [`maplibre-v6-migration.md`](evals/results/maplibre-v6-migration.md) are the pattern to copy. (A handful of older results docs use a longer full-transcript format instead — left as-is, not something to replicate.)
5. **Test with an AI assistant** before marking the PR ready: `npx skills add .` to install the skill locally, then ask it the questions from your rubric to confirm the fix holds.

If the eval setup is onerous, ship as `status: provisional` instead — but accept that your content may be edited or dropped if it later turns out not to match a verified gap. See [What a skill's status means](README.md#what-a-skills-status-means).

### Edit an existing skill

Fixing a wrong example or clarifying existing content: no baseline probe needed, just update the eval tests that cover the change if the change affects what a correct answer looks like. Do not remove tests to make a PR pass; if a test is wrong, fix it with reviewer sign-off.

Adding new content to an existing skill goes through the same gate a new skill does: probe the addition at baseline first, and cut it if the model already answers correctly without it. See [Cutting content the model already gets right](#cutting-content-the-model-already-gets-right) for a worked example from `maplibre-tile-sources`.

### Improve an eval rubric

Rubrics are re-run periodically to confirm the pinned model still fails without the skill and passes with it, and whenever the pinned model changes — see [evals/README.md](evals/README.md#setup) for the current pin. If a rubric's prompt or expected answer could be worded better, open an issue or a PR. Test your change locally with Promptfoo first if you have the [eval setup](evals/README.md#setup); if you don't, a maintainer will.

## SKILL.md format

### 1. Directory structure

```text
skills/maplibre-your-skill-name/
└── SKILL.md              # Required: the whole skill
```

### 2. Front matter and content

```markdown
---
name: maplibre-example-skill
description: Expert guidance on [domain] for MapLibre applications
status: provisional
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

---

**This skill is a snapshot.** Where a primary source contradicts it — the References above, MapLibre's current documentation, or what MapLibre does when you run it — that source wins. Follow it, then [report the disagreement](https://github.com/maplibre/maplibre-agent-skills/issues/new?template=ai-failure-report.md), citing the source and your MapLibre version: editing your installed copy helps no one else and is overwritten on the next update.
```

- `name` must match the directory name exactly (e.g. `maplibre-tile-sources`).
- `description` should be concise (1–2 sentences).
- `status` is `verified`, `provisional`, or `process` — see [What a skill's status means](README.md#what-a-skills-status-means).
- The closing footer is required and identical in every skill. A skill directory is all an install copies, so this is the only route back to us that an installed user has.
- Content must include actionable guidance, not just reference text.

### 3. Content guidelines

**Good skills have:**

- Clear structure with headings
- Actionable guidance ("Use X when Y")
- Decision tables or trees where helpful
- Code examples (MapLibre GL JS, open APIs) with ✅/❌ where useful
- Concrete thresholds or scenarios where relevant
- Links to MapLibre docs or other open-source docs

**Avoid:**

- Generic text that only repeats official docs
- Lists without context or prioritization
- Vague guidance ("might want to", "could consider")

**Reference:** Include links to primary sources wherever possible. See [Attribution and References](#attribution-and-references) for a curated list.

### 4. Process skills

A skill marked `status: process` describes how **this repository** works: its lanes, its checks, its eval discipline. It makes no claim about MapLibre, so it is exempt from the eval gate.

The exemption is narrow. The test is whether the skill's correctness depends on facts outside this repo. If it does, it is a domain skill and needs a baseline-failing eval like any other. If correctness is defined by this repo's own process and files, an eval graded by a model that has never read them would measure nothing.

Anything asserting how MapLibre behaves fails that test, whatever the front matter says — "it's a process skill" does not carry untested MapLibre content past the bar. Where a process skill needs a MapLibre example, it should point at a shipped skill that already carries the claim rather than restating it.

Process skills are reviewed by reading them against the files they describe, and they go stale when this repo's process changes rather than when MapLibre ships.

## Development setup

**1. Clone the repo and install dependencies:**

```bash
git clone https://github.com/maplibre/maplibre-agent-skills.git
cd maplibre-agent-skills
npm install
```

`npm install` also installs a pre-push git hook that runs `npm run check` before every push.

**2. Set up eval providers** if you're taking an eval-writing path — see [evals/README.md](evals/README.md#setup).

## Checks

Run `npm run check` frequently while developing, not just before pushing — it stops at the first failure, and catching issues early costs less time than catching them all at once at the end. It runs:

1. **Formatting** — Prettier (`.md`, `.json`, `.js`)
2. **Spelling** — cspell (markdown)
3. **Markdown linting** — markdownlint
4. **Terminology** — proper noun capitalization (e.g. `MapLibre` not `Maplibre`)
5. **Skills validation** — YAML frontmatter and structure

All checks pass when the output ends with:

```text
✅ All skills are valid
```

**Fixing failures:**

| Check            | Fix                                                                       |
| ---------------- | ------------------------------------------------------------------------- |
| Formatting       | `npm run format`                                                          |
| Terminology      | `npm run fix:terminology`                                                 |
| Markdown linting | `npm run format` fixes MD060 (table spacing); others require manual edits |
| Spell check      | Correct manually                                                          |

**Markdown linting details:** error output includes the rule ID and line number. The most common manual fix is **MD051** (invalid link fragment) — verify the heading exists and the anchor is lowercase with hyphens.

**Terminology details:** flags incorrect capitalization of proper nouns in prose (e.g. `maplibre` → `MapLibre`). Applies to standalone words only; package names and URL paths are ignored.

**Adding new words** when a check flags one that's correct:

- **Proper nouns** — add to [`terminology.txt`](terminology.txt) (used by both the spell checker and terminology checker)
- **Other technical terms** — add to the `words` array in [`cspell.config.json`](cspell.config.json), alphabetically sorted
- **Do not add URL slugs** — fix the link text instead (e.g. `[Service Name](https://...)`)

**Bypass pre-push:** `git push --no-verify`. Use this if you're stuck or unsure how to resolve a check — CI will still run checks, and your reviewer can help resolve them before merge.

## Submitting a change

1. Create a branch: `git checkout -b fix-your-description`
2. Make your edit, following whichever path in [Ways to contribute](#ways-to-contribute) matches what you're doing.
3. Run `npm run check`, and evals too if you touched skill content.
4. Push and open a PR describing what you changed and why.
5. **Fill in the Changelog section** in your PR description — this is required. A CI check validates it on every PR. See [How to fill in the Changelog field](#how-to-fill-in-the-changelog-field) below.

### How to fill in the Changelog field

Every PR description includes a `## Changelog` section (the PR template pre-fills it). Fill in three fields:

| Field      | What to write                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Bump`     | `minor` for a new or removed skill or a change to how skills are consumed; `patch` for content fixes and tooling; `major` if installed skills would break; `none` for typo fixes, CI-only, or changes that need no entry |
| `Category` | `Added`, `Changed`, `Fixed`, `Removed`, or `Internal` — the CHANGELOG heading the entry goes under                                                                                                                       |
| `Entry`    | One line in the CHANGELOG's voice, naming the skill if one is touched. Omit when Bump is `none`                                                                                                                          |

On merge, automation reads these fields and inserts the entry under `[Unreleased]` in `CHANGELOG.md` — do not hand-edit that section. A merged PR without a usable field (one opened before the template carried it, for example) is skipped with a warning on the workflow run, and its entry can be added by hand.

### How releases are cut

Releases are cut by a maintainer via the Release workflow (`workflow_dispatch`), which bumps the version, moves `[Unreleased]` entries into a dated section, regenerates the README skills table, and opens a release PR. Merging that PR tags `vX.Y.Z` and publishes the GitHub Release. Opening the PR needs "Allow GitHub Actions to create and approve pull requests" enabled under Settings → Actions → General → Workflow permissions; without it the workflow pushes the `release/vX.Y.Z` branch and stops, and the PR can be opened by hand. A PR opened by the workflow does not trigger `check.yml` on its own (GitHub does not run workflows for events caused by `GITHUB_TOKEN`); close and reopen it to run the checks. The README skills table is regenerated at the same time: rows are sorted by name, a row is added for each new skill (its "Use when" text seeded from the `Use when` clause of the skill's `description`), and rows for removed skills are dropped. Existing "Use when" text is preserved, so edit it in place in `README.md` whenever it can be improved; there is no need to touch the table when adding a skill.

## Note on AI usage

Please take a moment to review [MapLibre's AI Policy](https://github.com/maplibre/maplibre/blob/main/AI_POLICY.md). tl;dr: do not let AI speak for you, verify all generated content before requesting a review, and disclose AI usage in pull requests.

**What that means in this repo.** The policy is not a prohibition. Its first line: "contributors can use whatever tools they would like to craft their contributions, but there must be a **human in the loop**." It then makes each contributor responsible for aligning with "repository-specific contribution guidelines" — this section. Concretely: an AI agent may draft skill content, eval prompts, and rubrics. What it may not do is submit them, or speak for you in the pull request.

Before you mark a pull request ready for review:

- **Verify every claim against a primary source.** The [style spec](https://maplibre.org/maplibre-style-spec/), the [GL JS docs](https://maplibre.org/maplibre-gl-js/docs/), and the GL JS [CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md) decide correctness. A fluent draft that cites nothing is the exact failure mode this repo exists to correct.
- **Be able to answer questions about it** during review. If you cannot explain why a section says what it says, it is not ready.
- **Write the PR description yourself**, and disclose the AI usage in it, noting the models and prompts used. The pull request template has a line for this. Disclosure is not penalized.

Agent-drafted content meets the same gate as everything else, and the gate is the point: a skill must close a [demonstrated gap](evals/README.md#proving-tests-fail-without-the-skill) and pass evals that failed at baseline. Nothing enters this collection because it reads well.

## Attribution and References

Reference these sources in skill content wherever possible:

**MapLibre — core:**

- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) — web maps JavaScript library; see the [examples](https://maplibre.org/maplibre-gl-js/docs/examples/) for code patterns to reference.
- [MapLibre Style Spec](https://maplibre.org/maplibre-style-spec/) — JSON style schema for GL JS and Native
- [MapLibre Native](https://maplibre.org/maplibre-native/docs/book/) — C++ library for Android, iOS, and desktop; see the [GitHub README](https://github.com/maplibre/maplibre-native) for usage.
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

**Tile sources and map data:**

- [OpenFreeMap](https://openfreemap.org/quick_start/) — free hosted OpenStreetMap tiles with MapLibre-ready styles
- [OpenStreetMap US Tileservice](https://tiles.openstreetmap.us/) — vector and raster tilesets and fonts for the OpenStreetMap community
- [PMTiles / Protomaps](https://docs.protomaps.com/) — single-file tile archive format for serverless deployments
- [Overture Maps](https://docs.overturemaps.org/) — open, structured map data

**Geocoding and routing:**

- [Nominatim API](https://nominatim.org/release-docs/latest/api/Overview/) — OpenStreetMap geocoding and reverse geocoding
- [OSRM API](https://project-osrm.org/docs/v5.24.0/api/) — open source routing engine

**Tile generation:**

- [tippecanoe](https://github.com/felt/tippecanoe) — build vector tilesets from GeoJSON

### A note about adapted content

Due to similarities and shared history, though it shouldn't strictly be necessary, we acknowledge that this project may adapt structure or content from [mapbox-agent-skills](https://github.com/mapbox/mapbox-agent-skills) (MIT © Mapbox). Please, if you find yourself adding or changing content that is adapted from that repository:

- **Preserve Mapbox's copyright.** The [NOTICE](NOTICE) file and [LICENSE.md](LICENSE.md) already state that portions are adapted from mapbox-agent-skills and remain Copyright (c) Mapbox, Inc.
- For a skill or file that is substantially adapted from a Mapbox skill, you may add a short line at the top of the file, e.g.:
  `Adapted from mapbox-agent-skills. Copyright (c) Mapbox, Inc. Modifications (c) MapLibre and contributors.`
- New, original content only needs the project's usual license (see [LICENSE.md](LICENSE.md)).

## Code of Conduct

This project follows the [MapLibre Code of Conduct](https://github.com/maplibre/.github/blob/main/CODE_OF_CONDUCT.md). Please read it before contributing.

- Be respectful, constructive, and collaborative
- No harassment, spam, or unprofessional behavior

Issues or PRs that violate these standards may be closed; repeat offenders may be blocked.

## License

By contributing, you agree that your contributions will be licensed under the MIT License (see [LICENSE.md](LICENSE.md)).

Thank you for helping improve MapLibre guidance for AI assistants and developers.
