## What this changes

<!-- One or two sentences. If this adds or edits a skill, name the skill. -->

## The gap it closes

<!--
Skill changes only. Link the demonstrated failure: an AI failure report, a
baseline-failing eval prompt, or a mining note. See CONTRIBUTING.md → "Write a new skill".
Delete this section for docs, tooling, or CI changes.
-->

## How to review

<!--
Skill changes only. Delete for docs, tooling, or CI changes.
-->

Read `SKILL.md` to check for factual errors. Skim the corresponding prompt in
`evals/prompts/` and the summary in `evals/results`
(the individual CSVs are raw LLM output — only worth it if you want the details).

## Changelog

<!--
Bump: how this PR should move the version when the next release is cut — `minor` for a new or removed skill or a change to how skills are consumed, `patch` for content fixes and tooling, `major` reserved for a change that invalidates installed skills, `none` for changes that need no CHANGELOG entry (typo fixes, CI-only).
Entry: one line, in the CHANGELOG's voice, naming the skill if one is touched. Omit when Bump is none.
Category: Added | Changed | Fixed | Removed | Internal (which CHANGELOG heading the entry goes under).
-->

Bump: patch
Category: Changed
Entry: `maplibre-example`: one-line description of what changed

## Checks

- [ ] `npm run check` passes
- [ ] Evals run, or `status: provisional` set with the gap cited above
- [ ] Claims are traceable to a primary source (MapLibre docs, style spec, or CHANGELOG)

## AI usage

<!--
Per MapLibre's AI Policy, disclose substantial AI-generated content: for code, anything
beyond single-line autocomplete; for documentation, more than a few words. Note the models and
prompts used. Disclosure is not penalized. Drafting with an agent is fine and expected here;
submitting content you have not verified is not.
See CONTRIBUTING.md → "Note on AI usage".
-->

- [ ] No substantial AI-generated content, **or** it is described below (tools, models, prompts), and I have verified every claim against a primary source and can answer questions about it in review.
- [ ] I wrote this PR description myself.
