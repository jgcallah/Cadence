import type { IFileSystem } from "../fs/types.js";
import {
  ConfigNotFoundError,
  ConfigValidationError,
} from "../errors/index.js";
import type { CadenceConfig, PathsConfig } from "./types.js";

/**
 * Configuration file path relative to vault root
 */
const CONFIG_DIR = ".cadence";
const CONFIG_FILE = "config.json";

/**
 * Options for generating default config
 */
export interface GenerateConfigOptions {
  /** Overwrite existing config file */
  force?: boolean;
}

/**
 * Returns a deep clone of the default configuration
 */
export function getDefaultConfig(): CadenceConfig {
  return {
    version: 1,
    paths: {
      daily: "Journal/{year}/Daily/{month}/{date}.md",
      weekly: "Journal/{year}/Weekly/W{week}.md",
      monthly: "Journal/{year}/Monthly/{month}.md",
      quarterly: "Journal/{year}/Quarterly/Q{quarter}.md",
      yearly: "Journal/{year}/Year.md",
      templates: "Templates",
    },
    templates: {
      daily: "Templates/daily.md",
      weekly: "Templates/weekly.md",
      monthly: "Templates/monthly.md",
      quarterly: "Templates/quarterly.md",
      yearly: "Templates/yearly.md",
    },
    sections: {
      tasks: "## Tasks",
      notes: "## Notes",
      reflection: "## Reflection",
    },
    tasks: {
      rolloverEnabled: true,
      scanDaysBack: 7,
      staleAfterDays: 14,
    },
    hooks: {
      preCreate: null,
      postCreate: null,
    },
    linkFormat: "wikilink",
  };
}

/**
 * Loads and validates Cadence configuration from a vault
 */
export class ConfigLoader {
  constructor(private readonly fs: IFileSystem) {}

  /**
   * Load configuration from a vault
   * @param vaultPath - Path to the vault root
   * @returns The loaded and validated configuration
   * @throws ConfigNotFoundError if config file doesn't exist
   * @throws ConfigValidationError if config is invalid
   */
  async loadConfig(vaultPath: string): Promise<CadenceConfig> {
    const configPath = this.getConfigPath(vaultPath);

    // Check if config exists
    if (!(await this.fs.exists(configPath))) {
      throw new ConfigNotFoundError(vaultPath);
    }

    // Read and parse config
    const content = await this.fs.readFile(configPath);
    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new ConfigValidationError(
        `Invalid JSON in configuration file: ${configPath}`,
        { validationErrors: ["Configuration file contains invalid JSON"] }
      );
    }

    // Validate and return
    return this.validateConfig(parsed);
  }

  /**
   * Generate a default configuration file in the vault
   * @param vaultPath - Path to the vault root
   * @param options - Generation options
   */
  async generateDefaultConfigFile(
    vaultPath: string,
    options: GenerateConfigOptions = {}
  ): Promise<void> {
    const configDir = this.getConfigDir(vaultPath);
    const configPath = this.getConfigPath(vaultPath);

    // Check if config already exists
    if (!options.force && (await this.fs.exists(configPath))) {
      throw new ConfigValidationError(
        `Configuration file already exists at ${configPath}. Use force option to overwrite.`
      );
    }

    // Create directory structure
    await this.fs.mkdir(configDir, true);

    // Write default config
    const config = getDefaultConfig();
    const content = JSON.stringify(config, null, 2);
    await this.fs.writeFile(configPath, content);
  }

  /**
   * Get the config directory path
   */
  private getConfigDir(vaultPath: string): string {
    return this.joinPath(vaultPath, CONFIG_DIR);
  }

  /**
   * Get the config file path
   */
  private getConfigPath(vaultPath: string): string {
    return this.joinPath(vaultPath, CONFIG_DIR, CONFIG_FILE);
  }

  /**
   * Join path segments handling both Unix and Windows separators
   */
  private joinPath(...segments: string[]): string {
    // Detect if we're dealing with Windows-style paths
    const isWindows = segments[0]?.includes("\\") || segments[0]?.match(/^[A-Z]:/i);
    const separator = isWindows ? "\\" : "/";

    return segments
      .map((segment, index) => {
        // Remove trailing separators except for the root
        if (index < segments.length - 1) {
          return segment.replace(/[/\\]+$/, "");
        }
        return segment;
      })
      .join(separator);
  }

  /**
   * Validate the configuration object
   */
  private validateConfig(config: unknown): CadenceConfig {
    const errors: string[] = [];

    if (!config || typeof config !== "object") {
      throw new ConfigValidationError("Configuration must be an object", {
        validationErrors: ["Configuration must be an object"],
      });
    }

    const obj = config as Record<string, unknown>;

    // Validate version
    if (typeof obj["version"] !== "number") {
      errors.push("version must be a number");
    }

    // Validate paths
    const pathsErrors = this.validatePaths(obj["paths"]);
    errors.push(...pathsErrors);

    // Validate templates
    const templatesErrors = this.validateStringRecord(obj["templates"], "templates");
    errors.push(...templatesErrors);

    // Validate sections
    const sectionsErrors = this.validateStringRecord(obj["sections"], "sections");
    errors.push(...sectionsErrors);

    // Validate tasks
    const tasksErrors = this.validateTasks(obj["tasks"]);
    errors.push(...tasksErrors);

    // Validate hooks
    const hooksErrors = this.validateHooks(obj["hooks"]);
    errors.push(...hooksErrors);

    // Validate linkFormat
    const linkFormat = obj["linkFormat"];
    if (linkFormat !== "wikilink" && linkFormat !== "markdown") {
      errors.push('linkFormat must be either "wikilink" or "markdown"');
    }

    if (errors.length > 0) {
      throw new ConfigValidationError(
        `Invalid configuration: ${errors.join("; ")}`,
        { validationErrors: errors }
      );
    }

    return obj as unknown as CadenceConfig;
  }

  /**
   * Validate paths configuration
   */
  private validatePaths(paths: unknown): string[] {
    const errors: string[] = [];
    const requiredFields: (keyof PathsConfig)[] = [
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "yearly",
      "templates",
    ];

    if (!paths || typeof paths !== "object") {
      errors.push("paths must be an object");
      return errors;
    }

    const pathsObj = paths as Record<string, unknown>;

    for (const field of requiredFields) {
      if (typeof pathsObj[field] !== "string") {
        errors.push(`paths.${field} must be a string`);
      }
    }

    return errors;
  }

  /**
   * Validate a record of string values
   */
  private validateStringRecord(
    record: unknown,
    fieldName: string
  ): string[] {
    const errors: string[] = [];

    if (!record || typeof record !== "object") {
      errors.push(`${fieldName} must be an object`);
      return errors;
    }

    const recordObj = record as Record<string, unknown>;

    for (const [key, value] of Object.entries(recordObj)) {
      if (typeof value !== "string") {
        errors.push(`${fieldName}.${key} must be a string`);
      }
    }

    return errors;
  }

  /**
   * Validate tasks configuration
   */
  private validateTasks(tasks: unknown): string[] {
    const errors: string[] = [];

    if (!tasks || typeof tasks !== "object") {
      errors.push("tasks must be an object");
      return errors;
    }

    const tasksObj = tasks as Record<string, unknown>;

    if (typeof tasksObj["rolloverEnabled"] !== "boolean") {
      errors.push("tasks.rolloverEnabled must be a boolean");
    }

    if (typeof tasksObj["scanDaysBack"] !== "number") {
      errors.push("tasks.scanDaysBack must be a number");
    }

    if (typeof tasksObj["staleAfterDays"] !== "number") {
      errors.push("tasks.staleAfterDays must be a number");
    }

    return errors;
  }

  /**
   * Validate hooks configuration
   */
  private validateHooks(hooks: unknown): string[] {
    const errors: string[] = [];

    if (!hooks || typeof hooks !== "object") {
      errors.push("hooks must be an object");
      return errors;
    }

    const hooksObj = hooks as Record<string, unknown>;

    const preCreate = hooksObj["preCreate"];
    if (preCreate !== null && typeof preCreate !== "string") {
      errors.push("hooks.preCreate must be a string or null");
    }

    const postCreate = hooksObj["postCreate"];
    if (postCreate !== null && typeof postCreate !== "string") {
      errors.push("hooks.postCreate must be a string or null");
    }

    return errors;
  }
}
