import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bumpVersion, cutRelease } from './cut-release.js';

describe('bumpVersion', () => {
  it('bumps minor', () => {
    assert.equal(bumpVersion('0.1.0', 'minor'), '0.2.0');
  });

  it('bumps patch', () => {
    assert.equal(bumpVersion('0.1.0', 'patch'), '0.1.1');
  });

  it('bumps major', () => {
    assert.equal(bumpVersion('0.1.0', 'major'), '1.0.0');
  });

  it('bumps from higher versions', () => {
    assert.equal(bumpVersion('2.3.4', 'minor'), '2.4.0');
    assert.equal(bumpVersion('2.3.4', 'patch'), '2.3.5');
  });
});

describe('cutRelease', () => {
  const changelog = `# Changelog

Preamble.

## [Unreleased]
<!-- bump: minor -->

### Added

- New skill

### Internal

- CI improvement
`;

  const packageJson =
    JSON.stringify({ name: 'test', version: '0.1.0' }, null, 2) + '\n';

  it('rewrites changelog with version heading and date', () => {
    const result = cutRelease({
      changelog,
      packageJson,
      level: 'auto',
      date: '2026-08-25'
    });
    assert.equal(result.version, '0.2.0');
    assert.ok(result.changelog.includes('## [0.2.0] - 2026-08-25'));
    assert.ok(result.changelog.includes('## [Unreleased]'));
    assert.ok(!result.changelog.includes('<!-- bump:'));
  });

  it('inserts empty unreleased above the new version', () => {
    const result = cutRelease({
      changelog,
      packageJson,
      level: 'auto',
      date: '2026-08-25'
    });
    const unreleasedIdx = result.changelog.indexOf('## [Unreleased]');
    const versionIdx = result.changelog.indexOf('## [0.2.0]');
    assert.ok(unreleasedIdx < versionIdx);
  });

  it('uses auto level from marker', () => {
    const result = cutRelease({
      changelog,
      packageJson,
      level: 'auto',
      date: '2026-08-25'
    });
    assert.equal(result.version, '0.2.0');
  });

  it('uses explicit level override', () => {
    const result = cutRelease({
      changelog,
      packageJson,
      level: 'major',
      date: '2026-08-25'
    });
    assert.equal(result.version, '1.0.0');
    assert.ok(result.changelog.includes('## [1.0.0] - 2026-08-25'));
  });

  it('updates package.json version', () => {
    const result = cutRelease({
      changelog,
      packageJson,
      level: 'auto',
      date: '2026-08-25'
    });
    const pkg = JSON.parse(result.packageJson);
    assert.equal(pkg.version, '0.2.0');
  });

  it('updates package-lock.json version', () => {
    const lockJson =
      '{\n  "name": "test",\n  "version": "0.1.0",\n  "packages": {\n    "": {\n      "version": "0.1.0"\n    }\n  }\n}\n';
    const result = cutRelease({
      changelog,
      packageJson,
      packageLockJson: lockJson,
      level: 'auto',
      date: '2026-08-25'
    });
    assert.ok(result.packageLockJson.includes('"version": "0.2.0"'));
    assert.ok(!result.packageLockJson.includes('"version": "0.1.0"'));
  });

  it('errors on auto with no marker and no entries', () => {
    const empty = '# Changelog\n\n## [Unreleased]\n';
    assert.throws(() => {
      cutRelease({
        changelog: empty,
        packageJson,
        level: 'auto',
        date: '2026-08-25'
      });
    }, /Nothing to release/);
  });

  it('errors on auto with entries but no marker', () => {
    const noMarker = '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- stuff\n';
    assert.throws(() => {
      cutRelease({
        changelog: noMarker,
        packageJson,
        level: 'auto',
        date: '2026-08-25'
      });
    }, /Specify the level explicitly/);
  });

  it('preserves existing version sections', () => {
    const withPrev =
      changelog + '\n## [0.1.0] - 2026-01-01\n\n### Added\n\n- initial\n';
    const result = cutRelease({
      changelog: withPrev,
      packageJson,
      level: 'auto',
      date: '2026-08-25'
    });
    assert.ok(result.changelog.includes('## [0.1.0] - 2026-01-01'));
    assert.ok(result.changelog.includes('- initial'));
  });

  it('preserves package.json formatting', () => {
    const result = cutRelease({
      changelog,
      packageJson,
      level: 'auto',
      date: '2026-08-25'
    });
    assert.ok(result.packageJson.endsWith('\n'));
    assert.ok(result.packageJson.includes('  "version"'));
  });
});
