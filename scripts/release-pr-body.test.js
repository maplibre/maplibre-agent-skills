import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { releasePrBody } from './release-pr-body.js';
import { parseChangelogField } from './lib/changelog-field.js';

const changelog = `# Changelog\n\n## [Unreleased]\n\n## [0.2.0] - 2026-09-01\n\n### Added\n\n- thing ([#9](u))\n\n## [0.1.0] - 2026-08-25\n\n### Added\n\n- old\n`;

describe('releasePrBody', () => {
  it("includes only that version's section", () => {
    const body = releasePrBody(changelog, '0.2.0');
    assert.ok(body.includes('- thing ([#9](u))'));
    assert.ok(!body.includes('- old'));
  });
  it('carries Bump: none so merging it records nothing', () => {
    const parsed = parseChangelogField(releasePrBody(changelog, '0.2.0'));
    assert.equal(parsed.errors.length, 0);
    assert.equal(parsed.bump, 'none');
  });
  it('throws for an unknown version', () => {
    assert.throws(() => releasePrBody(changelog, '9.9.9'));
  });
});
