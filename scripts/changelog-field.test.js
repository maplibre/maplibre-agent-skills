import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseChangelogField } from './lib/changelog-field.js';

describe('parseChangelogField', () => {
  it('parses valid fields', () => {
    const body =
      '## Changelog\n\nBump: minor\nCategory: Added\nEntry: `new-skill`: added skill';
    const result = parseChangelogField(body);
    assert.deepStrictEqual(result, {
      bump: 'minor',
      category: 'Added',
      entry: '`new-skill`: added skill',
      errors: []
    });
  });

  it('handles bold keys', () => {
    const body =
      '**Bump:** patch\n**Category:** Fixed\n**Entry:** corrected example';
    const result = parseChangelogField(body);
    assert.deepStrictEqual(result, {
      bump: 'patch',
      category: 'Fixed',
      entry: 'corrected example',
      errors: []
    });
  });

  it('strips HTML comments before parsing', () => {
    const body =
      '<!-- instructions here -->\nBump: minor\nCategory: Changed\nEntry: updated content';
    const result = parseChangelogField(body);
    assert.equal(result.bump, 'minor');
    assert.equal(result.errors.length, 0);
  });

  it('strips comments that only form after a first pass', () => {
    // Removing the inner comment leaves "<!--\nBump: major\n-->", which a
    // single pass would then read as the Bump field.
    const body =
      '<!<!-- a -->--\nBump: major\n-->\nBump: patch\nCategory: Internal\nEntry: x';
    const result = parseChangelogField(body);
    assert.equal(result.bump, 'patch');
    assert.equal(result.errors.length, 0);
  });

  it('returns none with no entry or category required', () => {
    const body = 'Bump: none\nSome other text';
    const result = parseChangelogField(body);
    assert.deepStrictEqual(result, {
      bump: 'none',
      category: null,
      entry: null,
      errors: []
    });
  });

  it('errors on missing Entry when bump is not none', () => {
    const body = 'Bump: patch\nCategory: Changed';
    const result = parseChangelogField(body);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some((e) => e.includes('Entry')));
  });

  it('errors on missing Category when bump is not none', () => {
    const body = 'Bump: minor\nEntry: something';
    const result = parseChangelogField(body);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some((e) => e.includes('Category')));
  });

  it('errors on invalid bump level', () => {
    const body = 'Bump: huge';
    const result = parseChangelogField(body);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0].includes('huge'));
  });

  it('errors on invalid category', () => {
    const body = 'Bump: patch\nCategory: Deprecated\nEntry: something';
    const result = parseChangelogField(body);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors[0].includes('Deprecated'));
  });

  it('errors on empty body', () => {
    const result = parseChangelogField('');
    assert.ok(result.errors.length > 0);
  });

  it('errors on null body', () => {
    const result = parseChangelogField(null);
    assert.ok(result.errors.length > 0);
  });

  it('accepts case-insensitive keys and categories', () => {
    const body = 'bump: MINOR\ncategory: internal\nentry: CI change';
    const result = parseChangelogField(body);
    assert.equal(result.bump, 'minor');
    assert.equal(result.category, 'Internal');
    assert.equal(result.errors.length, 0);
  });

  it('uses first match for each key', () => {
    const body =
      'Bump: patch\nBump: major\nCategory: Added\nEntry: first entry\nEntry: second';
    const result = parseChangelogField(body);
    assert.equal(result.bump, 'patch');
    assert.equal(result.entry, 'first entry');
  });
});
