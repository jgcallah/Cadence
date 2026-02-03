import * as vscode from "vscode";
import {
  VERSION,
  NodeFileSystem,
  ConfigLoader,
  NoteService,
  DateParser,
  CadenceError,
  VaultNotFoundError,
  ConfigNotFoundError,
  TemplateRegistry,
  createFromTemplate,
  TaskAggregator,
  TaskRollover,
  TaskModifier,
  ContextBuilder,
  VaultSearch,
  type NoteType,
  type TemplateInfo,
  type TaskWithSource,
  type AggregatedTasks,
  type Context,
  type ContentMatch,
} from "@cadence/core";
import { TaskTreeProvider, TaskCodeLensProvider } from "./tasks/index.js";
import { ContextTreeProvider } from "./context/index.js";
import { SearchTreeProvider } from "./search/index.js";

let statusBarItem: vscode.StatusBarItem | undefined;
let taskStatusBarItem: vscode.StatusBarItem | undefined;
let taskTreeProvider: TaskTreeProvider | undefined;
let taskCodeLensProvider: TaskCodeLensProvider | undefined;
let contextTreeProvider: ContextTreeProvider | undefined;
let searchTreeProvider: SearchTreeProvider | undefined;
let cachedTasks: AggregatedTasks | null = null;
let cachedContext: Context | null = null;

/**
 * Prompts and placeholders for date input by note type.
 */
const NOTE_TYPE_INPUT_CONFIG: Record<NoteType, { prompt: string; placeholder: string; hint: string }> = {
  daily: {
    prompt: "Enter a date (e.g., 'yesterday', 'tomorrow', '2024-01-15')",
    placeholder: "today",
    hint: "Try 'yesterday', 'tomorrow', or YYYY-MM-DD.",
  },
  weekly: {
    prompt: "Enter a week (e.g., 'last week', 'W05', '2024-W05')",
    placeholder: "this week",
    hint: "Try 'last week', 'W05', or YYYY-Www.",
  },
  monthly: {
    prompt: "Enter a month (e.g., 'last month', 'January', '2024-01')",
    placeholder: "this month",
    hint: "Try 'last month', month name, or YYYY-MM.",
  },
  quarterly: {
    prompt: "Enter a quarter (e.g., 'last quarter', 'Q1', '2024-Q1')",
    placeholder: "this quarter",
    hint: "Try 'last quarter', 'Q1', or YYYY-Qn.",
  },
  yearly: {
    prompt: "Enter a year (e.g., 'last year', '2024')",
    placeholder: "this year",
    hint: "Try 'last year' or YYYY.",
  },
};

/**
 * Gets the vault path from the current workspace.
 * Uses the first workspace folder as the vault root.
 */
function getVaultPath(): string | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }
  const firstFolder = workspaceFolders[0];
  if (!firstFolder) {
    return undefined;
  }
  return firstFolder.uri.fsPath;
}

/**
 * Creates the NoteService with the current vault context.
 */
function createNoteService(vaultPath: string): NoteService {
  const fs = new NodeFileSystem();
  const configLoader = new ConfigLoader(fs);
  return new NoteService(fs, configLoader, vaultPath);
}

/**
 * Handles CadenceError types by showing appropriate VS Code toast notifications.
 */
function handleCadenceError(error: unknown): void {
  if (error instanceof VaultNotFoundError) {
    vscode.window.showErrorMessage(
      "Cadence: No vault found. Please open a folder containing a .cadence/config.json file."
    );
  } else if (error instanceof ConfigNotFoundError) {
    vscode.window.showErrorMessage(
      `Cadence: No config found at ${error.vaultPath}. Run 'cadence init' to create one.`
    );
  } else if (error instanceof CadenceError) {
    vscode.window.showErrorMessage(`Cadence: ${error.message}`);
  } else if (error instanceof Error) {
    vscode.window.showErrorMessage(`Cadence: ${error.message}`);
  } else {
    vscode.window.showErrorMessage("Cadence: An unknown error occurred.");
  }
}

/**
 * Opens a note at the given path in VS Code.
 */
async function openNote(notePath: string): Promise<void> {
  const uri = vscode.Uri.file(notePath);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
}

/**
 * Opens a note for the current period of the given type.
 */
async function openCurrentNote(type: NoteType): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  try {
    const noteService = createNoteService(vaultPath);
    const notePath = await noteService.ensureNote(type, new Date());
    await openNote(notePath);
    await updateStatusBar();
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Opens today's daily note, creating it if necessary.
 */
async function openTodaysNote(): Promise<void> {
  return openCurrentNote("daily");
}

/**
 * Opens this week's weekly note, creating it if necessary.
 */
async function openWeeklyNote(): Promise<void> {
  return openCurrentNote("weekly");
}

/**
 * Opens this month's monthly note, creating it if necessary.
 */
async function openMonthlyNote(): Promise<void> {
  return openCurrentNote("monthly");
}

/**
 * Opens this quarter's quarterly note, creating it if necessary.
 */
async function openQuarterlyNote(): Promise<void> {
  return openCurrentNote("quarterly");
}

/**
 * Opens this year's yearly note, creating it if necessary.
 */
async function openYearlyNote(): Promise<void> {
  return openCurrentNote("yearly");
}

/**
 * Creates a note for a user-selected date/period of the given type.
 */
async function createNoteForDate(type: NoteType): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  const config = NOTE_TYPE_INPUT_CONFIG[type];

  // Show date input picker
  const dateInput = await vscode.window.showInputBox({
    prompt: config.prompt,
    placeHolder: config.placeholder,
    validateInput: (value) => {
      if (!value) {
        return null; // Empty is valid, will use current period
      }
      try {
        const parser = new DateParser();
        parser.parseForType(value, type);
        return null;
      } catch {
        return `Invalid ${type} format. ${config.hint}`;
      }
    },
  });

  // User cancelled
  if (dateInput === undefined) {
    return;
  }

  try {
    const dateParser = new DateParser();
    const targetDate = dateInput ? dateParser.parseForType(dateInput, type) : new Date();
    const noteService = createNoteService(vaultPath);
    const notePath = await noteService.ensureNote(type, targetDate);
    await openNote(notePath);
    await updateStatusBar();
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Creates a daily note for a user-selected date.
 */
async function createDailyNote(): Promise<void> {
  return createNoteForDate("daily");
}

/**
 * Creates a weekly note for a user-selected week.
 */
async function createWeeklyNote(): Promise<void> {
  return createNoteForDate("weekly");
}

/**
 * Creates a monthly note for a user-selected month.
 */
async function createMonthlyNote(): Promise<void> {
  return createNoteForDate("monthly");
}

/**
 * Creates a quarterly note for a user-selected quarter.
 */
async function createQuarterlyNote(): Promise<void> {
  return createNoteForDate("quarterly");
}

/**
 * Creates a yearly note for a user-selected year.
 */
async function createYearlyNote(): Promise<void> {
  return createNoteForDate("yearly");
}

/**
 * Creates a TemplateRegistry loaded with config templates.
 */
async function createTemplateRegistry(vaultPath: string): Promise<TemplateRegistry> {
  const fs = new NodeFileSystem();
  const configLoader = new ConfigLoader(fs);
  const config = await configLoader.loadConfig(vaultPath);

  const registry = new TemplateRegistry(fs);
  if (config.templates) {
    registry.loadFromConfig(config.templates);
  }
  return registry;
}

/**
 * Quick pick item for template selection.
 */
interface TemplateQuickPickItem extends vscode.QuickPickItem {
  templateName: string;
  category?: string;
}

/**
 * Creates a new note from a template.
 * Shows a quick pick with available templates, then prompts for required variables.
 */
async function newFromTemplate(): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  try {
    const fs = new NodeFileSystem();
    const registry = await createTemplateRegistry(vaultPath);

    // Get available templates
    const templates = await registry.list();

    if (templates.length === 0) {
      vscode.window.showInformationMessage(
        "Cadence: No templates configured. Add templates to your .cadence/config.json file."
      );
      return;
    }

    // Build quick pick items, grouped by category
    const quickPickItems: (TemplateQuickPickItem | vscode.QuickPickItem)[] = [];

    // Group templates by category
    const categorized = new Map<string, TemplateInfo[]>();
    const uncategorized: TemplateInfo[] = [];

    for (const template of templates) {
      if (template.category) {
        const group = categorized.get(template.category) ?? [];
        group.push(template);
        categorized.set(template.category, group);
      } else {
        uncategorized.push(template);
      }
    }

    // Sort categories alphabetically
    const sortedCategories = [...categorized.keys()].sort();

    // Add categorized templates with separators
    for (const category of sortedCategories) {
      const categoryTemplates = categorized.get(category)!;
      // Add separator for category
      quickPickItems.push({
        label: category,
        kind: vscode.QuickPickItemKind.Separator,
      } as vscode.QuickPickItem);

      // Add templates in this category
      for (const template of categoryTemplates) {
        const item: TemplateQuickPickItem = {
          label: `$(file) ${template.name}`,
          templateName: template.name,
        };
        if (template.description) {
          item.description = template.description;
        }
        if (template.category) {
          item.category = template.category;
        }
        quickPickItems.push(item);
      }
    }

    // Add uncategorized templates at the end
    if (uncategorized.length > 0 && sortedCategories.length > 0) {
      quickPickItems.push({
        label: "Other",
        kind: vscode.QuickPickItemKind.Separator,
      } as vscode.QuickPickItem);
    }

    for (const template of uncategorized) {
      const item: TemplateQuickPickItem = {
        label: `$(file) ${template.name}`,
        templateName: template.name,
      };
      if (template.description) {
        item.description = template.description;
      }
      quickPickItems.push(item);
    }

    // Show template picker
    const selectedTemplate = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: "Select a template",
      title: "New from Template",
    });

    if (!selectedTemplate || !("templateName" in selectedTemplate)) {
      return;
    }

    // Get variable definitions for the selected template
    const variables = await registry.getVariables(selectedTemplate.templateName);

    // Collect variable values from user
    const variableValues: Record<string, unknown> = {};

    for (const variable of variables) {
      if (variable.required || !("default" in variable)) {
        const value = await vscode.window.showInputBox({
          prompt: `Enter value for "${variable.name}"`,
          placeHolder: variable.description ?? variable.name,
          validateInput: (input) => {
            if (variable.required && !input) {
              return `${variable.name} is required`;
            }
            return null;
          },
        });

        // User cancelled
        if (value === undefined) {
          return;
        }

        if (value) {
          variableValues[variable.name] = value;
        }
      }
    }

    // Ask for the output file name
    const fileName = await vscode.window.showInputBox({
      prompt: "Enter the file name for the new note",
      placeHolder: "my-note.md",
      validateInput: (input) => {
        if (!input) {
          return "File name is required";
        }
        if (!input.endsWith(".md")) {
          return "File name must end with .md";
        }
        return null;
      },
    });

    if (!fileName) {
      return;
    }

    // Get the parent directory for new notes (default to vault root)
    const targetPath = vaultPath + "/" + fileName;

    // Create the note from template
    const note = await createFromTemplate(
      selectedTemplate.templateName,
      targetPath,
      variableValues,
      { fs, registry }
    );

    // Open the new note
    await openNote(note.path);

    // Show success notification
    vscode.window.showInformationMessage(
      `Cadence: Created "${fileName}" from template "${selectedTemplate.templateName}"`
    );

    await updateStatusBar();
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Shows a quick pick menu to open a periodic note.
 */
async function openPeriodicNote(): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  // Show quick pick for note type
  const noteTypes: { label: string; description: string; type: NoteType }[] = [
    { label: "$(calendar) Daily", description: "Open today's daily note", type: "daily" },
    { label: "$(calendar) Weekly", description: "Open this week's note", type: "weekly" },
    { label: "$(calendar) Monthly", description: "Open this month's note", type: "monthly" },
    { label: "$(calendar) Quarterly", description: "Open this quarter's note", type: "quarterly" },
    { label: "$(calendar) Yearly", description: "Open this year's note", type: "yearly" },
  ];

  const selected = await vscode.window.showQuickPick(noteTypes, {
    placeHolder: "Select a periodic note type",
    title: "Open Periodic Note",
  });

  if (!selected) {
    return;
  }

  // Ask if they want to specify a custom date
  const dateChoice = await vscode.window.showQuickPick(
    [
      { label: "Current", description: `Open the current ${selected.type} note`, current: true },
      { label: "Choose date...", description: "Specify a custom date/period", current: false },
    ],
    {
      placeHolder: `Open current ${selected.type} or choose a specific date?`,
    }
  );

  if (!dateChoice) {
    return;
  }

  if (dateChoice.current) {
    await openCurrentNote(selected.type);
  } else {
    await createNoteForDate(selected.type);
  }
}

/**
 * Status of periodic notes for today.
 */
interface PeriodicNoteStatus {
  daily: boolean;
  weekly: boolean;
  monthly: boolean;
  quarterly: boolean;
  yearly: boolean;
}

/**
 * Checks which periodic notes exist for today.
 */
async function checkPeriodicNotesStatus(): Promise<PeriodicNoteStatus> {
  const vaultPath = getVaultPath();
  const defaultStatus: PeriodicNoteStatus = {
    daily: false,
    weekly: false,
    monthly: false,
    quarterly: false,
    yearly: false,
  };

  if (!vaultPath) {
    return defaultStatus;
  }

  try {
    const noteService = createNoteService(vaultPath);
    const today = new Date();

    const [daily, weekly, monthly, quarterly, yearly] = await Promise.all([
      noteService.noteExists("daily", today).catch(() => false),
      noteService.noteExists("weekly", today).catch(() => false),
      noteService.noteExists("monthly", today).catch(() => false),
      noteService.noteExists("quarterly", today).catch(() => false),
      noteService.noteExists("yearly", today).catch(() => false),
    ]);

    return { daily, weekly, monthly, quarterly, yearly };
  } catch {
    return defaultStatus;
  }
}

/**
 * Gets a human-readable period context label.
 */
function getPeriodContextLabel(): string {
  const now = new Date();
  const weekNumber = getWeekNumber(now);
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `W${weekNumber} · Q${quarter} · ${now.getFullYear()}`;
}

/**
 * Calculates the ISO week number for a date.
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Updates the status bar item with current note status.
 */
async function updateStatusBar(): Promise<void> {
  // Capture reference to avoid race conditions during module reset
  const currentStatusBarItem = statusBarItem;
  if (!currentStatusBarItem) {
    return;
  }

  const status = await checkPeriodicNotesStatus();
  const periodContext = getPeriodContextLabel();

  // Re-check after async operation in case module was reset
  if (!statusBarItem || statusBarItem !== currentStatusBarItem) {
    return;
  }

  // Build status indicator showing which notes exist
  const indicators: string[] = [];
  if (status.daily) indicators.push("D");
  if (status.weekly) indicators.push("W");
  if (status.monthly) indicators.push("M");
  if (status.quarterly) indicators.push("Q");
  if (status.yearly) indicators.push("Y");

  const statusText = indicators.length > 0 ? `[${indicators.join("")}]` : "";
  statusBarItem.text = `$(calendar) ${periodContext} ${statusText}`.trim();

  // Build tooltip showing detailed status
  const tooltipLines: string[] = [
    `**Cadence** - ${periodContext}`,
    "",
    `Daily: ${status.daily ? "✓" : "○"}`,
    `Weekly: ${status.weekly ? "✓" : "○"}`,
    `Monthly: ${status.monthly ? "✓" : "○"}`,
    `Quarterly: ${status.quarterly ? "✓" : "○"}`,
    `Yearly: ${status.yearly ? "✓" : "○"}`,
    "",
    "Click to open periodic note menu",
  ];

  statusBarItem.tooltip = new vscode.MarkdownString(tooltipLines.join("\n"));
}

/**
 * Creates the status bar item.
 */
function createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  item.command = "cadence.openPeriodicNote";
  item.text = `$(calendar) ${getPeriodContextLabel()}`;
  item.tooltip = "Click to open periodic note menu";
  item.show();
  return item;
}

// ============================================================================
// Task Management Functions
// ============================================================================

/**
 * Refreshes the cached task data from the vault.
 */
async function refreshTasks(): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    cachedTasks = null;
    taskTreeProvider?.refresh(null);
    updateTaskStatusBar();
    return;
  }

  try {
    const fs = new NodeFileSystem();
    const configLoader = new ConfigLoader(fs);
    const aggregator = new TaskAggregator(fs, configLoader);

    cachedTasks = await aggregator.aggregate({
      vaultPath,
      daysBack: 30,
      includeCompleted: false,
      noteTypes: ["daily"],
    });

    taskTreeProvider?.refresh(cachedTasks);
    updateTaskStatusBar();
  } catch (error) {
    console.error("Failed to refresh tasks:", error);
    cachedTasks = null;
    taskTreeProvider?.refresh(null);
    updateTaskStatusBar();
  }
}

/**
 * Updates the task status bar item with current counts.
 */
function updateTaskStatusBar(): void {
  if (!taskStatusBarItem) {
    return;
  }

  const openCount = cachedTasks?.open.length ?? 0;
  const overdueCount = cachedTasks?.overdue.length ?? 0;

  if (openCount === 0) {
    taskStatusBarItem.text = "$(checklist) No tasks";
    taskStatusBarItem.backgroundColor = undefined;
  } else if (overdueCount > 0) {
    taskStatusBarItem.text = `$(checklist) ${openCount} tasks (${overdueCount} overdue)`;
    taskStatusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
  } else {
    taskStatusBarItem.text = `$(checklist) ${openCount} tasks`;
    taskStatusBarItem.backgroundColor = undefined;
  }

  // Build tooltip
  const tooltipLines: string[] = [
    "**Cadence Tasks**",
    "",
    `Open: ${openCount}`,
    `Overdue: ${overdueCount}`,
  ];

  if (cachedTasks) {
    tooltipLines.push(
      `High Priority: ${cachedTasks.byPriority.high.length}`,
      `Stale: ${cachedTasks.stale.length}`
    );
  }

  tooltipLines.push("", "Click to show tasks sidebar");

  taskStatusBarItem.tooltip = new vscode.MarkdownString(tooltipLines.join("\n"));
}

/**
 * Creates the task status bar item.
 */
function createTaskStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99
  );
  item.command = "cadence.focusTasksView";
  item.text = "$(checklist) Loading...";
  item.tooltip = "Loading tasks...";
  item.show();
  return item;
}

/**
 * Navigates to a task in its source file.
 */
async function navigateToTask(task: TaskWithSource): Promise<void> {
  try {
    const uri = vscode.Uri.file(task.sourcePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    // Move cursor to the task line
    const line = task.line - 1; // Convert to 0-indexed
    const position = new vscode.Position(line, 0);
    const range = new vscode.Range(position, position);

    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Toggles the completion status of a task at the cursor position.
 */
async function toggleTaskAtCursor(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Cadence: No active editor");
    return;
  }

  if (editor.document.languageId !== "markdown") {
    vscode.window.showWarningMessage("Cadence: Not a markdown file");
    return;
  }

  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  const lineNumber = editor.selection.active.line + 1; // Convert to 1-indexed
  const filePath = editor.document.uri.fsPath;

  try {
    const fs = new NodeFileSystem();
    const modifier = new TaskModifier(fs);
    const updatedTask = await modifier.toggleTask(filePath, lineNumber);

    // Refresh the document to show the change
    await vscode.commands.executeCommand("workbench.action.files.revert");

    // Refresh task tree
    await refreshTasks();

    // Refresh CodeLens
    taskCodeLensProvider?.refresh();

    vscode.window.showInformationMessage(
      `Cadence: Task ${updatedTask.completed ? "completed" : "reopened"}`
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("is not a task")) {
      vscode.window.showWarningMessage("Cadence: Current line is not a task");
    } else {
      handleCadenceError(error);
    }
  }
}

/**
 * Toggles a task at a specific line (used by CodeLens).
 */
async function toggleTaskAtLine(uri: vscode.Uri, lineNumber: number): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  try {
    const fs = new NodeFileSystem();
    const modifier = new TaskModifier(fs);
    await modifier.toggleTask(uri.fsPath, lineNumber);

    // Refresh the document if it's open
    const doc = vscode.workspace.textDocuments.find(
      (d) => d.uri.fsPath === uri.fsPath
    );
    if (doc) {
      await vscode.commands.executeCommand("workbench.action.files.revert");
    }

    // Refresh task tree and CodeLens
    await refreshTasks();
    taskCodeLensProvider?.refresh();
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Executes task rollover from previous days.
 */
async function rolloverTasks(): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  try {
    const fs = new NodeFileSystem();
    const configLoader = new ConfigLoader(fs);
    const rollover = new TaskRollover(fs, configLoader);

    const result = await rollover.rollover({ vaultPath });

    if (result.rolledOver.length === 0) {
      vscode.window.showInformationMessage(
        "Cadence: No tasks to roll over"
      );
    } else {
      vscode.window.showInformationMessage(
        `Cadence: Rolled over ${result.rolledOver.length} task(s) to today's note`
      );

      // Open today's note to show the rolled over tasks
      await openNote(result.targetNotePath);
    }

    // Refresh task tree
    await refreshTasks();
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Shows only overdue tasks in the sidebar.
 */
async function showOverdueTasks(): Promise<void> {
  taskTreeProvider?.setFilterMode("overdue");
  await vscode.commands.executeCommand("cadence.focusTasksView");
}

/**
 * Shows all open tasks in the sidebar.
 */
async function showAllTasks(): Promise<void> {
  taskTreeProvider?.setFilterMode("all");
  await vscode.commands.executeCommand("cadence.focusTasksView");
}

/**
 * Shows high priority tasks in the sidebar.
 */
async function showHighPriorityTasks(): Promise<void> {
  taskTreeProvider?.setFilterMode("high-priority");
  await vscode.commands.executeCommand("cadence.focusTasksView");
}

/**
 * Edits task metadata (placeholder for quick pick).
 */
async function editTaskMetadata(uri: vscode.Uri, lineNumber: number): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  // Show quick pick for metadata to edit
  const options = [
    { label: "$(flame) Set Priority", value: "priority" },
    { label: "$(calendar) Set Due Date", value: "due" },
    { label: "$(tag) Add/Remove Tags", value: "tags" },
  ];

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: "Select metadata to edit",
  });

  if (!selected) {
    return;
  }

  const fs = new NodeFileSystem();
  const modifier = new TaskModifier(fs);

  try {
    switch (selected.value) {
      case "priority": {
        const priorityOptions = [
          { label: "$(flame) High", value: "high" as const },
          { label: "$(arrow-up) Medium", value: "medium" as const },
          { label: "$(arrow-down) Low", value: "low" as const },
          { label: "$(circle-slash) Remove Priority", value: null },
        ];

        const priority = await vscode.window.showQuickPick(priorityOptions, {
          placeHolder: "Select priority",
        });

        if (priority !== undefined) {
          await modifier.updateMetadata(uri.fsPath, lineNumber, {
            priority: priority.value,
          });
        }
        break;
      }

      case "due": {
        const dateInput = await vscode.window.showInputBox({
          prompt: "Enter due date (e.g., 'tomorrow', '2024-01-15')",
          placeHolder: "tomorrow",
        });

        if (dateInput !== undefined) {
          if (dateInput === "") {
            // Remove due date
            await modifier.updateMetadata(uri.fsPath, lineNumber, {
              due: null,
            });
          } else {
            const dateParser = new DateParser();
            const dueDate = dateParser.parse(dateInput);
            await modifier.updateMetadata(uri.fsPath, lineNumber, {
              due: dueDate,
            });
          }
        }
        break;
      }

      case "tags": {
        const tagsInput = await vscode.window.showInputBox({
          prompt: "Enter tags (comma-separated, e.g., 'work, urgent')",
          placeHolder: "work, urgent",
        });

        if (tagsInput !== undefined) {
          const tags = tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          await modifier.updateMetadata(uri.fsPath, lineNumber, {
            tags: tags.length > 0 ? tags : null,
          });
        }
        break;
      }
    }

    // Refresh document and tasks
    await vscode.commands.executeCommand("workbench.action.files.revert");
    await refreshTasks();
    taskCodeLensProvider?.refresh();
  } catch (error) {
    handleCadenceError(error);
  }
}

// ============================================================================
// Context and Search Functions
// ============================================================================

/**
 * Refreshes the context data from the vault.
 */
async function refreshContext(): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    cachedContext = null;
    contextTreeProvider?.refresh(null);
    return;
  }

  try {
    const fs = new NodeFileSystem();
    const configLoader = new ConfigLoader(fs);
    const contextBuilder = new ContextBuilder(fs, configLoader, vaultPath);

    cachedContext = await contextBuilder.getContext({
      dailyCount: 5,
      includeWeekly: true,
      includeMonthly: true,
      includeQuarterly: true,
      includeTasks: true,
    });

    contextTreeProvider?.refresh(cachedContext);
  } catch (error) {
    console.error("Failed to refresh context:", error);
    cachedContext = null;
    contextTreeProvider?.refresh(null);
  }
}

/**
 * Gets context and presents options to copy or open in editor.
 */
async function getContext(): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  try {
    // Ensure context is fresh
    await refreshContext();

    if (!cachedContext) {
      vscode.window.showInformationMessage("Cadence: No context available");
      return;
    }

    // Build context text
    const contextText = buildContextText(cachedContext, vaultPath);

    // Show quick pick for action
    const action = await vscode.window.showQuickPick(
      [
        { label: "$(clippy) Copy to Clipboard", value: "copy" },
        { label: "$(file-text) Open in New Editor", value: "editor" },
      ],
      {
        placeHolder: "What would you like to do with the context?",
        title: "Cadence: Get Context",
      }
    );

    if (!action) {
      return;
    }

    if (action.value === "copy") {
      await vscode.env.clipboard.writeText(contextText);
      vscode.window.showInformationMessage("Cadence: Context copied to clipboard");
    } else if (action.value === "editor") {
      const doc = await vscode.workspace.openTextDocument({
        content: contextText,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc);
    }
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Builds human-readable context text from Context object.
 */
function buildContextText(context: Context, vaultPath: string): string {
  const lines: string[] = [];

  // Header
  lines.push("# Cadence Context");
  lines.push("");
  lines.push(context.summary);
  lines.push("");

  // Daily notes
  if (context.daily.length > 0) {
    lines.push("## Recent Daily Notes");
    lines.push("");
    for (const note of context.daily) {
      const fileName = note.path.replace(vaultPath, "").replace(/^[/\\]/, "");
      lines.push(`### ${fileName}`);
      lines.push("");
      lines.push(note.body.trim().slice(0, 500));
      if (note.body.trim().length > 500) {
        lines.push("...");
      }
      lines.push("");
    }
  }

  // Weekly note
  if (context.weekly) {
    lines.push("## Current Weekly Note");
    lines.push("");
    lines.push(context.weekly.body.trim().slice(0, 500));
    if (context.weekly.body.trim().length > 500) {
      lines.push("...");
    }
    lines.push("");
  }

  // Monthly note
  if (context.monthly) {
    lines.push("## Current Monthly Note");
    lines.push("");
    lines.push(context.monthly.body.trim().slice(0, 500));
    if (context.monthly.body.trim().length > 500) {
      lines.push("...");
    }
    lines.push("");
  }

  // Tasks
  if (context.tasks.open.length > 0 || context.tasks.overdue.length > 0) {
    lines.push("## Tasks");
    lines.push("");

    if (context.tasks.overdue.length > 0) {
      lines.push("### Overdue Tasks");
      lines.push("");
      for (const task of context.tasks.overdue.slice(0, 10)) {
        lines.push(`- [ ] ${task.text}`);
      }
      lines.push("");
    }

    if (context.tasks.open.length > 0) {
      lines.push("### Open Tasks");
      lines.push("");
      for (const task of context.tasks.open.slice(0, 10)) {
        lines.push(`- [ ] ${task.text}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Quick open a note using fuzzy search across the vault.
 */
async function quickOpen(): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  try {
    const fs = new NodeFileSystem();
    const vaultSearch = new VaultSearch(fs, vaultPath);

    // Create quick pick with fuzzy search
    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { fullPath: string }>();
    quickPick.placeholder = "Type to search for notes...";
    quickPick.title = "Cadence: Quick Open Note";
    quickPick.matchOnDescription = true;

    // Initial load of all files
    const initialResults = await vaultSearch.searchFiles("", { limit: 50 });
    quickPick.items = initialResults.map((result) => ({
      label: getFileName(result.path).replace(".md", ""),
      description: result.path,
      fullPath: `${vaultPath}/${result.path}`,
    }));

    // Handle search input changes
    quickPick.onDidChangeValue(async (value) => {
      quickPick.busy = true;
      try {
        const results = await vaultSearch.searchFiles(value, { limit: 50 });
        quickPick.items = results.map((result) => ({
          label: getFileName(result.path).replace(".md", ""),
          description: result.path,
          fullPath: `${vaultPath}/${result.path}`,
        }));
      } catch {
        // Ignore search errors
      }
      quickPick.busy = false;
    });

    // Handle selection
    quickPick.onDidAccept(async () => {
      const selected = quickPick.selectedItems[0];
      if (selected) {
        quickPick.hide();
        await openNote(selected.fullPath);
      }
    });

    quickPick.onDidHide(() => { quickPick.dispose(); });
    quickPick.show();
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Search vault content and show results in tree view.
 */
async function searchVault(): Promise<void> {
  const vaultPath = getVaultPath();
  if (!vaultPath) {
    vscode.window.showErrorMessage(
      "Cadence: No workspace folder open. Please open a folder to use Cadence."
    );
    return;
  }

  // Prompt for search query
  const query = await vscode.window.showInputBox({
    prompt: "Enter search query",
    placeHolder: "Search vault content...",
    title: "Cadence: Search",
  });

  if (!query) {
    return;
  }

  try {
    const fs = new NodeFileSystem();
    const vaultSearch = new VaultSearch(fs, vaultPath);

    const results = await vaultSearch.searchContent(query, { limit: 100 });

    // Update search tree provider
    searchTreeProvider?.setVaultPath(vaultPath);
    searchTreeProvider?.setResults(query, results);

    // Focus the search view
    await vscode.commands.executeCommand("cadence-search.focus");

    if (results.length === 0) {
      vscode.window.showInformationMessage(`Cadence: No results found for "${query}"`);
    } else {
      vscode.window.showInformationMessage(
        `Cadence: Found ${results.length} result${results.length === 1 ? "" : "s"} for "${query}"`
      );
    }
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Opens a search result at the specified line.
 */
async function openSearchResult(match: ContentMatch): Promise<void> {
  try {
    const uri = vscode.Uri.file(match.path);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    // Move cursor to the match line
    const line = match.line - 1; // Convert to 0-indexed
    const position = new vscode.Position(line, 0);
    const range = new vscode.Range(position, position);

    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } catch (error) {
    handleCadenceError(error);
  }
}

/**
 * Extract filename from a path.
 */
function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

/**
 * Activates the extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log(`Cadence extension v${VERSION} activated`);

  // Register periodic note commands
  const periodicCommands: [string, () => Promise<void>][] = [
    // Open current period commands
    ["cadence.openTodaysNote", openTodaysNote],
    ["cadence.openWeeklyNote", openWeeklyNote],
    ["cadence.openMonthlyNote", openMonthlyNote],
    ["cadence.openQuarterlyNote", openQuarterlyNote],
    ["cadence.openYearlyNote", openYearlyNote],
    // Create note for specific date commands
    ["cadence.createDailyNote", createDailyNote],
    ["cadence.createWeeklyNote", createWeeklyNote],
    ["cadence.createMonthlyNote", createMonthlyNote],
    ["cadence.createQuarterlyNote", createQuarterlyNote],
    ["cadence.createYearlyNote", createYearlyNote],
    // Quick pick menu command
    ["cadence.openPeriodicNote", openPeriodicNote],
    // Template command
    ["cadence.newFromTemplate", newFromTemplate],
  ];

  const periodicCommandDisposables = periodicCommands.map(([command, handler]) =>
    vscode.commands.registerCommand(command, handler)
  );

  // Register task commands
  const taskCommands: [string, (...args: unknown[]) => Promise<void>][] = [
    ["cadence.toggleTask", toggleTaskAtCursor],
    ["cadence.rolloverTasks", rolloverTasks],
    ["cadence.showOverdueTasks", showOverdueTasks],
    ["cadence.showAllTasks", showAllTasks],
    ["cadence.showHighPriorityTasks", showHighPriorityTasks],
    ["cadence.refreshTasks", refreshTasks],
    ["cadence.navigateToTask", (task: unknown) => navigateToTask(task as TaskWithSource)],
    ["cadence.toggleTaskAtLine", (uri: unknown, line: unknown) => toggleTaskAtLine(uri as vscode.Uri, line as number)],
    ["cadence.editTaskMetadata", (uri: unknown, line: unknown) => editTaskMetadata(uri as vscode.Uri, line as number)],
  ];

  const taskCommandDisposables = taskCommands.map(([command, handler]) =>
    vscode.commands.registerCommand(command, handler)
  );

  // Focus task view command
  const focusTasksViewDisposable = vscode.commands.registerCommand(
    "cadence.focusTasksView",
    () => vscode.commands.executeCommand("cadence-tasks.focus")
  );

  // Register context and search commands
  const contextCommands: [string, (...args: unknown[]) => Promise<void>][] = [
    ["cadence.getContext", getContext],
    ["cadence.quickOpen", quickOpen],
    ["cadence.search", searchVault],
    ["cadence.refreshContext", refreshContext],
    ["cadence.openSearchResult", (match: unknown) => openSearchResult(match as ContentMatch)],
  ];

  const contextCommandDisposables = contextCommands.map(([command, handler]) =>
    vscode.commands.registerCommand(command, handler)
  );

  // Focus context view command
  const focusContextViewDisposable = vscode.commands.registerCommand(
    "cadence.focusContextView",
    () => vscode.commands.executeCommand("cadence-context.focus")
  );

  // Focus search view command
  const focusSearchViewDisposable = vscode.commands.registerCommand(
    "cadence.focusSearchView",
    () => vscode.commands.executeCommand("cadence-search.focus")
  );

  // Create task tree view provider
  taskTreeProvider = new TaskTreeProvider();
  const treeViewDisposable = vscode.window.createTreeView("cadence-tasks", {
    treeDataProvider: taskTreeProvider,
    showCollapseAll: true,
  });

  // Create context tree view provider
  contextTreeProvider = new ContextTreeProvider();
  const contextTreeViewDisposable = vscode.window.createTreeView("cadence-context", {
    treeDataProvider: contextTreeProvider,
    showCollapseAll: true,
  });

  // Create search tree view provider
  searchTreeProvider = new SearchTreeProvider();
  const searchTreeViewDisposable = vscode.window.createTreeView("cadence-search", {
    treeDataProvider: searchTreeProvider,
    showCollapseAll: true,
  });

  // Create CodeLens provider for tasks
  taskCodeLensProvider = new TaskCodeLensProvider();
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    { language: "markdown", scheme: "file" },
    taskCodeLensProvider
  );

  // Create status bar items
  statusBarItem = createStatusBarItem();
  taskStatusBarItem = createTaskStatusBarItem();

  // Update status bar on workspace change
  const workspaceChangeDisposable = vscode.workspace.onDidChangeWorkspaceFolders(
    async () => {
      await updateStatusBar();
      await refreshTasks();
      await refreshContext();
    }
  );

  // Update status bar and tasks when files are created/deleted
  const fileWatcherDisposable = vscode.workspace.onDidCreateFiles(async () => {
    await updateStatusBar();
    await refreshTasks();
    await refreshContext();
  });

  const fileDeleteDisposable = vscode.workspace.onDidDeleteFiles(async () => {
    await updateStatusBar();
    await refreshTasks();
    await refreshContext();
  });

  // Refresh tasks and context when markdown files are saved
  const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
    if (doc.languageId === "markdown") {
      await refreshTasks();
      await refreshContext();
      taskCodeLensProvider?.refresh();
    }
  });

  // Initial status bar update, task refresh, and context refresh
  void updateStatusBar();
  void refreshTasks();
  void refreshContext();

  // Register all disposables
  context.subscriptions.push(
    ...periodicCommandDisposables,
    ...taskCommandDisposables,
    ...contextCommandDisposables,
    focusTasksViewDisposable,
    focusContextViewDisposable,
    focusSearchViewDisposable,
    treeViewDisposable,
    contextTreeViewDisposable,
    searchTreeViewDisposable,
    codeLensDisposable,
    statusBarItem,
    taskStatusBarItem,
    workspaceChangeDisposable,
    fileWatcherDisposable,
    fileDeleteDisposable,
    saveDisposable
  );
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {
  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = undefined;
  }
  if (taskStatusBarItem) {
    taskStatusBarItem.dispose();
    taskStatusBarItem = undefined;
  }
  taskTreeProvider = undefined;
  taskCodeLensProvider = undefined;
  contextTreeProvider = undefined;
  searchTreeProvider = undefined;
  cachedContext = null;
  cachedTasks = null;
}
