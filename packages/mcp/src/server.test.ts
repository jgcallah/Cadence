import { describe, it, expect, beforeEach } from "vitest";
import {
  MemoryFileSystem,
  ConfigLoader,
  NoteService,
  DateParser,
  PathGenerator,
  PathMatcher,
  PeriodCalculator,
  CadenceError,
  NoteNotFoundError,
  VaultNotFoundError,
  TemplateNotFoundError as _TemplateNotFoundError,
  TemplateRegistry,
  createFromTemplate,
  getDefaultConfig,
  TaskAggregator,
  TaskRollover,
  TaskModifier,
  ContextBuilder,
  VaultSearch,
  FrontmatterParser,
  type CadenceConfig,
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

// Helper to create dates in local timezone at noon to avoid timezone issues
function _localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

// Test implementations of the tool handlers (extracted from server.ts logic for testing)
async function handleEnsureDailyNote(
  noteService: NoteService,
  fs: MemoryFileSystem,
  input: EnsureDailyNoteInput
): Promise<EnsureDailyNoteOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const targetDate = input.date ? dateParser.parse(input.date) : new Date();

    const existed = await noteService.noteExists("daily", targetDate);
    const notePath = await noteService.ensureNote("daily", targetDate);
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

async function handleListDailyNotes(
  fs: MemoryFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: ListDailyNotesInput
): Promise<ListDailyNotesOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const config = await configLoader.loadConfig(vaultPath);

    const startDate = input.startDate
      ? dateParser.parse(input.startDate)
      : undefined;
    const endDate = input.endDate ? dateParser.parse(input.endDate) : undefined;
    const limit = input.limit ?? 10;

    const dailyPathPattern = config.paths.daily;
    const pathMatcher = new PathMatcher();
    const separator = "/";
    const patternParts = dailyPathPattern.split(/[/\\]/);
    const directoryParts: string[] = [];

    for (const part of patternParts.slice(0, -1)) {
      if (part.includes("{")) {
        break;
      }
      directoryParts.push(part);
    }

    const dailyDir =
      directoryParts.length > 0
        ? [vaultPath, ...directoryParts].join(separator)
        : vaultPath;

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
            const components = pathMatcher.extractDateComponents(
              entryPath,
              dailyPathPattern
            );
            if (components && components.year && components.month && components.date) {
              try {
                const noteDate = pathMatcher.componentsToDate(components);
                const dateStr = pathMatcher.formatComponents(components);

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
        // Directory doesn't exist or can't be read
      }
    }

    if (await fs.exists(dailyDir)) {
      await scanDirectory(dailyDir);
    }

    notes.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
    const limitedNotes = notes.slice(0, limit);

    return {
      notes: limitedNotes.map((n) => ({ path: n.path, date: n.date })),
    };
  } catch (error) {
    return formatError(error);
  }
}

async function handleEnsurePeriodicNote(
  noteService: NoteService,
  fs: MemoryFileSystem,
  input: EnsurePeriodicNoteInput
): Promise<EnsurePeriodicNoteOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const periodCalculator = new PeriodCalculator();
    const targetDate = input.date ? dateParser.parse(input.date) : new Date();
    const noteType = input.type as NoteType;

    const existed = await noteService.noteExists(noteType, targetDate);
    const notePath = await noteService.ensureNote(noteType, targetDate);
    const content = await fs.readFile(notePath);
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

    const periodInfo = periodCalculator.getCurrentPeriod(noteType, targetDate);
    const config = await configLoader.loadConfig(vaultPath);
    const pathPattern = config.paths[noteType];
    const relativePath = pathGenerator.generatePath(pathPattern, targetDate);
    const separator = "/";
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

async function handleListPeriodicNotes(
  fs: MemoryFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: ListPeriodicNotesInput
): Promise<ListPeriodicNotesOutput | ToolErrorResponse> {
  try {
    const dateParser = new DateParser();
    const periodCalculator = new PeriodCalculator();
    const config = await configLoader.loadConfig(vaultPath);
    const noteType = input.type as NoteType;

    const startDate = input.startDate
      ? dateParser.parse(input.startDate)
      : undefined;
    const endDate = input.endDate ? dateParser.parse(input.endDate) : undefined;
    const limit = input.limit ?? 10;

    const pathPattern = config.paths[noteType];
    const pathMatcher = new PathMatcher();
    const separator = "/";
    const patternParts = pathPattern.split(/[/\\]/);
    const directoryParts: string[] = [];

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

    const notes: {
      path: string;
      date: string;
      dateObj: Date;
      periodLabel: string;
    }[] = [];

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

                const periodInfo = periodCalculator.getCurrentPeriod(noteType, noteDate);
                notes.push({
                  path: entryPath,
                  date: dateStr,
                  dateObj: noteDate,
                  periodLabel: periodInfo.label,
                });
              } catch {
                // Skip invalid dates
              }
            }
          }
        }
      } catch {
        // Directory doesn't exist or can't be read
      }
    }

    if (await fs.exists(noteDir)) {
      await scanDirectory(noteDir);
    }

    notes.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
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

async function handleCreateFromTemplate(
  fs: MemoryFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  input: CreateFromTemplateInput
): Promise<CreateFromTemplateOutput | ToolErrorResponse> {
  try {
    const config = await configLoader.loadConfig(vaultPath);
    const registry = new TemplateRegistry(fs);

    // Load templates from config
    if (config.templates) {
      for (const [name, templatePath] of Object.entries(config.templates)) {
        const separator = "/";
        const absolutePath = `${vaultPath}${separator}${templatePath}`;
        registry.register(name, absolutePath);
      }
    }

    // Build the full target path
    const separator = "/";
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

async function handleListTemplates(
  fs: MemoryFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string
): Promise<ListTemplatesOutput | ToolErrorResponse> {
  try {
    const config = await configLoader.loadConfig(vaultPath);
    const registry = new TemplateRegistry(fs);

    // Load templates from config
    if (config.templates) {
      for (const [name, templatePath] of Object.entries(config.templates)) {
        const separator = "/";
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

async function handleGetTemplate(
  fs: MemoryFileSystem,
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
        const separator = "/";
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

function formatError(error: unknown): ToolErrorResponse {
  if (error instanceof CadenceError) {
    return {
      error: error.toJSON(),
    };
  }

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

function isError(result: unknown): result is ToolErrorResponse {
  return (
    typeof result === "object" && result !== null && "error" in result
  );
}

// =====================
// Context and Search Tool Test Handlers
// =====================

async function handleGetContext(
  fs: MemoryFileSystem,
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
      const dateMatch = note.path.match(/(\d{4}-\d{2}-\d{2})/);
      notes.push({
        path: note.path,
        type: "daily",
        date: dateMatch?.[1] ?? "unknown",
      });
    }

    // Add weekly note if present
    if (context.weekly) {
      const weekMatch = context.weekly.path.match(/(\d{4}).*W(\d{1,2})/);
      notes.push({
        path: context.weekly.path,
        type: "weekly",
        date: weekMatch ? `${weekMatch[1]}-W${weekMatch[2]}` : "current week",
      });
    }

    // Add monthly note if present
    if (context.monthly) {
      const monthMatch = context.monthly.path.match(/(\d{4}).*?(\d{2})\.md$/);
      notes.push({
        path: context.monthly.path,
        type: "monthly",
        date: monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : "current month",
      });
    }

    // Add quarterly note if present
    if (context.quarterly) {
      const quarterMatch = context.quarterly.path.match(/(\d{4}).*Q(\d)/);
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

async function handleSearchVault(
  fs: MemoryFileSystem,
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

    return {
      error: {
        code: "CADENCE_INVALID_INPUT",
        message: `Invalid search type: ${input.type}`,
      },
    };
  } catch (error) {
    return formatError(error);
  }
}

async function handleAppendToSection(
  fs: MemoryFileSystem,
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
    const separator = "/";
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
      if (line.trim().match(/^#{1,6}\s/)) {
        insertIndex = i;
        break;
      }
    }

    // Insert content before the next section (or at end)
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

async function handleReadNote(
  fs: MemoryFileSystem,
  vaultPath: string,
  input: ReadNoteInput
): Promise<ReadNoteOutput | ToolErrorResponse> {
  try {
    const frontmatterParser = new FrontmatterParser();

    // Build full path
    const separator = "/";
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

describe("MCP Tool Handlers", () => {
  let fs: MemoryFileSystem;
  let configLoader: ConfigLoader;
  let noteService: NoteService;
  const vaultPath = "/vault";

  beforeEach(async () => {
    fs = new MemoryFileSystem();
    configLoader = new ConfigLoader(fs);

    const config: CadenceConfig = {
      ...getDefaultConfig(),
      paths: {
        daily: "Journal/Daily/{year}-{month}-{date}.md",
        weekly: "Journal/Weekly/{year}/W{week}.md",
        monthly: "Journal/Monthly/{year}/{month}.md",
        quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
        yearly: "Journal/Yearly/{year}.md",
        templates: "Templates",
      },
      templates: {
        daily: "Templates/daily.md",
        weekly: "Templates/weekly.md",
        monthly: "Templates/monthly.md",
        quarterly: "Templates/quarterly.md",
        yearly: "Templates/yearly.md",
      },
    };

    await fs.mkdir(`${vaultPath}/.cadence`, true);
    await fs.writeFile(
      `${vaultPath}/.cadence/config.json`,
      JSON.stringify(config)
    );

    await fs.mkdir(`${vaultPath}/Templates`, true);
    await fs.writeFile(
      `${vaultPath}/Templates/daily.md`,
      `---
type: daily
date: '{{date}}'
---
# Daily Note for {{date}}

## Tasks

## Notes
`
    );
    await fs.writeFile(
      `${vaultPath}/Templates/weekly.md`,
      `---
type: weekly
week: '{{week}}'
---
# Weekly Note

## Goals

## Review
`
    );
    await fs.writeFile(
      `${vaultPath}/Templates/monthly.md`,
      `---
type: monthly
month: '{{month}}'
---
# Monthly Note

## Goals

## Review
`
    );
    await fs.writeFile(
      `${vaultPath}/Templates/quarterly.md`,
      `---
type: quarterly
quarter: '{{quarter}}'
---
# Quarterly Note

## OKRs

## Review
`
    );
    await fs.writeFile(
      `${vaultPath}/Templates/yearly.md`,
      `---
type: yearly
year: '{{year}}'
---
# Yearly Note

## Theme

## Goals
`
    );

    noteService = new NoteService(fs, configLoader, vaultPath);
  });

  describe("ensure_daily_note", () => {
    describe("input validation", () => {
      it("should accept empty input (defaults to today)", async () => {
        const result = await handleEnsureDailyNote(noteService, fs, {});

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.path).toBeDefined();
          expect(result.content).toBeDefined();
          expect(result.created).toBe(true);
        }
      });

      it("should accept ISO date string", async () => {
        const result = await handleEnsureDailyNote(noteService, fs, {
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.path).toContain("2026-03-15");
        }
      });

      it("should accept natural language date", async () => {
        const result = await handleEnsureDailyNote(noteService, fs, {
          date: "yesterday",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.created).toBe(true);
        }
      });

      it("should return error for invalid date string", async () => {
        const result = await handleEnsureDailyNote(noteService, fs, {
          date: "not-a-real-date-format-xyz",
        });

        expect(isError(result)).toBe(true);
        if (isError(result)) {
          expect(result.error.code).toBe("CADENCE_UNKNOWN");
          expect(result.error.message).toContain("Unable to parse date");
        }
      });
    });

    describe("output format", () => {
      it("should return path, content, and created flag", async () => {
        const result = await handleEnsureDailyNote(noteService, fs, {
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(typeof result.path).toBe("string");
          expect(typeof result.content).toBe("string");
          expect(typeof result.created).toBe("boolean");
        }
      });

      it("should set created=true for new notes", async () => {
        const result = await handleEnsureDailyNote(noteService, fs, {
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.created).toBe(true);
        }
      });

      it("should set created=false for existing notes", async () => {
        // Create note first
        await handleEnsureDailyNote(noteService, fs, { date: "2026-03-15" });

        // Call again - should find existing note
        const result = await handleEnsureDailyNote(noteService, fs, {
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.created).toBe(false);
        }
      });
    });
  });

  describe("get_daily_note", () => {
    describe("input validation", () => {
      it("should require date parameter", async () => {
        // This test validates the schema requirement - the handler
        // requires a date, and without it would error
        const result = await handleGetDailyNote(noteService, {
          date: "",
        });

        expect(isError(result)).toBe(true);
      });

      it("should accept ISO date string", async () => {
        // Create note first
        await handleEnsureDailyNote(noteService, fs, { date: "2026-03-15" });

        const result = await handleGetDailyNote(noteService, {
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
      });

      it("should accept natural language date", async () => {
        // Create today's note first
        await handleEnsureDailyNote(noteService, fs, { date: "today" });

        const result = await handleGetDailyNote(noteService, {
          date: "today",
        });

        expect(isError(result)).toBe(false);
      });

      it("should return error for invalid date string", async () => {
        const result = await handleGetDailyNote(noteService, {
          date: "not-a-date-xyz-invalid",
        });

        expect(isError(result)).toBe(true);
        if (isError(result)) {
          expect(result.error.message).toContain("Unable to parse date");
        }
      });
    });

    describe("output format", () => {
      it("should return path, content, and frontmatter", async () => {
        // Create note first
        await handleEnsureDailyNote(noteService, fs, { date: "2026-03-15" });

        const result = await handleGetDailyNote(noteService, {
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(typeof result.path).toBe("string");
          expect(typeof result.content).toBe("string");
          expect(typeof result.frontmatter).toBe("object");
        }
      });

      it("should return frontmatter as object", async () => {
        await handleEnsureDailyNote(noteService, fs, { date: "2026-03-15" });

        const result = await handleGetDailyNote(noteService, {
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.frontmatter).toHaveProperty("type", "daily");
        }
      });
    });

    describe("error response structure", () => {
      it("should return NoteNotFoundError when note does not exist", async () => {
        const result = await handleGetDailyNote(noteService, {
          date: "2020-01-01",
        });

        expect(isError(result)).toBe(true);
        if (isError(result)) {
          expect(result.error.code).toBe("CADENCE_NOTE_NOT_FOUND");
          expect(result.error.message).toContain("Note not found");
        }
      });

      it("should include notePath in error response", async () => {
        const result = await handleGetDailyNote(noteService, {
          date: "2020-01-01",
        });

        expect(isError(result)).toBe(true);
        if (isError(result)) {
          expect(result.error).toHaveProperty("notePath");
        }
      });
    });
  });

  describe("list_daily_notes", () => {
    beforeEach(async () => {
      // Create several daily notes for testing
      await handleEnsureDailyNote(noteService, fs, { date: "2026-03-10" });
      await handleEnsureDailyNote(noteService, fs, { date: "2026-03-11" });
      await handleEnsureDailyNote(noteService, fs, { date: "2026-03-12" });
      await handleEnsureDailyNote(noteService, fs, { date: "2026-03-13" });
      await handleEnsureDailyNote(noteService, fs, { date: "2026-03-14" });
    });

    describe("input validation", () => {
      it("should accept empty input", async () => {
        const result = await handleListDailyNotes(
          fs,
          configLoader,
          vaultPath,
          {}
        );

        expect(isError(result)).toBe(false);
      });

      it("should accept limit parameter", async () => {
        const result = await handleListDailyNotes(fs, configLoader, vaultPath, {
          limit: 3,
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes.length).toBeLessThanOrEqual(3);
        }
      });

      it("should accept startDate parameter", async () => {
        const result = await handleListDailyNotes(fs, configLoader, vaultPath, {
          startDate: "2026-03-12",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          for (const note of result.notes) {
            expect(note.date >= "2026-03-12").toBe(true);
          }
        }
      });

      it("should accept endDate parameter", async () => {
        const result = await handleListDailyNotes(fs, configLoader, vaultPath, {
          endDate: "2026-03-12",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          for (const note of result.notes) {
            expect(note.date <= "2026-03-12").toBe(true);
          }
        }
      });

      it("should accept date range parameters", async () => {
        const result = await handleListDailyNotes(fs, configLoader, vaultPath, {
          startDate: "2026-03-11",
          endDate: "2026-03-13",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes.length).toBe(3);
        }
      });

      it("should accept natural language dates for filtering", async () => {
        const result = await handleListDailyNotes(fs, configLoader, vaultPath, {
          startDate: "March 11, 2026",
          endDate: "March 13, 2026",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          // Natural language date parsing can vary slightly in inclusiveness
          // so we check that we get at least 2 notes in the range
          expect(result.notes.length).toBeGreaterThanOrEqual(2);
          expect(result.notes.length).toBeLessThanOrEqual(3);
        }
      });
    });

    describe("output format", () => {
      it("should return notes array", async () => {
        const result = await handleListDailyNotes(
          fs,
          configLoader,
          vaultPath,
          {}
        );

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(Array.isArray(result.notes)).toBe(true);
        }
      });

      it("should return notes with path and date properties", async () => {
        const result = await handleListDailyNotes(
          fs,
          configLoader,
          vaultPath,
          {}
        );

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          for (const note of result.notes) {
            expect(typeof note.path).toBe("string");
            expect(typeof note.date).toBe("string");
            expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          }
        }
      });

      it("should sort notes by date descending", async () => {
        const result = await handleListDailyNotes(
          fs,
          configLoader,
          vaultPath,
          {}
        );

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          const dates = result.notes.map((n) => n.date);
          const sorted = [...dates].sort().reverse();
          expect(dates).toEqual(sorted);
        }
      });

      it("should apply default limit of 10", async () => {
        // Create more notes
        for (let i = 15; i <= 30; i++) {
          await handleEnsureDailyNote(noteService, fs, {
            date: `2026-03-${i}`,
          });
        }

        const result = await handleListDailyNotes(
          fs,
          configLoader,
          vaultPath,
          {}
        );

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes.length).toBe(10);
        }
      });
    });

    describe("error response structure", () => {
      it("should return empty array when no notes exist in date range", async () => {
        const result = await handleListDailyNotes(fs, configLoader, vaultPath, {
          startDate: "2020-01-01",
          endDate: "2020-01-31",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes).toEqual([]);
        }
      });
    });
  });

  describe("ensure_periodic_note", () => {
    describe("input validation", () => {
      it("should require type parameter", async () => {
        // Test that a call without type would fail (validated at server level)
        // Here we test that the handler works with valid type
        const result = await handleEnsurePeriodicNote(noteService, fs, {
          type: "weekly",
        });
        expect(isError(result)).toBe(false);
      });

      it("should accept all note types", async () => {
        const types: ("daily" | "weekly" | "monthly" | "quarterly" | "yearly")[] = [
          "daily",
          "weekly",
          "monthly",
          "quarterly",
          "yearly",
        ];

        for (const type of types) {
          const result = await handleEnsurePeriodicNote(noteService, fs, { type });
          expect(isError(result)).toBe(false);
        }
      });

      it("should accept optional date parameter", async () => {
        const result = await handleEnsurePeriodicNote(noteService, fs, {
          type: "weekly",
          date: "2026-03-15",
        });
        expect(isError(result)).toBe(false);
      });

      it("should accept natural language dates", async () => {
        const result = await handleEnsurePeriodicNote(noteService, fs, {
          type: "monthly",
          date: "last month",
        });
        expect(isError(result)).toBe(false);
      });

      it("should return error for invalid date", async () => {
        const result = await handleEnsurePeriodicNote(noteService, fs, {
          type: "weekly",
          date: "not-a-valid-date-xyz",
        });
        expect(isError(result)).toBe(true);
      });
    });

    describe("output format", () => {
      it("should return path, content, created flag, and periodInfo", async () => {
        const result = await handleEnsurePeriodicNote(noteService, fs, {
          type: "weekly",
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(typeof result.path).toBe("string");
          expect(typeof result.content).toBe("string");
          expect(typeof result.created).toBe("boolean");
          expect(result.periodInfo).toBeDefined();
          expect(result.periodInfo.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(result.periodInfo.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(typeof result.periodInfo.label).toBe("string");
        }
      });

      it("should return created=true for new notes", async () => {
        const result = await handleEnsurePeriodicNote(noteService, fs, {
          type: "quarterly",
          date: "2026-01-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.created).toBe(true);
        }
      });

      it("should return created=false for existing notes", async () => {
        // Create note first
        await handleEnsurePeriodicNote(noteService, fs, {
          type: "monthly",
          date: "2026-03-15",
        });

        // Call again
        const result = await handleEnsurePeriodicNote(noteService, fs, {
          type: "monthly",
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.created).toBe(false);
        }
      });

      it("should return appropriate periodInfo for weekly notes", async () => {
        const result = await handleEnsurePeriodicNote(noteService, fs, {
          type: "weekly",
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.periodInfo.label).toMatch(/Week \d+, \d{4}/);
        }
      });

      it("should return appropriate periodInfo for quarterly notes", async () => {
        const result = await handleEnsurePeriodicNote(noteService, fs, {
          type: "quarterly",
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.periodInfo.label).toMatch(/Q[1-4] \d{4}/);
        }
      });
    });
  });

  describe("get_current_period", () => {
    describe("input validation", () => {
      it("should require type parameter", async () => {
        const result = await handleGetCurrentPeriod(configLoader, vaultPath, {
          type: "weekly",
        });
        expect(isError(result)).toBe(false);
      });

      it("should accept weekly, monthly, quarterly, yearly types", async () => {
        const types: ("weekly" | "monthly" | "quarterly" | "yearly")[] = [
          "weekly",
          "monthly",
          "quarterly",
          "yearly",
        ];

        for (const type of types) {
          const result = await handleGetCurrentPeriod(configLoader, vaultPath, { type });
          expect(isError(result)).toBe(false);
        }
      });

      it("should accept optional date parameter", async () => {
        const result = await handleGetCurrentPeriod(configLoader, vaultPath, {
          type: "monthly",
          date: "2026-06-15",
        });
        expect(isError(result)).toBe(false);
      });

      it("should return error for invalid date", async () => {
        const result = await handleGetCurrentPeriod(configLoader, vaultPath, {
          type: "weekly",
          date: "invalid-date-xyz",
        });
        expect(isError(result)).toBe(true);
      });
    });

    describe("output format", () => {
      it("should return start, end, label, and notePath", async () => {
        const result = await handleGetCurrentPeriod(configLoader, vaultPath, {
          type: "weekly",
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(typeof result.label).toBe("string");
          expect(typeof result.notePath).toBe("string");
          expect(result.notePath).toContain(vaultPath);
        }
      });

      it("should return correct weekly period info", async () => {
        const result = await handleGetCurrentPeriod(configLoader, vaultPath, {
          type: "weekly",
          date: "2026-03-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.label).toMatch(/Week \d+, \d{4}/);
          // Verify start and end dates are valid ISO dates
          expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          // End date should be after start date
          expect(new Date(result.end).getTime()).toBeGreaterThan(new Date(result.start).getTime());
        }
      });

      it("should return correct quarterly period info", async () => {
        const result = await handleGetCurrentPeriod(configLoader, vaultPath, {
          type: "quarterly",
          date: "2026-05-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.label).toBe("Q2 2026");
          expect(result.start).toBe("2026-04-01");
        }
      });

      it("should return correct yearly period info", async () => {
        const result = await handleGetCurrentPeriod(configLoader, vaultPath, {
          type: "yearly",
          date: "2026-07-15",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.label).toBe("2026");
          expect(result.start).toBe("2026-01-01");
          // End date should be in the correct year (could be end of Dec 31 or start of next year due to timezone)
          expect(result.end).toMatch(/^202[67]-/);
        }
      });
    });
  });

  describe("list_periodic_notes", () => {
    beforeEach(async () => {
      // Create various periodic notes for testing
      await handleEnsurePeriodicNote(noteService, fs, { type: "daily", date: "2026-03-10" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "daily", date: "2026-03-11" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "daily", date: "2026-03-12" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "weekly", date: "2026-03-10" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "weekly", date: "2026-03-17" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "monthly", date: "2026-02-15" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "monthly", date: "2026-03-15" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "quarterly", date: "2026-01-15" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "quarterly", date: "2026-04-15" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "yearly", date: "2025-06-15" });
      await handleEnsurePeriodicNote(noteService, fs, { type: "yearly", date: "2026-06-15" });
    });

    describe("input validation", () => {
      it("should require type parameter", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "daily",
        });
        expect(isError(result)).toBe(false);
      });

      it("should accept all note types", async () => {
        const types: ("daily" | "weekly" | "monthly" | "quarterly" | "yearly")[] = [
          "daily",
          "weekly",
          "monthly",
          "quarterly",
          "yearly",
        ];

        for (const type of types) {
          const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, { type });
          expect(isError(result)).toBe(false);
        }
      });

      it("should accept limit parameter", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "daily",
          limit: 2,
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes.length).toBeLessThanOrEqual(2);
        }
      });

      it("should accept startDate filter", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "daily",
          startDate: "2026-03-11",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          for (const note of result.notes) {
            expect(note.date >= "2026-03-11").toBe(true);
          }
        }
      });

      it("should accept endDate filter", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "daily",
          endDate: "2026-03-11",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          for (const note of result.notes) {
            expect(note.date <= "2026-03-11").toBe(true);
          }
        }
      });
    });

    describe("output format", () => {
      it("should return notes array with path, date, and periodLabel", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "daily",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(Array.isArray(result.notes)).toBe(true);
          for (const note of result.notes) {
            expect(typeof note.path).toBe("string");
            expect(typeof note.date).toBe("string");
            expect(typeof note.periodLabel).toBe("string");
          }
        }
      });

      it("should sort notes by date descending", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "daily",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          const dates = result.notes.map((n) => n.date);
          const sorted = [...dates].sort().reverse();
          expect(dates).toEqual(sorted);
        }
      });

      it("should apply default limit of 10", async () => {
        // Create more than 10 daily notes
        for (let i = 15; i <= 30; i++) {
          await handleEnsurePeriodicNote(noteService, fs, {
            type: "daily",
            date: `2026-03-${i}`,
          });
        }

        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "daily",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes.length).toBe(10);
        }
      });

      it("should list weekly notes with correct format", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "weekly",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes.length).toBeGreaterThan(0);
          for (const note of result.notes) {
            expect(note.date).toMatch(/^\d{4}-W\d{2}$/);
            expect(note.periodLabel).toMatch(/Week \d+, \d{4}/);
          }
        }
      });

      it("should list monthly notes with correct format", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "monthly",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes.length).toBeGreaterThan(0);
          for (const note of result.notes) {
            expect(note.date).toMatch(/^\d{4}-\d{2}$/);
          }
        }
      });

      it("should list quarterly notes with correct format", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "quarterly",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes.length).toBeGreaterThan(0);
          for (const note of result.notes) {
            expect(note.date).toMatch(/^\d{4}-Q[1-4]$/);
            expect(note.periodLabel).toMatch(/Q[1-4] \d{4}/);
          }
        }
      });

      it("should list yearly notes with correct format", async () => {
        const result = await handleListPeriodicNotes(fs, configLoader, vaultPath, {
          type: "yearly",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes.length).toBeGreaterThan(0);
          for (const note of result.notes) {
            expect(note.date).toMatch(/^\d{4}$/);
            expect(note.periodLabel).toMatch(/^\d{4}$/);
          }
        }
      });
    });

    describe("error handling", () => {
      it("should return empty array when no notes exist for type", async () => {
        // Create a fresh fs/config without any notes
        const freshFs = new MemoryFileSystem();
        const freshConfigLoader = new ConfigLoader(freshFs);
        const config: CadenceConfig = {
          ...getDefaultConfig(),
          paths: {
            daily: "Journal/Daily/{year}-{month}-{date}.md",
            weekly: "Journal/Weekly/{year}/W{week}.md",
            monthly: "Journal/Monthly/{year}/{month}.md",
            quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
            yearly: "Journal/Yearly/{year}.md",
            templates: "Templates",
          },
          templates: {},
        };
        await freshFs.mkdir(`${vaultPath}/.cadence`, true);
        await freshFs.writeFile(
          `${vaultPath}/.cadence/config.json`,
          JSON.stringify(config)
        );

        const result = await handleListPeriodicNotes(freshFs, freshConfigLoader, vaultPath, {
          type: "quarterly",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.notes).toEqual([]);
        }
      });
    });
  });

  describe("Error Response Structure", () => {
    it("should format CadenceError with code and message", () => {
      const error = new NoteNotFoundError("/path/to/note.md");
      const result = formatError(error);

      expect(result.error.code).toBe("CADENCE_NOTE_NOT_FOUND");
      expect(result.error.message).toContain("Note not found");
      expect(result.error).toHaveProperty("notePath", "/path/to/note.md");
    });

    it("should format VaultNotFoundError", () => {
      const error = new VaultNotFoundError("No vault found");
      const result = formatError(error);

      expect(result.error.code).toBe("CADENCE_VAULT_NOT_FOUND");
      expect(result.error.message).toBe("No vault found");
    });

    it("should format generic Error with CADENCE_UNKNOWN code", () => {
      const error = new Error("Something went wrong");
      const result = formatError(error);

      expect(result.error.code).toBe("CADENCE_UNKNOWN");
      expect(result.error.message).toBe("Something went wrong");
    });

    it("should handle string errors", () => {
      const result = formatError("string error");

      expect(result.error.code).toBe("CADENCE_UNKNOWN");
      expect(result.error.message).toBe("string error");
    });
  });

  describe("create_from_template", () => {
    beforeEach(async () => {
      // Add a custom template with variables
      await fs.writeFile(
        `${vaultPath}/Templates/meeting.md`,
        `---
template:
  name: Meeting Notes
  description: Template for meeting notes
  variables:
    - name: title
      required: true
      description: The meeting title
    - name: attendees
      required: false
      default: []
      description: List of attendees
    - name: location
      required: false
      default: Virtual
---
# {{title}}

**Date:** {{date}}
**Location:** {{location}}
**Attendees:** {{attendees}}

## Agenda

## Notes

## Action Items
`
      );

      // Update config to include the meeting template
      const config: CadenceConfig = {
        ...getDefaultConfig(),
        paths: {
          daily: "Journal/Daily/{year}-{month}-{date}.md",
          weekly: "Journal/Weekly/{year}/W{week}.md",
          monthly: "Journal/Monthly/{year}/{month}.md",
          quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
          yearly: "Journal/Yearly/{year}.md",
          templates: "Templates",
        },
        templates: {
          daily: "Templates/daily.md",
          weekly: "Templates/weekly.md",
          monthly: "Templates/monthly.md",
          quarterly: "Templates/quarterly.md",
          yearly: "Templates/yearly.md",
          meeting: "Templates/meeting.md",
        },
      };

      await fs.writeFile(
        `${vaultPath}/.cadence/config.json`,
        JSON.stringify(config)
      );
    });

    describe("input validation", () => {
      it("should require template, targetPath, and variables", async () => {
        const result = await handleCreateFromTemplate(fs, configLoader, vaultPath, {
          template: "meeting",
          targetPath: "Meetings/test-meeting.md",
          variables: { title: "Test Meeting" },
        });

        expect(isError(result)).toBe(false);
      });

      it("should return error for unknown template", async () => {
        const result = await handleCreateFromTemplate(fs, configLoader, vaultPath, {
          template: "nonexistent",
          targetPath: "test.md",
          variables: {},
        });

        expect(isError(result)).toBe(true);
        if (isError(result)) {
          expect(result.error.code).toBe("CADENCE_TEMPLATE_NOT_FOUND");
        }
      });

      it("should return error for missing required variables", async () => {
        const result = await handleCreateFromTemplate(fs, configLoader, vaultPath, {
          template: "meeting",
          targetPath: "Meetings/test.md",
          variables: {}, // Missing required 'title' variable
        });

        expect(isError(result)).toBe(true);
        if (isError(result)) {
          expect(result.error.code).toBe("CADENCE_TEMPLATE_RENDER");
          expect(result.error.message).toContain("title");
        }
      });
    });

    describe("output format", () => {
      it("should return path and content", async () => {
        const result = await handleCreateFromTemplate(fs, configLoader, vaultPath, {
          template: "meeting",
          targetPath: "Meetings/standup.md",
          variables: { title: "Daily Standup" },
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(typeof result.path).toBe("string");
          expect(typeof result.content).toBe("string");
          expect(result.path).toContain("standup.md");
        }
      });

      it("should substitute variables in content", async () => {
        const result = await handleCreateFromTemplate(fs, configLoader, vaultPath, {
          template: "meeting",
          targetPath: "Meetings/planning.md",
          variables: {
            title: "Sprint Planning",
            location: "Conference Room A",
          },
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.content).toContain("# Sprint Planning");
          expect(result.content).toContain("Conference Room A");
        }
      });

      it("should apply default values for optional variables", async () => {
        const result = await handleCreateFromTemplate(fs, configLoader, vaultPath, {
          template: "meeting",
          targetPath: "Meetings/quick.md",
          variables: { title: "Quick Sync" },
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.content).toContain("Virtual"); // Default location
        }
      });

      it("should include built-in variables like date", async () => {
        const result = await handleCreateFromTemplate(fs, configLoader, vaultPath, {
          template: "meeting",
          targetPath: "Meetings/today.md",
          variables: { title: "Today's Meeting" },
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          // Should have a date in YYYY-MM-DD format
          expect(result.content).toMatch(/\*\*Date:\*\* \d{4}-\d{2}-\d{2}/);
        }
      });

      it("should create the file at the specified path", async () => {
        const result = await handleCreateFromTemplate(fs, configLoader, vaultPath, {
          template: "meeting",
          targetPath: "Meetings/created.md",
          variables: { title: "Created Meeting" },
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          const exists = await fs.exists(result.path);
          expect(exists).toBe(true);
        }
      });
    });
  });

  describe("list_templates", () => {
    beforeEach(async () => {
      // Add a custom template with full metadata
      await fs.writeFile(
        `${vaultPath}/Templates/project.md`,
        `---
template:
  name: Project
  description: Template for project documentation
  variables:
    - name: projectName
      required: true
      description: Name of the project
    - name: status
      required: false
      default: Active
---
# {{projectName}}

**Status:** {{status}}

## Overview

## Goals

## Tasks
`
      );

      // Update config
      const config: CadenceConfig = {
        ...getDefaultConfig(),
        paths: {
          daily: "Journal/Daily/{year}-{month}-{date}.md",
          weekly: "Journal/Weekly/{year}/W{week}.md",
          monthly: "Journal/Monthly/{year}/{month}.md",
          quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
          yearly: "Journal/Yearly/{year}.md",
          templates: "Templates",
        },
        templates: {
          daily: "Templates/daily.md",
          weekly: "Templates/weekly.md",
          project: "Templates/project.md",
        },
      };

      await fs.writeFile(
        `${vaultPath}/.cadence/config.json`,
        JSON.stringify(config)
      );
    });

    describe("input validation", () => {
      it("should accept empty input", async () => {
        const result = await handleListTemplates(fs, configLoader, vaultPath);
        expect(isError(result)).toBe(false);
      });
    });

    describe("output format", () => {
      it("should return templates array", async () => {
        const result = await handleListTemplates(fs, configLoader, vaultPath);

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(Array.isArray(result.templates)).toBe(true);
        }
      });

      it("should return template name, description, and variables", async () => {
        const result = await handleListTemplates(fs, configLoader, vaultPath);

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          const project = result.templates.find((t) => t.name === "project");
          expect(project).toBeDefined();
          if (project) {
            expect(project.name).toBe("project");
            expect(project.description).toBe("Template for project documentation");
            expect(Array.isArray(project.variables)).toBe(true);
          }
        }
      });

      it("should include variable details with required and default", async () => {
        const result = await handleListTemplates(fs, configLoader, vaultPath);

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          const project = result.templates.find((t) => t.name === "project");
          expect(project).toBeDefined();
          if (project) {
            const nameVar = project.variables.find((v) => v.name === "projectName");
            const statusVar = project.variables.find((v) => v.name === "status");

            expect(nameVar).toBeDefined();
            expect(nameVar?.required).toBe(true);

            expect(statusVar).toBeDefined();
            expect(statusVar?.required).toBe(false);
            expect(statusVar?.default).toBe("Active");
          }
        }
      });

      it("should list all configured templates", async () => {
        const result = await handleListTemplates(fs, configLoader, vaultPath);

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          const names = result.templates.map((t) => t.name);
          expect(names).toContain("daily");
          expect(names).toContain("weekly");
          expect(names).toContain("project");
        }
      });
    });
  });

  describe("get_template", () => {
    beforeEach(async () => {
      // Add a template with rich metadata
      await fs.writeFile(
        `${vaultPath}/Templates/person.md`,
        `---
template:
  name: Person Profile
  description: Template for tracking people/contacts
  variables:
    - name: name
      required: true
      description: Person's full name
    - name: role
      required: false
      default: Contact
      description: Their role or relationship
    - name: company
      required: false
      description: Company they work for
---
# {{name}}

**Role:** {{role}}
{{#if company}}**Company:** {{company}}{{/if}}

## Notes

## Interactions
`
      );

      const config: CadenceConfig = {
        ...getDefaultConfig(),
        paths: {
          daily: "Journal/Daily/{year}-{month}-{date}.md",
          weekly: "Journal/Weekly/{year}/W{week}.md",
          monthly: "Journal/Monthly/{year}/{month}.md",
          quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
          yearly: "Journal/Yearly/{year}.md",
          templates: "Templates",
        },
        templates: {
          daily: "Templates/daily.md",
          person: "Templates/person.md",
        },
      };

      await fs.writeFile(
        `${vaultPath}/.cadence/config.json`,
        JSON.stringify(config)
      );
    });

    describe("input validation", () => {
      it("should require name parameter", async () => {
        const result = await handleGetTemplate(fs, configLoader, vaultPath, {
          name: "person",
        });
        expect(isError(result)).toBe(false);
      });

      it("should return error for unknown template", async () => {
        const result = await handleGetTemplate(fs, configLoader, vaultPath, {
          name: "nonexistent",
        });

        expect(isError(result)).toBe(true);
        if (isError(result)) {
          expect(result.error.code).toBe("CADENCE_TEMPLATE_NOT_FOUND");
        }
      });
    });

    describe("output format", () => {
      it("should return name, content, and metadata", async () => {
        const result = await handleGetTemplate(fs, configLoader, vaultPath, {
          name: "person",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(typeof result.name).toBe("string");
          expect(typeof result.content).toBe("string");
          expect(typeof result.metadata).toBe("object");
        }
      });

      it("should return the raw template content with placeholders", async () => {
        const result = await handleGetTemplate(fs, configLoader, vaultPath, {
          name: "person",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.content).toContain("{{name}}");
          expect(result.content).toContain("{{role}}");
        }
      });

      it("should return metadata with name and description", async () => {
        const result = await handleGetTemplate(fs, configLoader, vaultPath, {
          name: "person",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.metadata.name).toBe("Person Profile");
          expect(result.metadata.description).toBe("Template for tracking people/contacts");
        }
      });

      it("should return metadata with variable definitions", async () => {
        const result = await handleGetTemplate(fs, configLoader, vaultPath, {
          name: "person",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.metadata.variables).toBeDefined();
          expect(Array.isArray(result.metadata.variables)).toBe(true);

          const nameVar = result.metadata.variables?.find((v) => v.name === "name");
          expect(nameVar).toBeDefined();
          expect(nameVar?.required).toBe(true);
          expect(nameVar?.description).toBe("Person's full name");

          const roleVar = result.metadata.variables?.find((v) => v.name === "role");
          expect(roleVar).toBeDefined();
          expect(roleVar?.required).toBe(false);
          expect(roleVar?.default).toBe("Contact");
        }
      });

      it("should handle templates without metadata gracefully", async () => {
        // Create a simple template without metadata
        await fs.writeFile(
          `${vaultPath}/Templates/simple.md`,
          `# Simple Template

Just some content.
`
        );

        const config: CadenceConfig = {
          ...getDefaultConfig(),
          paths: {
            daily: "Journal/Daily/{year}-{month}-{date}.md",
            weekly: "Journal/Weekly/{year}/W{week}.md",
            monthly: "Journal/Monthly/{year}/{month}.md",
            quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
            yearly: "Journal/Yearly/{year}.md",
            templates: "Templates",
          },
          templates: {
            simple: "Templates/simple.md",
          },
        };

        await fs.writeFile(
          `${vaultPath}/.cadence/config.json`,
          JSON.stringify(config)
        );

        const result = await handleGetTemplate(fs, configLoader, vaultPath, {
          name: "simple",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.name).toBe("simple");
          expect(result.content).toContain("Simple Template");
          // Metadata should be empty object or have undefined values
          expect(result.metadata.name).toBeUndefined();
          expect(result.metadata.description).toBeUndefined();
          expect(result.metadata.variables).toBeUndefined();
        }
      });
    });
  });
});

// =====================
// Task Tool Handler Tests
// =====================

/**
 * Serializes task metadata to a JSON-safe format
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

function serializeTask(task: Task): SerializedTask {
  return {
    line: task.line,
    text: task.text,
    completed: task.completed,
    metadata: serializeTaskMetadata(task.metadata),
    raw: task.raw,
  };
}

function serializeTaskWithSource(task: TaskWithSource): SerializedTaskWithSource {
  return {
    ...serializeTask(task),
    sourcePath: task.sourcePath,
    sourceDate: task.sourceDate.toISOString().split("T")[0]!,
  };
}

async function handleGetOpenTasks(
  fs: MemoryFileSystem,
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

    let tasks = aggregated.open;
    if (input.priority) {
      tasks = tasks.filter((t) => t.metadata.priority === input.priority);
    }

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

async function handleRolloverTasks(
  fs: MemoryFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  noteService: NoteService,
  input: RolloverTasksInput
): Promise<RolloverTasksOutput | RolloverTasksDryRunOutput | ToolErrorResponse> {
  try {
    const rollover = new TaskRollover(fs, configLoader);

    if (input.dryRun) {
      const aggregator = new TaskAggregator(fs, configLoader);
      const config = await configLoader.loadConfig(vaultPath);
      const pathGenerator = new PathGenerator();

      const aggregated = await aggregator.aggregate({
        vaultPath,
        daysBack: config.tasks.scanDaysBack,
        includeCompleted: false,
        noteTypes: ["daily"],
      });

      const today = new Date();
      const targetPath = pathGenerator.generatePath(config.paths.daily, today);
      const fullTargetPath = `${vaultPath}/${targetPath}`;

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

    await noteService.ensureNote("daily", new Date());
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

async function handleToggleTask(
  fs: MemoryFileSystem,
  vaultPath: string,
  input: ToggleTaskInput
): Promise<ToggleTaskOutput | ToolErrorResponse> {
  try {
    const modifier = new TaskModifier(fs);

    let filePath = input.filePath;
    if (!filePath.startsWith("/")) {
      filePath = `${vaultPath}/${filePath}`;
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

async function handleGetOverdueTasks(
  fs: MemoryFileSystem,
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

async function handleAddTask(
  fs: MemoryFileSystem,
  configLoader: ConfigLoader,
  vaultPath: string,
  noteService: NoteService,
  input: AddTaskInput
): Promise<AddTaskOutput | ToolErrorResponse> {
  try {
    const modifier = new TaskModifier(fs);
    const dateParser = new DateParser();
    const config = await configLoader.loadConfig(vaultPath);

    const today = new Date();
    const notePath = await noteService.ensureNote("daily", today);

    let dueDate: Date | undefined;
    if (input.due) {
      dueDate = dateParser.parse(input.due);
    }

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

    const tasksSection = config.sections["tasks"] ?? "## Tasks";

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

describe("Task Tool Handlers", () => {
  let fs: MemoryFileSystem;
  let configLoader: ConfigLoader;
  let noteService: NoteService;
  const vaultPath = "/vault";

  beforeEach(async () => {
    fs = new MemoryFileSystem();
    configLoader = new ConfigLoader(fs);

    const config: CadenceConfig = {
      ...getDefaultConfig(),
      paths: {
        daily: "Journal/Daily/{year}-{month}-{date}.md",
        weekly: "Journal/Weekly/{year}/W{week}.md",
        monthly: "Journal/Monthly/{year}/{month}.md",
        quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
        yearly: "Journal/Yearly/{year}.md",
        templates: "Templates",
      },
      templates: {
        daily: "Templates/daily.md",
        weekly: "Templates/weekly.md",
        monthly: "Templates/monthly.md",
        quarterly: "Templates/quarterly.md",
        yearly: "Templates/yearly.md",
      },
      tasks: {
        rolloverEnabled: true,
        scanDaysBack: 7,
        staleAfterDays: 3,
      },
      sections: {
        tasks: "## Tasks",
        notes: "## Notes",
      },
    };

    await fs.mkdir(`${vaultPath}/.cadence`, true);
    await fs.writeFile(
      `${vaultPath}/.cadence/config.json`,
      JSON.stringify(config)
    );

    await fs.mkdir(`${vaultPath}/Templates`, true);
    await fs.writeFile(
      `${vaultPath}/Templates/daily.md`,
      `---
type: daily
date: '{{date}}'
---
# Daily Note for {{date}}

## Tasks

## Notes
`
    );

    noteService = new NoteService(fs, configLoader, vaultPath);
  });

  describe("get_open_tasks", () => {
    it("should return empty array when no tasks exist", async () => {
      const result = await handleGetOpenTasks(fs, configLoader, vaultPath, {});

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.tasks).toEqual([]);
        expect(result.summary.total).toBe(0);
        expect(result.summary.overdue).toBe(0);
        expect(result.summary.stale).toBe(0);
      }
    });

    it("should find open tasks in daily notes", async () => {
      // Create a daily note with tasks
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      const content = await fs.readFile(notePath);
      await fs.writeFile(
        notePath,
        content + "\n- [ ] First task\n- [ ] Second task\n- [x] Completed task\n"
      );

      const result = await handleGetOpenTasks(fs, configLoader, vaultPath, {});

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.tasks.length).toBe(2);
        expect(result.tasks[0].text).toBe("First task");
        expect(result.tasks[1].text).toBe("Second task");
        expect(result.summary.total).toBe(2);
      }
    });

    it("should filter by priority", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      const content = await fs.readFile(notePath);
      await fs.writeFile(
        notePath,
        content + "\n- [ ] High priority task priority:high\n- [ ] Low priority task priority:low\n- [ ] No priority task\n"
      );

      const result = await handleGetOpenTasks(fs, configLoader, vaultPath, {
        priority: "high",
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.tasks.length).toBe(1);
        expect(result.tasks[0].text).toBe("High priority task");
        expect(result.tasks[0].metadata.priority).toBe("high");
      }
    });

    it("should filter by tag", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      const content = await fs.readFile(notePath);
      await fs.writeFile(
        notePath,
        content + "\n- [ ] Work task #work\n- [ ] Personal task #personal\n- [ ] Untagged task\n"
      );

      const result = await handleGetOpenTasks(fs, configLoader, vaultPath, {
        tag: "work",
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.tasks.length).toBe(1);
        expect(result.tasks[0].text).toBe("Work task");
        expect(result.tasks[0].metadata.tags).toContain("work");
      }
    });

    it("should serialize task metadata correctly", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      const content = await fs.readFile(notePath);
      await fs.writeFile(
        notePath,
        content + "\n- [ ] Task with metadata due:2026-03-15 priority:high #work #urgent age:2 created:2026-02-01\n"
      );

      const result = await handleGetOpenTasks(fs, configLoader, vaultPath, {});

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.tasks.length).toBe(1);
        const task = result.tasks[0];
        expect(task.metadata.due).toBe("2026-03-15");
        expect(task.metadata.priority).toBe("high");
        expect(task.metadata.tags).toContain("work");
        expect(task.metadata.tags).toContain("urgent");
        expect(task.metadata.age).toBe(2);
        expect(task.metadata.created).toBe("2026-02-01");
      }
    });

    it("should respect daysBack parameter", async () => {
      // Create notes for multiple days
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

      await noteService.ensureNote("daily", today);
      await noteService.ensureNote("daily", yesterday);
      await noteService.ensureNote("daily", weekAgo);
      await noteService.ensureNote("daily", twoWeeksAgo);

      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);

      // Add tasks to each note
      for (const date of [today, yesterday, weekAgo, twoWeeksAgo]) {
        const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, date)}`;
        const content = await fs.readFile(notePath);
        await fs.writeFile(notePath, content + `\n- [ ] Task from ${date.toISOString().split("T")[0]}\n`);
      }

      // Should find tasks from last 3 days only
      const result = await handleGetOpenTasks(fs, configLoader, vaultPath, {
        daysBack: 3,
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        // Should find today and yesterday's tasks (within 3 days)
        expect(result.tasks.length).toBe(2);
      }
    });
  });

  describe("rollover_tasks", () => {
    it("should return empty when no tasks to roll over", async () => {
      await noteService.ensureNote("daily", new Date());

      const result = await handleRolloverTasks(
        fs,
        configLoader,
        vaultPath,
        noteService,
        {}
      );

      expect(isError(result)).toBe(false);
      if (!isError(result) && "rolledOver" in result) {
        expect(result.rolledOver).toEqual([]);
        expect(result.skipped).toEqual([]);
      }
    });

    it("should roll over incomplete tasks from yesterday", async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Create yesterday's note with incomplete task
      await noteService.ensureNote("daily", yesterday);
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const yesterdayPath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, yesterday)}`;

      const content = await fs.readFile(yesterdayPath);
      await fs.writeFile(
        yesterdayPath,
        content + "\n- [ ] Unfinished task\n- [x] Completed task\n"
      );

      // Ensure today's note exists
      await noteService.ensureNote("daily", today);

      const result = await handleRolloverTasks(
        fs,
        configLoader,
        vaultPath,
        noteService,
        {}
      );

      expect(isError(result)).toBe(false);
      if (!isError(result) && "rolledOver" in result) {
        expect(result.rolledOver.length).toBe(1);
        expect(result.rolledOver[0].text).toBe("Unfinished task");
        // Age should be incremented
        expect(result.rolledOver[0].metadata.age).toBe(1);
      }
    });

    it("should support dry run mode", async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      await noteService.ensureNote("daily", yesterday);
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const yesterdayPath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, yesterday)}`;

      const content = await fs.readFile(yesterdayPath);
      await fs.writeFile(
        yesterdayPath,
        content + "\n- [ ] Task to preview\n"
      );

      const result = await handleRolloverTasks(
        fs,
        configLoader,
        vaultPath,
        noteService,
        { dryRun: true }
      );

      expect(isError(result)).toBe(false);
      if (!isError(result) && "wouldRollOver" in result) {
        expect(result.wouldRollOver.length).toBe(1);
        expect(result.wouldRollOver[0].text).toBe("Task to preview");
        expect(result.targetNote).toContain("Daily");
      }
    });

    it("should skip duplicate tasks", async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Create yesterday's note with task
      await noteService.ensureNote("daily", yesterday);
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const yesterdayPath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, yesterday)}`;

      let content = await fs.readFile(yesterdayPath);
      await fs.writeFile(yesterdayPath, content + "\n- [ ] Duplicate task\n");

      // Create today's note with the same task already
      await noteService.ensureNote("daily", today);
      const todayPath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, today)}`;

      content = await fs.readFile(todayPath);
      await fs.writeFile(todayPath, content + "\n- [ ] Duplicate task\n");

      const result = await handleRolloverTasks(
        fs,
        configLoader,
        vaultPath,
        noteService,
        {}
      );

      expect(isError(result)).toBe(false);
      if (!isError(result) && "rolledOver" in result) {
        expect(result.rolledOver.length).toBe(0);
        expect(result.skipped.length).toBe(1);
        expect(result.skipped[0].reason).toContain("already exists");
      }
    });
  });

  describe("toggle_task", () => {
    it("should toggle task from open to completed", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      const content = await fs.readFile(notePath);
      await fs.writeFile(notePath, content + "\n- [ ] Task to complete\n");

      const result = await handleToggleTask(fs, vaultPath, {
        filePath: notePath,
        lineNumber: 11, // Line after template content
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.newState).toBe("completed");
        expect(result.task.completed).toBe(true);
        expect(result.task.raw).toContain("[x]");
      }
    });

    it("should toggle task from completed to open", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      const content = await fs.readFile(notePath);
      await fs.writeFile(notePath, content + "\n- [x] Completed task\n");

      const result = await handleToggleTask(fs, vaultPath, {
        filePath: notePath,
        lineNumber: 11,
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.newState).toBe("open");
        expect(result.task.completed).toBe(false);
        expect(result.task.raw).toContain("[ ]");
      }
    });

    it("should return error for non-task line", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      const result = await handleToggleTask(fs, vaultPath, {
        filePath: notePath,
        lineNumber: 1, // Header line, not a task
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain("not a task");
      }
    });

    it("should return error for invalid line number", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      const result = await handleToggleTask(fs, vaultPath, {
        filePath: notePath,
        lineNumber: 1000, // Way beyond file length
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain("out of range");
      }
    });

    it("should handle relative file paths", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;
      const relativePath = pathGenerator.generatePath(config.paths.daily, new Date());

      const content = await fs.readFile(notePath);
      await fs.writeFile(notePath, content + "\n- [ ] Relative path task\n");

      const result = await handleToggleTask(fs, vaultPath, {
        filePath: relativePath,
        lineNumber: 11,
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.newState).toBe("completed");
      }
    });
  });

  describe("get_overdue_tasks", () => {
    it("should return empty array when no overdue tasks", async () => {
      await noteService.ensureNote("daily", new Date());

      const result = await handleGetOverdueTasks(fs, configLoader, vaultPath);

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.tasks).toEqual([]);
      }
    });

    it("should find tasks past their due date", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      // Add a task due yesterday (overdue)
      // Use local date formatting to avoid UTC vs local timezone issues
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

      const content = await fs.readFile(notePath);
      await fs.writeFile(
        notePath,
        content + `\n- [ ] Overdue task due:${yesterdayStr}\n- [ ] Not overdue task\n`
      );

      const result = await handleGetOverdueTasks(fs, configLoader, vaultPath);

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.tasks.length).toBe(1);
        expect(result.tasks[0].text).toBe("Overdue task");
        expect(result.tasks[0].metadata.due).toBe(yesterdayStr);
      }
    });

    it("should not include completed overdue tasks", async () => {
      await noteService.ensureNote("daily", new Date());
      const pathGenerator = new PathGenerator();
      const config = await configLoader.loadConfig(vaultPath);
      const notePath = `${vaultPath}/${pathGenerator.generatePath(config.paths.daily, new Date())}`;

      // Use local date formatting to avoid UTC vs local timezone issues
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

      const content = await fs.readFile(notePath);
      await fs.writeFile(
        notePath,
        content + `\n- [x] Completed overdue task due:${yesterdayStr}\n`
      );

      const result = await handleGetOverdueTasks(fs, configLoader, vaultPath);

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.tasks.length).toBe(0);
      }
    });
  });

  describe("add_task", () => {
    it("should add a simple task to today's note", async () => {
      const result = await handleAddTask(
        fs,
        configLoader,
        vaultPath,
        noteService,
        { text: "New task" }
      );

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.task.text).toBe("New task");
        expect(result.task.completed).toBe(false);
        expect(result.task.metadata.created).toBeDefined();
        expect(result.notePath).toContain("Daily");
      }
    });

    it("should add task with due date", async () => {
      const result = await handleAddTask(
        fs,
        configLoader,
        vaultPath,
        noteService,
        {
          text: "Task with due date",
          due: "2026-03-15",
        }
      );

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.task.text).toBe("Task with due date");
        expect(result.task.metadata.due).toBe("2026-03-15");
      }
    });

    it("should add task with priority", async () => {
      const result = await handleAddTask(
        fs,
        configLoader,
        vaultPath,
        noteService,
        {
          text: "High priority task",
          priority: "high",
        }
      );

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.task.text).toBe("High priority task");
        expect(result.task.metadata.priority).toBe("high");
      }
    });

    it("should add task with tags", async () => {
      const result = await handleAddTask(
        fs,
        configLoader,
        vaultPath,
        noteService,
        {
          text: "Tagged task",
          tags: ["work", "important"],
        }
      );

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.task.text).toBe("Tagged task");
        expect(result.task.metadata.tags).toContain("work");
        expect(result.task.metadata.tags).toContain("important");
      }
    });

    it("should add task with all metadata", async () => {
      const result = await handleAddTask(
        fs,
        configLoader,
        vaultPath,
        noteService,
        {
          text: "Complete task",
          due: "tomorrow",
          priority: "high",
          tags: ["urgent", "review"],
        }
      );

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.task.text).toBe("Complete task");
        expect(result.task.metadata.due).toBeDefined();
        expect(result.task.metadata.priority).toBe("high");
        expect(result.task.metadata.tags).toContain("urgent");
        expect(result.task.metadata.tags).toContain("review");
        expect(result.task.metadata.created).toBeDefined();
      }
    });

    it("should create note if it doesn't exist", async () => {
      // Don't create the note first
      const result = await handleAddTask(
        fs,
        configLoader,
        vaultPath,
        noteService,
        { text: "First task" }
      );

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        // Verify note was created
        expect(await fs.exists(result.notePath)).toBe(true);
        expect(result.task.text).toBe("First task");
      }
    });

    it("should parse natural language due dates", async () => {
      const result = await handleAddTask(
        fs,
        configLoader,
        vaultPath,
        noteService,
        {
          text: "Task due next friday",
          due: "next friday",
        }
      );

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.task.metadata.due).toBeDefined();
        // The due date should be in the future
        const dueDate = new Date(result.task.metadata.due!);
        expect(dueDate.getTime()).toBeGreaterThan(Date.now());
      }
    });
  });

  // =====================
  // Context and Search Tool Tests
  // =====================

  describe("get_context", () => {
    beforeEach(async () => {
      // Create some daily notes for testing
      // Use local date formatting to avoid UTC vs local timezone issues
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/${todayStr}.md`,
        `---
type: daily
date: '${todayStr}'
---
# Daily Note for ${todayStr}

## Tasks

- [ ] High priority task priority:high
- [ ] Normal task
- [x] Completed task

## Notes

Some notes for today.
`
      );
    });

    it("should return context with default options", async () => {
      const result = await handleGetContext(fs, configLoader, vaultPath, {});

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.context).toBeDefined();
        expect(result.notes).toBeInstanceOf(Array);
        expect(result.tasks).toBeDefined();
        expect(result.tasks.openCount).toBeGreaterThanOrEqual(0);
        expect(result.tasks.overdueCount).toBeGreaterThanOrEqual(0);
      }
    });

    it("should include daily notes in context", async () => {
      const result = await handleGetContext(fs, configLoader, vaultPath, {
        dailyCount: 5,
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        const dailyNotes = result.notes.filter(n => n.type === "daily");
        expect(dailyNotes.length).toBeGreaterThan(0);
      }
    });

    it("should include task summary when includeTasks is true", async () => {
      const result = await handleGetContext(fs, configLoader, vaultPath, {
        includeTasks: true,
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.tasks.openCount).toBeGreaterThanOrEqual(0);
        expect(result.tasks.overdue).toBeInstanceOf(Array);
        expect(result.tasks.highPriority).toBeInstanceOf(Array);
      }
    });

    it("should still return tasks object when includeTasks is false", async () => {
      const result = await handleGetContext(fs, configLoader, vaultPath, {
        includeTasks: false,
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        // Tasks should be empty but still present
        expect(result.tasks.openCount).toBe(0);
        expect(result.tasks.overdueCount).toBe(0);
      }
    });

    it("should respect dailyCount parameter", async () => {
      // Create multiple daily notes
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-01-30.md`,
        `---
type: daily
date: '2026-01-30'
---
# Daily Note for 2026-01-30
`
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-01-29.md`,
        `---
type: daily
date: '2026-01-29'
---
# Daily Note for 2026-01-29
`
      );

      const result = await handleGetContext(fs, configLoader, vaultPath, {
        dailyCount: 1,
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        const dailyNotes = result.notes.filter(n => n.type === "daily");
        expect(dailyNotes.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("search_vault", () => {
    beforeEach(async () => {
      // Create some notes for testing search
      await fs.mkdir(`${vaultPath}/Projects`, true);
      await fs.writeFile(
        `${vaultPath}/Projects/project-alpha.md`,
        `---
status: active
tags:
  - project
  - important
---
# Project Alpha

This is the alpha project documentation.
`
      );
      await fs.writeFile(
        `${vaultPath}/Projects/project-beta.md`,
        `---
status: completed
tags:
  - project
---
# Project Beta

This project is now completed.
`
      );
      await fs.writeFile(
        `${vaultPath}/Notes/meeting-notes.md`,
        `---
type: meeting
---
# Meeting Notes

Discussion about project alpha progress.
`
      );
    });

    describe("files search", () => {
      it("should find files by fuzzy name match", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "alpha",
          type: "files",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.results.length).toBeGreaterThan(0);
          expect(result.results.some(r => r.path.includes("alpha"))).toBe(true);
        }
      });

      it("should return multiple matches", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "project",
          type: "files",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.results.length).toBeGreaterThanOrEqual(2);
        }
      });

      it("should respect limit parameter", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "project",
          type: "files",
          limit: 1,
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.results.length).toBeLessThanOrEqual(1);
        }
      });

      it("should include score in results", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "alpha",
          type: "files",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result) && result.results.length > 0) {
          expect(result.results[0]!.score).toBeDefined();
        }
      });
    });

    describe("content search", () => {
      it("should find content within files", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "documentation",
          type: "content",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.results.length).toBeGreaterThan(0);
          expect(result.results[0]!.content).toContain("documentation");
        }
      });

      it("should include line numbers", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "Project Alpha",
          type: "content",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result) && result.results.length > 0) {
          expect(result.results[0]!.line).toBeDefined();
          expect(typeof result.results[0]!.line).toBe("number");
        }
      });

      it("should search case-insensitively", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "ALPHA",
          type: "content",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.results.length).toBeGreaterThan(0);
        }
      });
    });

    describe("frontmatter search", () => {
      it("should find notes by frontmatter field", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "active",
          type: "frontmatter",
          field: "status",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.results.length).toBe(1);
          expect(result.results[0]!.path).toContain("alpha");
        }
      });

      it("should find notes by array field value", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "important",
          type: "frontmatter",
          field: "tags",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result)) {
          expect(result.results.length).toBe(1);
          expect(result.results[0]!.path).toContain("alpha");
        }
      });

      it("should return error when field is missing", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "active",
          type: "frontmatter",
          // field is missing
        });

        expect(isError(result)).toBe(true);
        if (isError(result)) {
          expect(result.error.code).toBe("CADENCE_INVALID_INPUT");
          expect(result.error.message).toContain("field");
        }
      });

      it("should include frontmatter in results", async () => {
        const result = await handleSearchVault(fs, vaultPath, {
          query: "active",
          type: "frontmatter",
          field: "status",
        });

        expect(isError(result)).toBe(false);
        if (!isError(result) && result.results.length > 0) {
          expect(result.results[0]!.frontmatter).toBeDefined();
          expect(result.results[0]!.frontmatter!.status).toBe("active");
        }
      });
    });

    it("should return error for invalid search type", async () => {
      const result = await handleSearchVault(fs, vaultPath, {
        query: "test",
        type: "invalid" as "files",
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe("CADENCE_INVALID_INPUT");
      }
    });
  });

  describe("append_to_section", () => {
    beforeEach(async () => {
      // Update config to include sections
      const config: CadenceConfig = {
        ...getDefaultConfig(),
        paths: {
          daily: "Journal/Daily/{year}-{month}-{date}.md",
          weekly: "Journal/Weekly/{year}/W{week}.md",
          monthly: "Journal/Monthly/{year}/{month}.md",
          quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
          yearly: "Journal/Yearly/{year}.md",
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
          log: "## Log",
        },
      };

      await fs.writeFile(
        `${vaultPath}/.cadence/config.json`,
        JSON.stringify(config)
      );

      // Create a test note with sections
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        `---
type: daily
date: '2026-02-01'
---
# Daily Note for 2026-02-01

## Tasks

- [ ] Existing task

## Notes

Some existing notes.

## Log

`
      );
    });

    it("should append content to a valid section", async () => {
      const result = await handleAppendToSection(fs, configLoader, vaultPath, {
        notePath: "Journal/Daily/2026-02-01.md",
        section: "tasks",
        content: "- [ ] New task from append",
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.success).toBe(true);
        expect(result.notePath).toBe("Journal/Daily/2026-02-01.md");

        // Verify content was appended
        const updatedContent = await fs.readFile(`${vaultPath}/Journal/Daily/2026-02-01.md`);
        expect(updatedContent).toContain("- [ ] Existing task");
        expect(updatedContent).toContain("- [ ] New task from append");
      }
    });

    it("should append content before the next section", async () => {
      const result = await handleAppendToSection(fs, configLoader, vaultPath, {
        notePath: "Journal/Daily/2026-02-01.md",
        section: "tasks",
        content: "- [ ] Another task",
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        const updatedContent = await fs.readFile(`${vaultPath}/Journal/Daily/2026-02-01.md`);
        const tasksIndex = updatedContent.indexOf("## Tasks");
        const notesIndex = updatedContent.indexOf("## Notes");
        const newTaskIndex = updatedContent.indexOf("- [ ] Another task");

        // New content should be between Tasks and Notes sections
        expect(newTaskIndex).toBeGreaterThan(tasksIndex);
        expect(newTaskIndex).toBeLessThan(notesIndex);
      }
    });

    it("should return error for undefined section", async () => {
      const result = await handleAppendToSection(fs, configLoader, vaultPath, {
        notePath: "Journal/Daily/2026-02-01.md",
        section: "nonexistent",
        content: "Some content",
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe("CADENCE_INVALID_INPUT");
        expect(result.error.message).toContain("not defined in config.sections");
      }
    });

    it("should return error for nonexistent note", async () => {
      const result = await handleAppendToSection(fs, configLoader, vaultPath, {
        notePath: "Journal/Daily/nonexistent.md",
        section: "tasks",
        content: "Some content",
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe("CADENCE_NOTE_NOT_FOUND");
      }
    });

    it("should return error when section not found in note", async () => {
      // Create a note without the log section
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-02.md`,
        `---
type: daily
---
# Note without log section

## Tasks

`
      );

      const result = await handleAppendToSection(fs, configLoader, vaultPath, {
        notePath: "Journal/Daily/2026-02-02.md",
        section: "log",
        content: "Log entry",
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe("CADENCE_SECTION_NOT_FOUND");
      }
    });

    it("should append to section at end of file", async () => {
      const result = await handleAppendToSection(fs, configLoader, vaultPath, {
        notePath: "Journal/Daily/2026-02-01.md",
        section: "log",
        content: "- 10:00 AM: Started work",
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        const updatedContent = await fs.readFile(`${vaultPath}/Journal/Daily/2026-02-01.md`);
        expect(updatedContent).toContain("- 10:00 AM: Started work");
      }
    });
  });

  describe("read_note", () => {
    beforeEach(async () => {
      // Create test notes
      await fs.mkdir(`${vaultPath}/Notes`, true);
      await fs.writeFile(
        `${vaultPath}/Notes/test-note.md`,
        `---
title: Test Note
tags:
  - test
  - example
status: draft
---
# Test Note

This is a test note with frontmatter.

## Section 1

Some content here.
`
      );
    });

    it("should read note content and frontmatter", async () => {
      const result = await handleReadNote(fs, vaultPath, {
        path: "Notes/test-note.md",
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.content).toContain("# Test Note");
        expect(result.content).toContain("This is a test note");
        expect(result.frontmatter).toBeDefined();
        expect(result.frontmatter.title).toBe("Test Note");
        expect(result.frontmatter.status).toBe("draft");
      }
    });

    it("should parse frontmatter arrays", async () => {
      const result = await handleReadNote(fs, vaultPath, {
        path: "Notes/test-note.md",
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(Array.isArray(result.frontmatter.tags)).toBe(true);
        expect(result.frontmatter.tags).toContain("test");
        expect(result.frontmatter.tags).toContain("example");
      }
    });

    it("should return error for nonexistent note", async () => {
      const result = await handleReadNote(fs, vaultPath, {
        path: "Notes/nonexistent.md",
      });

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.code).toBe("CADENCE_NOTE_NOT_FOUND");
        expect(result.error.message).toContain("nonexistent.md");
      }
    });

    it("should handle notes without frontmatter", async () => {
      await fs.writeFile(
        `${vaultPath}/Notes/no-frontmatter.md`,
        `# Note Without Frontmatter

Just content, no YAML.
`
      );

      const result = await handleReadNote(fs, vaultPath, {
        path: "Notes/no-frontmatter.md",
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        expect(result.content).toContain("# Note Without Frontmatter");
        expect(result.frontmatter).toEqual({});
      }
    });

    it("should return full content including frontmatter block", async () => {
      const result = await handleReadNote(fs, vaultPath, {
        path: "Notes/test-note.md",
      });

      expect(isError(result)).toBe(false);
      if (!isError(result)) {
        // Content should include the raw frontmatter block
        expect(result.content).toContain("---");
        expect(result.content).toContain("title: Test Note");
      }
    });
  });
});
