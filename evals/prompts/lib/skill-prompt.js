/**
 * Shared Promptfoo prompt function for skill evals.
 *
 * Injects the skill's SKILL.md as the system message.
 * Set vars.skillFile to the skill path relative to the repo root,
 * e.g. "skills/maplibre-tile-sources/SKILL.md".
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');

module.exports = function ({ vars }) {
  const messages = [];
  if (vars.injectSkill !== 'false') {
    const skillContent = fs.readFileSync(
      path.join(repoRoot, vars.skillFile),
      'utf8'
    );
    messages.push({ role: 'system', content: skillContent });
  }
  messages.push({ role: 'user', content: vars.prompt });
  return JSON.stringify(messages);
};
