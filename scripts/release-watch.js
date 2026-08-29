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
 * Exit status is 1 when any watched repository could not be read, so a
 * scheduled run does not report a clean week it did not fully check.
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

const PER_PAGE = 100;
const MAX_PAGES = 10;

/**
 * The releases of `repo`, newest first, read page by page until one at or
 * before the watermark shows up — so a long gap is caught up in full rather
 * than cut off at the first page. With no watermark yet, one page is enough:
 * the entry is new, and its first run only sets where to start.
 */
async function releasesSince(repo, watermark, auth) {
  const since = watermark?.published_at
    ? Date.parse(watermark.published_at)
    : 0;
  const releases = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await api(
      `/repos/${repo}/releases?per_page=${PER_PAGE}&page=${page}`,
      auth
    );
    releases.push(...batch);
    const reachedWatermark = batch.some(
      (r) => r.published_at && Date.parse(r.published_at) <= since
    );
    if (batch.length < PER_PAGE || reachedWatermark || !since) break;
  }
  return releases;
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
 * index: search tokenizes an HTML comment unpredictably, a label listing does
 * not. A label nobody has created yet lists as empty, not as an error.
 */
async function existingMarkers(repo, auth) {
  const markers = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const issues = await api(
      `/repos/${repo}/issues?state=all&labels=release-watch&per_page=${PER_PAGE}&page=${page}`,
      auth
    );
    for (const issue of issues) {
      const found = /<!-- release-watch: [^>]+ -->/.exec(issue.body ?? '');
      if (found) markers.add(found[0]);
    }
    if (issues.length < PER_PAGE) break;
  }
  return markers;
}

/**
 * Creates a label only if it is missing. `gh label create --force` would also
 * reset the color and description of a label a maintainer has since adjusted.
 */
async function ensureLabel(repo, label, auth) {
  try {
    await api(`/repos/${repo}/labels/${encodeURIComponent(label)}`, auth);
    return;
  } catch (error) {
    if (!/ 404 /.test(String(error.message))) throw error;
  }
  execFileSync(
    'gh',
    ['label', 'create', label, '--repo', repo, '--color', 'ededed'],
    { stdio: 'inherit' }
  );
}

function createIssue(repo, title, body) {
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
const unreadable = [];
let issuesFiled = 0;

for (const entry of watchList) {
  if (args.repo && entry.repo !== args.repo) continue;
  if (entry.enabled === false) {
    summary.push(
      `- ${entry.repo}: skipped — ${entry.note ?? 'disabled in the watch list'}`
    );
    continue;
  }

  const watermark = args.since
    ? { published_at: args.since }
    : state[entry.repo];

  let candidates;
  try {
    if (args.tag) {
      candidates = [
        await api(
          `/repos/${entry.repo}/releases/tags/${encodeURIComponent(args.tag)}`,
          auth
        )
      ];
    } else {
      candidates = selectReleases(
        await releasesSince(entry.repo, watermark, auth),
        watermark
      );
    }
  } catch (error) {
    // Nothing advances for this repo: the next run reads the same releases
    // again. The run fails at the end so the week does not pass for clean.
    summary.push(`- ${entry.repo}: could not be read (${error.message})`);
    unreadable.push(entry.repo);
    continue;
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
      for (const label of LABELS) await ensureLabel(selfRepo, label, auth);
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
if (unreadable.length > 0) {
  console.error(`Could not read releases for: ${unreadable.join(', ')}`);
  process.exit(1);
}
