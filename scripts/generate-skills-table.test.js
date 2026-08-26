import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractUseWhen,
  generateTable,
  parseExistingRows,
  tableIsCurrent
} from './generate-skills-table.js';

describe('extractUseWhen', () => {
  it('extracts text after last "Use when"', () => {
    const desc = 'Some description. Use when building a map with custom tiles.';
    const result = extractUseWhen(desc);
    assert.equal(result.text, 'Building a map with custom tiles');
    assert.equal(result.fallback, false);
  });

  it('strips trailing period', () => {
    const desc = 'Desc. Use when doing something.';
    assert.equal(extractUseWhen(desc).text, 'Doing something');
  });

  it('capitalizes the first letter', () => {
    assert.ok(
      extractUseWhen('Desc. Use when styling a map.').text.startsWith('S')
    );
  });

  it('falls back to full description when no "Use when" exists', () => {
    const desc = 'How to configure data sources for MapLibre';
    const result = extractUseWhen(desc);
    assert.equal(result.text, desc);
    assert.equal(result.fallback, true);
  });

  it('uses the LAST occurrence of "Use when"', () => {
    const desc = 'Use when first case. More text. Use when second case.';
    assert.equal(extractUseWhen(desc).text, 'Second case');
  });
});

const skills = [
  {
    name: 'beta-skill',
    description: 'Beta. Use when doing B.',
    status: 'verified'
  },
  {
    name: 'alpha-skill',
    description: 'Alpha. Use when doing A.',
    status: 'verified'
  },
  {
    name: 'process-skill',
    description: 'Process. Use when maintaining.',
    status: 'process'
  },
  {
    name: 'no-usewhen',
    description: 'Full description only',
    status: 'provisional'
  }
];

describe('parseExistingRows', () => {
  it('reads name and cell from prettier-padded rows', () => {
    const block = [
      '| Skill                                  | Use when         |',
      '| -------------------------------------- | ---------------- |',
      '| [`alpha-skill`](skills/alpha-skill/SKILL.md) | Hand-written A   |',
      '| [`beta-skill`](skills/beta-skill/SKILL.md)   | Hand-written B |'
    ].join('\n');
    const rows = parseExistingRows(block);
    assert.deepEqual(
      [...rows.entries()],
      [
        ['alpha-skill', 'Hand-written A'],
        ['beta-skill', 'Hand-written B']
      ]
    );
  });
});

describe('generateTable', () => {
  it('sorts rows by skill name', () => {
    const { table } = generateTable(skills);
    assert.ok(table.indexOf('alpha-skill') < table.indexOf('beta-skill'));
  });

  it('includes process skills', () => {
    assert.ok(generateTable(skills).table.includes('process-skill'));
  });

  it('warns on fallback descriptions', () => {
    assert.ok(
      generateTable(skills).warnings.some((w) => w.includes('no-usewhen'))
    );
  });

  it('generates valid markdown table header', () => {
    const { table } = generateTable(skills);
    assert.ok(table.startsWith('| Skill | Use when |'));
    assert.ok(table.includes('| --- | --- |'));
  });

  it('links to SKILL.md', () => {
    assert.ok(
      generateTable(skills).table.includes(
        '[`alpha-skill`](skills/alpha-skill/SKILL.md)'
      )
    );
  });

  it('preserves an existing cell over the derived text', () => {
    const existing = new Map([['alpha-skill', 'Hand-written A']]);
    const { table, warnings } = generateTable(skills, existing);
    assert.ok(table.includes('| Hand-written A |'));
    assert.ok(table.includes('| Doing B |'));
    assert.ok(!warnings.some((w) => w.includes('alpha-skill')));
  });

  it('drops rows for skills that no longer exist', () => {
    const existing = new Map([['gone-skill', 'Old cell']]);
    assert.ok(!generateTable(skills, existing).table.includes('gone-skill'));
  });
});

describe('tableIsCurrent', () => {
  const wrap = (rows) =>
    `# T\n\n<!-- skills-table:start -->\n<!-- c -->\n\n| Skill | Use when |\n| --- | --- |\n${rows}\n\n<!-- skills-table:end -->\n`;
  const two = skills.filter(
    (s) => s.name.endsWith('-skill') && s.status !== 'process'
  );

  it('is current when rows are sorted and complete, whatever the cell text', () => {
    const readme = wrap(
      '| [`alpha-skill`](skills/alpha-skill/SKILL.md) | X |\n| [`beta-skill`](skills/beta-skill/SKILL.md) | Y |'
    );
    assert.equal(tableIsCurrent(readme, two), true);
  });

  it('is stale when a skill is missing or out of order', () => {
    const missing = wrap(
      '| [`alpha-skill`](skills/alpha-skill/SKILL.md) | X |'
    );
    assert.equal(tableIsCurrent(missing, two), false);
    const unsorted = wrap(
      '| [`beta-skill`](skills/beta-skill/SKILL.md) | Y |\n| [`alpha-skill`](skills/alpha-skill/SKILL.md) | X |'
    );
    assert.equal(tableIsCurrent(unsorted, two), false);
  });
});
