import { Command } from "commander";
import chalk from "chalk";
import { NodeFileSystem, ConfigLoader, getDefaultConfig, type GenerateConfigOptions } from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultOption } from "../utils/vault.js";
import { logger } from "../utils/logger.js";

/**
 * Default template content for each note type
 */
const DEFAULT_TEMPLATES: Record<string, string> = {
  daily: `---
type: daily
created: "{{date}}"
---
# {{periodLabel}}

Parent: {{parentNote}}

## Tasks

## Notes

## Reflection
`,
  weekly: `---
type: weekly
created: "{{date}}"
---
# {{periodLabel}}

Parent: {{parentNote}}

## Goals

## Review

## Notes
`,
  monthly: `---
type: monthly
created: "{{date}}"
---
# {{periodLabel}}

Parent: {{parentNote}}

## Objectives

## Review

## Notes
`,
  quarterly: `---
type: quarterly
created: "{{date}}"
---
# {{periodLabel}}

Parent: {{parentNote}}

## Goals

## Review

## Notes
`,
  yearly: `---
type: yearly
created: "{{date}}"
---
# {{periodLabel}}

## Vision

## Goals

## Review
`,
};

export const initCommand = new Command("init")
  .description("Initialize a vault with Cadence configuration")
  .option("--force", "Overwrite existing configuration")
  .option("--dry-run", "Show what would be created without making changes")
  .action(async function (this: Command, options: { force?: boolean; dryRun?: boolean }) {
    try {
      const fs = new NodeFileSystem();
      const explicitVault = getVaultOption(this);

      // Use explicit vault path or current directory
      const vaultPath = explicitVault ?? process.cwd();
      logger.debug(`Vault path: ${vaultPath}`);

      const configPath = `${vaultPath}/.cadence/config.json`;

      const defaultConfig = getDefaultConfig();
      const templatesDir = `${vaultPath}/${defaultConfig.paths.templates}`;

      if (options.dryRun) {
        console.log(chalk.bold.yellow("DRY RUN - No changes will be made"));
        console.log();

        // Check if config already exists
        const configExists = await fs.exists(configPath);
        if (configExists && !options.force) {
          console.log(chalk.red("✗"), `Config already exists at ${configPath}`);
          console.log(chalk.gray("  Use --force to overwrite"));
          return;
        }

        // Show what would be created
        console.log(chalk.bold("Would create:"));
        console.log();
        console.log(chalk.cyan("  .cadence/config.json"));

        // Show template files that would be created
        for (const [, templatePath] of Object.entries(defaultConfig.templates)) {
          const fullPath = `${vaultPath}/${templatePath}`;
          const templateExists = await fs.exists(fullPath);
          if (!templateExists || options.force) {
            console.log(chalk.cyan(`  ${templatePath}`));
          } else {
            console.log(chalk.gray(`  ${templatePath} (already exists, skipping)`));
          }
        }
        console.log();

        // Show the default config that would be written
        console.log(chalk.bold("Config content:"));
        console.log();
        const configJson = JSON.stringify(defaultConfig, null, 2);
        const lines = configJson.split("\n");
        for (const line of lines) {
          console.log(chalk.green(`  + ${line}`));
        }
        return;
      }

      const configLoader = new ConfigLoader(fs);
      const generateOptions: GenerateConfigOptions = {};
      if (options.force) {
        generateOptions.force = true;
      }
      await configLoader.generateDefaultConfigFile(vaultPath, generateOptions);

      // Create templates directory
      await fs.mkdir(templatesDir, true);

      // Create template files
      const createdTemplates: string[] = [];
      const skippedTemplates: string[] = [];

      for (const [name, templatePath] of Object.entries(defaultConfig.templates)) {
        const fullPath = `${vaultPath}/${templatePath}`;
        const templateExists = await fs.exists(fullPath);

        if (!templateExists || options.force) {
          const templateContent = DEFAULT_TEMPLATES[name];
          if (templateContent) {
            await fs.writeFile(fullPath, templateContent);
            createdTemplates.push(templatePath);
          }
        } else {
          skippedTemplates.push(templatePath);
        }
      }

      console.log(chalk.green("✓"), `Initialized Cadence in ${vaultPath}`);
      console.log(chalk.gray(`  Created .cadence/config.json`));

      if (createdTemplates.length > 0) {
        console.log(chalk.gray(`  Created templates:`));
        for (const template of createdTemplates) {
          console.log(chalk.gray(`    - ${template}`));
        }
      }

      if (skippedTemplates.length > 0) {
        console.log(chalk.gray(`  Skipped existing templates:`));
        for (const template of skippedTemplates) {
          console.log(chalk.gray(`    - ${template}`));
        }
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
