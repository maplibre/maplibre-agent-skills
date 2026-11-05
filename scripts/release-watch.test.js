import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  breakingNotes,
  extractTerms,
  findHits,
  findRow,
  issueBody,
  issueMarker,
  lineMatches,
  linkedNumbers,
  parseRows,
  parseWatchList,
  rowMentions,
  selectReleases,
  splitNotes,
  tableRows
} from './lib/release-watch.js';

// Trimmed from the real MapLibre GL JS v6.0.0 release body. Note the shape that
// matters: the breaking items are warning-marked bullets under a "Features and
// improvements" heading, not under a "Breaking changes" one.
const GL_JS_V6 = `The following incorporates all the pre-releases for version 6 changes.

### ✨ Features and improvements

- ⚠️ Switch to an ESM-only distribution (\`maplibre-gl.mjs\`). The UMD bundles (\`maplibre-gl.js\`, \`maplibre-gl-csp.js\`) are no longer published. Consumers using \`import maplibregl from 'maplibre-gl'\` must switch to \`import * as maplibregl from 'maplibre-gl'\` or named imports.
- Add \`Map.setMissingStyleImageResolver\` for resolving missing style images ([#7850](https://example.invalid))

### 🐞 Bug fixes

- Fix camera jump in flyTo when minZoom is set
`;

const MARTIN_STYLE = `### Breaking

- The \`--watch\` flag was removed; use \`--auto-bounds\` instead.

### Added

- e2e local geoparquet wiring via \`duckdb\`
`;

describe('splitNotes', () => {
  it('keeps the heading each note sat under', () => {
    const notes = splitNotes(GL_JS_V6);
    assert.equal(notes.at(-1).heading, '🐞 Bug fixes');
    assert.ok(notes[0].heading.includes('Features'));
  });

  it('folds a wrapped bullet back into one note', () => {
    const notes = splitNotes('- first line\n  continued here\n\n- second');
    assert.equal(notes.length, 2);
    assert.equal(notes[0].text, 'first line continued here');
  });

  it('marks notes inside a breaking section', () => {
    const notes = splitNotes(MARTIN_STYLE);
    assert.equal(notes[0].inBreakingSection, true);
    assert.equal(notes[1].inBreakingSection, false);
  });
});

describe('breakingNotes', () => {
  it('picks up a warning-marked bullet outside any breaking heading', () => {
    const notes = breakingNotes(GL_JS_V6);
    assert.equal(notes.length, 1);
    assert.match(notes[0].text, /ESM-only distribution/);
  });

  it('picks up every bullet under a breaking heading', () => {
    const notes = breakingNotes(MARTIN_STYLE);
    assert.equal(notes.length, 1);
    assert.match(notes[0].text, /--watch/);
  });

  it('picks up a removal phrase with no heading or marker to help', () => {
    const notes = breakingNotes('- The `--drop-densest` flag is deprecated.');
    assert.equal(notes.length, 1);
  });

  // planetiler v0.9.0 marks its breaking bullets this way, under an ordinary
  // "Bug Fixes and Improvements" heading.
  it('picks up a [breaking]-prefixed bullet', () => {
    const notes = breakingNotes(
      '### Bug Fixes and Improvements\n\n  * [breaking] fix: typo in `water_lines_labels` for shortbread tiles spec by @CommanderStorm in https://example.invalid/1215'
    );
    assert.equal(notes.length, 1);
    assert.deepEqual(
      extractTerms(notes[0].text).map((t) => t.value),
      ['water_lines_labels']
    );
  });

  // MapLibre Native ios-v6.29.0 names what went with a bare verb right before
  // the code span, with no "has been" to match on. A verb that is not directly
  // before the span ("never removed from the image manager") is not enough.
  it('picks up a removal verb directly before a code span', () => {
    const body = [
      '- core: rename `mbgl` namespace to `mln` ([#4487](https://example.invalid/4487)).',
      '- Removed `waitForCompletion`, the second parameter of `GeoJSONSource.setData`',
      '- Fix a leak: images of a replaced sprite were never removed from the image manager'
    ].join('\n');
    const notes = breakingNotes(body);
    assert.equal(notes.length, 2);
    assert.match(notes[0].text, /mbgl/);
    assert.match(notes[1].text, /waitForCompletion/);
  });

  it('leaves ordinary notes alone', () => {
    assert.deepEqual(
      breakingNotes('### Added\n\n- Add `--tile-format=mlt`'),
      []
    );
  });
});

describe('extractTerms', () => {
  it('reads a code span with whitespace as a verbatim snippet', () => {
    const terms = extractTerms(
      "use `import maplibregl from 'maplibre-gl'` now"
    );
    assert.deepEqual(terms, [
      { value: "import maplibregl from 'maplibre-gl'", kind: 'phrase' }
    ]);
  });

  it('reads a whitespace-free span as an identifier', () => {
    const values = extractTerms(
      'drop `maplibre-gl.js` and `maplibre-gl.mjs`'
    ).map((t) => t.value);
    assert.deepEqual(values, ['maplibre-gl.js', 'maplibre-gl.mjs']);
  });

  it('ignores prose outside code spans', () => {
    assert.deepEqual(extractTerms('the UMD bundle is no longer published'), []);
  });

  it('drops short bare words that only give a rename its context', () => {
    const values = extractTerms(
      '`Map` composes a `Camera`; `map.transform` was removed and `MapDataEvent` is gone'
    ).map((t) => t.value);
    assert.deepEqual(values, ['map.transform', 'MapDataEvent']);
  });

  it('drops names every skill mentions, and version numbers', () => {
    assert.deepEqual(extractTerms('`maplibre-gl` at `v6.0.0`'), []);
  });
});

describe('lineMatches', () => {
  const term = { value: 'maplibre-gl.js', kind: 'identifier' };

  it('matches an identifier inside a URL path', () => {
    assert.equal(
      lineMatches(
        "src='https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js'",
        term
      ),
      true
    );
  });

  it('will not match an identifier glued to a longer word', () => {
    assert.equal(lineMatches('see xmaplibre-gl.jsx for details', term), false);
  });

  it('matches a snippet only verbatim', () => {
    const phrase = {
      value: "import maplibregl from 'maplibre-gl'",
      kind: 'phrase'
    };
    assert.equal(
      lineMatches("import maplibregl from 'maplibre-gl';", phrase),
      true
    );
    assert.equal(
      lineMatches("import * as maplibregl from 'maplibre-gl';", phrase),
      false
    );
  });
});

describe('findHits', () => {
  // The pre-#59 content of the two skills the v6 UMD removal contradicted.
  const preFix = [
    {
      path: 'skills/maplibre-mapbox-migration/SKILL.md',
      content: [
        '# Migration',
        '',
        '- Script: `https://api.mapbox.com/mapbox-gl-js/v2.9.0/mapbox-gl.js` -> `https://unpkg.com/maplibre-gl@5.0.0/dist/maplibre-gl.js`'
      ].join('\n')
    },
    {
      path: 'skills/maplibre-pmtiles-patterns/SKILL.md',
      content: [
        "import maplibregl from 'maplibre-gl';",
        'protocol.add();'
      ].join('\n')
    }
  ];

  it('flags the pre-fix CDN bundle and default import', () => {
    const hits = findHits(GL_JS_V6, preFix);
    assert.deepEqual(
      hits.map((h) => `${h.path}:${h.line}`),
      [
        'skills/maplibre-mapbox-migration/SKILL.md:3',
        'skills/maplibre-pmtiles-patterns/SKILL.md:1'
      ]
    );
  });

  it('drops the removed form once the content is corrected', () => {
    const fixed = [
      {
        path: 'skills/maplibre-pmtiles-patterns/SKILL.md',
        content: "import * as maplibregl from 'maplibre-gl';"
      }
    ];
    const terms = findHits(GL_JS_V6, fixed).map((h) => h.term);
    assert.ok(!terms.includes("import maplibregl from 'maplibre-gl'"));
  });

  // A known and accepted false positive: a note that quotes both the removed
  // form and its replacement matches the replacement too, because nothing in the
  // prose tells the two apart mechanically. One line for a maintainer to
  // dismiss, which is why the issue says these are matches and not defects.
  it('still matches a replacement the note quoted', () => {
    const fixed = [
      {
        path: 'skills/maplibre-pmtiles-patterns/SKILL.md',
        content: "import * as maplibregl from 'maplibre-gl';"
      }
    ];
    assert.deepEqual(
      findHits(GL_JS_V6, fixed).map((h) => h.term),
      ["import * as maplibregl from 'maplibre-gl'"]
    );
  });

  it('ignores a release with nothing breaking in it', () => {
    assert.deepEqual(
      findHits('### Added\n\n- Add `maplibre-gl.js` docs', preFix),
      []
    );
  });
});

describe('issueBody', () => {
  const body = issueBody({
    repo: 'maplibre/maplibre-gl-js',
    tag: 'v6.0.0',
    url: 'https://example.invalid/v6.0.0',
    publishedAt: '2026-07-22T10:00:00Z',
    hits: findHits(GL_JS_V6, [
      {
        path: 'skills/maplibre-mapbox-migration/SKILL.md',
        content: 'see dist/maplibre-gl.js'
      }
    ]),
    runUrl: 'https://example.invalid/run/1'
  });

  it('leads with the marker that makes a rerun idempotent', () => {
    assert.ok(
      body.startsWith(issueMarker('maplibre/maplibre-gl-js', 'v6.0.0'))
    );
  });

  it('cites the hit as file:line beside the release note', () => {
    assert.match(body, /`skills\/maplibre-mapbox-migration\/SKILL\.md:1`/);
    assert.match(body, /ESM-only distribution/);
  });

  it('says the matches are unverified, not defects', () => {
    assert.match(body, /string matches, not verified defects/);
  });

  it('points an overflowing report at the local dry run, not a rerun', () => {
    const many = Array.from({ length: 70 }, (_, i) => ({
      note: 'n',
      heading: '',
      term: 't',
      kind: 'identifier',
      path: 'skills/x/SKILL.md',
      line: i + 1,
      text: ''
    }));
    const long = issueBody({
      repo: 'maplibre/martin',
      tag: 'martin-v1.14.0',
      url: 'https://example.invalid',
      publishedAt: '2026-08-18T14:06:17Z',
      hits: many,
      runUrl: ''
    });
    assert.match(long, /10 further match\(es\) not listed/);
    assert.match(long, /--repo maplibre\/martin --tag martin-v1\.14\.0/);
  });
});

describe('parseWatchList', () => {
  const source = [
    '# a comment',
    'watch:',
    '  - repo: maplibre/martin',
    "    why: 'Martin endpoints and flags.'",
    '  - repo: protomaps/PMTiles',
    '    enabled: false',
    "    note: 'publishes no releases'",
    ''
  ].join('\n');

  it('reads repo, prose, and the enabled flag', () => {
    const entries = parseWatchList(source);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].repo, 'maplibre/martin');
    assert.equal(entries[0].why, 'Martin endpoints and flags.');
    assert.equal(entries[1].enabled, false);
    assert.equal(entries[1].note, 'publishes no releases');
  });

  it('reads a quoted value Prettier folded onto several lines', () => {
    const folded = [
      'watch:',
      '  - repo: maplibre/martin',
      '    why:',
      "      'Martin endpoints",
      "      and flags.'",
      '    enabled: false',
      ''
    ].join('\n');
    const [entry] = parseWatchList(folded);
    assert.equal(entry.why, 'Martin endpoints and flags.');
    assert.equal(entry.enabled, false);
  });

  it('ignores an entry with no repo', () => {
    assert.deepEqual(parseWatchList('watch:\n  - why: nothing\n'), []);
  });

  it('reads the committed watch list, and every entry says why', () => {
    const entries = parseWatchList(
      readFileSync('.github/release-watch/watch.yml', 'utf8')
    );
    assert.ok(entries.length >= 8);
    assert.ok(entries.every((entry) => entry.repo.includes('/')));
    assert.ok(entries.every((entry) => entry.why));
  });
});

describe('selectReleases', () => {
  const releases = [
    { tag_name: 'v2', published_at: '2026-02-01T00:00:00Z' },
    { tag_name: 'v1', published_at: '2026-01-01T00:00:00Z' },
    {
      tag_name: 'test-abc',
      published_at: '2026-03-01T00:00:00Z',
      prerelease: true
    },
    { tag_name: 'draft', published_at: '2026-03-01T00:00:00Z', draft: true }
  ];

  it('returns everything newer than the watermark, oldest first', () => {
    const picked = selectReleases(releases, {
      published_at: '2025-12-01T00:00:00Z'
    });
    assert.deepEqual(
      picked.map((r) => r.tag_name),
      ['v1', 'v2']
    );
  });

  it('skips prereleases and drafts', () => {
    const tags = selectReleases(releases, null).map((r) => r.tag_name);
    assert.ok(!tags.includes('test-abc'));
    assert.ok(!tags.includes('draft'));
  });

  it('catches up across a missed week rather than skipping', () => {
    assert.equal(selectReleases(releases, null).length, 2);
  });

  it('returns nothing when the watermark is current', () => {
    assert.deepEqual(
      selectReleases(releases, { published_at: '2026-02-01T00:00:00Z' }),
      []
    );
  });
});

// Trimmed from real MapLibre Native release bodies: android-v13.0.0 (#3965),
// android-v13.7.1 (#4602) and the android-v2026.11.2-globe prerelease (#4533).
// None of these notes announces a removal.
const NATIVE_NOTES = `### ✨ Features and improvements

- core: Update Hillshade Algorithms and add Color-Relief Layer support ([#3965](https://github.com/maplibre/maplibre-native/pull/3965))
- Load PMTiles archives bundled in the APK \`assets/\` directory with \`pmtiles://asset://...\` URLs. Asset requests now read only the requested byte range ([#4602](https://github.com/maplibre/maplibre-native/pull/4602)).
- feat(core): render the map as a globe when the style sets \`"projection": {"type": "globe"}\` ([#4533](https://github.com/maplibre/maplibre-native/pull/4533)).
- Make symbol guard checks opt-in, so symbol-dense tiles load faster. To keep them, set the environment variable \`MLN_SYMBOL_GUARDS=1\` before the first map loads.
`;

const PARITY = {
  path: 'skills/maplibre-native-gl-js-parity/SKILL.md',
  content: [
    '| Feature | MapLibre GL JS | MapLibre Native |',
    '| ------- | -------------- | --------------- |',
    '| Globe projection (`projection: globe`) | Yes | No release; [#3161](https://github.com/maplibre/maplibre-native/issues/3161) open |',
    '| 3D terrain (`map.setTerrain`) | Yes | No release; [#252](https://github.com/maplibre/maplibre-native/issues/252) open |',
    '| `color-relief` layer | 5.6.0 | android-v13.0.0 ([#3965](https://github.com/maplibre/maplibre-native/pull/3965)) |',
    '| PMTiles | `addProtocol` | Built in ([#2882](https://github.com/maplibre/maplibre-native/pull/2882)) |'
  ].join('\n')
};

const row = (fields) => ({
  repo: 'maplibre/maplibre-native',
  skill: 'maplibre-native-gl-js-parity',
  ...fields
});

const ROWS = [
  row({ row: 'Globe projection', terms: 'globe' }),
  row({ row: '3D terrain', terms: 'terrain' }),
  row({ row: '`color-relief`', terms: 'color-relief, colorrelief' }),
  row({ row: 'PMTiles', terms: 'pmtiles' })
];

describe('tableRows', () => {
  it('skips the header and separator, and trims the first cell', () => {
    const rows = tableRows(PARITY.content);
    assert.equal(rows.length, 4);
    assert.equal(rows[0].first, 'Globe projection (`projection: globe`)');
    assert.equal(rows[0].line, 3);
  });
});

describe('linkedNumbers', () => {
  it("reads the issues and pull requests a line links in the repo, and no other repo's", () => {
    const line =
      '[#1](https://github.com/maplibre/maplibre-native/issues/1), [#2](https://github.com/maplibre/maplibre-native/pull/2), https://github.com/maplibre/maplibre-gl-js/issues/3';
    assert.deepEqual(linkedNumbers(line, 'maplibre/maplibre-native'), [
      '1',
      '2'
    ]);
  });
});

describe('rowMentions', () => {
  const mentions = rowMentions(NATIVE_NOTES, ROWS, [PARITY]);
  const onRow = (name) => mentions.filter((m) => m.row === name);

  it("flags a note that adds a row's feature, whatever its case", () => {
    const [relief] = onRow('`color-relief`');
    assert.match(relief.note, /Color-Relief Layer support/);
    assert.equal(relief.term, 'color-relief');
  });

  it('reads every note, not only the ones that announce a removal', () => {
    assert.equal(breakingNotes(NATIVE_NOTES).length, 0);
    assert.equal(onRow('Globe projection').length, 1);
    assert.equal(onRow('PMTiles').length, 1);
  });

  it('places the row at its file:line', () => {
    const [relief] = onRow('`color-relief`');
    assert.equal(relief.path, PARITY.path);
    assert.equal(relief.line, 5);
  });

  it('leaves a note that mentions no row alone', () => {
    assert.ok(mentions.every((m) => !m.note.includes('MLN_SYMBOL_GUARDS')));
    assert.equal(onRow('3D terrain').length, 0);
  });

  it("flags a note that links the row's issue without naming its feature", () => {
    const [hit] = rowMentions(
      '- Fix a crash on resume ([#3161](https://github.com/maplibre/maplibre-native/issues/3161))',
      ROWS,
      [PARITY]
    );
    assert.equal(hit.row, 'Globe projection');
    assert.equal(hit.term, '#3161');
  });

  it('matches an issue number whole, and only in the watched repo', () => {
    const body = [
      '- Fix label overlap ([#2520](https://github.com/maplibre/maplibre-native/pull/2520))',
      '- Port the fix from maplibre/maplibre-gl-js#252'
    ].join('\n');
    assert.deepEqual(rowMentions(body, ROWS, [PARITY]), []);
  });

  it('still reports a listed row its skill no longer has, without a location', () => {
    const [hit] = rowMentions(
      NATIVE_NOTES,
      [row({ row: 'A row that was renamed', terms: 'globe' })],
      [PARITY]
    );
    assert.equal(hit.path, null);
  });
});

describe('issueBody with table row mentions', () => {
  const mentions = rowMentions(NATIVE_NOTES, ROWS, [PARITY]);
  const only = issueBody({
    repo: 'maplibre/maplibre-native',
    tag: 'android-v13.0.0',
    url: 'https://example.invalid/android-v13.0.0',
    publishedAt: '2026-08-01T10:00:00Z',
    hits: [],
    mentions,
    runUrl: ''
  });

  it('says the release mentions a table row when nothing was removed', () => {
    assert.match(only, /Its release notes mention a skill table row/);
    assert.doesNotMatch(only, /announce a removal/);
  });

  it('cites each row as file:line under the note that mentions it', () => {
    assert.match(only, /Color-Relief Layer support/);
    assert.match(
      only,
      /`skills\/maplibre-native-gl-js-parity\/SKILL\.md:5`: the "`color-relief`" row/
    );
  });

  it('reports removals and row mentions in one issue', () => {
    const both = issueBody({
      repo: 'maplibre/maplibre-gl-js',
      tag: 'v6.0.0',
      url: 'https://example.invalid/v6.0.0',
      publishedAt: '2026-07-22T10:00:00Z',
      hits: findHits(GL_JS_V6, [
        { path: 'skills/x/SKILL.md', content: 'see dist/maplibre-gl.js' }
      ]),
      mentions,
      runUrl: ''
    });
    assert.match(both, /announce a removal/);
    assert.match(both, /They also mention a skill table row/);
  });
});

describe('parseRows', () => {
  it('reads the rows list, and leaves it out of the watch list', () => {
    const source = [
      'watch:',
      '  - repo: maplibre/maplibre-native',
      "    why: 'Native.'",
      '',
      'rows:',
      '  - repo: maplibre/maplibre-native',
      '    skill: maplibre-native-gl-js-parity',
      "    row: 'Globe projection'",
      "    terms: 'globe'",
      ''
    ].join('\n');
    assert.equal(parseWatchList(source).length, 1);
    assert.deepEqual(parseRows(source), [
      row({ row: 'Globe projection', terms: 'globe' })
    ]);
  });

  it('reads the committed rows: each is in its skill, and every row of that table that links the repo is listed', () => {
    const rows = parseRows(
      readFileSync('.github/release-watch/watch.yml', 'utf8')
    );
    assert.ok(rows.length >= 6);
    const files = [...new Set(rows.map((r) => r.skill))].map((skill) => ({
      path: `skills/${skill}/SKILL.md`,
      content: readFileSync(`skills/${skill}/SKILL.md`, 'utf8')
    }));
    for (const entry of rows) {
      assert.ok(
        findRow(entry, files),
        `${entry.skill} has no table row starting "${entry.row}"`
      );
    }
    for (const file of files) {
      const listed = rows.filter((r) => file.path.includes(`/${r.skill}/`));
      for (const repo of new Set(listed.map((r) => r.repo))) {
        for (const tableRow of tableRows(file.content)) {
          if (linkedNumbers(tableRow.text, repo).length === 0) continue;
          assert.ok(
            listed.some(
              (r) => r.repo === repo && tableRow.first.startsWith(r.row)
            ),
            `${file.path}:${tableRow.line} links ${repo} but is not under rows:`
          );
        }
      }
    }
  });
});
