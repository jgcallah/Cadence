/**
 * Input and output types for MCP tools
 */

// ensure_daily_note
export interface EnsureDailyNoteInput {
  date?: string; // Optional, defaults to today, supports natural language
}

export interface EnsureDailyNoteOutput {
  path: string;
  content: string;
  created: boolean;
}

// get_daily_note
export interface GetDailyNoteInput {
  date: string;
}

export interface GetDailyNoteOutput {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
}

// list_daily_notes
export interface ListDailyNotesInput {
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface ListDailyNoteEntry {
  path: string;
  date: string;
}

export interface ListDailyNotesOutput {
  notes: ListDailyNoteEntry[];
}

// ensure_periodic_note
export interface EnsurePeriodicNoteInput {
  type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  date?: string; // Optional, defaults to today, supports natural language
}

export interface EnsurePeriodicNoteOutput {
  path: string;
  content: string;
  created: boolean;
  periodInfo: {
    start: string; // ISO date string
    end: string; // ISO date string
    label: string;
  };
}

// get_current_period
export interface GetCurrentPeriodInput {
  type: "weekly" | "monthly" | "quarterly" | "yearly";
  date?: string; // Optional, defaults to today
}

export interface GetCurrentPeriodOutput {
  start: string; // ISO date string
  end: string; // ISO date string
  label: string;
  notePath: string;
}

// list_periodic_notes
export interface ListPeriodicNotesInput {
  type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface ListPeriodicNoteEntry {
  path: string;
  date: string;
  periodLabel: string;
}

export interface ListPeriodicNotesOutput {
  notes: ListPeriodicNoteEntry[];
}

// create_from_template
export interface CreateFromTemplateInput {
  template: string;
  targetPath: string;
  variables: Record<string, unknown>;
}

export interface CreateFromTemplateOutput {
  path: string;
  content: string;
}

// list_templates
export interface ListTemplatesInput {
  // No input required
}

export interface ListTemplatesVariableInfo {
  name: string;
  required: boolean;
  default?: unknown;
}

export interface ListTemplatesEntry {
  name: string;
  description: string;
  variables: ListTemplatesVariableInfo[];
}

export interface ListTemplatesOutput {
  templates: ListTemplatesEntry[];
}

// get_template
export interface GetTemplateInput {
  name: string;
}

export interface GetTemplateOutput {
  name: string;
  content: string;
  metadata: {
    name?: string;
    description?: string;
    variables?: {
      name: string;
      required: boolean;
      default?: unknown;
      description?: string;
    }[];
  };
}

// Error response
export interface ToolErrorResponse {
  error: {
    code: string;
    message: string;
    [key: string]: unknown;
  };
}

// =====================
// Task Tool Types
// =====================

/**
 * Serializable task metadata for MCP responses.
 * Dates are serialized as ISO strings.
 */
export interface SerializedTaskMetadata {
  due?: string;
  priority?: "high" | "medium" | "low";
  tags: string[];
  scheduled?: string;
  age?: number;
  created?: string;
}

/**
 * Serializable task for MCP responses.
 */
export interface SerializedTask {
  line: number;
  text: string;
  completed: boolean;
  metadata: SerializedTaskMetadata;
  raw: string;
}

/**
 * Serializable task with source information for MCP responses.
 */
export interface SerializedTaskWithSource extends SerializedTask {
  sourcePath: string;
  sourceDate: string;
}

// get_open_tasks
export interface GetOpenTasksInput {
  /** Number of days to look back for tasks (default: 7) */
  daysBack?: number;
  /** Filter by priority level */
  priority?: "high" | "medium" | "low";
  /** Filter by tag (without # prefix) */
  tag?: string;
}

export interface GetOpenTasksOutput {
  /** List of open tasks matching the filters */
  tasks: SerializedTaskWithSource[];
  /** Summary statistics */
  summary: {
    /** Total number of open tasks found */
    total: number;
    /** Number of tasks past their due date */
    overdue: number;
    /** Number of tasks open longer than configured stale threshold */
    stale: number;
  };
}

// rollover_tasks
export interface RolloverTasksInput {
  /** If true, return what would be rolled over without making changes */
  dryRun?: boolean;
}

export interface RolloverTasksOutput {
  /** Tasks that were rolled over (or would be, in dry run mode) */
  rolledOver: SerializedTaskWithSource[];
  /** Path to the target note where tasks were inserted */
  targetNote: string;
  /** Tasks that were skipped (duplicates, etc.) */
  skipped: { task: SerializedTask; reason: string }[];
}

export interface RolloverTasksDryRunOutput {
  /** Tasks that would be rolled over */
  wouldRollOver: SerializedTaskWithSource[];
  /** Target note path */
  targetNote: string;
}

// toggle_task
export interface ToggleTaskInput {
  /** Path to the file containing the task (absolute or relative to vault) */
  filePath: string;
  /** Line number of the task (1-indexed) */
  lineNumber: number;
}

export interface ToggleTaskOutput {
  /** The updated task */
  task: SerializedTask;
  /** The new completion state */
  newState: "completed" | "open";
}

// get_overdue_tasks
export interface GetOverdueTasksInput {
  // No required input
}

export interface GetOverdueTasksOutput {
  /** List of overdue tasks */
  tasks: SerializedTaskWithSource[];
}

// add_task
export interface AddTaskInput {
  /** The task text (without checkbox syntax) */
  text: string;
  /** Due date in YYYY-MM-DD format or natural language */
  due?: string;
  /** Priority level */
  priority?: "high" | "medium" | "low";
  /** Tags to add (without # prefix) */
  tags?: string[];
}

export interface AddTaskOutput {
  /** The created task */
  task: SerializedTask;
  /** Path to the note where the task was added */
  notePath: string;
}

// =====================
// Context Tool Types
// =====================

/**
 * Summary of a note for context responses.
 */
export interface NoteSummary {
  /** Path to the note relative to vault */
  path: string;
  /** The note type */
  type: "daily" | "weekly" | "monthly" | "quarterly";
  /** Human-readable date label */
  date: string;
}

/**
 * Summary of tasks for context responses.
 */
export interface TaskSummary {
  /** Total number of open tasks */
  openCount: number;
  /** Number of overdue tasks */
  overdueCount: number;
  /** List of overdue tasks */
  overdue: SerializedTaskWithSource[];
  /** High priority tasks */
  highPriority: SerializedTaskWithSource[];
}

// get_context
export interface GetContextInput {
  /** Number of daily notes to include (default: 3) */
  dailyCount?: number;
  /** Whether to include task summary (default: true) */
  includeTasks?: boolean;
}

export interface GetContextOutput {
  /** Human-readable context summary */
  context: string;
  /** List of notes included in context */
  notes: NoteSummary[];
  /** Task summary (if includeTasks was true) */
  tasks: TaskSummary;
}

// =====================
// Search Tool Types
// =====================

/**
 * Result from a vault search operation.
 */
export interface VaultSearchResult {
  /** Path to the matching file */
  path: string;
  /** Match relevance score (lower is better for files, higher for content) */
  score?: number;
  /** For content search: the matching line number */
  line?: number;
  /** For content search: the matching content */
  content?: string;
  /** For frontmatter search: the parsed frontmatter */
  frontmatter?: Record<string, unknown>;
}

// search_vault
export interface SearchVaultInput {
  /** Search query text */
  query: string;
  /** Type of search to perform */
  type: "files" | "content" | "frontmatter";
  /** Maximum number of results (default: 10) */
  limit?: number;
  /** For frontmatter search: the field to match */
  field?: string;
}

export interface SearchVaultOutput {
  /** Search results */
  results: VaultSearchResult[];
}

// =====================
// Append Tool Types
// =====================

// append_to_section
export interface AppendToSectionInput {
  /** Path to the note (relative to vault root) */
  notePath: string;
  /** Section name (must be in config.sections) */
  section: string;
  /** Content to append */
  content: string;
}

export interface AppendToSectionOutput {
  /** Whether the operation succeeded */
  success: boolean;
  /** Path to the modified note */
  notePath: string;
}

// =====================
// Read Note Tool Types
// =====================

// read_note
export interface ReadNoteInput {
  /** Path to the note (relative to vault root) */
  path: string;
}

export interface ReadNoteOutput {
  /** The note content */
  content: string;
  /** The parsed frontmatter */
  frontmatter: Record<string, unknown>;
}
