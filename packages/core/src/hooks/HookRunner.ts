import { exec, type ExecException } from "child_process";
import type {
  HookContext,
  HookResult,
  HookName,
  HookRunnerOptions,
} from "./types.js";

/**
 * Default timeout for hook execution in milliseconds (30 seconds).
 */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Executes lifecycle hooks for note creation.
 *
 * Hooks are shell commands that run before (preCreate) or after (postCreate)
 * a note is created. Context is passed via environment variables prefixed
 * with CADENCE_.
 *
 * Hook failures are handled gracefully - they log errors but don't crash
 * the application. The result indicates success/failure for the caller
 * to handle as appropriate.
 */
export class HookRunner {
  public readonly timeoutMs: number;

  constructor(options?: HookRunnerOptions) {
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Executes a hook command with the given context.
   *
   * @param command - The shell command to execute, or null/empty to skip
   * @param hookName - The type of hook (preCreate or postCreate)
   * @param context - Context information passed via environment variables
   * @returns Promise resolving to the hook execution result
   */
  async run(
    command: string | null,
    hookName: HookName,
    context: HookContext
  ): Promise<HookResult> {
    // Skip if no command configured
    if (!command || command.trim() === "") {
      return {
        success: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
      };
    }

    const env = this.buildEnvironment(hookName, context);

    return new Promise<HookResult>((resolve) => {
      // eslint-disable-next-line prefer-const -- reassigned in setTimeout below
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let resolved = false;

      const childProcess = exec(
        command,
        {
          env,
          timeout: this.timeoutMs,
        },
        (error: ExecException | null, stdout: string, stderr: string) => {
        if (resolved) return;
        resolved = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (error) {
          const exitCode = typeof (error as Error & { code?: number }).code === "number"
            ? (error as Error & { code?: number }).code!
            : 1;

          resolve({
            success: false,
            stdout: stdout ?? "",
            stderr: stderr ?? "",
            exitCode,
          });
        } else {
          resolve({
            success: true,
            stdout: stdout ?? "",
            stderr: stderr ?? "",
            exitCode: 0,
          });
        }
      });

      // Set up manual timeout handling as backup
      timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;

        // Try to kill the process
        if (childProcess.pid) {
          try {
            process.kill(childProcess.pid);
          } catch {
            // Process may have already exited
          }
        }

        resolve({
          success: false,
          stdout: "",
          stderr: `Hook execution timeout after ${String(this.timeoutMs)}ms`,
          exitCode: -1,
        });
      }, this.timeoutMs);
    });
  }

  /**
   * Builds the environment variables for hook execution.
   *
   * All context values are passed with the CADENCE_ prefix:
   * - CADENCE_NOTE_PATH: Full path to the note
   * - CADENCE_NOTE_TYPE: Type of note (daily, weekly, etc.)
   * - CADENCE_DATE: Date in ISO format
   * - CADENCE_VAULT_PATH: Root vault path
   * - CADENCE_HOOK_NAME: Name of the hook being executed
   */
  private buildEnvironment(
    hookName: HookName,
    context: HookContext
  ): NodeJS.ProcessEnv {
    return {
      ...process.env,
      CADENCE_NOTE_PATH: context.notePath,
      CADENCE_NOTE_TYPE: context.noteType,
      CADENCE_DATE: context.date,
      CADENCE_VAULT_PATH: context.vaultPath,
      CADENCE_HOOK_NAME: hookName,
    };
  }
}
