import { Command } from "commander";
import chalk from "chalk";
import {
  NodeFileSystem,
  resolveVault,
  ConfigLoader,
  TemplateRegistry,
  type CadenceConfig,
  VaultNotFoundError,
  ConfigNotFoundError,
  ConfigValidationError,
} from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultOption } from "../utils/vault.js";
import { logger } from "../utils/logger.js";

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
  suggestion?: string;
}

interface DoctorReport {
  vaultPath: string | null;
  checks: CheckResult[];
  summary: {
    ok: number;
    warnings: number;
    errors: number;
  };
}

/**
 * Format a check result for terminal display.
 */
function formatCheckResult(result: CheckResult): string {
  const statusIcons = {
    ok: chalk.green("✓"),
    warn: chalk.yellow("⚠"),
    error: chalk.red("✗"),
  };

  const icon = statusIcons[result.status];
  const name = chalk.bold(result.name);
  let output = `${icon} ${name}: ${result.message}`;

  if (result.suggestion) {
    output += `\n   ${chalk.gray(`→ ${result.suggestion}`)}`;
  }

  return output;
}

/**
 * Check if vault can be resolved.
 */
async function checkVault(
  fs: NodeFileSystem,
  explicitVault?: string
): Promise<{ vaultPath: string | null; result: CheckResult }> {
  logger.debug("Checking vault resolution...");

  try {
    const resolveOptions = explicitVault ? { explicit: explicitVault } : {};
    const vaultPath = await resolveVault(fs, resolveOptions);

    return {
      vaultPath,
      result: {
        name: "Vault Resolution",
        status: "ok",
        message: `Found vault at ${vaultPath}`,
      },
    };
  } catch (error) {
    if (error instanceof VaultNotFoundError) {
      return {
        vaultPath: null,
        result: {
          name: "Vault Resolution",
          status: "error",
          message: "Could not find a Cadence vault",
          suggestion:
            "Run 'cadence init' to initialize a vault in the current directory, or specify --vault <path>",
        },
      };
    }
    throw error;
  }
}

/**
 * Get the templates directory path from config.
 */
function getTemplatesDirectory(config: CadenceConfig): string {
  // Access using index signature for exactOptionalPropertyTypes compatibility
  return (config.templates as Record<string, string>)["directory"] ?? ".cadence/templates";
}

/**
 * Check if config file exists and is valid.
 */
async function checkConfig(
  configLoader: ConfigLoader,
  vaultPath: string
): Promise<{ config: CadenceConfig | null; result: CheckResult }> {
  logger.debug("Checking configuration...");

  try {
    const config = await configLoader.loadConfig(vaultPath);
    return {
      config,
      result: {
        name: "Configuration",
        status: "ok",
        message: "Config file is valid",
      },
    };
  } catch (error) {
    if (error instanceof ConfigNotFoundError) {
      return {
        config: null,
        result: {
          name: "Configuration",
          status: "error",
          message: "Config file not found",
          suggestion:
            "Run 'cadence init' to create a default configuration file",
        },
      };
    }
    if (error instanceof ConfigValidationError) {
      return {
        config: null,
        result: {
          name: "Configuration",
          status: "error",
          message: `Invalid configuration: ${error.message}`,
          suggestion: "Check your .cadence/config.json for syntax errors",
        },
      };
    }
    throw error;
  }
}

/**
 * Check if required directories exist.
 */
async function checkDirectories(
  fs: NodeFileSystem,
  vaultPath: string,
  config: CadenceConfig
): Promise<CheckResult[]> {
  logger.debug("Checking directories...");

  const results: CheckResult[] = [];
  const paths = config.paths;

  // Check each note type directory
  const noteTypes = [
    { name: "Daily", path: paths.daily },
    { name: "Weekly", path: paths.weekly },
    { name: "Monthly", path: paths.monthly },
    { name: "Quarterly", path: paths.quarterly },
    { name: "Yearly", path: paths.yearly },
  ];

  for (const { name, path } of noteTypes) {
    // Extract base directory from path pattern
    const baseDir = path.split("/")[0];
    if (!baseDir) continue;

    const fullPath = `${vaultPath}/${baseDir}`;
    const exists = await fs.exists(fullPath);

    if (exists) {
      results.push({
        name: `${name} Directory`,
        status: "ok",
        message: `Directory exists: ${baseDir}/`,
      });
    } else {
      results.push({
        name: `${name} Directory`,
        status: "warn",
        message: `Directory not found: ${baseDir}/`,
        suggestion: `Will be created automatically when you create your first ${name.toLowerCase()} note`,
      });
    }
  }

  return results;
}

/**
 * Check if templates directory exists and has templates.
 */
async function checkTemplates(
  fs: NodeFileSystem,
  vaultPath: string,
  config: CadenceConfig
): Promise<CheckResult[]> {
  logger.debug("Checking templates...");

  const results: CheckResult[] = [];
  const templatesDirectory = getTemplatesDirectory(config);
  const templatesDir = `${vaultPath}/${templatesDirectory}`;

  const dirExists = await fs.exists(templatesDir);

  if (!dirExists) {
    results.push({
      name: "Templates Directory",
      status: "warn",
      message: `Templates directory not found: ${templatesDirectory}/`,
      suggestion:
        "Create a templates directory to use custom templates with 'cadence new'",
    });
    return results;
  }

  results.push({
    name: "Templates Directory",
    status: "ok",
    message: `Found templates directory: ${templatesDirectory}/`,
  });

  // Check for template files by loading from config
  try {
    const registry = new TemplateRegistry(fs);
    registry.loadFromConfig(config.templates);
    const templates = await registry.list();

    if (templates.length === 0) {
      results.push({
        name: "Template Files",
        status: "warn",
        message: "No template files found",
        suggestion: `Add .md template files to ${templatesDirectory}/`,
      });
    } else {
      results.push({
        name: "Template Files",
        status: "ok",
        message: `Found ${templates.length} template(s): ${templates.map((t) => t.name).join(", ")}`,
      });
    }
  } catch (error) {
    results.push({
      name: "Template Files",
      status: "error",
      message: `Error loading templates: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return results;
}

/**
 * Check tasks configuration.
 */
function checkTasksConfig(config: CadenceConfig): CheckResult {
  logger.debug("Checking tasks configuration...");

  const tasks = config.tasks;

  if (tasks.scanDaysBack < 1) {
    return {
      name: "Tasks Configuration",
      status: "error",
      message: "Invalid scanDaysBack value (must be >= 1)",
      suggestion: "Set tasks.scanDaysBack to a positive integer in config",
    };
  }

  if (tasks.staleAfterDays < 1) {
    return {
      name: "Tasks Configuration",
      status: "warn",
      message: "staleAfterDays is less than 1",
      suggestion: "Consider setting a reasonable stale threshold (e.g., 3-7 days)",
    };
  }

  return {
    name: "Tasks Configuration",
    status: "ok",
    message: `Tasks configured (scan: ${tasks.scanDaysBack}d, stale: ${tasks.staleAfterDays}d)`,
  };
}

/**
 * Check sections configuration.
 */
function checkSectionsConfig(config: CadenceConfig): CheckResult {
  logger.debug("Checking sections configuration...");

  const sections = config.sections;
  const requiredSections = ["tasks"];
  const missing = requiredSections.filter((s) => !sections[s]);

  if (missing.length > 0) {
    return {
      name: "Sections Configuration",
      status: "warn",
      message: `Missing recommended sections: ${missing.join(", ")}`,
      suggestion: 'Add sections.tasks to config (e.g., "## Tasks")',
    };
  }

  const sectionCount = Object.keys(sections).length;
  return {
    name: "Sections Configuration",
    status: "ok",
    message: `${sectionCount} section(s) configured`,
  };
}

export const doctorCommand = new Command("doctor")
  .description("Check vault health and configuration")
  .option("--json", "Output as JSON")
  .action(async function (this: Command, options: { json?: boolean }) {
    try {
      const fs = new NodeFileSystem();
      const configLoader = new ConfigLoader(fs);
      const explicitVault = getVaultOption(this);

      const report: DoctorReport = {
        vaultPath: null,
        checks: [],
        summary: { ok: 0, warnings: 0, errors: 0 },
      };

      // Check vault resolution
      const vaultCheck = await checkVault(fs, explicitVault);
      report.checks.push(vaultCheck.result);
      report.vaultPath = vaultCheck.vaultPath;

      // If vault found, continue with other checks
      if (vaultCheck.vaultPath) {
        // Check config
        const configCheck = await checkConfig(
          configLoader,
          vaultCheck.vaultPath
        );
        report.checks.push(configCheck.result);

        // If config valid, check everything else
        if (configCheck.config) {
          const config = configCheck.config;

          // Check directories
          const dirResults = await checkDirectories(
            fs,
            vaultCheck.vaultPath,
            config
          );
          report.checks.push(...dirResults);

          // Check templates
          const templateResults = await checkTemplates(
            fs,
            vaultCheck.vaultPath,
            config
          );
          report.checks.push(...templateResults);

          // Check tasks config
          report.checks.push(checkTasksConfig(config));

          // Check sections config
          report.checks.push(checkSectionsConfig(config));
        }
      }

      // Calculate summary
      for (const check of report.checks) {
        switch (check.status) {
          case "ok":
            report.summary.ok++;
            break;
          case "warn":
            report.summary.warnings++;
            break;
          case "error":
            report.summary.errors++;
            break;
        }
      }

      // Output
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(chalk.bold("Cadence Doctor"));
        console.log();

        if (report.vaultPath) {
          console.log(chalk.gray(`Vault: ${report.vaultPath}`));
          console.log();
        }

        for (const check of report.checks) {
          console.log(formatCheckResult(check));
        }

        console.log();
        console.log(chalk.bold("Summary:"));

        const parts: string[] = [];
        if (report.summary.ok > 0) {
          parts.push(chalk.green(`${report.summary.ok} passed`));
        }
        if (report.summary.warnings > 0) {
          parts.push(chalk.yellow(`${report.summary.warnings} warning(s)`));
        }
        if (report.summary.errors > 0) {
          parts.push(chalk.red(`${report.summary.errors} error(s)`));
        }
        console.log(`  ${parts.join(", ")}`);

        if (report.summary.errors > 0) {
          console.log();
          console.log(
            chalk.red("Some checks failed. Please address the errors above.")
          );
          process.exit(1);
        } else if (report.summary.warnings > 0) {
          console.log();
          console.log(
            chalk.yellow(
              "Some checks have warnings. Your vault is functional but could be improved."
            )
          );
        } else {
          console.log();
          console.log(chalk.green("All checks passed! Your vault is healthy."));
        }
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
