import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lastGraded, parseCsv } from './lib/results-history.js';

describe('parseCsv', () => {
  it('keeps commas, newlines, and doubled quotes inside a quoted field', () => {
    const text =
      'Description,Status\n"a, with ""quotes""\nand a line",PASS\nb,FAIL\n';
    assert.deepEqual(parseCsv(text), [
      ['Description', 'Status'],
      ['a, with "quotes"\nand a line', 'PASS'],
      ['b', 'FAIL']
    ]);
  });

  it('reads CRLF rows and a last row with no line ending', () => {
    assert.deepEqual(parseCsv('x,y\r\n1,2'), [
      ['x', 'y'],
      ['1', '2']
    ]);
  });
});

describe('lastGraded', () => {
  const csv = (...rows) =>
    [
      'Description,prompt,Status',
      ...rows.map(([d, s]) => `${d},"q",${s}`)
    ].join('\n');
  const files = {
    '2026-10-14-maplibre-a.csv': csv(['one', 'PASS'], ['two', 'FAIL']),
    '2026-10-21-maplibre-a.csv': csv(['one', 'PASS'], ['two', 'ERROR']),
    '2026-10-16-maplibre-b.csv': csv(['one', 'PASS'], ['two', 'ERROR']),
    '2026-10-16-maplibre-b-retry.csv': csv(['two', 'ERROR'], ['two', 'PASS']),
    '2026-10-21-maplibre-c.csv': csv(['one', 'ERROR']),
    'baseline-2026-10-22-maplibre-a.csv': csv(['one', 'PASS'], ['two', 'PASS']),
    'maplibre-a.md': ''
  };
  const last = lastGraded(Object.keys(files), (name) => files[name]);

  it('passes over a day that left a test in ERROR', () => {
    assert.equal(last.get('maplibre-a'), '2026-10-14');
  });

  it('counts a test the re-run graded', () => {
    assert.equal(last.get('maplibre-b'), '2026-10-16');
  });

  it('leaves out a skill that never got a verdict, and every baseline', () => {
    assert.equal(last.has('maplibre-c'), false);
    assert.deepEqual([...last.keys()].sort(), ['maplibre-a', 'maplibre-b']);
  });
});
