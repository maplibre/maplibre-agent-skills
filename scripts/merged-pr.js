#!/usr/bin/env node
// Merge-time lookup for changelog.yml: which PR produced this commit, and should it be recorded?
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setOutputs } from './lib/github-output.js';

const AUTOMATION_PREFIXES = ['chore(changelog):', 'chore(release):'];

export function isAutomationCommit(subject) {
  return AUTOMATION_PREFIXES.some((p) => subject.startsWith(p));
}

// Picks the merged PR from the commit's associated pull requests.
export function selectPullRequest(pulls) {
  if (!Array.isArray(pulls)) return null;
  return pulls.find((p) => p.merged_at) ?? pulls[0] ?? null;
}

export async function fetchPullsForCommit({ repo, sha, token }) {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits/${sha}/pulls`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} looking up PRs for ${sha}`);
  }
  return res.json();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {
    GITHUB_REPOSITORY: repo,
    GITHUB_SHA: sha,
    GH_TOKEN: token,
    PR_BODY_FILE
  } = process.env;
  if (!repo || !sha || !token || !PR_BODY_FILE) {
    console.error(
      'Required env: GITHUB_REPOSITORY, GITHUB_SHA, GH_TOKEN, PR_BODY_FILE'
    );
    process.exit(1);
  }

  const subject = execFileSync('git', ['log', '-1', '--format=%s'], {
    encoding: 'utf8'
  }).trim();
  if (isAutomationCommit(subject)) {
    console.log(`Automation commit ("${subject}") — skipping.`);
    setOutputs({ found: 'false' });
    process.exit(0);
  }

  const pr = selectPullRequest(await fetchPullsForCommit({ repo, sha, token }));
  if (!pr) {
    console.log('No PR found for this commit — skipping.');
    setOutputs({ found: 'false' });
    process.exit(0);
  }

  writeFileSync(PR_BODY_FILE, pr.body ?? '');
  setOutputs({ found: 'true', number: pr.number, url: pr.html_url });
  console.log(`Found #${pr.number}: ${pr.html_url}`);
}
