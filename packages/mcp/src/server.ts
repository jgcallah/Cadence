import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  NodeFileSystem,
  resolveVault,
  ConfigLoader,
  NoteService,
  DateParser,
  CadenceError,
  PeriodCalculator,
  PathGenerator,
  PathMatcher,
  TemplateRegistry,
  createFromTemplate,
  TaskAggregator,
  TaskRollover,
  TaskModifier,
  ContextBuilder,
  VaultSearch,
  FrontmatterParser,
  type IFileSystem,
  type NoteType,
  type Task,
  type TaskWithSource,
} from "@cadence/core";
import type {
  EnsureDailyNoteInput,
  EnsureDailyNoteOutput,
  GetDailyNoteInput,
  GetDailyNoteOutput,
  ListDailyNotesInput,
  ListDailyNotesOutput,
  EnsurePeriodicNoteInput,
  EnsurePeriodicNoteOutput,
  GetCurrentPeriodInput,
  GetCurrentPeriodOutput,
  ListPeriodicNotesInput,
  ListPeriodicNotesOutput,
  CreateFromTemplateInput,
  CreateFromTemplateOutput,
  ListTemplatesOutput,
  GetTemplateInput,
  GetTemplateOutput,
  ToolErrorResponse,
  GetOpenTasksInput,
  GetOpenTasksOutput,
  RolloverTasksInput,
  RolloverTasksOutput,
  RolloverTasksDryRunOutput,
  ToggleTaskInput,
  ToggleTaskOutput,
  GetOverdueTasksOutput,
  AddTaskInput,
  AddTaskOutput,
  SerializedTask,
  SerializedTaskWithSource,
  SerializedTaskMetadata,
  GetContextInput,
  GetContextOutput,
  SearchVaultInput,
  SearchVaultOutput,
  AppendToSectionInput,
  AppendToSectionOutput,
  ReadNoteInput,
  ReadNoteOutput,
  NoteSummary,
  TaskSummary,
} from "./types.js";

/**
 * Creates the vault context from CADENCE_VAULT_PATH environment variable
 */
async function createVaultContext(fs: IFileSystem) {
  const vaultPath = await resolveVault(fs);
  const configLoader = new ConfigLoader(fs);
  const noteService = new NoteService(fs, configLoader, vaultPath);
  return { vaultPath, fs, configLoader, noteService };
}

/**
 * Formats a CadenceError as a structured error response
 */
function formatError(error: unknown): ToolErrorResponse {
  if (error instanceof CadenceError) {
    return {
      error: error.toJSON(),
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      error: {
        code: "CADENCE_UNKNOWN",
        message: error.message,
      },
    };
  }

  return {
    error: {
      code: "CADENCE_UNKNOWN",
      message: String(error),
    },
  };
}

/**
 * Tool definitions with JSON schemas for Claude
 */
const TOOL_DEFINITIONS = [
  {
    name: "ensure_daily_note",
    description:
      "Ensures a daily note exists for the specified date. If the note doesn't exist, it will be created using the configured template. If no date is provided, defaults to today. Supports natural language dates like 'yesterday', 'last friday', etc.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "The date for the daily note. Supports ISO dates (YYYY-MM-DD) or natural language (today, yesterday, last friday, 3 days ago). Defaults to today if not provided.",
        },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_daily_note",
    description:
      "Retrieves an existing daily note for the specified date. Returns the note content, path, and parsed frontmatter. Returns an error if the note does not exist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description:
            "The date for the daily note. Supports ISO dates (YYYY-MM-DD) or natural language (today, yesterday, last friday, 3 days ago).",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "list_daily_notes",
    description:
      "Lists daily notes in the vault, optionally filtered by date range. Returns an array of note paths and their dates, sorted by date descending (most recent first).",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description:
            "Maximum number of notes to return. Defaults to 10 if not specified.",
        },
        startDate: {
          type: "string",
          description:
            "Only include notes on or after this date. Supports ISO dates (YYYY-MM-DD) or natural language.",
        },
        endDate: {
          type: "string",
          description:
            "Only include notes on or before this date. Supports ISO dates (YYYY-MM-DD) or natural language.",
        },
      },
      required: [] as string[],
    },
  },
  {
    name: "ensure_periodic_note",
    description:
      "Creates or retrieves a periodic note (daily, weekly, monthly, quarterly, or yearly) for a given date. Use this tool when the user wants to create, access, or work with a periodic note of any type. The note is created from templates if it doesn't exist. Returns the note path, content, whether it was newly created, and period information (start/end dates and label like 'Week 5, 2026' or 'Q1 2026').",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
          description:
            "The type of periodic note to ensure. Use 'daily' for day-to-day journaling, 'weekly' for week reviews/planning, 'monthly' for month goals/reviews, 'quarterly' for OKRs and quarterly planning, 'yearly' for annual reviews/goals.",
        },
        date: {
          type: "string",
          description:
            "The date for the note. Supports ISO dates (YYYY-MM-DD) or natural language (today, yesterday, last friday, 3 days ago, next monday). Defaults to today if not provided. For weekly/monthly/quarterly/yearly notes, any date within that period works.",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "get_current_period",
    description:
      "Gets information about the current time period (week, month, quarter, or year) including its start date, end date, human-readable label, and the path to the corresponding periodic note. Use this when you need to know what week/month/quarter/year it is, or to find the path to the current period's note without creating it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["weekly", "monthly", "quarterly", "yearly"],
          description:
            "The period type to get info for. Use 'weekly' to find current week (e.g., 'Week 5, 2026'), 'monthly' for current month, 'quarterly' for current quarter (Q1-Q4), 'yearly' for current year.",
        },
        date: {
          type: "string",
          description:
            "The date to get period info for. Defaults to today. Supports ISO dates (YYYY-MM-DD) or natural language (yesterday, last week, 2 months ago).",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "list_periodic_notes",
    description:
      "Lists periodic notes of a specific type in the vault, with optional date range filtering. Returns note paths, dates, and period labels (e.g., 'Week 5, 2026', 'Q1 2026'). Sorted by date descending (most recent first). Use this to discover existing notes, find notes within a date range, or get an overview of periodic notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["daily", "weekly", "monthly", "quarterly", "yearly"],
          description:
            "The type of periodic notes to list. Specifies which note type to scan for.",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of notes to return. Defaults to 10 if not specified. Set higher to see more historical notes.",
        },
        startDate: {
          type: "string",
          description:
            "Only include notes on or after this date. Supports ISO dates (YYYY-MM-DD) or natural language.",
        },
        endDate: {
          type: "string",
          description:
            "Only include notes on or before this date. Supports ISO dates (YYYY-MM-DD) or natural language.",
        },
      },
      required: ["type"],
    },
  },
  {
    name: "create_from_template",
    description:
      "Creates a new note from a named template. Templates are defined in the Cadence config and can include variable placeholders that get replaced with provided values. Use this to create standardized notes like meeting notes, project documents, or any custom note type. Common templates include 'meeting', 'project', 'person', etc. Variables are passed as key-value pairs and can include strings, numbers, booleans, or arrays. Built-in variables like {{date}}, {{time}}, {{year}}, {{month}} are automatically available.",
    inputSchema: {
      type: "object" as const,
      properties: {
        template: {
          type: "string",
          description:
            "The name of the template to use. Must be a template registered in the Cadence config (e.g., 'meeting', 'project', 'person'). Use list_templates to see available templates.",
        },
        targetPath: {
          type: "string",
          description:
            "The path where the new note should be created, relative to the vault root. Should include the .md extension (e.g., 'Projects/my-project.md' or 'People/John Doe.md').",
        },
        variables: {
          type: "object",
          description:
            "Key-value pairs of variables to substitute in the template. These replace {{variableName}} placeholders in the template content. Required variables must be provided; optional variables will use their defaults if not specified.",
          additionalProperties: true,
        },
      },
      required: ["template", "targetPath", "variables"],
    },
  },
  {
    name: "list_templates",
    description:
      "Lists all available templates registered in the Cadence configuration. Returns each template's name, description, and variable definitions (including which are required and their defaults). Use this to discover what templates exist before using create_from_template.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_template",
    description:
      "Retrieves the full content and metadata of a specific template by name. Returns the raw template content with Handlebars placeholders ({{variable}}) and the metadata including variable definitions. Use this to inspect a template before using it or to understand what variables it expects.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description:
            "The name of the template to retrieve. Must be a template registered in the Cadence config.",
        },
      },
      required: ["name"],
    },
  },
  // Task management tools
  {
    name: "get_open_tasks",
    description:
      "Retrieves all open (incomplete) tasks from daily notes within a date range. Tasks are parsed from markdown checkbox syntax (- [ ] task text). Returns task metadata including: due dates (due:YYYY-MM-DD), priority (!!! = high, !! = medium, ! = low, or priority:high/medium/low), tags (#tagname), age in days (age:N), created date (created:YYYY-MM-DD), and scheduled date (scheduled:YYYY-MM-DD). Use this to get an overview of pending work, filter by priority or tag, or find stale tasks that need attention.",
    inputSchema: {
      type: "object" as const,
      properties: {
        daysBack: {
          type: "number",
          description:
            "Number of days to look back for tasks. Defaults to 7. Set higher to find older incomplete tasks.",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "Filter tasks by priority level. Only returns tasks with this priority.",
        },
        tag: {
          type: "string",
          description:
            "Filter tasks by tag (without # prefix). Only returns tasks containing this tag.",
        },
      },
      required: [] as string[],
    },
  },
  {
    name: "rollover_tasks",
    description:
      "Rolls over incomplete tasks from previous daily notes to today's note. This is useful for carrying forward unfinished work. Features: (1) Scans previous daily notes for incomplete tasks (- [ ] syntax), (2) Increments the age metadata (age:N -> age:N+1), (3) Adds created date if not present, (4) Prevents duplicates by checking if task already exists in target note, (5) Inserts tasks under the configured tasks section. Use dryRun: true to preview what would be rolled over without making changes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dryRun: {
          type: "boolean",
          description:
            "If true, returns what would be rolled over without making changes. Useful for previewing the rollover operation.",
        },
      },
      required: [] as string[],
    },
  },
  {
    name: "toggle_task",
    description:
      "Toggles a task's completion status between open and completed. Changes - [ ] to - [x] (complete) or - [x] to - [ ] (reopen). The task is identified by its file path and line number. To get line numbers, first use get_open_tasks or read the note content. Line numbers are 1-indexed (first line = 1).",
    inputSchema: {
      type: "object" as const,
      properties: {
        filePath: {
          type: "string",
          description:
            "Path to the file containing the task. Can be absolute or relative to the vault root.",
        },
        lineNumber: {
          type: "number",
          description:
            "Line number of the task (1-indexed). Use the 'line' field from task objects returned by get_open_tasks.",
        },
      },
      required: ["filePath", "lineNumber"],
    },
  },
  {
    name: "get_overdue_tasks",
    description:
      "Retrieves all tasks that are past their due date. A task is overdue if it has a due:YYYY-MM-DD metadata field with a date before today and is not completed. Returns tasks sorted by priority (high first) then by due date (oldest first). Use this to identify urgent work that needs immediate attention.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "add_task",
    description:
      "Creates a new task in today's daily note. The task is added under the configured tasks section (default: ## Tasks). Automatically adds a created date (created:YYYY-MM-DD) for tracking task age. Supports optional metadata: due date (natural language like 'tomorrow', 'next friday', or YYYY-MM-DD), priority (high/medium/low), and tags (array of tag names without # prefix).",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description:
            "The task text. Do not include checkbox syntax (- [ ]) - it will be added automatically.",
        },
        due: {
          type: "string",
          description:
            "Due date for the task. Supports ISO dates (YYYY-MM-DD) or natural language (tomorrow, next friday, in 3 days).",
        },
        priority: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "Priority level for the task. High priority tasks appear first in sorted lists.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description:
            "Tags to add to the task (without # prefix). Example: ['work', 'urgent'] becomes #work #urgent.",
        },
      },
      required: ["text"],
    },
  },
  // Context and search tools
  {
    name: "get_context",
    description:
      "Get recent notes and tasks to understand current context. Returns recent daily notes, current weekly/monthly notes, and a summary of open and overdue tasks. Use this at the start of a conversation to understand what the user has been working on recently.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dailyCount: {
          type: "number",
          description:
            "Number of recent daily notes to include (default: 3). Increase for more historical context.",
        },
        includeTasks: {
          type: "boolean",
          description:
            "Whether to include task summary (default: true). Set to false if you only need notes.",
        },
      },
      required: [] as string[],
    },
  },
  {
    name: "search_vault",
    description:
      "Search for notes by name, content, or metadata. Use 'files' type for fuzzy filename search, 'content' for full-text search within note contents, or 'frontmatter' to find notes with specific metadata values.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "The search query. For 'files' type: fuzzy matches against filenames. For 'content' type: searches within note text. For 'frontmatter' type: the value to match against the specified field.",
        },
        type: {
          type: "string",
          enum: ["files", "content", "frontmatter"],
          description:
            "Type of search: 'files' for filename fuzzy search, 'content' for full-text search, 'frontmatter' for metadata field search.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10).",
        },
        field: {
          type: "string",
          description:
            "For frontmatter search: the field name to match against (e.g., 'tags', 'status', 'project'). Supports dot notation for nested fields (e.g., 'metadata.status').",
        },
      },
      required: ["query", "type"],
    },
  },
  {
    name: "append_to_section",
    description:
      "Add content to a predefined section in a note. The section must be defined in the Cadence configuration (config.sections). Common sections include 'tasks', 'notes', 'log', etc. Use this to add new content to a specific part of a note without overwriting existing content.",
    inputSchema: {
      type: "object" as const,
      properties: {
        notePath: {
          type: "string",
          description:
            "Path to the note relative to vault root (e.g., 'Journal/Daily/2026-02-01.md').",
        },
        section: {
          type: "string",
          description:
            "Section name as defined in config.sections (e.g., 'tasks', 'notes', 'log'). Must be a predefined section.",
        },
        content: {
          type: "string",
          description:
            "Content to append to the section. Will be added after existing content in that section.",
        },
      },
      required: ["notePath", "section", "content"],
    },
  },
  {
    name: "read_note",
    description:
      "Read a note's content and frontmatter by path. Returns the full content and parsed frontmatter metadata. Use this to access any note in the vault by its path.",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "Path to the note relative to vault root (e.g., 'Projects/my-project.md').",
        },
      },
      required: ["path"],
    },
  },
];

/**
 * Handles the ensure_daily_note tool
 */
async function handleEnsureDailyNote(
  noteService: NoteService,
  fs: IFileSystem,
  input: EnsureDailyNoteInput
): Promise<EnsureDailyNoteOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const targetDate = input.date ? dateParser.parse(input.date) : new Date();

    // Check if note exists before ensuring
    const existed = await noteService.noteExists("daily", targetDate);

    // Ensure the note exists
    const notePath = await noteService.ensureNote("daily", targetDate);

    // Read the content
    const content = await fs.readFile(notePath);

    return {
      path: notePath,
      content,
      created: !existed,
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the get_daily_note tool
 */
async function handleGetDailyNote(
  noteService: NoteService,
  input: GetDailyNoteInput
): Promise<GetDailyNoteOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const targetDate = dateParser.parse(input.date);

    const note = await noteService.getNote("daily", targetDate);

    return {
      path: note.path,
      content: note.content,
      frontmatter: note.frontmatter,
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the list_daily_notes tool
 */
async function handleListDailyNotes(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: ListDailyNotesInput
): Promise<ListDailyNotesOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const config = await configLoader.loadConfig(vaultPath);

    // Parse date filters if provided
    const startDate = input.startDate
      ? dateParser.parse(input.startDate)
      : undefined;
    const endDate = input.endDate ? dateParser.parse(input.endDate) : undefined;
    const limit = input.limit ?? 10;

    // Get the daily path pattern from config
    const dailyPathPattern = config.paths.daily;
    const pathMatcher = new PathMatcher();

    // Extract the directory from the pattern (everything before the first variable)
    const separator = vaultPath.includes("\\") ? "\\" : "/";
    const patternParts = dailyPathPattern.split(/[/\\]/);
    const directoryParts: string[] = [];

    // Find the directory parts (stop when we hit a pattern with {)
    for (const part of patternParts.slice(0, -1)) {
      if (part.includes("{")) {
        break;
      }
      directoryParts.push(part);
    }

    const dailyDir = directoryParts.length > 0
      ? [vaultPath, ...directoryParts].join(separator)
      : vaultPath;

    // Collect all .md files recursively
    const notes: { path: string; date: string; dateObj: Date }[] = [];

    async function scanDirectory(dirPath: string): Promise<void> {
      try {
        const entries = await fs.readdir(dirPath);
        for (const entry of entries) {
          const entryPath = `${dirPath}${separator}${entry}`;
          const stat = await fs.stat(entryPath);

          if (stat.isDirectory) {
            await scanDirectory(entryPath);
          } else if (entry.endsWith(".md")) {
            // Use PathMatcher to extract date from the full path
            const components = pathMatcher.extractDateComponents(entryPath, dailyPathPattern);
            if (components?.year && components.month && components.date) {
              try {
                const noteDate = pathMatcher.componentsToDate(components);
                const dateStr = pathMatcher.formatComponents(components);

                // Apply date filters
                if (startDate && noteDate < startDate) {
                  continue;
                }
                if (endDate && noteDate > endDate) {
                  continue;
                }

                notes.push({
                  path: entryPath,
                  date: dateStr,
                  dateObj: noteDate,
                });
              } catch {
                // Skip files with invalid dates
              }
            }
          }
        }
      } catch {
        // Directory doesn't exist or can't be read - that's okay
      }
    }

    // Check if daily directory exists
    if (await fs.exists(dailyDir)) {
      await scanDirectory(dailyDir);
    }

    // Sort by date descending (most recent first)
    notes.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    // Apply limit
    const limitedNotes = notes.slice(0, limit);

    return {
      notes: limitedNotes.map((n) => ({ path: n.path, date: n.date })),
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the ensure_periodic_note tool
 */
async function handleEnsurePeriodicNote(
  noteService: NoteService,
  fs: IFileSystem,
  input: EnsurePeriodicNoteInput
): Promise<EnsurePeriodicNoteOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const periodCalculator = new PeriodCalculator();
    const targetDate = input.date ? dateParser.parse(input.date) : new Date();
    const noteType = input.type as NoteType;

    // Check if note exists before ensuring
    const existed = await noteService.noteExists(noteType, targetDate);

    // Ensure the note exists
    const notePath = await noteService.ensureNote(noteType, targetDate);

    // Read the content
    const content = await fs.readFile(notePath);

    // Get period info
    const periodInfo = periodCalculator.getCurrentPeriod(noteType, targetDate);

    return {
      path: notePath,
      content,
      created: !existed,
      periodInfo: {
        start: periodInfo.start.toISOString().split("T")[0]!,
        end: periodInfo.end.toISOString().split("T")[0]!,
        label: periodInfo.label,
      },
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the get_current_period tool
 */
async function handleGetCurrentPeriod(
  configLoader: ConfigLoader,
  vaultPath: string,
  input: GetCurrentPeriodInput
): Promise<GetCurrentPeriodOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const periodCalculator = new PeriodCalculator();
    const pathGenerator = new PathGenerator();

    const targetDate = input.date ? dateParser.parse(input.date) : new Date();
    const noteType = input.type as NoteType;

    // Get period info
    const periodInfo = periodCalculator.getCurrentPeriod(noteType, targetDate);

    // Get the note path from config
    const config = await configLoader.loadConfig(vaultPath);
    const pathPattern = config.paths[noteType];
    const relativePath = pathGenerator.generatePath(pathPattern, targetDate);

    // Build full path
    const separator = vaultPath.includes("\\") ? "\\" : "/";
    const notePath = `${vaultPath}${separator}${relativePath}`;

    return {
      start: periodInfo.start.toISOString().split("T")[0]!,
      end: periodInfo.end.toISOString().split("T")[0]!,
      label: periodInfo.label,
      notePath,
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the list_periodic_notes tool
 */
async function handleListPeriodicNotes(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: ListPeriodicNotesInput
): Promise<ListPeriodicNotesOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const periodCalculator = new PeriodCalculator();
    const config = await configLoader.loadConfig(vaultPath);
    const noteType = input.type as NoteType;

    // Parse date filters if provided
    const startDate = input.startDate
      ? dateParser.parse(input.startDate)
      : undefined;
    const endDate = input.endDate ? dateParser.parse(input.endDate) : undefined;
    const limit = input.limit ?? 10;

    // Get the path pattern from config
    const pathPattern = config.paths[noteType];

    // Extract the directory from the pattern (everything before dynamic parts)
    const separator = vaultPath.includes("\\") ? "\\" : "/";
    const patternParts = pathPattern.split(/[/\\]/);
    const directoryParts: string[] = [];

    // Find the static directory parts (stop when we hit a pattern with { or {{)
    for (const part of patternParts.slice(0, -1)) {
      if (part.includes("{")) {
        break;
      }
      directoryParts.push(part);
    }

    const noteDir =
      directoryParts.length > 0
        ? [vaultPath, ...directoryParts].join(separator)
        : vaultPath;

    // Collect all .md files recursively
    const notes: {
      path: string;
      date: string;
      dateObj: Date;
      periodLabel: string;
    }[] = [];

    const pathMatcher = new PathMatcher();

    async function scanDirectory(dirPath: string): Promise<void> {
      try {
        const entries = await fs.readdir(dirPath);
        for (const entry of entries) {
          const entryPath = `${dirPath}${separator}${entry}`;
          const stat = await fs.stat(entryPath);

          if (stat.isDirectory) {
            await scanDirectory(entryPath);
          } else if (entry.endsWith(".md")) {
            // Use PathMatcher to extract date components from the full path
            const components = pathMatcher.extractDateComponents(entryPath, pathPattern);
            if (components) {
              try {
                const noteDate = pathMatcher.componentsToDate(components);
                const dateStr = pathMatcher.formatComponents(components);

                if (startDate && noteDate < startDate) continue;
                if (endDate && noteDate > endDate) continue;

                const periodInfo = periodCalculator.getCurrentPeriod(
                  noteType,
                  noteDate
                );
                notes.push({
                  path: entryPath,
                  date: dateStr,
                  dateObj: noteDate,
                  periodLabel: periodInfo.label,
                });
              } catch {
                // Skip files with invalid dates
              }
            }
          }
        }
      } catch {
        // Directory doesn't exist or can't be read - that's okay
      }
    }

    // Check if note directory exists
    if (await fs.exists(noteDir)) {
      await scanDirectory(noteDir);
    }

    // Sort by date descending (most recent first)
    notes.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    // Apply limit
    const limitedNotes = notes.slice(0, limit);

    return {
      notes: limitedNotes.map((n) => ({
        path: n.path,
        date: n.date,
        periodLabel: n.periodLabel,
      })),
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the create_from_template tool
 */
async function handleCreateFromTemplate(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: CreateFromTemplateInput
): Promise<CreateFromTemplateOutput | ToolErrorResponse> {
  try {
    const config = await configLoader.loadConfig(vaultPath);
    const registry = new TemplateRegistry(fs);

    // Load templates from config
    if (config.templates) {
      // Convert relative template paths to absolute paths
      for (const [name, templatePath] of Object.entries(config.templates)) {
        const separator = vaultPath.includes("\\") ? "\\" : "/";
        const absolutePath = `${vaultPath}${separator}${templatePath}`;
        registry.register(name, absolutePath);
      }
    }

    // Build the full target path
    const separator = vaultPath.includes("\\") ? "\\" : "/";
    const fullTargetPath = `${vaultPath}${separator}${input.targetPath}`;

    // Create the note from template
    const note = await createFromTemplate(
      input.template,
      fullTargetPath,
      input.variables,
      { fs, registry }
    );

    return {
      path: note.path,
      content: note.content,
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the list_templates tool
 */
async function handleListTemplates(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string
): Promise<ListTemplatesOutput | ToolErrorResponse> {
  try {
    const config = await configLoader.loadConfig(vaultPath);
    const registry = new TemplateRegistry(fs);

    // Load templates from config
    if (config.templates) {
      for (const [name, templatePath] of Object.entries(config.templates)) {
        const separator = vaultPath.includes("\\") ? "\\" : "/";
        const absolutePath = `${vaultPath}${separator}${templatePath}`;
        registry.register(name, absolutePath);
      }
    }

    // Get template list with full info
    const templates = [];
    const templateInfoList = await registry.list();

    for (const info of templateInfoList) {
      const variables = await registry.getVariables(info.name);

      templates.push({
        name: info.name,
        description: info.description ?? "",
        variables: variables.map((v) => ({
          name: v.name,
          required: v.required,
          ...(v.default !== undefined ? { default: v.default } : {}),
        })),
      });
    }

    return { templates };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the get_template tool
 */
async function handleGetTemplate(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: GetTemplateInput
): Promise<GetTemplateOutput | ToolErrorResponse> {
  try {
    const config = await configLoader.loadConfig(vaultPath);
    const registry = new TemplateRegistry(fs);

    // Load templates from config
    if (config.templates) {
      for (const [name, templatePath] of Object.entries(config.templates)) {
        const separator = vaultPath.includes("\\") ? "\\" : "/";
        const absolutePath = `${vaultPath}${separator}${templatePath}`;
        registry.register(name, absolutePath);
      }
    }

    // Get the template content and metadata
    const content = await registry.get(input.name);
    const metadata = await registry.getMetadata(input.name);

    return {
      name: input.name,
      content,
      metadata: {
        ...(metadata.name !== undefined ? { name: metadata.name } : {}),
        ...(metadata.description !== undefined ? { description: metadata.description } : {}),
        ...(metadata.variables !== undefined ? { variables: metadata.variables } : {}),
      },
    };
  } catch (error) {
    return formatError(error);
  }
}

// =====================
// Task Tool Helpers
// =====================

/**
 * Serializes task metadata to a JSON-safe format (Dates -> ISO strings)
 */
function serializeTaskMetadata(metadata: {
  due?: Date;
  priority?: "high" | "medium" | "low";
  tags: string[];
  scheduled?: Date;
  age?: number;
  created?: Date;
}): SerializedTaskMetadata {
  return {
    ...(metadata.due !== undefined
      ? { due: metadata.due.toISOString().split("T")[0] }
      : {}),
    ...(metadata.priority !== undefined ? { priority: metadata.priority } : {}),
    tags: metadata.tags,
    ...(metadata.scheduled !== undefined
      ? { scheduled: metadata.scheduled.toISOString().split("T")[0] }
      : {}),
    ...(metadata.age !== undefined ? { age: metadata.age } : {}),
    ...(metadata.created !== undefined
      ? { created: metadata.created.toISOString().split("T")[0] }
      : {}),
  };
}

/**
 * Serializes a Task to a JSON-safe format
 */
function serializeTask(task: Task): SerializedTask {
  return {
    line: task.line,
    text: task.text,
    completed: task.completed,
    metadata: serializeTaskMetadata(task.metadata),
    raw: task.raw,
  };
}

/**
 * Serializes a TaskWithSource to a JSON-safe format
 */
function serializeTaskWithSource(task: TaskWithSource): SerializedTaskWithSource {
  return {
    ...serializeTask(task),
    sourcePath: task.sourcePath,
    sourceDate: task.sourceDate.toISOString().split("T")[0]!,
  };
}

// =====================
// Task Tool Handlers
// =====================

/**
 * Handles the get_open_tasks tool
 */
async function handleGetOpenTasks(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: GetOpenTasksInput
): Promise<GetOpenTasksOutput | ToolErrorResponse> {
  try {
    const aggregator = new TaskAggregator(fs, configLoader);

    const aggregated = await aggregator.aggregate({
      vaultPath,
      daysBack: input.daysBack ?? 7,
      includeCompleted: false,
      noteTypes: ["daily"],
    });

    // Filter by priority if specified
    let tasks = aggregated.open;
    if (input.priority) {
      tasks = tasks.filter((t) => t.metadata.priority === input.priority);
    }

    // Filter by tag if specified
    if (input.tag) {
      const normalizedTag = input.tag.toLowerCase();
      tasks = tasks.filter((t) =>
        t.metadata.tags.some((tag) => tag.toLowerCase() === normalizedTag)
      );
    }

    return {
      tasks: tasks.map(serializeTaskWithSource),
      summary: {
        total: tasks.length,
        overdue: aggregated.overdue.filter((t) =>
          tasks.some((task) => task.line === t.line && task.sourcePath === t.sourcePath)
        ).length,
        stale: aggregated.stale.filter((t) =>
          tasks.some((task) => task.line === t.line && task.sourcePath === t.sourcePath)
        ).length,
      },
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the rollover_tasks tool
 */
async function handleRolloverTasks(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  noteService: NoteService,
  input: RolloverTasksInput
): Promise<RolloverTasksOutput | RolloverTasksDryRunOutput | ToolErrorResponse> {
  try {
    const rollover = new TaskRollover(fs, configLoader);

    if (input.dryRun) {
      // For dry run, we need to simulate the rollover without making changes
      // We'll use the aggregator to find incomplete tasks
      const aggregator = new TaskAggregator(fs, configLoader);
      const config = await configLoader.loadConfig(vaultPath);
      const pathGenerator = new PathGenerator();

      const aggregated = await aggregator.aggregate({
        vaultPath,
        daysBack: config.tasks.scanDaysBack,
        includeCompleted: false,
        noteTypes: ["daily"],
      });

      // Get the target note path
      const today = new Date();
      const targetPath = pathGenerator.generatePath(config.paths.daily, today);
      const separator = vaultPath.includes("\\") ? "\\" : "/";
      const fullTargetPath = `${vaultPath}${separator}${targetPath}`;

      // Filter to only tasks from before today
      const todayStr = today.toISOString().split("T")[0];
      const tasksToRollOver = aggregated.open.filter((t) => {
        const sourceStr = t.sourceDate.toISOString().split("T")[0];
        return sourceStr !== todayStr;
      });

      return {
        wouldRollOver: tasksToRollOver.map(serializeTaskWithSource),
        targetNote: fullTargetPath,
      };
    }

    // Ensure today's note exists before rollover
    await noteService.ensureNote("daily", new Date());

    // Perform actual rollover
    const result = await rollover.rollover({ vaultPath });

    return {
      rolledOver: result.rolledOver.map(serializeTaskWithSource),
      targetNote: result.targetNotePath,
      skipped: result.skipped.map((s) => ({
        task: serializeTask(s.task),
        reason: s.reason,
      })),
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the toggle_task tool
 */
async function handleToggleTask(
  fs: IFileSystem,
  vaultPath: string,
  input: ToggleTaskInput
): Promise<ToggleTaskOutput | ToolErrorResponse> {
  try {
    const modifier = new TaskModifier(fs);

    // Resolve the file path (handle both absolute and relative paths)
    let filePath = input.filePath;
    if (!filePath.includes(":") && !filePath.startsWith("/")) {
      // Relative path - prepend vault path
      const separator = vaultPath.includes("\\") ? "\\" : "/";
      filePath = `${vaultPath}${separator}${filePath}`;
    }

    const updatedTask = await modifier.toggleTask(filePath, input.lineNumber);

    return {
      task: serializeTask(updatedTask),
      newState: updatedTask.completed ? "completed" : "open",
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the get_overdue_tasks tool
 */
async function handleGetOverdueTasks(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string
): Promise<GetOverdueTasksOutput | ToolErrorResponse> {
  try {
    const aggregator = new TaskAggregator(fs, configLoader);
    const config = await configLoader.loadConfig(vaultPath);

    const aggregated = await aggregator.aggregate({
      vaultPath,
      daysBack: config.tasks.scanDaysBack,
      includeCompleted: false,
      noteTypes: ["daily"],
    });

    return {
      tasks: aggregated.overdue.map(serializeTaskWithSource),
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the add_task tool
 */
async function handleAddTask(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  noteService: NoteService,
  input: AddTaskInput
): Promise<AddTaskOutput | ToolErrorResponse> {
  try {
    const modifier = new TaskModifier(fs);
    const dateParser = new DateParser();
    const config = await configLoader.loadConfig(vaultPath);

    // Ensure today's note exists
    const today = new Date();
    const notePath = await noteService.ensureNote("daily", today);

    // Parse the due date if provided
    let dueDate: Date | undefined;
    if (input.due) {
      dueDate = dateParser.parse(input.due);
    }

    // Build task metadata
    const metadata: {
      due?: Date;
      priority?: "high" | "medium" | "low";
      tags?: string[];
    } = {};

    if (dueDate) {
      metadata.due = dueDate;
    }
    if (input.priority) {
      metadata.priority = input.priority;
    }
    if (input.tags && input.tags.length > 0) {
      metadata.tags = input.tags;
    }

    // Get the tasks section heading
    const tasksSection = config.sections["tasks"] ?? "## Tasks";

    // Add the task
    const task = await modifier.addTask(notePath, tasksSection, {
      text: input.text,
      completed: false,
      metadata,
    });

    return {
      task: serializeTask(task),
      notePath,
    };
  } catch (error) {
    return formatError(error);
  }
}

// =====================
// Context and Search Tool Handlers
// =====================

/**
 * Handles the get_context tool
 */
async function handleGetContext(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: GetContextInput
): Promise<GetContextOutput | ToolErrorResponse> {
  try {
    const contextBuilder = new ContextBuilder(fs, configLoader, vaultPath);

    const context = await contextBuilder.getContext({
      dailyCount: input.dailyCount ?? 3,
      includeWeekly: true,
      includeMonthly: true,
      includeQuarterly: false,
      includeTasks: input.includeTasks !== false,
    });

    // Build note summaries
    const notes: NoteSummary[] = [];

    // Add daily notes
    for (const note of context.daily) {
      const dateMatch = /(\d{4}-\d{2}-\d{2})/.exec(note.path);
      notes.push({
        path: note.path,
        type: "daily",
        date: dateMatch?.[1] ?? "unknown",
      });
    }

    // Add weekly note if present
    if (context.weekly) {
      const weekMatch = /(\d{4}).*W(\d{1,2})/.exec(context.weekly.path);
      notes.push({
        path: context.weekly.path,
        type: "weekly",
        date: weekMatch ? `${weekMatch[1]}-W${weekMatch[2]}` : "current week",
      });
    }

    // Add monthly note if present
    if (context.monthly) {
      const monthMatch = /(\d{4}).*?(\d{2})\.md$/.exec(context.monthly.path);
      notes.push({
        path: context.monthly.path,
        type: "monthly",
        date: monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : "current month",
      });
    }

    // Add quarterly note if present
    if (context.quarterly) {
      const quarterMatch = /(\d{4}).*Q(\d)/.exec(context.quarterly.path);
      notes.push({
        path: context.quarterly.path,
        type: "quarterly",
        date: quarterMatch ? `${quarterMatch[1]}-Q${quarterMatch[2]}` : "current quarter",
      });
    }

    // Build task summary
    const highPriorityTasks = context.tasks.open.filter(
      (t) => t.metadata.priority === "high"
    );

    const tasks: TaskSummary = {
      openCount: context.tasks.open.length,
      overdueCount: context.tasks.overdue.length,
      overdue: context.tasks.overdue.map(serializeTaskWithSource),
      highPriority: highPriorityTasks.map(serializeTaskWithSource),
    };

    return {
      context: context.summary,
      notes,
      tasks,
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the search_vault tool
 */
async function handleSearchVault(
  fs: IFileSystem,
  vaultPath: string,
  input: SearchVaultInput
): Promise<SearchVaultOutput | ToolErrorResponse> {
  try {
    const search = new VaultSearch(fs, vaultPath);
    const limit = input.limit ?? 10;

    if (input.type === "files") {
      const results = await search.searchFiles(input.query, { limit });
      return {
        results: results.map((r) => ({
          path: r.path,
          score: r.score,
        })),
      };
    } else if (input.type === "content") {
      const results = await search.searchContent(input.query, { limit });
      return {
        results: results.map((r) => ({
          path: r.path,
          line: r.line,
          content: r.content,
        })),
      };
    } else if (input.type === "frontmatter") {
      if (!input.field) {
        return {
          error: {
            code: "CADENCE_INVALID_INPUT",
            message: "frontmatter search requires a 'field' parameter",
          },
        };
      }
      const results = await search.searchFrontmatter(input.field, input.query, {
        limit,
      });
      return {
        results: results.map((r) => ({
          path: r.path,
          frontmatter: r.frontmatter,
        })),
      };
    }

    // Exhaustive check - input.type should be never here
    const invalidType: never = input.type;
    return {
      error: {
        code: "CADENCE_INVALID_INPUT",
        message: `Invalid search type: ${String(invalidType)}`,
      },
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the append_to_section tool
 */
async function handleAppendToSection(
  fs: IFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: AppendToSectionInput
): Promise<AppendToSectionOutput | ToolErrorResponse> {
  try {
    const config = await configLoader.loadConfig(vaultPath);

    // Validate section exists in config
    const sectionHeader = config.sections[input.section];
    if (!sectionHeader) {
      const availableSections = Object.keys(config.sections).join(", ");
      return {
        error: {
          code: "CADENCE_INVALID_INPUT",
          message: `Section '${input.section}' is not defined in config.sections. Available sections: ${availableSections}`,
        },
      };
    }

    // Build full path
    const separator = vaultPath.includes("\\") ? "\\" : "/";
    const fullPath = `${vaultPath}${separator}${input.notePath}`;

    // Check if note exists
    if (!(await fs.exists(fullPath))) {
      return {
        error: {
          code: "CADENCE_NOTE_NOT_FOUND",
          message: `Note not found: ${input.notePath}`,
        },
      };
    }

    // Read the note content
    const content = await fs.readFile(fullPath);
    const lines = content.split("\n");

    // Find the section
    const sectionIndex = lines.findIndex((line) =>
      line.trim().startsWith(sectionHeader)
    );

    if (sectionIndex === -1) {
      return {
        error: {
          code: "CADENCE_SECTION_NOT_FOUND",
          message: `Section '${sectionHeader}' not found in note: ${input.notePath}`,
        },
      };
    }

    // Find the end of the section (next heading or end of file)
    let insertIndex = lines.length;
    for (let i = sectionIndex + 1; i < lines.length; i++) {
      const line = lines[i]!;
      // Check if this is another heading (starts with ##)
      if (/^#{1,6}\s/.exec(line.trim())) {
        insertIndex = i;
        break;
      }
    }

    // Insert content before the next section (or at end)
    // Add a newline before content if the previous line isn't empty
    const contentToInsert = input.content.endsWith("\n")
      ? input.content
      : input.content + "\n";

    lines.splice(insertIndex, 0, contentToInsert);

    // Write back
    await fs.writeFile(fullPath, lines.join("\n"));

    return {
      success: true,
      notePath: input.notePath,
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Handles the read_note tool
 */
async function handleReadNote(
  fs: IFileSystem,
  vaultPath: string,
  input: ReadNoteInput
): Promise<ReadNoteOutput | ToolErrorResponse> {
  try {
    const frontmatterParser = new FrontmatterParser();

    // Build full path
    const separator = vaultPath.includes("\\") ? "\\" : "/";
    const fullPath = `${vaultPath}${separator}${input.path}`;

    // Check if note exists
    if (!(await fs.exists(fullPath))) {
      return {
        error: {
          code: "CADENCE_NOTE_NOT_FOUND",
          message: `Note not found: ${input.path}`,
        },
      };
    }

    // Read and parse the note
    const content = await fs.readFile(fullPath);
    const parsed = frontmatterParser.parse(content);

    return {
      content,
      frontmatter: parsed.frontmatter,
    };
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Main entry point for the MCP server
 */
async function main() {
  const server = new Server(
    {
      name: "cadence-mcp",
      version: "0.0.1",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Initialize file system and vault context
  const fs = new NodeFileSystem();
  let vaultContext: Awaited<ReturnType<typeof createVaultContext>> | null =
    null;

  // Lazy initialization of vault context
  async function getVaultContext() {
    if (!vaultContext) {
      vaultContext = await createVaultContext(fs);
    }
    return vaultContext;
  }

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_DEFINITIONS,
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const { noteService, configLoader, vaultPath, fs: vaultFs } =
        await getVaultContext();

      let result: unknown;

      switch (name) {
        case "ensure_daily_note":
          result = await handleEnsureDailyNote(
            noteService,
            vaultFs,
            (args ?? {}) as EnsureDailyNoteInput
          );
          break;

        case "get_daily_note":
          if (!args || typeof args !== "object" || !("date" in args)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message: "get_daily_note requires a 'date' parameter",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleGetDailyNote(
            noteService,
            args as unknown as GetDailyNoteInput
          );
          break;

        case "list_daily_notes":
          result = await handleListDailyNotes(
            vaultFs,
            configLoader,
            vaultPath,
            (args ?? {}) as ListDailyNotesInput
          );
          break;

        case "ensure_periodic_note":
          if (!args || typeof args !== "object" || !("type" in args)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message: "ensure_periodic_note requires a 'type' parameter",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleEnsurePeriodicNote(
            noteService,
            vaultFs,
            args as unknown as EnsurePeriodicNoteInput
          );
          break;

        case "get_current_period":
          if (!args || typeof args !== "object" || !("type" in args)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message: "get_current_period requires a 'type' parameter",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleGetCurrentPeriod(
            configLoader,
            vaultPath,
            args as unknown as GetCurrentPeriodInput
          );
          break;

        case "list_periodic_notes":
          if (!args || typeof args !== "object" || !("type" in args)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message: "list_periodic_notes requires a 'type' parameter",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleListPeriodicNotes(
            vaultFs,
            configLoader,
            vaultPath,
            args as unknown as ListPeriodicNotesInput
          );
          break;

        case "create_from_template":
          if (
            !args ||
            typeof args !== "object" ||
            !("template" in args) ||
            !("targetPath" in args) ||
            !("variables" in args)
          ) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message:
                        "create_from_template requires 'template', 'targetPath', and 'variables' parameters",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleCreateFromTemplate(
            vaultFs,
            configLoader,
            vaultPath,
            args as unknown as CreateFromTemplateInput
          );
          break;

        case "list_templates":
          result = await handleListTemplates(vaultFs, configLoader, vaultPath);
          break;

        case "get_template":
          if (!args || typeof args !== "object" || !("name" in args)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message: "get_template requires a 'name' parameter",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleGetTemplate(
            vaultFs,
            configLoader,
            vaultPath,
            args as unknown as GetTemplateInput
          );
          break;

        // Task management tools
        case "get_open_tasks":
          result = await handleGetOpenTasks(
            vaultFs,
            configLoader,
            vaultPath,
            (args ?? {}) as GetOpenTasksInput
          );
          break;

        case "rollover_tasks":
          result = await handleRolloverTasks(
            vaultFs,
            configLoader,
            vaultPath,
            noteService,
            (args ?? {}) as RolloverTasksInput
          );
          break;

        case "toggle_task":
          if (
            !args ||
            typeof args !== "object" ||
            !("filePath" in args) ||
            !("lineNumber" in args)
          ) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message:
                        "toggle_task requires 'filePath' and 'lineNumber' parameters",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleToggleTask(
            vaultFs,
            vaultPath,
            args as unknown as ToggleTaskInput
          );
          break;

        case "get_overdue_tasks":
          result = await handleGetOverdueTasks(vaultFs, configLoader, vaultPath);
          break;

        case "add_task":
          if (!args || typeof args !== "object" || !("text" in args)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message: "add_task requires a 'text' parameter",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleAddTask(
            vaultFs,
            configLoader,
            vaultPath,
            noteService,
            args as unknown as AddTaskInput
          );
          break;

        // Context and search tools
        case "get_context":
          result = await handleGetContext(
            vaultFs,
            configLoader,
            vaultPath,
            (args ?? {}) as GetContextInput
          );
          break;

        case "search_vault":
          if (
            !args ||
            typeof args !== "object" ||
            !("query" in args) ||
            !("type" in args)
          ) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message:
                        "search_vault requires 'query' and 'type' parameters",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleSearchVault(
            vaultFs,
            vaultPath,
            args as unknown as SearchVaultInput
          );
          break;

        case "append_to_section":
          if (
            !args ||
            typeof args !== "object" ||
            !("notePath" in args) ||
            !("section" in args) ||
            !("content" in args)
          ) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message:
                        "append_to_section requires 'notePath', 'section', and 'content' parameters",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleAppendToSection(
            vaultFs,
            configLoader,
            vaultPath,
            args as unknown as AppendToSectionInput
          );
          break;

        case "read_note":
          if (!args || typeof args !== "object" || !("path" in args)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: {
                      code: "CADENCE_INVALID_INPUT",
                      message: "read_note requires a 'path' parameter",
                    },
                  }),
                },
              ],
              isError: true,
            };
          }
          result = await handleReadNote(
            vaultFs,
            vaultPath,
            args as unknown as ReadNoteInput
          );
          break;

        default:
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: {
                    code: "CADENCE_UNKNOWN_TOOL",
                    message: `Unknown tool: ${name}`,
                  },
                }),
              },
            ],
            isError: true,
          };
      }

      // Check if result is an error
      const isError = "error" in (result as object);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(formatError(error), null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
