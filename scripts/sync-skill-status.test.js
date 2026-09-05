import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { outputsFor, syncSkillStatus } from './sync-skill-status.js';

// A skills dir holding one SKILL.md per entry, `status` being the frontmatter
// field under test — or null for a skill that never opted into auto-sync.
function skillsDir(skills) {
  const dir = mkdtempSync(join(tmpdir(), 'skill-status-'));
  for (const [name, status] of Object.entries(skills)) {
    mkdirSync(join(dir, name));
    writeFileSync(
      join(dir, name, 'SKILL.md'),
      [
        '---',
        `name: ${name}`,
        'description: A skill. Use when testing.',
        ...(status === null ? [] : [`status: ${status}`]),
        '---',
        '',
        '# Body'
      ].join('\n')
    );
  }
  return dir;
}

function statusOf(dir, name) {
  const content = readFileSync(join(dir, name, 'SKILL.md'), 'utf8');
  return content.match(/^status:\s*(\S+)/m)?.[1] ?? null;
}

describe('syncSkillStatus', () => {
  it('promotes provisional to verified on a pass', () => {
    const dir = skillsDir({ 'maplibre-cartography': 'provisional' });
    const result = syncSkillStatus({
      verdictsText: 'maplibre-cartography:pass\n',
      skillsDir: dir
    });
    assert.deepEqual(result.changes, [
      'maplibre-cartography: provisional -> verified'
    ]);
    assert.equal(statusOf(dir, 'maplibre-cartography'), 'verified');
  });

  it('demotes verified to provisional on a graded fail', () => {
    const dir = skillsDir({ 'maplibre-cartography': 'verified' });
    const result = syncSkillStatus({
      verdictsText: 'maplibre-cartography:fail\n',
      skillsDir: dir
    });
    assert.deepEqual(result.changes, [
      'maplibre-cartography: verified -> provisional'
    ]);
    assert.equal(statusOf(dir, 'maplibre-cartography'), 'provisional');
  });

  it('leaves a status alone on an error, in either direction', () => {
    const dir = skillsDir({
      'maplibre-cartography': 'verified',
      'maplibre-fonts-glyphs': 'provisional'
    });
    const result = syncSkillStatus({
      verdictsText: 'maplibre-cartography:error\nmaplibre-fonts-glyphs:error\n',
      skillsDir: dir
    });
    assert.deepEqual(result.changes, []);
    assert.equal(statusOf(dir, 'maplibre-cartography'), 'verified');
    assert.equal(statusOf(dir, 'maplibre-fonts-glyphs'), 'provisional');
    assert.equal(result.ignored.length, 2);
    assert.match(result.ignored[0].reason, /not a graded result/);
  });

  it('never touches a process skill or one with no status field', () => {
    const dir = skillsDir({
      'maplibre-writing-evals': 'process',
      'maplibre-cartography': null
    });
    const result = syncSkillStatus({
      verdictsText: 'maplibre-writing-evals:fail\nmaplibre-cartography:pass\n',
      skillsDir: dir
    });
    assert.deepEqual(result.changes, []);
    assert.equal(statusOf(dir, 'maplibre-writing-evals'), 'process');
    assert.equal(statusOf(dir, 'maplibre-cartography'), null);
  });

  it('reports a verdict naming a skill that has no SKILL.md', () => {
    const dir = skillsDir({ 'maplibre-cartography': 'verified' });
    const result = syncSkillStatus({
      verdictsText: 'maplibre-gone:fail\n',
      skillsDir: dir
    });
    assert.deepEqual(result.changes, []);
    assert.equal(result.ignored[0].skill, 'maplibre-gone');
    assert.match(result.ignored[0].reason, /no SKILL\.md/);
  });

  it('names every expected skill the run never reached', () => {
    const dir = skillsDir({ 'maplibre-cartography': 'verified' });
    const result = syncSkillStatus({
      verdictsText: 'maplibre-cartography:pass\n',
      expectedSkills: [
        'maplibre-cartography',
        'maplibre-fonts-glyphs',
        'maplibre-tile-sources'
      ],
      skillsDir: dir
    });
    assert.deepEqual(result.missing, [
      'maplibre-fonts-glyphs',
      'maplibre-tile-sources'
    ]);
  });

  it('refuses a malformed verdicts file rather than syncing part of it', () => {
    const dir = skillsDir({ 'maplibre-cartography': 'provisional' });
    assert.throws(
      () =>
        syncSkillStatus({
          verdictsText: 'maplibre-cartography:pass\nmaplibre-fonts-glyphs\n',
          skillsDir: dir
        }),
      /Unparseable/
    );
    assert.equal(statusOf(dir, 'maplibre-cartography'), 'provisional');
  });
});

describe('outputsFor', () => {
  it('marks a run with an unreached skill partial', () => {
    assert.deepEqual(outputsFor({ changes: [], missing: ['a', 'b'] }), {
      changed: 'false',
      partial: 'true'
    });
  });

  it('passes the changes on as a multi-line summary', () => {
    assert.deepEqual(
      outputsFor({ changes: ['a: verified -> provisional'], missing: [] }),
      {
        changed: 'true',
        partial: 'false',
        summary: 'a: verified -> provisional'
      }
    );
  });
});
