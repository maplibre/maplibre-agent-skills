/**
 * Tripwires a skill trips by itself. A tripwire is a `not-` string assertion
 * (`not-icontains`, `not-regex`, and the like) that fails an answer for
 * containing a term. The model reads the injected SKILL.md before it answers
 * and repeats its words, the mistakes it warns against included, so a tripwire
 * on text the skill contains can fail an answer for following the skill. The
 * negative test is the exception: it asks an adjacent question the skill
 * should stay out of, so the skill's own words are what its tripwires catch.
 */

// How promptfoo 0.122 looks for a match for each type (handleContains through
// handleRegex in node_modules/promptfoo/dist/src/evaluator-*.js), returned as
// an index into the text, or -1. The `-any` types check each listed term.
const locate = {
  contains: (text, term) => text.indexOf(String(term)),
  icontains: (text, term) =>
    text.toLowerCase().indexOf(String(term).toLowerCase()),
  regex: (text, term) => text.search(new RegExp(term))
};
const TRIPWIRES = {
  'not-contains': { locate: locate.contains },
  'not-icontains': { locate: locate.icontains },
  'not-contains-any': { locate: locate.contains, list: true },
  'not-icontains-any': { locate: locate.icontains, list: true },
  'not-regex': { locate: locate.regex }
};

// promptfoo also reads an `-any` value written as one comma-separated string,
// where a quoted term may hold a comma; only the unquoted form is read here.
function terms(assertion) {
  const { type, value } = assertion;
  if (Array.isArray(value)) return value;
  if (String(value).includes('"')) {
    throw new Error(`write the terms of ${type} as a YAML list`);
  }
  return String(value)
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
}

// promptfoo runs the assertions of an `assert-set` like any others.
function flatten(assertions) {
  return assertions.flatMap((assertion) =>
    assertion?.type === 'assert-set'
      ? flatten(assertion.assert ?? [])
      : [assertion]
  );
}

/**
 * Every tripwire in one parsed eval config that the skill it injects already
 * trips, one entry per term: `{ test, description, type, term, skillFile,
 * line }`. `readSkill` returns a skill file's text as the grader would see it
 * in an answer, or null for a skill not written yet, which no tripwire can
 * match. Vars merge the way promptfoo merges them, a test's own over
 * `defaultTest`'s, and `defaultTest`'s assertions apply to every test.
 */
export function selfTrippedTripwires(config, { readSkill }) {
  const found = [];
  (config?.tests ?? []).forEach((test, index) => {
    const description = test.description ?? `test ${index + 1}`;
    if (/^negative\b/i.test(description)) return;
    const vars = { ...config.defaultTest?.vars, ...test.vars };
    // The comparison lib/skill-prompt.mjs makes before it injects the skill.
    if (String(vars.injectSkill).toLowerCase() === 'false') return;
    const tripwires = flatten([
      ...(config.defaultTest?.assert ?? []),
      ...(test.assert ?? [])
    ]).filter((assertion) => TRIPWIRES[assertion?.type]);
    if (tripwires.length === 0) return;
    if (!vars.skillFile) {
      throw new Error(`test ${index + 1} sets no skillFile`);
    }
    const text = readSkill(vars.skillFile);
    if (text === null) return;
    for (const assertion of tripwires) {
      const check = TRIPWIRES[assertion.type];
      for (const term of check.list ? terms(assertion) : [assertion.value]) {
        const at = check.locate(text, term);
        if (at === -1) continue;
        found.push({
          test: index + 1,
          description,
          type: assertion.type,
          term,
          skillFile: vars.skillFile,
          line: text.slice(0, at).split('\n').length
        });
      }
    }
  });
  return found;
}

/**
 * The transform the pinned provider applies to every answer before any
 * assertion reads it, run the way promptfoo 0.122 runs an inline one
 * (getInlineTransformFunction in node_modules/promptfoo/dist/src/transform-*.js):
 * one line is an expression over `output`, several lines a function body.
 * Without one, answers are graded as written.
 */
export function answerTransform(provider) {
  const code = provider?.transform;
  if (code === undefined) return (text) => text;
  if (typeof code !== 'string' || code.startsWith('file://')) {
    throw new Error(
      `cannot run the provider transform ${JSON.stringify(code)}`
    );
  }
  const run = new Function(
    'output',
    'context',
    code.includes('\n') ? code : `return ${code}`
  );
  return (text) => String(run(text, {}));
}
