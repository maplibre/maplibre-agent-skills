#!/usr/bin/env node
import { spawnSync } from 'child_process';

const result = spawnSync('npx', ['prettier', '--check', '**/*.{md,json,js}'], {
  encoding: 'utf8',
  shell: true
});

const output = (result.stdout + result.stderr).replace(
  /Run Prettier with --write to fix\./g,
  'Run `npm run format` to fix.'
);
process.stdout.write(output);
process.exit(result.status);
