import chalk from "chalk";

/**
 * Global verbose mode flag.
 * Set to true when --verbose is passed to enable debug output.
 */
let verboseMode = false;

/**
 * Enable verbose mode for debug output.
 */
export function setVerbose(enabled: boolean): void {
  verboseMode = enabled;
}

/**
 * Check if verbose mode is enabled.
 */
export function isVerbose(): boolean {
  return verboseMode;
}

/**
 * Logger utility for CLI output with verbose support.
 */
export const logger = {
  /**
   * Log an info message (always shown).
   */
  info(message: string): void {
    console.log(message);
  },

  /**
   * Log a success message with green checkmark.
   */
  success(message: string): void {
    console.log(chalk.green("✓"), message);
  },

  /**
   * Log a warning message with yellow indicator.
   */
  warn(message: string): void {
    console.log(chalk.yellow("⚠"), message);
  },

  /**
   * Log an error message with red indicator.
   */
  error(message: string): void {
    console.error(chalk.red("✗"), message);
  },

  /**
   * Log a debug message (only shown in verbose mode).
   */
  debug(message: string): void {
    if (verboseMode) {
      console.log(chalk.gray(`[debug] ${message}`));
    }
  },

  /**
   * Log a debug message with a label (only shown in verbose mode).
   */
  debugLabeled(label: string, message: string): void {
    if (verboseMode) {
      console.log(chalk.gray(`[${label}]`), chalk.gray(message));
    }
  },

  /**
   * Log vault resolution info (only shown in verbose mode).
   */
  debugVault(vaultPath: string, source: string): void {
    if (verboseMode) {
      console.log(chalk.gray(`[vault] Resolved to: ${vaultPath}`));
      console.log(chalk.gray(`[vault] Source: ${source}`));
    }
  },

  /**
   * Log config loading info (only shown in verbose mode).
   */
  debugConfig(configPath: string): void {
    if (verboseMode) {
      console.log(chalk.gray(`[config] Loaded from: ${configPath}`));
    }
  },

  /**
   * Log file operation info (only shown in verbose mode).
   */
  debugFile(operation: string, path: string): void {
    if (verboseMode) {
      console.log(chalk.gray(`[file] ${operation}: ${path}`));
    }
  },

  /**
   * Log template operation info (only shown in verbose mode).
   */
  debugTemplate(operation: string, name: string): void {
    if (verboseMode) {
      console.log(chalk.gray(`[template] ${operation}: ${name}`));
    }
  },

  /**
   * Log command execution info (only shown in verbose mode).
   */
  debugCommand(command: string, args?: Record<string, unknown>): void {
    if (verboseMode) {
      console.log(chalk.gray(`[command] Executing: ${command}`));
      if (args && Object.keys(args).length > 0) {
        console.log(chalk.gray(`[command] Options: ${JSON.stringify(args)}`));
      }
    }
  },
};
