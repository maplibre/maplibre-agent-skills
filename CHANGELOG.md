# Changelog

Notable changes to this repo's skills and tooling. Loosely follows [Keep a Changelog](https://keepachangelog.com/), adapted for a skills repo — skills are additive markdown, so there's no real "breaking change" axis; entries are grouped by what changed, not by semver category. Entries under [Unreleased] are added automatically from merged PRs.

## [Unreleased]

## [0.2.0] - 2026-08-30

### Added

- `maplibre-source-wiring` skill, split out of `maplibre-tile-sources` so that "the source is configured but nothing draws" routes to a focused skill; `maplibre-tile-sources` narrowed to choosing and identifying a source, and cross-references updated across the collection ([#69](https://github.com/maplibre/maplibre-agent-skills/pull/69))
- `maplibre-v6-migration` skill, for upgrading a v5 app to v6's ESM-only build and other breaking changes ([#53](https://github.com/maplibre/maplibre-agent-skills/pull/53))
- `maplibre-skill-authoring` process skill, for turning a research session into a new skill or a failure report ([#57](https://github.com/maplibre/maplibre-agent-skills/pull/57))
- `maplibre-fonts-glyphs` skill, extracted from `maplibre-cartography` and `maplibre-tile-sources` ([#56](https://github.com/maplibre/maplibre-agent-skills/pull/56))

### Changed

- `maplibre-v6-migration`: add the missing `status` field ([#77](https://github.com/maplibre/maplibre-agent-skills/pull/77))

### Fixed

- pinned generator `max_tokens` lowered 8192 → 4096; no output is lost, and far fewer calls are rejected against Groq's TPM ceiling ([#63](https://github.com/maplibre/maplibre-agent-skills/pull/63))
- `maplibre-mapbox-migration` and `maplibre-pmtiles-patterns`: corrected import and CDN examples broken by MapLibre GL JS v6's ES-module-only build ([#59](https://github.com/maplibre/maplibre-agent-skills/pull/59))

### Internal

- evals: re-ran `maplibre-cartography`, `maplibre-mapbox-migration`, `maplibre-pmtiles-patterns`, `maplibre-terrain-patterns` on the Groq pin and replaced their Cerebras-era results (#64) ([#70](https://github.com/maplibre/maplibre-agent-skills/pull/70))
- Release watch: a weekly check that files an issue when an upstream release removes, renames, or deprecates something a skill still mentions (#71) ([#74](https://github.com/maplibre/maplibre-agent-skills/pull/74))
- `eval.yml`: a publish-job failure after a passing eval now opens an `eval-publish` issue (#55) ([#60](https://github.com/maplibre/maplibre-agent-skills/pull/60))
- Versioning and CHANGELOG automation: a `Changelog` field in the PR template, entries recorded on merge, a Release workflow that cuts the version and regenerates the README skills table ([#58](https://github.com/maplibre/maplibre-agent-skills/pull/58))

## [0.1.0] - 2026-08-25

First tagged release. The collection is versioned as a whole via this release tag, since the Agent Skills spec has no per-skill version field.

### Added

- `maplibre-cartography` skill
- `maplibre-terrain-patterns` skill
- `status` front-matter field on every skill (`verified` / `provisional` / `process`), documented in `README.md` and `CONTRIBUTING.md`
- PR template and an AI-failure-report issue template
- Root `AGENTS.md`, orienting an AI agent working in a clone of this repo and pointing it at the failure-report flow; other MapLibre-ecosystem repos can stub a route-back to it (template in `README.md`)

### Changed

- `maplibre-pmtiles-patterns`: added zoom-range guidance for `url:` vs. hand-wired `tiles:` sources
- `CONTRIBUTING.md` rewritten to enumerate contribution paths (issue report, new skill, eval rubric) rather than assuming one path
- `README.md`: added a "Correctness Guarantee" section and a "What Status Means" table

### Removed

- Per-skill `AGENTS.md` files, in favor of splitting `SKILL.md` content into smaller, task-focused sections directly

### Internal

- Judge-graded evals now run from a single `eval.yml`: a weekly cron on the default branch, plus a maintainer `workflow_dispatch` taking `ref`, `configs`, and `baseline`. They deliberately sit off the PR path, because GitHub withholds repo secrets from a `pull_request` triggered by a fork; `check.yml` remains the only fork-safe merge gate. Dispatching against a contributor ref checks out untrusted code in a job that holds secrets, so the install uses `--ignore-scripts` and the workflow definition always comes from the default branch.
- The generator pin lives in one place, `evals/prompts/lib/providers.yaml`, referenced by all five skill configs and `TEMPLATE.yaml`; `npm run lint:model-pins` fails on any provider id that drifts from it. This also standardized sampling across the suite: `max_tokens: 8192` (previously 8192 in `maplibre-cartography.yaml` and `maplibre-pmtiles-patterns.yaml`, and unset in `maplibre-terrain-patterns.yaml`, where the Promptfoo default truncated answers mid-code and graded as a content failure) and `temperature: 0` (previously unset everywhere). **Eval results recorded before this change were produced without `temperature: 0`.**
- `package.json` version set to `0.1.0` to match this tag
