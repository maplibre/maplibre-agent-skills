import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readVersion, versionChange } from './version-changed.js';

describe('versionChange', () => {
  it('reports the new version when it changed', () => {
    assert.equal(
      versionChange('{"version":"0.1.0"}', '{"version":"0.2.0"}'),
      '0.2.0'
    );
  });
  it('is null when unchanged', () => {
    assert.equal(
      versionChange('{"version":"0.1.0"}', '{"version":"0.1.0"}'),
      null
    );
  });
  it('treats a missing or unparsable parent as a change (first release)', () => {
    assert.equal(versionChange('', '{"version":"0.1.0"}'), '0.1.0');
    assert.equal(versionChange('not json', '{"version":"0.1.0"}'), '0.1.0');
  });
  it('never tags when the current version is unreadable', () => {
    assert.equal(versionChange('{"version":"0.1.0"}', '{}'), null);
    assert.equal(readVersion('{'), '');
  });
});
