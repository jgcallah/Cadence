/**
 * Metadata extracted from task content.
 */
export interface TaskMetadata {
  /** Due date parsed from due:YYYY-MM-DD or due:natural-language */
  due?: Date;
  /** Priority level: high, medium, or low */
  priority?: "high" | "medium" | "low";
  /** Tags extracted from #tagname syntax */
  tags: string[];
  /** Scheduled date parsed from scheduled:YYYY-MM-DD */
  scheduled?: Date;
  /** Age in days since creation, parsed from age:N */
  age?: number;
  /** Created date parsed from created:YYYY-MM-DD */
  created?: Date;
}

/**
 * Represents a parsed task from markdown content.
 */
export interface Task {
  /** Line number where the task appears (1-indexed) */
  line: number;
  /** The task text without the checkbox syntax and metadata */
  text: string;
  /** Whether the task is completed (marked with [x]) */
  completed: boolean;
  /** Extracted metadata from the task */
  metadata: TaskMetadata;
  /** The raw, original line content */
  raw: string;
}

/**
 * A task with information about its source note.
 */
export interface TaskWithSource extends Task {
  /** The path to the note file where this task was found */
  sourcePath: string;
  /** The date associated with the source note */
  sourceDate: Date;
}

/**
 * Priority levels for task categorization.
 */
export type TaskPriority = "high" | "medium" | "low" | "none";

/**
 * Tasks grouped by priority level.
 */
export interface TasksByPriority {
  high: TaskWithSource[];
  medium: TaskWithSource[];
  low: TaskWithSource[];
  none: TaskWithSource[];
}

/**
 * Result of aggregating tasks from multiple notes.
 */
export interface AggregatedTasks {
  /** Open (incomplete) tasks */
  open: TaskWithSource[];
  /** Completed tasks */
  completed: TaskWithSource[];
  /** Tasks that are past their due date */
  overdue: TaskWithSource[];
  /** Tasks that have been open longer than staleAfterDays */
  stale: TaskWithSource[];
  /** Tasks grouped by priority */
  byPriority: TasksByPriority;
}

/**
 * Options for rolling over incomplete tasks.
 */
export interface RolloverOptions {
  /** Path to the vault root */
  vaultPath: string;
  /** Target date for rollover (default: today) */
  targetDate?: Date;
  /** Number of days to scan back for incomplete tasks (default: config.tasks.scanDaysBack) */
  sourceDaysBack?: number;
}

/**
 * Result of rolling over tasks.
 */
export interface RolloverResult {
  /** Tasks that were rolled over to the target note */
  rolledOver: TaskWithSource[];
  /** Path to the target note where tasks were inserted */
  targetNotePath: string;
  /** Tasks that were skipped during rollover */
  skipped: { task: Task; reason: string }[];
}
