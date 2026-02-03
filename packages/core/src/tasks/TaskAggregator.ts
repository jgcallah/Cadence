import { subDays, startOfDay, isAfter, isBefore, differenceInDays } from "date-fns";
import type { IFileSystem } from "../fs/types.js";
import type { ConfigLoader } from "../config/ConfigLoader.js";
import type { CadenceConfig } from "../config/types.js";
import type { NoteType } from "../notes/types.js";
import { PathGenerator } from "../dates/PathGenerator.js";
import { TaskParser } from "./TaskParser.js";
import type {
  Task,
  TaskWithSource,
  AggregatedTasks,
  TasksByPriority,
  TaskPriority,
} from "./types.js";

/**
 * Options for aggregating tasks.
 */
export interface AggregateOptions {
  /** Path to the vault root */
  vaultPath: string;
  /** Number of days to look back (default: 7) */
  daysBack?: number;
  /** Whether to include completed tasks in results (default: false) */
  includeCompleted?: boolean;
  /** Types of notes to scan (default: ['daily']) */
  noteTypes?: NoteType[];
}

/**
 * Aggregates tasks from multiple periodic notes.
 *
 * Scans notes within a date range and categorizes tasks by:
 * - Status (open, completed, overdue, stale)
 * - Priority (high, medium, low, none)
 */
export class TaskAggregator {
  private fs: IFileSystem;
  private configLoader: ConfigLoader;
  private pathGenerator: PathGenerator;
  private taskParser: TaskParser;
  private configCache: CadenceConfig | null = null;

  constructor(fs: IFileSystem, configLoader: ConfigLoader) {
    this.fs = fs;
    this.configLoader = configLoader;
    this.pathGenerator = new PathGenerator();
    this.taskParser = new TaskParser();
  }

  /**
   * Aggregate tasks from notes within the specified date range.
   *
   * @param options - Aggregation options
   * @returns Aggregated tasks categorized by status and priority
   */
  async aggregate(options: AggregateOptions): Promise<AggregatedTasks> {
    const {
      vaultPath,
      daysBack = 7,
      includeCompleted = false,
      noteTypes = ["daily"],
    } = options;

    const config = await this.getConfig(vaultPath);
    const today = startOfDay(new Date());
    const startDate = subDays(today, daysBack);

    // Collect all tasks from all note types
    const allTasks: TaskWithSource[] = [];

    for (const noteType of noteTypes) {
      const tasks = await this.collectTasksFromNoteType(
        vaultPath,
        config,
        noteType,
        startDate,
        today
      );
      allTasks.push(...tasks);
    }

    // Categorize tasks
    return this.categorizeTasks(allTasks, config, today, includeCompleted);
  }

  /**
   * Collect tasks from notes of a specific type within a date range.
   */
  private async collectTasksFromNoteType(
    vaultPath: string,
    config: CadenceConfig,
    noteType: NoteType,
    startDate: Date,
    endDate: Date
  ): Promise<TaskWithSource[]> {
    const tasks: TaskWithSource[] = [];
    const pathPattern = config.paths[noteType];
    const dates = this.getDatesInRange(noteType, startDate, endDate);

    for (const date of dates) {
      const relativePath = this.pathGenerator.generatePath(pathPattern, date);
      const fullPath = this.joinPath(vaultPath, relativePath);

      try {
        if (await this.fs.exists(fullPath)) {
          const content = await this.fs.readFile(fullPath);
          const noteTasks = this.taskParser.parse(content);

          for (const task of noteTasks) {
            tasks.push({
              ...task,
              sourcePath: fullPath,
              sourceDate: date,
            });
          }
        }
      } catch {
        // Skip notes that can't be read
        continue;
      }
    }

    return tasks;
  }

  /**
   * Get all dates in range for a given note type.
   */
  private getDatesInRange(
    noteType: NoteType,
    startDate: Date,
    endDate: Date
  ): Date[] {
    const dates: Date[] = [];
    let current = startOfDay(startDate);
    const end = startOfDay(endDate);

    while (!isAfter(current, end)) {
      dates.push(new Date(current));

      switch (noteType) {
        case "daily":
          current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
          break;
        case "weekly":
          current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "monthly":
          current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
          break;
        case "quarterly":
          current = new Date(current.getFullYear(), current.getMonth() + 3, 1);
          break;
        case "yearly":
          current = new Date(current.getFullYear() + 1, 0, 1);
          break;
      }
    }

    return dates;
  }

  /**
   * Categorize tasks by status and priority.
   */
  private categorizeTasks(
    tasks: TaskWithSource[],
    config: CadenceConfig,
    today: Date,
    includeCompleted: boolean
  ): AggregatedTasks {
    const open: TaskWithSource[] = [];
    const completed: TaskWithSource[] = [];
    const overdue: TaskWithSource[] = [];
    const stale: TaskWithSource[] = [];
    const byPriority: TasksByPriority = {
      high: [],
      medium: [],
      low: [],
      none: [],
    };

    for (const task of tasks) {
      if (task.completed) {
        if (includeCompleted) {
          completed.push(task);
        }
        continue;
      }

      // Task is open
      open.push(task);

      // Check if overdue
      if (task.metadata.due && isBefore(task.metadata.due, today)) {
        overdue.push(task);
      }

      // Check if stale
      const taskAge = this.getTaskAge(task, today);
      if (taskAge > config.tasks.staleAfterDays) {
        stale.push(task);
      }

      // Categorize by priority
      const priority = this.getPriority(task);
      byPriority[priority].push(task);
    }

    // Sort all arrays
    this.sortTasks(open);
    this.sortTasks(completed);
    this.sortTasks(overdue);
    this.sortTasks(stale);
    this.sortTasks(byPriority.high);
    this.sortTasks(byPriority.medium);
    this.sortTasks(byPriority.low);
    this.sortTasks(byPriority.none);

    return {
      open,
      completed,
      overdue,
      stale,
      byPriority,
    };
  }

  /**
   * Get the age of a task in days.
   */
  private getTaskAge(task: TaskWithSource, today: Date): number {
    // Use explicit age if set
    if (task.metadata.age !== undefined) {
      return task.metadata.age;
    }

    // Use created date if set
    if (task.metadata.created) {
      return differenceInDays(today, task.metadata.created);
    }

    // Fall back to source date
    return differenceInDays(today, task.sourceDate);
  }

  /**
   * Get the priority of a task.
   */
  private getPriority(task: Task): TaskPriority {
    return task.metadata.priority ?? "none";
  }

  /**
   * Sort tasks by priority (high first), then by due date (earliest first).
   */
  private sortTasks(tasks: TaskWithSource[]): void {
    const priorityOrder: Record<TaskPriority, number> = {
      high: 0,
      medium: 1,
      low: 2,
      none: 3,
    };

    tasks.sort((a, b) => {
      // Sort by priority first
      const priorityA = this.getPriority(a);
      const priorityB = this.getPriority(b);
      const priorityDiff = priorityOrder[priorityA] - priorityOrder[priorityB];
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
   * Joins path segments, handling both Unix and Windows separators.
   */
  private joinPath(...segments: string[]): string {
    // Detect the separator used in the first segment
    const firstSegment = segments[0] ?? "";
    const separator = firstSegment.includes("\\") ? "\\" : "/";

    return segments
      .map((segment, index) => {
        // Remove trailing separators except for root
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
  private async getConfig(vaultPath: string): Promise<CadenceConfig> {
    if (!this.configCache) {
      this.configCache = await this.configLoader.loadConfig(vaultPath);
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
