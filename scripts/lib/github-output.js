import { appendFileSync } from 'node:fs';

// A value with a newline in it has to be written as a heredoc; `key=value` would
// leave the runner reading only its first line.
const DELIMITER = 'GITHUB_OUTPUT_EOF';

// Writes key=value pairs to $GITHUB_OUTPUT (or stdout when unset, for local runs).
export function setOutputs(outputs, file = process.env.GITHUB_OUTPUT) {
  const lines = Object.entries(outputs)
    .map(([k, v]) => {
      const value = String(v);
      if (!value.includes('\n')) return `${k}=${value}\n`;
      if (value.includes(DELIMITER)) {
        throw new Error(
          `Output "${k}" contains the heredoc delimiter ${DELIMITER}`
        );
      }
      return `${k}<<${DELIMITER}\n${value}\n${DELIMITER}\n`;
    })
    .join('');
  if (file) appendFileSync(file, lines);
  else process.stdout.write(lines);
}
