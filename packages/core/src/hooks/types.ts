/**
 * Context passed to hook commands via environment variables.
 */
export interface HookContext {
  /** Full path to the note being created/modified */
  notePath: string;
  /** Type of note (daily, weekly, monthly, quarterly, yearly) */
  noteType: string;
  /** Date associated with the note in ISO format (YYYY-MM-DD) */
  date: string;
  /** Root path of the Obsidian vault */
  vaultPath: string;
}

/**
 * Result of executing a hook command.
 */
export interface HookResult {
  /** Whether the hook executed successfully (exit code 0) */
  success: boolean;
  /** Standard output from the command */
  stdout?: string;
  /** Standard error from the command */
  stderr?: string;
  /** Exit code of the command (-1 for timeout) */
  exitCode: number;
}

/**
 * Type of hook being executed.
 */
export type HookName = "preCreate" | "postCreate";

/**
 * Options for configuring HookRunner.
 */
export interface HookRunnerOptions {
  /** Timeout in milliseconds for hook execution (default: 30000) */
  timeoutMs?: number;
}
