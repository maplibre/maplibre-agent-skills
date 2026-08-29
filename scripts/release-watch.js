#!/usr/bin/env node
/**
 * Release watch: flags skill content an upstream release just contradicted.
 *
 * Reads the watch list in `.github/release-watch/watch.yml`, fetches each repo's
 * releases newer than the watermark in `.github/release-watch/state.json`, and
 * for every release whose notes announce a removal, rename, or deprecation,
 * reports the skill lines that still carry the affected name. One issue per
 * release with hits, labeled `release-watch` and `needs-triage`.
 *
 * Hard limits, by design: it never opens a pull request, never edits a skill
 * file, and never closes an issue. The parsing and matching rules live in
 * `scripts/lib/release-watch.js`.
 *
 *   node scripts/release-watch.js --dry-run
 *   node scripts/release-watch.js --dry-run --repo maplibre/maplibre-gl-js --tag v6.0.0
 *
 * Flags:
 *   --dry-run          print the issues that would be filed; no writes at all
 *   --repo <o/n>       limit the run to one watch-list entry
 *   --tag <tag>        examine exactly this release, ignoring the watermark
 *   --since <iso8601>  override the watermark for this run
 *   --skills-dir <d>   read skills from another checkout (used by the smoke test)
 *   --watch <file>     watch list path
 *   --state <file>     watermark path
 *
 * Env: GH_TOKEN or GITHUB_TOKEN; falls back to `gh auth token` locally.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseWatchList,
  selectReleases,
  findHits,
  issueBody,
  issueMarker,
  issueTitle
} from './lib/release-watch.js';

const WATCH_DEFAULT = '.github/release-watch/watch.yml';
const STATE_DEFAULT = '.github/release-watch/state.json';
const LABELS = ['release-watch', 'needs-triage'];

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--repo') args.repo = argv[++i];
    else if (arg === '--tag') args.tag = argv[++i];
    else if (arg === '--since') args.since = argv[++i];
    else if (arg === '--skills-dir') args.skillsDir = argv[++i];
    else if (arg === '--watch') args.watch = argv[++i];
    else if (arg === '--state') args.state = argv[++i];
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  args.watch ??= WATCH_DEFAULT;
  args.state ??= STATE_DEFAULT;
  args.skillsDir ??= 'skills';
  return args;
}

function token() {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    console.error('No GH_TOKEN or GITHUB_TOKEN, and `gh auth token` failed.');
    process.exit(1);
  }
}

async function api(path, auth) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${auth}`,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
}

/** Every skill file the watch reads: SKILL.md, and AGENTS.md where a skill has one. */
function loadSkillFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    for (const file of ['SKILL.md', 'AGENTS.md']) {
      const path = join(dir, name.name, file);
      if (existsSync(path)) {
        files.push({ path, content: readFileSync(path, 'utf8') });
      }
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Markers of issues already filed. Read from the label rather than the search
 * index: search tokenizes an HTML comment unpredictably, a label listing does not.
 */
async function existingMarkers(repo, auth) {
  const markers = new Set();
  try {
    const issues = await api(
      `/repos/${repo}/issues?state=all&labels=release-watch&per_page=100`,
      auth
    );
    for (const issue of issues) {
      const found = /<!-- release-watch: [^>]+ -->/.exec(issue.body ?? '');
      if (found) markers.add(found[0]);
    }
  } catch (error) {
    // A repo with the label not yet created answers 404 here; that just means
    // nothing has been filed yet.
    if (!/ 404 /.test(String(error.message))) throw error;
  }
  return markers;
}

function createIssue(repo, title, body) {
  for (const label of LABELS) {
    execFileSync(
      'gh',
      [
        'label',
        'create',
        label,
        '--repo',
        repo,
        '--force',
        '--color',
        'ededed'
      ],
      { stdio: 'ignore' }
    );
  }
  execFileSync(
    'gh',
    [
      'issue',
      'create',
      '--repo',
      repo,
      '--title',
      title,
      '--body',
      body,
      '--label',
      LABELS.join(',')
    ],
    { stdio: 'inherit' }
  );
}

const args = parseArgs(process.argv.slice(2));
const auth = token();
const selfRepo =
  process.env.GITHUB_REPOSITORY ?? 'maplibre/maplibre-agent-skills';
const runUrl = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${selfRepo}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : '';

const watchList = parseWatchList(readFileSync(args.watch, 'utf8'));
const state = existsSync(args.state)
  ? JSON.parse(readFileSync(args.state, 'utf8'))
  : {};
const skillFiles = loadSkillFiles(args.skillsDir);
const filed = args.dryRun ? new Set() : await existingMarkers(selfRepo, auth);

const summary = [];
let issuesFiled = 0;

for (const entry of watchList) {
  if (args.repo && entry.repo !== args.repo) continue;
  if (entry.enabled === false) {
    summary.push(
      `- ${entry.repo}: skipped — ${entry.note ?? 'disabled in the watch list'}`
    );
    continue;
  }

  let releases;
  try {
    releases = await api(`/repos/${entry.repo}/releases?per_page=50`, auth);
  } catch (error) {
    summary.push(`- ${entry.repo}: could not be read (${error.message})`);
    continue;
  }

  let candidates;
  if (args.tag) {
    candidates = releases.filter((r) => r.tag_name === args.tag);
    if (candidates.length === 0) {
      summary.push(`- ${entry.repo}: no release tagged ${args.tag}`);
      continue;
    }
  } else {
    const watermark = args.since
      ? { published_at: args.since }
      : state[entry.repo];
    candidates = selectReleases(releases, watermark);
  }

  if (candidates.length === 0) {
    summary.push(`- ${entry.repo}: no new releases`);
    continue;
  }

  for (const release of candidates) {
    const hits = findHits(release.body ?? '', skillFiles);
    if (hits.length === 0) {
      // A release with no hits files nothing. An issue per release regardless
      // would bury the ones that matter under weekly noise; the run summary is
      // the record that it was read.
      summary.push(`- ${entry.repo} ${release.tag_name}: read, no hits`);
      continue;
    }

    const marker = issueMarker(entry.repo, release.tag_name);
    if (filed.has(marker)) {
      summary.push(
        `- ${entry.repo} ${release.tag_name}: ${hits.length} hit(s), issue already filed`
      );
      continue;
    }

    const title = issueTitle(entry.repo, release.tag_name);
    const body = issueBody({
      repo: entry.repo,
      tag: release.tag_name,
      url: release.html_url,
      publishedAt: release.published_at,
      hits,
      runUrl
    });

    if (args.dryRun) {
      console.log(`\n=== would file: ${title}\n`);
      console.log(body);
    } else {
      createIssue(selfRepo, title, body);
      filed.add(marker);
      issuesFiled++;
    }
    summary.push(`- ${entry.repo} ${release.tag_name}: ${hits.length} hit(s)`);
  }

  // Watermark advances past every release read, hits or not, so a rerun is
  // idempotent and a missed week catches up instead of skipping.
  if (!args.tag) {
    const newest = candidates[candidates.length - 1];
    state[entry.repo] = {
      tag: newest.tag_name,
      published_at: newest.published_at
    };
  }
}

if (!args.dryRun && !args.tag) {
  writeFileSync(args.state, JSON.stringify(state, null, 2) + '\n');
}

const report = ['## Release watch', '', ...summary, ''].join('\n');
console.log('\n' + report);
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, report, { flag: 'a' });
}
if (!args.dryRun) console.log(`Issues filed: ${issuesFiled}`);
