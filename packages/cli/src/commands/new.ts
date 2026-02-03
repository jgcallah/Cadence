import * as path from "path";
import { Command } from "commander";
import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import {
  TemplateRegistry,
  createFromTemplate,
  type TemplateVariableInfo,
} from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";

const execAsync = promisify(exec);

/**
 * Parse --var flag values into a variables object
 * Format: key=value
 */
function parseVarFlags(varFlags: string[]): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const flag of varFlags) {
    const eqIndex = flag.indexOf("=");
    if (eqIndex === -1) {
      console.warn(
        chalk.yellow(`Warning: Invalid --var format '${flag}'. Use key=value.`)
      );
      continue;
    }

    const key = flag.substring(0, eqIndex);
    const value = flag.substring(eqIndex + 1);
    vars[key] = value;
  }

  return vars;
}

/**
 * Get the platform-specific command to open a file in the default editor/application
 */
function getOpenCommand(filePath: string): string {
  const quotedPath = `"${filePath}"`;

  switch (process.platform) {
    case "darwin":
      return `open ${quotedPath}`;
    case "win32":
      return `start "" ${quotedPath}`;
    case "linux":
    default:
      return `xdg-open ${quotedPath}`;
  }
}

/**
 * Prompt for a single variable value interactively
 */
async function promptForVariable(
  variable: TemplateVariableInfo
): Promise<string> {
  // Dynamic import for @inquirer/prompts
  const { input } = await import("@inquirer/prompts");

  let message = variable.name;
  if (variable.description) {
    message = `${variable.name} (${variable.description})`;
  }

  const hasDefault = variable.default !== undefined;
  const defaultValue = hasDefault ? String(variable.default) : "";

  const config: Parameters<typeof input>[0] = {
    message,
    validate: (value: string) => {
      if (variable.required && !value.trim()) {
        return `${variable.name} is required`;
      }
      return true;
    },
  };

  // Only set default if there is one
  if (hasDefault) {
    config.default = defaultValue;
  }

  const answer = await input(config);

  return answer;
}

/**
 * Prompt for all missing required variables
 */
async function promptForMissingVariables(
  variables: TemplateVariableInfo[],
  providedVars: Record<string, string>
): Promise<Record<string, string>> {
  const result = { ...providedVars };

  // Find missing required variables and all variables not yet provided
  const missingRequired = variables.filter(
    (v) => v.required && !(v.name in providedVars)
  );
  const missingOptional = variables.filter(
    (v) => !v.required && !(v.name in providedVars) && v.default === undefined
  );

  // Prompt for missing required variables
  if (missingRequired.length > 0) {
    console.log(chalk.bold("\nRequired variables:"));
    for (const variable of missingRequired) {
      result[variable.name] = await promptForVariable(variable);
    }
  }

  // Optionally prompt for optional variables without defaults
  if (missingOptional.length > 0) {
    console.log(chalk.gray("\nOptional variables (press Enter to skip):"));
    for (const variable of missingOptional) {
      const value = await promptForVariable(variable);
      if (value.trim()) {
        result[variable.name] = value;
      }
    }
  }

  return result;
}

/**
 * Check if running in interactive mode (TTY)
 */
function isInteractive(): boolean {
  return process.stdin.isTTY;
}

interface NewCommandOptions {
  title?: string;
  date?: string;
  output?: string;
  var?: string[];
  open?: boolean;
}

/**
 * Create a new note from a template
 */
export const newCommand = new Command("new")
  .description("Create a new note from a template")
  .argument("<template>", "Name of the template to use")
  .option("--title <title>", "Title for the new note")
  .option("--date <date>", "Date for the new note")
  .option("--output <path>", "Output path for the new note (relative to vault)")
  .option(
    "--var <key=value>",
    "Set a template variable (can be used multiple times)",
    (value: string, previous: string[]) => [...previous, value],
    []
  )
  .option("--open", "Open the created note in the default editor")
  .action(async function (
    this: Command,
    templateName: string,
    options: NewCommandOptions
  ) {
    try {
      const { vaultPath, fs, configLoader } = await getVaultContext(this);
      const config = await configLoader.loadConfig(vaultPath);

      // Set up the template registry
      const registry = new TemplateRegistry(fs);
      registry.loadFromConfig(config.templates);

      // Check if template exists
      if (!registry.has(templateName)) {
        console.error(chalk.red(`Template '${templateName}' not found.`));
        console.log(chalk.gray("\nAvailable templates:"));
        const templates = await registry.list();
        for (const t of templates) {
          console.log(`  - ${t.name}`);
        }
        process.exit(1);
      }

      // Get template variables
      const templateVars = await registry.getVariables(templateName);

      // Build initial variables from flags
      let variables: Record<string, string> = {};

      // Parse --var flags
      if (options.var && options.var.length > 0) {
        variables = parseVarFlags(options.var);
      }

      // Add named flags to variables
      if (options.title) {
        variables["title"] = options.title;
      }
      if (options.date) {
        variables["date"] = options.date;
      }

      // Check if we have all required variables
      const missingRequired = templateVars.filter(
        (v) => v.required && !(v.name in variables)
      );

      // If missing required variables and interactive, prompt
      if (missingRequired.length > 0) {
        if (isInteractive()) {
          variables = await promptForMissingVariables(templateVars, variables);
        } else {
          console.error(
            chalk.red("Missing required variables: ") +
              missingRequired.map((v) => v.name).join(", ")
          );
          console.log(
            chalk.gray(
              "\nProvide them with --var name=value or run interactively."
            )
          );
          process.exit(1);
        }
      }

      // Determine output path
      let outputPath: string;

      if (options.output) {
        // Use provided output path
        outputPath = path.isAbsolute(options.output)
          ? options.output
          : path.join(vaultPath, options.output);
      } else {
        // Generate a default path based on template name and title/date
        const title = variables["title"] || templateName;
        const safeTitle = title.replace(/[/\\?%*:|"<>]/g, "-");
        const dateStr =
          variables["date"] ||
          new Date().toISOString().split("T")[0];

        // Default to a Notes folder with template name subfolder
        outputPath = path.join(
          vaultPath,
          "Notes",
          templateName,
          `${dateStr}-${safeTitle}.md`
        );
      }

      // Ensure .md extension
      if (!outputPath.endsWith(".md")) {
        outputPath += ".md";
      }

      // Create the note from template
      const note = await createFromTemplate(templateName, outputPath, variables, {
        fs,
        registry,
      });

      // Output the created path
      console.log(note.path);

      // Open in editor if requested
      if (options.open) {
        const openCmd = getOpenCommand(note.path);
        await execAsync(openCmd);
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
