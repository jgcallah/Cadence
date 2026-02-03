import { Command } from "commander";
import chalk from "chalk";
import { NodeFileSystem, ConfigLoader, getDefaultConfig, type GenerateConfigOptions } from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultOption } from "../utils/vault.js";
import { logger } from "../utils/logger.js";

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

      if (options.dryRun) {
        console.log(chalk.bold.yellow("DRY RUN - No changes will be made"));
        console.log();

        // Check if config already exists
        const exists = await fs.exists(configPath);
        if (exists && !options.force) {
          console.log(chalk.red("✗"), `Config already exists at ${configPath}`);
          console.log(chalk.gray("  Use --force to overwrite"));
          return;
        }

        // Show what would be created
        console.log(chalk.bold("Would create:"));
        console.log();
        console.log(chalk.cyan("  .cadence/config.json"));
        console.log();

        // Show the default config that would be written
        const defaultConfig = getDefaultConfig();
        console.log(chalk.bold("With content:"));
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

      console.log(chalk.green("✓"), `Initialized Cadence in ${vaultPath}`);
      console.log(chalk.gray(`  Created .cadence/config.json`));
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
