#!/usr/bin/env node

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Validates that all skills have proper SKILL.md files with required YAML frontmatter.
 * Skill directory names must match the frontmatter "name" field (e.g. maplibre-tile-sources).
 */
async function validateSkills() {
  const skillsDir = 'skills';
  let hasErrors = false;

  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const skillDirs = entries.filter((entry) => entry.isDirectory());

    if (skillDirs.length === 0) {
      console.error('❌ No skill directories found in skills/');
      process.exit(1);
    }

    console.log(`Found ${skillDirs.length} skill directories\n`);

    for (const dir of skillDirs) {
      const skillName = dir.name;
      const skillPath = join(skillsDir, skillName);
      const skillFile = join(skillPath, 'SKILL.md');

      console.log(`Validating ${skillName}...`);

      try {
        const content = await readFile(skillFile, 'utf-8');

        if (!content.startsWith('---\n')) {
          console.error(`  ❌ Missing YAML frontmatter (must start with ---)`);
          hasErrors = true;
          continue;
        }

        const frontmatterEnd = content.indexOf('\n---\n', 4);
        if (frontmatterEnd === -1) {
          console.error(
            `  ❌ Malformed YAML frontmatter (missing closing ---)`
          );
          hasErrors = true;
          continue;
        }

        const frontmatter = content.substring(4, frontmatterEnd);
        const body = content.substring(frontmatterEnd + 5).trim();

        const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
        const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

        if (!nameMatch) {
          console.error(`  ❌ Missing required field: name`);
          hasErrors = true;
        } else {
          const name = nameMatch[1].trim();
          if (name !== skillName) {
            console.error(
              `  ❌ Skill name mismatch: directory is "${skillName}" but YAML name is "${name}"`
            );
            hasErrors = true;
          }
        }

        if (!descMatch) {
          console.error(`  ❌ Missing required field: description`);
          hasErrors = true;
        }

        if (body.length === 0) {
          console.error(`  ❌ No content found after YAML frontmatter`);
          hasErrors = true;
        }

        if (!hasErrors) {
          console.log(`  ✅ Valid`);
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.error(`  ❌ Missing SKILL.md file`);
        } else {
          console.error(`  ❌ Error reading file: ${error.message}`);
        }
        hasErrors = true;
      }

      console.log('');
    }

    if (hasErrors) {
      console.error('❌ Skill validation failed');
      process.exit(1);
    }

    console.log('✅ All skills are valid');
  } catch (error) {
    console.error(`❌ Error reading skills directory: ${error.message}`);
    process.exit(1);
  }
}

validateSkills();
