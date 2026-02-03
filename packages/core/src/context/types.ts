import type { Note } from "../notes/types.js";
import type { TaskWithSource } from "../tasks/types.js";

/**
 * Options for building context.
 */
export interface ContextOptions {
  /** Number of daily notes to include (default: 3) */
  dailyCount?: number;
  /** Whether to include the current weekly note (default: true) */
  includeWeekly?: boolean;
  /** Whether to include the current monthly note (default: true) */
  includeMonthly?: boolean;
  /** Whether to include the current quarterly note (default: false) */
  includeQuarterly?: boolean;
  /** Whether to include task summary (default: true) */
  includeTasks?: boolean;
  /** Optional maximum token limit for the context */
  maxTokens?: number;
}

/**
 * Aggregated context from periodic notes and tasks.
 */
export interface Context {
  /** Recent daily notes (most recent first) */
  daily: Note[];
  /** Current weekly note (if available and requested) */
  weekly?: Note;
  /** Current monthly note (if available and requested) */
  monthly?: Note;
  /** Current quarterly note (if available and requested) */
  quarterly?: Note;
  /** Task summary */
  tasks: {
    /** Open (incomplete) tasks */
    open: TaskWithSource[];
    /** Tasks past their due date */
    overdue: TaskWithSource[];
  };
  /** Human-readable summary of the context */
  summary: string;
}
