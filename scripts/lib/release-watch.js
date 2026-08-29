/**
 * Pure functions behind the release watch (`scripts/release-watch.js`).
 *
 * The job: given an upstream release body, decide which of its notes announce a
 * removal, rename, or deprecation, pull the machine-readable names out of those
 * notes, and report where those names still appear in our skill files. Nothing
 * here talks to the network or the filesystem, so it can all be tested against
 * fixture release bodies.
 *
 * The rules below were written against real release bodies (MapLibre GL JS v6,
 * Martin, planetiler, tippecanoe), not against an idea of what a release body
 * looks like. The important finding: GL JS does not put its breaking changes
 * under a "Breaking changes" heading. It marks individual bullets with a warning
 * emoji and leaves them under "Features and improvements". A heading-only reader
 * would have missed the v6 UMD removal entirely, which is the case this exists
 * to catch.
 */

/** Headings whose section is read as breaking. Matched on the lowercased heading text. */
const BREAKING_HEADING_WORDS = [
  'breaking',
  'removed',
  'removal',
  'deprecat',
  'incompatib',
  'migration'
];

/**
 * Per-bullet markers that make a single note breaking wherever it sits. GL JS
 * and the style spec use the warning emoji; planetiler prefixes the bullet with
 * `[breaking]`. The word forms are compared lowercased.
 */
const BREAKING_MARKERS = [
  '⚠',
  '💥',
  'breaking change',
  'breaking:',
  '[breaking]'
];

/**
 * Fixed phrases that make a note breaking on their own. A fixed list, not a
 * guess at verb forms: a note has to say one of these things to be picked up,
 * which keeps a routine "improve X" bullet from being read as a removal.
 */
const REMOVAL_PHRASES = [
  'no longer published',
  'no longer supported',
  'no longer available',
  'no longer required',
  'has been removed',
  'have been removed',
  'was removed',
  'were removed',
  'is removed',
  'are removed',
  'support has been removed',
  'dropped support',
  'is deprecated',
  'are deprecated',
  'now deprecated',
  'has been renamed',
  'have been renamed',
  'renamed to',
  'replaced by',
  'must switch to',
  // A removal verb directly before a code span is how a note names what went:
  // "Remove `waitForCompletion`", "rename `mbgl` namespace to `mln`".
  'remove `',
  'removed `',
  'removes `',
  'rename `',
  'renamed `',
  'renames `',
  'drop `',
  'dropped `',
  'drops `',
  'deprecate `',
  'deprecated `',
  'deprecates `'
];

/**
 * Names too common in this ecosystem to discriminate: every skill mentions them,
 * so a hit on one says nothing. Kept short and explicit rather than tuned.
 */
const GENERIC_IDENTIFIERS = new Set([
  'maplibre',
  'maplibre-gl',
  'mapbox',
  'mapbox-gl',
  'pmtiles',
  'martin',
  'style.json',
  'https',
  'http',
  'import',
  'export',
  'require',
  'return',
  'const',
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'function',
  'undefined',
  'null',
  'true',
  'false',
  'default'
]);

const MIN_IDENTIFIER_LENGTH = 5;

/**
 * A bare word this short or shorter has to earn its place some other way. A
 * rename note names the surrounding types as context (`Map`, `Camera`, `Style`,
 * `Marker`), and matching those floods the report with lines that are still
 * correct. A name carrying `.`, `-`, `_`, `/` or `=` is specific enough on its
 * own (`map.transform`, `maplibre-gl.js`, `--tile-format=mlt`); a plain word has
 * to be long enough to be unmistakable (`styleimagemissing`, `MapDataEvent`).
 */
const MIN_BARE_WORD_LENGTH = 12;

/** Hits per issue. Past this the report stops being readable; a local dry run prints them all. */
export const MAX_HITS = 60;

function headingLevel(line) {
  const match = /^(#{1,6})\s+(.*)$/.exec(line);
  return match ? { level: match[1].length, text: match[2].trim() } : null;
}

function isBreakingHeading(text) {
  const lowered = text.toLowerCase();
  return BREAKING_HEADING_WORDS.some((word) => lowered.includes(word));
}

function isListItem(line) {
  return /^ {0,3}[-*+]\s+/.test(line);
}

/**
 * Splits a release body into notes: one per top-level list item (continuation
 * lines folded in) plus, inside a breaking section, each prose paragraph. Each
 * note carries the heading it sat under so the issue can quote its context.
 */
export function splitNotes(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const notes = [];
  let heading = '';
  let breakingSection = false;
  let breakingLevel = 0;
  let current = null;

  const flush = () => {
    if (current && current.text.trim()) notes.push(current);
    current = null;
  };

  for (const line of lines) {
    const h = headingLevel(line);
    if (h) {
      flush();
      heading = h.text;
      if (isBreakingHeading(h.text)) {
        breakingSection = true;
        breakingLevel = h.level;
      } else if (breakingSection && h.level <= breakingLevel) {
        breakingSection = false;
      }
      continue;
    }

    if (isListItem(line)) {
      flush();
      current = {
        heading,
        inBreakingSection: breakingSection,
        text: line.replace(/^ {0,3}[-*+]\s+/, '').trim()
      };
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    if (current) {
      current.text += ' ' + line.trim();
    } else if (breakingSection) {
      current = { heading, inBreakingSection: true, text: line.trim() };
    }
  }
  flush();
  return notes;
}

export function isBreakingNote(note) {
  if (note.inBreakingSection) return true;
  const lowered = note.text.toLowerCase();
  if (BREAKING_MARKERS.some((marker) => lowered.includes(marker))) return true;
  return REMOVAL_PHRASES.some((phrase) => lowered.includes(phrase));
}

/** The notes in a release body that announce a removal, rename, or deprecation. */
export function breakingNotes(body) {
  const seen = new Set();
  return splitNotes(body)
    .filter(isBreakingNote)
    .filter((note) => {
      if (seen.has(note.text)) return false;
      seen.add(note.text);
      return true;
    });
}

function isUsefulIdentifier(token) {
  if (token.length < MIN_IDENTIFIER_LENGTH) return false;
  if (!/[A-Za-z]/.test(token)) return false;
  if (/^v?\d/.test(token)) return false; // version numbers, not names
  if (token.includes('://')) return false; // URLs, matched by their own text elsewhere
  if (!/[.\-_/=]/.test(token) && token.length < MIN_BARE_WORD_LENGTH) {
    return false;
  }
  return !GENERIC_IDENTIFIERS.has(token.toLowerCase());
}

/**
 * Pulls searchable terms out of a note's inline code spans, and only out of
 * those: a code span is the release author explicitly marking a machine-readable
 * name, while prose words match far too much to be worth a maintainer's time.
 *
 * A span containing whitespace is a snippet, kept whole and matched verbatim
 * (`import maplibregl from 'maplibre-gl'`). A span without whitespace is an
 * identifier (`maplibre-gl.js`, `--tile-format=mlt`) and is matched on word
 * boundaries, after dropping the too-generic and version-like ones.
 *
 * Known limitation: a note that quotes both the removed form and its
 * replacement yields both, so corrected content can still match on the
 * replacement. Nothing in the prose separates the two mechanically, and the
 * report is explicit that its matches are matches, not defects.
 */
export function extractTerms(text) {
  const spans = [...String(text ?? '').matchAll(/`([^`\n]+)`/g)].map((m) =>
    m[1].trim()
  );
  const terms = [];
  const seen = new Set();
  for (const span of spans) {
    if (!span) continue;
    const kind = /\s/.test(span) ? 'phrase' : 'identifier';
    if (kind === 'identifier' && !isUsefulIdentifier(span)) continue;
    if (seen.has(span)) continue;
    seen.add(span);
    terms.push({ value: span, kind });
  }
  return terms;
}

const BOUNDARY = /[A-Za-z0-9_]/;

/** True when `term` occurs in `line`; identifiers additionally require word boundaries. */
export function lineMatches(line, term) {
  if (term.kind === 'phrase') return line.includes(term.value);
  let from = 0;
  for (;;) {
    const at = line.indexOf(term.value, from);
    if (at === -1) return false;
    const before = at === 0 ? '' : line[at - 1];
    const after = line[at + term.value.length] ?? '';
    if (!BOUNDARY.test(before) && !BOUNDARY.test(after)) return true;
    from = at + 1;
  }
}

/**
 * Class A hits: for each breaking note in a release, every skill line that still
 * contains one of its terms.
 *
 * `files` is `[{ path, content }]`. Returns `[{ note, term, path, line, text }]`.
 */
export function findHits(body, files) {
  const hits = [];
  for (const note of breakingNotes(body)) {
    for (const term of extractTerms(note.text)) {
      for (const file of files) {
        const lines = file.content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (!lineMatches(lines[i], term)) continue;
          hits.push({
            note: note.text,
            heading: note.heading,
            term: term.value,
            kind: term.kind,
            path: file.path,
            line: i + 1,
            text: lines[i].trim()
          });
        }
      }
    }
  }
  return hits;
}

/** The stable per-release marker that makes a rerun idempotent. */
export function issueMarker(repo, tag) {
  return `<!-- release-watch: ${repo}@${tag} -->`;
}

export function issueTitle(repo, tag) {
  return `Release watch: ${repo} ${tag} may contradict skill content`;
}

function groupBy(hits, key) {
  const map = new Map();
  for (const hit of hits) {
    const k = key(hit);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(hit);
  }
  return map;
}

/**
 * The issue body: what the release says, and what our files contain. It reports
 * those two facts and stops — it never asserts that a model gets something
 * wrong, and it never proposes an edit.
 */
export function issueBody({ repo, tag, url, publishedAt, hits, runUrl }) {
  const shown = hits.slice(0, MAX_HITS);
  const out = [
    issueMarker(repo, tag),
    '',
    `[${repo} ${tag}](${url}) was published on ${publishedAt.slice(0, 10)}. Its release notes announce a removal, rename, or deprecation whose name still appears in this repository's skill content.`,
    '',
    'These are string matches, not verified defects. Each one is either content to correct, or a mention that is still accurate in context — a maintainer decides which.',
    ''
  ];

  for (const [note, noteHits] of groupBy(shown, (h) => h.note)) {
    out.push('### Release note', '', `> ${note.replace(/\n/g, ' ')}`, '');
    out.push('Still present in:', '');
    for (const [path, pathHits] of groupBy(noteHits, (h) => h.path)) {
      for (const hit of pathHits) {
        out.push(`- \`${path}:${hit.line}\` — matches \`${hit.term}\``);
      }
    }
    out.push('');
  }

  if (hits.length > shown.length) {
    out.push(
      `_${hits.length - shown.length} further match(es) not listed. For the full list run \`node scripts/release-watch.js --dry-run --repo ${repo} --tag ${tag}\` locally._`,
      ''
    );
  }

  out.push(
    '### Scope',
    '',
    'This is a Class A report only: a release note said a name is going away, and that name is still in our files. It does not cover new features a model may not know about (Class B) or content a newer model may already get right (Class C).',
    ''
  );

  // Class B triage blocks belong here once the gap-intake pipeline defines its
  // schema. Until that schema exists there is nothing to conform to, and
  // inventing one would produce output no pipeline can read.

  if (runUrl) out.push(`[Workflow run](${runUrl})`, '');
  return out.join('\n');
}

/**
 * The watch list's YAML, in the restricted subset `.github/release-watch/watch.yml`
 * is written in: a `watch:` key holding a list of entries, each a flat map of
 * scalars. A quoted value may continue onto following indented lines, which is
 * how Prettier folds a long one. Deliberately not a general YAML parser — this
 * repository takes no runtime dependencies, and the file it reads is one we
 * control.
 */
export function parseWatchList(source) {
  const entries = [];
  let inWatch = false;
  let current = null;
  let lastKey = null;

  for (const raw of String(source ?? '').split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    if (/^watch:\s*$/.test(line)) {
      inWatch = true;
      continue;
    }
    if (!inWatch) continue;
    if (/^\S/.test(line)) break; // a new top-level key ends the list

    const item = /^\s*-\s*(.*)$/.exec(line);
    const text = item ? item[1] : line.trim();
    if (item) {
      current = {};
      entries.push(current);
      lastKey = null;
    }
    if (!current || !text) continue;

    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(text);
    if (pair) {
      lastKey = pair[1];
      current[lastKey] = pair[2].trim();
    } else if (lastKey) {
      current[lastKey] = `${current[lastKey]} ${text}`.trim();
    }
  }

  return entries
    .map((entry) =>
      Object.fromEntries(
        Object.entries(entry).map(([key, value]) => [key, scalar(value)])
      )
    )
    .filter((entry) => entry.repo);
}

function scalar(value) {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    value = value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/**
 * The releases worth looking at: published, not a draft or prerelease (a
 * prerelease is how tippecanoe publishes per-commit test builds), newer than the
 * watermark, oldest first so a missed week catches up in order.
 */
export function selectReleases(releases, watermark) {
  const since = watermark?.published_at
    ? Date.parse(watermark.published_at)
    : 0;
  return (releases ?? [])
    .filter((r) => !r.draft && !r.prerelease && r.published_at)
    .filter((r) => Date.parse(r.published_at) > since)
    .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));
}
