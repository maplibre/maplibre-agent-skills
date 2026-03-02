#!/usr/bin/env node
import { spawnSync } from "child_process";

const result = spawnSync(
  "npx",
  ["textlint", "*.md", "skills/**/*.md"],
  { encoding: "utf8", shell: true }
);

const output = (result.stdout + result.stderr).replace(
  /Try to run: \$ textlint --fix \[file\]/g,
  "Run `npm run fix:terminology` to fix all issues automatically."
);
process.stdout.write(output);
process.exit(result.status);
