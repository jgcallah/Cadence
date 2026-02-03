import { Command } from "commander";
import chalk from "chalk";
import {
  TemplateRegistry,
  type TemplateInfo,
  type TemplateVariableInfo,
} from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";

/**
 * Format a variable for display
 */
function formatVariable(variable: TemplateVariableInfo): string {
  const parts: string[] = [];
  parts.push(`    - ${chalk.cyan(variable.name)}`);

  if (variable.required) {
    parts.push(chalk.red(" (required)"));
  } else if (variable.default !== undefined) {
    parts.push(chalk.gray(` (default: ${JSON.stringify(variable.default)})`));
  } else {
    parts.push(chalk.gray(" (optional)"));
  }

  if (variable.description) {
    parts.push(`\n      ${chalk.gray(variable.description)}`);
  }

  return parts.join("");
}

/**
 * List all available templates
 */
const listSubcommand = new Command("list")
  .description("List all available templates")
  .action(async function (this: Command) {
    try {
      const { vaultPath, fs, configLoader } = await getVaultContext(this);
      const config = await configLoader.loadConfig(vaultPath);

      const registry = new TemplateRegistry(fs);
      registry.loadFromConfig(config.templates);

      const templates: TemplateInfo[] = await registry.list();

      if (templates.length === 0) {
        console.log(chalk.yellow("No templates found."));
        console.log(
          chalk.gray("Templates are configured in .cadence/config.json")
        );
        return;
      }

      console.log(chalk.bold("Available templates:\n"));

      for (const template of templates) {
        console.log(`  ${chalk.cyan(template.name)}`);
        if (template.description) {
          console.log(`    ${chalk.gray(template.description)}`);
        }
        console.log(`    ${chalk.gray(`Path: ${template.path}`)}`);
        console.log();
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

/**
 * Show detailed information about a template
 */
const showSubcommand = new Command("show")
  .description("Show detailed information about a template")
  .argument("<name>", "Name of the template to show")
  .action(async function (this: Command, name: string) {
    try {
      const { vaultPath, fs, configLoader } = await getVaultContext(this);
      const config = await configLoader.loadConfig(vaultPath);

      const registry = new TemplateRegistry(fs);
      registry.loadFromConfig(config.templates);

      // Check if template exists
      if (!registry.has(name)) {
        console.error(chalk.red(`Template '${name}' not found.`));
        console.log(chalk.gray("\nAvailable templates:"));
        const templates = await registry.list();
        for (const t of templates) {
          console.log(`  - ${t.name}`);
        }
        process.exit(1);
      }

      const path = registry.getPath(name);
      const metadata = await registry.getMetadata(name);
      const variables = await registry.getVariables(name);
      const content = await registry.get(name);

      // Display template info
      console.log(chalk.bold(`Template: ${chalk.cyan(name)}\n`));

      if (metadata.name) {
        console.log(`  ${chalk.gray("Display Name:")} ${metadata.name}`);
      }

      console.log(`  ${chalk.gray("Path:")} ${path}`);

      if (metadata.description) {
        console.log(`  ${chalk.gray("Description:")} ${metadata.description}`);
      }

      // Display variables
      if (variables.length > 0) {
        console.log(`\n  ${chalk.bold("Variables:")}`);
        const requiredVars = variables.filter((v) => v.required);
        const optionalVars = variables.filter((v) => !v.required);

        if (requiredVars.length > 0) {
          console.log(`\n    ${chalk.red("Required:")}`);
          for (const v of requiredVars) {
            console.log(formatVariable(v));
          }
        }

        if (optionalVars.length > 0) {
          console.log(`\n    ${chalk.gray("Optional:")}`);
          for (const v of optionalVars) {
            console.log(formatVariable(v));
          }
        }
      } else {
        console.log(
          `\n  ${chalk.gray("Variables:")} None (uses built-in variables only)`
        );
      }

      // Display preview
      console.log(`\n  ${chalk.bold("Preview:")}`);
      console.log(chalk.gray("  " + "─".repeat(50)));

      // Show first 20 lines of the template
      const lines = content.split("\n").slice(0, 20);
      for (const line of lines) {
        console.log(chalk.gray(`  ${line}`));
      }

      if (content.split("\n").length > 20) {
        console.log(chalk.gray(`  ... (${content.split("\n").length - 20} more lines)`));
      }

      console.log(chalk.gray("  " + "─".repeat(50)));
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

/**
 * Templates command group for listing and inspecting templates
 */
export const templatesCommand = new Command("templates")
  .description("Manage and inspect templates")
  .addCommand(listSubcommand)
  .addCommand(showSubcommand);
