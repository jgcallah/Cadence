import { subDays, startOfDay, format, isBefore } from "date-fns";
import type { IFileSystem } from "../fs/types.js";
import type { ConfigLoader } from "../config/ConfigLoader.js";
import type { CadenceConfig } from "../config/types.js";
import type { Note, NoteType } from "../notes/types.js";
import { PathGenerator } from "../dates/PathGenerator.js";
import { FrontmatterParser } from "../frontmatter/FrontmatterParser.js";
import { TaskParser } from "../tasks/TaskParser.js";
import type { TaskWithSource } from "../tasks/types.js";
import type { Context, ContextOptions } from "./types.js";

/**
 * Default options for context building.
 */
const DEFAULT_OPTIONS: Required<Omit<ContextOptions, "maxTokens">> = {
  dailyCount: 3,
  includeWeekly: true,
  includeMonthly: true,
  includeQuarterly: false,
  includeTasks: true,
};

/**
 * Builds aggregated context from periodic notes and tasks.
 *
 * Collects recent daily notes, current period notes (weekly, monthly, quarterly),
 * and open/overdue tasks into a unified context object with a human-readable summary.
 */
export class ContextBuilder {
  private fs: IFileSystem;
  private configLoader: ConfigLoader;
  private vaultPath: string;
  private pathGenerator: PathGenerator;
  private frontmatterParser: FrontmatterParser;
  private taskParser: TaskParser;
  private configCache: CadenceConfig | null = null;

  /**
   * Creates a new ContextBuilder.
   *
   * @param fs - The filesystem abstraction to use
   * @param configLoader - The config loader for reading vault configuration
   * @param vaultPath - The path to the vault root
   */
  constructor(fs: IFileSystem, configLoader: ConfigLoader, vaultPath: string) {
    this.fs = fs;
    this.configLoader = configLoader;
    this.vaultPath = vaultPath;
    this.pathGenerator = new PathGenerator();
    this.frontmatterParser = new FrontmatterParser();
    this.taskParser = new TaskParser();
  }

  /**
   * Build context from periodic notes and tasks.
   *
   * @param options - Options controlling which notes and data to include
   * @returns Aggregated context with notes, tasks, and summary
   */
  async getContext(options: ContextOptions = {}): Promise<Context> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const config = await this.getConfig();
    const today = startOfDay(new Date());

    // Collect daily notes (most recent first)
    const daily = await this.collectDailyNotes(config, today, opts.dailyCount);

    // Collect period notes
    const weekly = opts.includeWeekly
      ? await this.tryGetNote(config, "weekly", today)
      : undefined;
    const monthly = opts.includeMonthly
      ? await this.tryGetNote(config, "monthly", today)
      : undefined;
    const quarterly = opts.includeQuarterly
      ? await this.tryGetNote(config, "quarterly", today)
      : undefined;

    // Collect tasks
    let tasks: Context["tasks"] = { open: [], overdue: [] };
    if (opts.includeTasks) {
      tasks = await this.collectTasks(config, today, opts.dailyCount);
    }

    // Build context - only include period notes if they exist
    const context: Context = {
      daily,
      tasks,
      summary: "",
    };

    if (weekly) {
      context.weekly = weekly;
    }
    if (monthly) {
      context.monthly = monthly;
    }
    if (quarterly) {
      context.quarterly = quarterly;
    }

    // Generate summary
    context.summary = this.generateSummary(context, today);

    // Apply token limit if specified
    if (opts.maxTokens !== undefined) {
      return this.applyTokenLimit(context, opts.maxTokens);
    }

    return context;
  }

  /**
   * Collect the most recent daily notes.
   */
  private async collectDailyNotes(
    config: CadenceConfig,
    today: Date,
    count: number
  ): Promise<Note[]> {
    const notes: Note[] = [];

    // Look back up to count * 2 days to find enough notes
    // (accounts for possible gaps in daily notes)
    const maxDaysBack = count * 2;

    for (let i = 0; i < maxDaysBack && notes.length < count; i++) {
      const date = subDays(today, i);
      const note = await this.tryGetNote(config, "daily", date);
      if (note) {
        notes.push(note);
      }
    }

    return notes;
  }

  /**
   * Try to get a note, returning undefined if it doesn't exist.
   */
  private async tryGetNote(
    config: CadenceConfig,
    type: NoteType,
    date: Date
  ): Promise<Note | undefined> {
    const pathPattern = config.paths[type];
    const relativePath = this.pathGenerator.generatePath(pathPattern, date);
    const fullPath = this.joinPath(this.vaultPath, relativePath);

    try {
      if (await this.fs.exists(fullPath)) {
        const content = await this.fs.readFile(fullPath);
        const parsed = this.frontmatterParser.parse(content);
        return {
          path: fullPath,
          content,
          frontmatter: parsed.frontmatter,
          body: parsed.body,
        };
      }
    } catch {
      // Note doesn't exist or can't be read
    }

    return undefined;
  }

  /**
   * Collect open and overdue tasks from recent daily notes.
   */
  private async collectTasks(
    config: CadenceConfig,
    today: Date,
    daysBack: number
  ): Promise<Context["tasks"]> {
    const open: TaskWithSource[] = [];
    const overdue: TaskWithSource[] = [];
    const pathPattern = config.paths.daily;

    // Scan daily notes for tasks
    for (let i = 0; i < daysBack * 2; i++) {
      const date = subDays(today, i);
      const relativePath = this.pathGenerator.generatePath(pathPattern, date);
      const fullPath = this.joinPath(this.vaultPath, relativePath);

      try {
        if (await this.fs.exists(fullPath)) {
          const content = await this.fs.readFile(fullPath);
          const tasks = this.taskParser.parse(content);

          for (const task of tasks) {
            if (!task.completed) {
              const taskWithSource: TaskWithSource = {
                ...task,
                sourcePath: fullPath,
                sourceDate: date,
              };
              open.push(taskWithSource);

              // Check if overdue
              if (task.metadata.due && isBefore(task.metadata.due, today)) {
                overdue.push(taskWithSource);
              }
            }
          }
        }
      } catch {
        // Skip notes that can't be read
      }
    }

    // Sort by priority then due date
    this.sortTasks(open);
    this.sortTasks(overdue);

    return { open, overdue };
  }

  /**
   * Sort tasks by priority (high first), then by due date (earliest first).
   */
  private sortTasks(tasks: TaskWithSource[]): void {
    const priorityOrder: Record<string, number> = {
      high: 0,
      medium: 1,
      low: 2,
      none: 3,
    };

    tasks.sort((a, b) => {
      // Sort by priority first
      const priorityA = a.metadata.priority ?? "none";
      const priorityB = b.metadata.priority ?? "none";
      const priorityDiff =
        (priorityOrder[priorityA] ?? 3) - (priorityOrder[priorityB] ?? 3);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Then by due date
      const dueA = a.metadata.due?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dueB = b.metadata.due?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return dueA - dueB;
    });
  }

  /**
   * Generate a human-readable summary of the context.
   */
  private generateSummary(context: Context, today: Date): string {
    const lines: string[] = [];
    const dateStr = format(today, "yyyy-MM-dd");

    lines.push(`Context as of ${dateStr}`);
    lines.push("");

    // List periods covered
    lines.push("Periods covered:");
    if (context.daily.length > 0) {
      lines.push(`- ${context.daily.length} daily note(s)`);
    }
    if (context.weekly) {
      lines.push("- Current weekly note");
    }
    if (context.monthly) {
      lines.push("- Current monthly note");
    }
    if (context.quarterly) {
      lines.push("- Current quarterly note");
    }

    // Task counts
    lines.push("");
    lines.push("Tasks:");
    lines.push(`- ${context.tasks.open.length} open task(s)`);
    lines.push(`- ${context.tasks.overdue.length} overdue task(s)`);

    return lines.join("\n");
  }

  /**
   * Apply token limit to context by truncating content.
   * Uses a rough estimate of 4 characters per token.
   */
  private applyTokenLimit(context: Context, maxTokens: number): Context {
    const charsPerToken = 4;
    const maxChars = maxTokens * charsPerToken;

    // Calculate current size
    const currentChars = this.estimateContextSize(context);

    // If under limit, return as-is
    if (currentChars <= maxChars) {
      return context;
    }

    // Create a copy to modify
    const limited: Context = {
      ...context,
      daily: [...context.daily],
      tasks: {
        open: [...context.tasks.open],
        overdue: [...context.tasks.overdue],
      },
    };

    // Progressively remove content to fit within limit
    // Priority: keep summary, then tasks, then period notes, then daily notes

    // First, trim daily notes from oldest to newest
    while (limited.daily.length > 1 && this.estimateContextSize(limited) > maxChars) {
      limited.daily.pop();
    }

    // Then remove quarterly note
    if (limited.quarterly && this.estimateContextSize(limited) > maxChars) {
      delete limited.quarterly;
    }

    // Then remove monthly note
    if (limited.monthly && this.estimateContextSize(limited) > maxChars) {
      delete limited.monthly;
    }

    // Then remove weekly note
    if (limited.weekly && this.estimateContextSize(limited) > maxChars) {
      delete limited.weekly;
    }

    // Regenerate summary with updated content
    limited.summary = this.generateSummary(limited, startOfDay(new Date()));

    return limited;
  }

  /**
   * Estimate the size of a context in characters.
   */
  private estimateContextSize(context: Context): number {
    let size = context.summary.length;

    for (const note of context.daily) {
      size += note.content.length;
    }
    if (context.weekly) {
      size += context.weekly.content.length;
    }
    if (context.monthly) {
      size += context.monthly.content.length;
    }
    if (context.quarterly) {
      size += context.quarterly.content.length;
    }

    // Rough estimate for tasks (each task ~100 chars)
    size += context.tasks.open.length * 100;
    size += context.tasks.overdue.length * 100;

    return size;
  }

  /**
   * Joins path segments, handling both Unix and Windows separators.
   */
  private joinPath(...segments: string[]): string {
    const firstSegment = segments[0] ?? "";
    const separator = firstSegment.includes("\\") ? "\\" : "/";

    return segments
      .map((segment, index) => {
        if (index > 0) {
          segment = segment.replace(/^[/\\]+/, "");
        }
        if (index < segments.length - 1) {
          segment = segment.replace(/[/\\]+$/, "");
        }
        return segment;
      })
      .join(separator);
  }

  /**
   * Gets the config, caching it for subsequent calls.
   */
  private async getConfig(): Promise<CadenceConfig> {
    if (!this.configCache) {
      this.configCache = await this.configLoader.loadConfig(this.vaultPath);
    }
    return this.configCache;
  }

  /**
   * Clear the config cache. Useful when config may have changed.
   */
  clearConfigCache(): void {
    this.configCache = null;
  }
}
