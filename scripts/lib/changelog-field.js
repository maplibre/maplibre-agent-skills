const VALID_BUMPS = new Set(['none', 'patch', 'minor', 'major']);
const VALID_CATEGORIES = ['Added', 'Changed', 'Fixed', 'Removed', 'Internal'];
const CATEGORY_SET = new Set(VALID_CATEGORIES.map((c) => c.toLowerCase()));
const BUMP_ORDER = { patch: 1, minor: 2, major: 3 };

// Repeat until nothing changes: a single pass over "<!<!-- a -->--" leaves
// "<!--" behind (CodeQL js/incomplete-multi-character-sanitization).
function stripHtmlComments(text) {
  let stripped = text;
  let previous;
  do {
    previous = stripped;
    stripped = stripped.replace(/<!--[\s\S]*?-->/g, '');
  } while (stripped !== previous);
  return stripped;
}

function parseLine(text, key) {
  for (const line of text.split('\n')) {
    const cleaned = line.replace(/\*\*/g, '').trim();
    const match = cleaned.match(new RegExp(`^${key}:\\s*(.+)`, 'i'));
    if (match) return match[1].trim();
  }
  return null;
}

function parseChangelogField(body) {
  if (!body) {
    return { errors: ['PR body is empty.'] };
  }

  const stripped = stripHtmlComments(body);
  const errors = [];

  const bumpRaw = parseLine(stripped, 'Bump');
  if (bumpRaw === null) {
    errors.push(
      'Missing Bump field. Expected: Bump: none | patch | minor | major'
    );
    return { errors };
  }

  const bump = bumpRaw.toLowerCase();
  if (!VALID_BUMPS.has(bump)) {
    errors.push(
      `Invalid Bump "${bumpRaw}". Expected: none, patch, minor, major.`
    );
    return { errors };
  }

  if (bump === 'none') {
    return { bump, category: null, entry: null, errors: [] };
  }

  const entryRaw = parseLine(stripped, 'Entry');
  const categoryRaw = parseLine(stripped, 'Category');

  if (entryRaw === null) errors.push('Bump is not none — Entry is required.');
  if (categoryRaw === null) {
    errors.push('Bump is not none — Category is required.');
  } else if (!CATEGORY_SET.has(categoryRaw.toLowerCase())) {
    errors.push(
      `Invalid Category "${categoryRaw}". Expected: ${VALID_CATEGORIES.join(', ')}.`
    );
  }

  if (errors.length > 0) return { errors };

  const category = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === categoryRaw.toLowerCase()
  );
  return { bump, category, entry: entryRaw, errors: [] };
}

export {
  parseChangelogField,
  VALID_BUMPS,
  VALID_CATEGORIES,
  BUMP_ORDER,
  CATEGORY_SET
};
