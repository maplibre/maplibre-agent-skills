import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setOutputs } from './lib/github-output.js';

function outputFile() {
  return join(mkdtempSync(join(tmpdir(), 'github-output-')), 'out');
}

describe('setOutputs', () => {
  it('writes a single-line value as key=value', () => {
    const file = outputFile();
    setOutputs({ changed: 'true', partial: false }, file);
    assert.equal(readFileSync(file, 'utf8'), 'changed=true\npartial=false\n');
  });

  it('appends rather than replacing, as $GITHUB_OUTPUT expects', () => {
    const file = outputFile();
    setOutputs({ name: '2026-09-06' }, file);
    setOutputs({ changed: 'true' }, file);
    assert.equal(readFileSync(file, 'utf8'), 'name=2026-09-06\nchanged=true\n');
  });

  it('wraps a multi-line value in a heredoc the runner can read back', () => {
    const file = outputFile();
    setOutputs({ summary: 'a: verified -> provisional\nb: pass' }, file);
    assert.equal(
      readFileSync(file, 'utf8'),
      [
        'summary<<GITHUB_OUTPUT_EOF',
        'a: verified -> provisional',
        'b: pass',
        'GITHUB_OUTPUT_EOF',
        ''
      ].join('\n')
    );
  });

  it('refuses a value that would close its own heredoc', () => {
    const file = outputFile();
    assert.throws(
      () => setOutputs({ summary: 'one\nGITHUB_OUTPUT_EOF\ntwo' }, file),
      /delimiter/
    );
  });
});
