import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAutomationCommit, selectPullRequest } from './merged-pr.js';

describe('isAutomationCommit', () => {
  it('skips changelog and release commits', () => {
    assert.equal(isAutomationCommit('chore(changelog): record #12'), true);
    assert.equal(isAutomationCommit('chore(release): v0.2.0'), true);
  });
  it('keeps everything else', () => {
    assert.equal(
      isAutomationCommit('feat(skills): add fonts skill (#12)'),
      false
    );
    assert.equal(isAutomationCommit('chore(deps): bump prettier'), false);
  });
});

describe('selectPullRequest', () => {
  it('prefers the merged PR when a commit belongs to several', () => {
    const pulls = [
      { number: 1, merged_at: null },
      { number: 2, merged_at: '2026-08-25T00:00:00Z' }
    ];
    assert.equal(selectPullRequest(pulls).number, 2);
  });
  it('falls back to the first PR, or null', () => {
    assert.equal(selectPullRequest([{ number: 7 }]).number, 7);
    assert.equal(selectPullRequest([]), null);
    assert.equal(selectPullRequest(undefined), null);
  });
});
