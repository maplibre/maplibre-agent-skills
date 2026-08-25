import { appendFileSync } from 'node:fs';

// Writes key=value pairs to $GITHUB_OUTPUT (or stdout when unset, for local runs).
export function setOutputs(outputs, file = process.env.GITHUB_OUTPUT) {
  const lines = Object.entries(outputs)
    .map(([k, v]) => `${k}=${String(v)}\n`)
    .join('');
  if (file) appendFileSync(file, lines);
  else process.stdout.write(lines);
}
