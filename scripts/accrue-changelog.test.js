import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { accrueEntry } from './accrue-changelog.js';

const BASE = `# Changelog

## [Unreleased]

### Added

- existing skill

### Changed

- existing change
`;

const OPTS = {
  category: 'Fixed',
  entry: '`some-skill`: corrected example',
  bump: 'patch',
  prNumber: '42',
  prUrl: 'https://github.com/maplibre/maplibre-agent-skills/pull/42'
};

describe('accrueEntry', () => {
  it('creates a new category heading in canonical order', () => {
    const result = accrueEntry(BASE, OPTS);
    assert.ok(result.changed);
    assert.ok(result.changelog.includes('### Fixed'));
    assert.ok(
      result.changelog.includes('`some-skill`: corrected example ([#42]')
    );
    const fixedIdx = result.changelog.indexOf('### Fixed');
    const changedIdx = result.changelog.indexOf('### Changed');
    const addedIdx = result.changelog.indexOf('### Added');
    assert.ok(addedIdx < changedIdx);
    assert.ok(changedIdx < fixedIdx);
  });

  it('inserts under an existing category heading', () => {
    const result = accrueEntry(BASE, {
      ...OPTS,
      category: 'Added',
      entry: 'new skill'
    });
    assert.ok(result.changed);
    const lines = result.changelog.split('\n');
    const addedIdx = lines.findIndex((l) => l === '### Added');
    assert.ok(addedIdx >= 0);
    assert.equal(
      lines[addedIdx + 2],
      '- new skill ([#42](' + OPTS.prUrl + '))'
    );
    assert.equal(lines[addedIdx + 3], '- existing skill');
  });

  it('is idempotent — same PR number skips', () => {
    const first = accrueEntry(BASE, OPTS);
    const second = accrueEntry(first.changelog, OPTS);
    assert.ok(!second.changed);
    assert.equal(first.changelog, second.changelog);
  });

  it('sets the bump marker', () => {
    const result = accrueEntry(BASE, OPTS);
    assert.ok(result.changelog.includes('<!-- bump: patch -->'));
    assert.equal(result.effectiveBump, 'patch');
  });

  it('keeps the higher bump marker', () => {
    const withMarker = BASE.replace(
      '## [Unreleased]\n',
      '## [Unreleased]\n<!-- bump: minor -->\n'
    );
    const result = accrueEntry(withMarker, { ...OPTS, bump: 'patch' });
    assert.ok(result.changelog.includes('<!-- bump: minor -->'));
    assert.equal(result.effectiveBump, 'minor');
  });

  it('upgrades the bump marker when new bump is higher', () => {
    const withMarker = BASE.replace(
      '## [Unreleased]\n',
      '## [Unreleased]\n<!-- bump: patch -->\n'
    );
    const result = accrueEntry(withMarker, { ...OPTS, bump: 'major' });
    assert.ok(result.changelog.includes('<!-- bump: major -->'));
    assert.equal(result.effectiveBump, 'major');
  });

  it('appends category at end when no later category exists', () => {
    const short = `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- existing\n`;
    const result = accrueEntry(short, {
      ...OPTS,
      category: 'Internal',
      entry: 'CI change'
    });
    assert.ok(result.changelog.includes('### Internal'));
    const internalIdx = result.changelog.indexOf('### Internal');
    const addedIdx = result.changelog.indexOf('### Added');
    assert.ok(internalIdx > addedIdx);
  });

  it('handles empty unreleased section', () => {
    const empty = `# Changelog\n\n## [Unreleased]\n`;
    const result = accrueEntry(empty, OPTS);
    assert.ok(result.changed);
    assert.ok(result.changelog.includes('### Fixed'));
    assert.ok(result.changelog.includes(OPTS.entry));
  });

  it('preserves content after unreleased section', () => {
    const withPrev =
      BASE + '\n## [0.1.0] - 2026-01-01\n\n### Added\n\n- initial\n';
    const result = accrueEntry(withPrev, OPTS);
    assert.ok(result.changelog.includes('## [0.1.0] - 2026-01-01'));
    assert.ok(result.changelog.includes('- initial'));
  });
});
