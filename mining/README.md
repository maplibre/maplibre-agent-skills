# MapLibre Agent Skills — Demand Mining

This folder contains the demand mining reports for the [MapLibre Agent Skills](https://github.com/maplibre/maplibre-agent-skills) project, published here because they may be of general interest to maintainers and the Governing Board, and because they may not be suitable to share with the general public.

## What is demand mining?

Demand mining identifies topics where developers are already reaching for AI help — meaning the existing documentation is insufficient, the API is confusing, or LLMs frequently hallucinate wrong answers.

We're mining from:

- **GitHub** — AI tool mentions in issues and discussions across all MapLibre ecosystem repos (`maplibre-gl-js`, `maplibre-native`, `martin`, `maplibre-style-spec`, `maplibre-tile-spec`, `maputnik`); keyword volume counts via `gh search issues`
- **Stack Overflow** — top questions tagged `maplibre-gl` by votes
- **MapLibre Slack** — manual search for threads where developers mentioned AI tools

Mining results drive which new skills to write, and which topics to write eval prompts against, to ensure the skills are answering real questions our community has.

These reports could also motivate us to improve documentation or address pain-points in other ways.

## Reports

| Period  | File                        | Status                                   |
| ------- | --------------------------- | ---------------------------------------- |
| 2026-Q1 | [README.md](./q1/README.md) | Complete — 2026-03-04 through 2026-03-06 |

## Findings Summary

### 2026-Q1

The Q1 mining run covered 6 repos, the top 20 Stack Overflow questions by votes, and 7 Slack threads. Key findings:

- **9 confirmed AI failure threads** — including verbatim wrong answers from ChatGPT and Claude on `["literal"]` wrapping, `addProtocol` v3→v4 API changes, and Martin's YAML-only config format
- **5 topics at the GitHub API ceiling (50+ issues):** React/framework integration, expressions/filters, font/glyph setup, performance, and 3D/fill-extrusion
- **4 new skill proposals filed:** [`maplibre-terrain-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/19), [`martin-configuration-patterns`](https://github.com/maplibre/maplibre-agent-skills/issues/18), [`maplibre-native-gl-js-parity`](https://github.com/maplibre/maplibre-agent-skills/issues/20), [`maplibre-cloud-native-sources`](https://github.com/maplibre/maplibre-agent-skills/issues/21)
- **Top priority backlog skills:** [web-integration-patterns](https://github.com/maplibre/maplibre-agent-skills/issues/9), [style-patterns](https://github.com/maplibre/maplibre-agent-skills/issues/8), [maplibre-cartography](https://github.com/maplibre/maplibre-agent-skills/issues/11), [maplibre-terrain-patterns](https://github.com/maplibre/maplibre-agent-skills/issues/19)

## What's next

After mining, a structured issue review was completed: gap analysis, public comments, outline updates, and new issues filed for all confirmed gaps. Issue comments are posted publicly to create a record and surface signal to other contributors.

The eval infrastructure (`evals/prompts/`, `evals/rubrics/`, CI workflows) is currently being built out (March 2026).

See the [maplibre-agent-skills repo](https://github.com/maplibre/maplibre-agent-skills) for current status.

**Refresh cadence:** Quarterly. The next run is planned for 2026-Q2.
