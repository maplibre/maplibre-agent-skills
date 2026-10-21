/**
 * When each skill last got a verdict, read from the dated CSVs a scheduled run
 * commits to evals/results/: `<date>-<skill>.csv`, and `-retry` beside it.
 *
 * A run counts only when it graded every test: each test's Description has a
 * PASS or FAIL row in that day's CSVs, the re-run's included. A run that ended
 * with a test in ERROR graded nothing for that skill, so the skill keeps its
 * place in line instead of waiting as though it had been checked.
 */

/**
 * The rows of a CSV as arrays of fields, per RFC 4180: a quoted field can hold
 * commas, newlines, and `""` for a quote, which every answer column does.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Whether one day's CSVs for a skill gave every test a PASS or FAIL. */
function gradedEveryTest(texts) {
  const graded = new Map();
  for (const text of texts) {
    const [header, ...rows] = parseCsv(text);
    const description = header?.indexOf('Description') ?? -1;
    const status = header?.indexOf('Status') ?? -1;
    if (description < 0 || status < 0) return false;
    for (const row of rows) {
      const verdict = row[status] === 'PASS' || row[status] === 'FAIL';
      graded.set(row[description], graded.get(row[description]) || verdict);
    }
  }
  return graded.size > 0 && [...graded.values()].every(Boolean);
}

/**
 * The day each skill last got a verdict. `fileNames` lists evals/results/, and
 * `read(fileName)` returns one file's text; only the newest days are read, back
 * to the first that graded every test. Baseline CSVs don't count.
 */
export function lastGraded(fileNames, read) {
  const days = new Map();
  for (const fileName of fileNames) {
    const match = /^(\d{4}-\d{2}-\d{2})-(.+?)(?:-retry)?\.csv$/.exec(fileName);
    if (!match) continue;
    const [, date, skill] = match;
    const byDate = days.get(skill) ?? new Map();
    byDate.set(date, [...(byDate.get(date) ?? []), fileName]);
    days.set(skill, byDate);
  }
  const last = new Map();
  for (const [skill, byDate] of days) {
    for (const date of [...byDate.keys()].sort().reverse()) {
      if (gradedEveryTest(byDate.get(date).map(read))) {
        last.set(skill, date);
        break;
      }
    }
  }
  return last;
}
