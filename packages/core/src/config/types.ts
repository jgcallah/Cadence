/**
 * Configuration types for Cadence
 */

/**
 * Path configuration for different note types
 */
export interface PathsConfig {
  /** Path pattern for daily notes (e.g., "Journal/Daily/{{date:YYYY-MM-DD}}.md") */
  daily: string;
  /** Path pattern for weekly notes */
  weekly: string;
  /** Path pattern for monthly notes */
  monthly: string;
  /** Path pattern for quarterly notes */
  quarterly: string;
  /** Path pattern for yearly notes */
  yearly: string;
  /** Path to templates directory */
  templates: string;
}

/**
 * Template mappings - template name to file path
 */
export type TemplatesConfig = Record<string, string>;

/**
 * Section header mappings - section name to header text
 */
export type SectionsConfig = Record<string, string>;

/**
 * Task rollover and management configuration
 */
export interface TasksConfig {
  /** Whether to automatically roll over incomplete tasks */
  rolloverEnabled: boolean;
  /** Number of days to scan back for incomplete tasks */
  scanDaysBack: number;
  /** Number of days after which a task is considered stale */
  staleAfterDays: number;
}

/**
 * Lifecycle hooks configuration
 */
export interface HooksConfig {
  /** Command to run before creating a note */
  preCreate: string | null;
  /** Command to run after creating a note */
  postCreate: string | null;
}

/**
 * Link format for internal links
 */
export type LinkFormat = "wikilink" | "markdown";

/**
 * Complete Cadence configuration schema
 */
export interface CadenceConfig {
  /** Configuration schema version */
  version: number;
  /** Path patterns for different note types */
  paths: PathsConfig;
  /** Template name to path mappings */
  templates: TemplatesConfig;
  /** Section name to header text mappings */
  sections: SectionsConfig;
  /** Task management settings */
  tasks: TasksConfig;
  /** Lifecycle hooks */
  hooks: HooksConfig;
  /** Format for internal links */
  linkFormat: LinkFormat;
}

/**
 * Deep partial type for configuration (used for validation)
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Partial configuration that can be loaded from file
 */
export type PartialCadenceConfig = DeepPartial<CadenceConfig>;
