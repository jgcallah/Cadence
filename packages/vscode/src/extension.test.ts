import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create a fresh mock status bar item for each test
function createMockStatusBarItem() {
  return {
    command: undefined as string | undefined,
    text: "",
    tooltip: "" as string | { value: string },
    backgroundColor: undefined as unknown,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  };
}

let mockStatusBarItem = createMockStatusBarItem();
let _mockTaskStatusBarItem = createMockStatusBarItem();
let statusBarItemCallCount = 0;

const mockCommands = new Map<string, (...args: unknown[]) => Promise<void>>();

const mockTreeView = {
  dispose: vi.fn(),
};

const mockVscode = {
  window: {
    createStatusBarItem: vi.fn(() => {
      statusBarItemCallCount++;
      const item = createMockStatusBarItem();
      // First call is periodic note status bar, second is task status bar
      if (statusBarItemCallCount === 1) {
        mockStatusBarItem = item;
      } else if (statusBarItemCallCount === 2) {
        _mockTaskStatusBarItem = item;
      }
      return item;
    }),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInputBox: vi.fn(),
    showTextDocument: vi.fn(),
    showQuickPick: vi.fn(),
    createTreeView: vi.fn(() => mockTreeView),
    activeTextEditor: undefined as { document: { languageId: string; uri: { fsPath: string } }; selection: { active: { line: number } } } | undefined,
  },
  workspace: {
    workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined,
    openTextDocument: vi.fn(),
    textDocuments: [] as { uri: { fsPath: string } }[],
    onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
    onDidCreateFiles: vi.fn(() => ({ dispose: vi.fn() })),
    onDidDeleteFiles: vi.fn(() => ({ dispose: vi.fn() })),
    onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  },
  commands: {
    registerCommand: vi.fn((command: string, callback: (...args: unknown[]) => Promise<void>) => {
      mockCommands.set(command, callback);
      return { dispose: vi.fn() };
    }),
    executeCommand: vi.fn(),
  },
  languages: {
    registerCodeLensProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2,
  },
  QuickPickItemKind: {
    Separator: -1,
    Default: 0,
  },
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
  MarkdownString: vi.fn((value: string) => ({ value })),
  TreeItem: class TreeItem {
    label: string;
    collapsibleState: number;
    iconPath?: unknown;
    description?: string;
    tooltip?: unknown;
    command?: unknown;
    contextValue?: string;

    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  ThemeIcon: class ThemeIcon {
    id: string;
    color?: unknown;
    constructor(id: string, color?: unknown) {
      this.id = id;
      this.color = color;
    }
  },
  ThemeColor: class ThemeColor {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
  },
  EventEmitter: class EventEmitter {
    private listeners: (() => void)[] = [];
    event = (listener: () => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire = () => {
      this.listeners.forEach((l) => l());
    };
  },
  Position: class Position {
    line: number;
    character: number;
    constructor(line: number, character: number) {
      this.line = line;
      this.character = character;
    }
  },
  Selection: class Selection {
    anchor: { line: number; character: number };
    active: { line: number; character: number };
    constructor(
      anchor: { line: number; character: number },
      active: { line: number; character: number }
    ) {
      this.anchor = anchor;
      this.active = active;
    }
  },
  Range: class Range {
    start: { line: number; character: number };
    end: { line: number; character: number };
    constructor(startLine: number, startChar: number, endLine: number, endChar: number) {
      this.start = { line: startLine, character: startChar };
      this.end = { line: endLine, character: endChar };
    }
  },
  CodeLens: class CodeLens {
    range: unknown;
    command?: unknown;
    constructor(range: unknown, command?: unknown) {
      this.range = range;
      this.command = command;
    }
  },
};

vi.mock("vscode", () => mockVscode);

// Mock @cadence/core
const mockNoteService = {
  ensureNote: vi.fn(),
  noteExists: vi.fn(),
};

const mockTemplateRegistry = {
  loadFromConfig: vi.fn(),
  list: vi.fn(),
  getVariables: vi.fn(),
  get: vi.fn(),
};

const mockConfigLoader = {
  loadConfig: vi.fn(),
};

const mockCreateFromTemplate = vi.fn();

const mockDateParser = {
  parse: vi.fn((input: string) => {
    if (input === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d;
    }
    if (input === "tomorrow") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return d;
    }
    return new Date(input);
  }),
  parseForType: vi.fn((input: string, _type: string) => {
    if (input === "last week" || input === "last month" || input === "last quarter" || input === "last year") {
      const d = new Date();
      return d;
    }
    return new Date(input);
  }),
};

const mockTaskAggregator = {
  aggregate: vi.fn().mockResolvedValue({
    open: [],
    completed: [],
    overdue: [],
    stale: [],
    byPriority: { high: [], medium: [], low: [], none: [] },
  }),
  clearConfigCache: vi.fn(),
};

const mockTaskRollover = {
  rollover: vi.fn().mockResolvedValue({
    rolledOver: [],
    targetNotePath: "",
    skipped: [],
  }),
  clearConfigCache: vi.fn(),
};

const mockTaskModifier = {
  toggleTask: vi.fn(),
  updateMetadata: vi.fn(),
  addTask: vi.fn(),
};

const mockContextBuilder = {
  getContext: vi.fn().mockResolvedValue({
    daily: [],
    tasks: { open: [], overdue: [] },
    summary: "",
  }),
};

vi.mock("@cadence/core", () => ({
  VERSION: "0.0.1",
  NodeFileSystem: vi.fn(() => ({})),
  ConfigLoader: vi.fn(() => mockConfigLoader),
  NoteService: vi.fn(() => mockNoteService),
  DateParser: vi.fn(() => mockDateParser),
  TemplateRegistry: vi.fn(() => mockTemplateRegistry),
  createFromTemplate: (...args: unknown[]) => mockCreateFromTemplate(...args),
  TaskAggregator: vi.fn(() => mockTaskAggregator),
  TaskRollover: vi.fn(() => mockTaskRollover),
  TaskModifier: vi.fn(() => mockTaskModifier),
  TaskParser: vi.fn(() => ({
    parse: vi.fn().mockReturnValue([]),
  })),
  ContextBuilder: vi.fn(() => mockContextBuilder),
  CadenceError: class CadenceError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "CadenceError";
    }
  },
  VaultNotFoundError: class VaultNotFoundError extends Error {
    constructor() {
      super("No vault found");
      this.name = "VaultNotFoundError";
    }
  },
  ConfigNotFoundError: class ConfigNotFoundError extends Error {
    vaultPath: string;
    constructor(vaultPath: string) {
      super(`No config found at ${vaultPath}`);
      this.name = "ConfigNotFoundError";
      this.vaultPath = vaultPath;
    }
  },
}));

describe("VS Code Extension", () => {
  let activate: (context: { subscriptions: { dispose: () => void }[] }) => void;
  let deactivate: () => void;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    mockCommands.clear();

    // Create fresh status bar items
    mockStatusBarItem = createMockStatusBarItem();
    _mockTaskStatusBarItem = createMockStatusBarItem();
    statusBarItemCallCount = 0;

    // Reset workspace folders
    mockVscode.workspace.workspaceFolders = undefined;
    mockVscode.window.activeTextEditor = undefined;

    // Reset note service mocks - default to returning false for noteExists
    mockNoteService.ensureNote.mockReset();
    mockNoteService.noteExists.mockReset();
    mockNoteService.noteExists.mockResolvedValue(false);

    // Reset template mocks
    mockTemplateRegistry.loadFromConfig.mockReset();
    mockTemplateRegistry.list.mockReset();
    mockTemplateRegistry.getVariables.mockReset();
    mockTemplateRegistry.get.mockReset();
    mockConfigLoader.loadConfig.mockReset();
    mockCreateFromTemplate.mockReset();

    // Reset task mocks
    mockTaskAggregator.aggregate.mockReset();
    mockTaskAggregator.aggregate.mockResolvedValue({
      open: [],
      completed: [],
      overdue: [],
      stale: [],
      byPriority: { high: [], medium: [], low: [], none: [] },
    });
    mockTaskRollover.rollover.mockReset();
    mockTaskRollover.rollover.mockResolvedValue({
      rolledOver: [],
      targetNotePath: "",
      skipped: [],
    });
    mockTaskModifier.toggleTask.mockReset();
    mockTaskModifier.updateMetadata.mockReset();

    // Default config loader returns empty config
    mockConfigLoader.loadConfig.mockResolvedValue({ templates: {}, tasks: { scanDaysBack: 7, staleAfterDays: 3 } });

    // Import fresh module (reset module state)
    vi.resetModules();
    const module = await import("./extension.js");
    activate = module.activate;
    deactivate = module.deactivate;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("activate", () => {
    it("should register all periodic note commands", () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      activate(context);

      const expectedCommands = [
        "cadence.openTodaysNote",
        "cadence.openWeeklyNote",
        "cadence.openMonthlyNote",
        "cadence.openQuarterlyNote",
        "cadence.openYearlyNote",
        "cadence.createDailyNote",
        "cadence.createWeeklyNote",
        "cadence.createMonthlyNote",
        "cadence.createQuarterlyNote",
        "cadence.createYearlyNote",
        "cadence.openPeriodicNote",
      ];

      for (const cmd of expectedCommands) {
        expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
          cmd,
          expect.any(Function)
        );
      }
    });

    it("should create status bar item with periodic note command", () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      activate(context);

      expect(mockVscode.window.createStatusBarItem).toHaveBeenCalledWith(
        mockVscode.StatusBarAlignment.Right,
        100
      );
      expect(mockStatusBarItem.command).toBe("cadence.openPeriodicNote");
      expect(mockStatusBarItem.text).toMatch(/\$\(calendar\)/);
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it("should add disposables to context subscriptions", () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      activate(context);

      // Should have: 12 periodic commands + 9 task commands + 5 context/search commands + 3 focus commands + 3 tree views + 1 CodeLens + 2 status bars + 4 event listeners = 39
      expect(context.subscriptions.length).toBe(39);
    });
  });

  describe("deactivate", () => {
    it("should clean up status bar item", () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      activate(context);

      deactivate();

      expect(mockStatusBarItem.dispose).toHaveBeenCalled();
    });
  });

  describe("cadence.openTodaysNote command", () => {
    it("should show error when no workspace folder is open", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = undefined;

      activate(context);

      const command = mockCommands.get("cadence.openTodaysNote");
      expect(command).toBeDefined();
      await command!();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Cadence: No workspace folder open. Please open a folder to use Cadence."
      );
    });

    it("should open daily note when workspace folder exists", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/daily/2024-01-15.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.openTodaysNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "daily",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(mockVscode.window.showTextDocument).toHaveBeenCalled();
    });
  });

  describe("cadence.openWeeklyNote command", () => {
    it("should show error when no workspace folder is open", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = undefined;

      activate(context);

      const command = mockCommands.get("cadence.openWeeklyNote");
      expect(command).toBeDefined();
      await command!();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Cadence: No workspace folder open. Please open a folder to use Cadence."
      );
    });

    it("should open weekly note when workspace folder exists", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/weekly/2024-W03.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.openWeeklyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "weekly",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(mockVscode.window.showTextDocument).toHaveBeenCalled();
    });
  });

  describe("cadence.openMonthlyNote command", () => {
    it("should open monthly note when workspace folder exists", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/monthly/2024-01.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.openMonthlyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "monthly",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
    });
  });

  describe("cadence.openQuarterlyNote command", () => {
    it("should open quarterly note when workspace folder exists", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/quarterly/2024-Q1.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.openQuarterlyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "quarterly",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
    });
  });

  describe("cadence.openYearlyNote command", () => {
    it("should open yearly note when workspace folder exists", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/yearly/2024.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.openYearlyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "yearly",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
    });
  });

  describe("cadence.createDailyNote command", () => {
    it("should show error when no workspace folder is open", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = undefined;

      activate(context);

      const command = mockCommands.get("cadence.createDailyNote");
      expect(command).toBeDefined();
      await command!();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Cadence: No workspace folder open. Please open a folder to use Cadence."
      );
    });

    it("should do nothing when user cancels input box", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showInputBox.mockResolvedValue(undefined);

      activate(context);

      const command = mockCommands.get("cadence.createDailyNote");
      await command!();

      expect(mockNoteService.ensureNote).not.toHaveBeenCalled();
    });

    it("should create note for entered date", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showInputBox.mockResolvedValue("yesterday");
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/daily/2024-01-14.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.createDailyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "daily",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
    });

    it("should use today when empty string is entered", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showInputBox.mockResolvedValue("");
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/daily/2024-01-15.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.createDailyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "daily",
        expect.any(Date)
      );
    });
  });

  describe("cadence.createWeeklyNote command", () => {
    it("should create weekly note for entered week", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showInputBox.mockResolvedValue("last week");
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/weekly/2024-W02.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.createWeeklyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "weekly",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
    });

    it("should do nothing when user cancels", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showInputBox.mockResolvedValue(undefined);

      activate(context);

      const command = mockCommands.get("cadence.createWeeklyNote");
      await command!();

      expect(mockNoteService.ensureNote).not.toHaveBeenCalled();
    });
  });

  describe("cadence.createMonthlyNote command", () => {
    it("should create monthly note for entered month", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showInputBox.mockResolvedValue("last month");
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/monthly/2023-12.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.createMonthlyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "monthly",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
    });
  });

  describe("cadence.createQuarterlyNote command", () => {
    it("should create quarterly note for entered quarter", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showInputBox.mockResolvedValue("last quarter");
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/quarterly/2023-Q4.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.createQuarterlyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "quarterly",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
    });
  });

  describe("cadence.createYearlyNote command", () => {
    it("should create yearly note for entered year", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showInputBox.mockResolvedValue("last year");
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/yearly/2023.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.createYearlyNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "yearly",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
    });
  });

  describe("cadence.openPeriodicNote command", () => {
    it("should show error when no workspace folder is open", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = undefined;

      activate(context);

      const command = mockCommands.get("cadence.openPeriodicNote");
      expect(command).toBeDefined();
      await command!();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Cadence: No workspace folder open. Please open a folder to use Cadence."
      );
    });

    it("should do nothing when user cancels note type selection", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showQuickPick.mockResolvedValue(undefined);

      activate(context);

      const command = mockCommands.get("cadence.openPeriodicNote");
      await command!();

      expect(mockNoteService.ensureNote).not.toHaveBeenCalled();
    });

    it("should open current daily note when selected", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showQuickPick
        .mockResolvedValueOnce({ label: "$(calendar) Daily", description: "Open today's daily note", type: "daily" })
        .mockResolvedValueOnce({ label: "Current", description: "Open the current daily note", current: true });
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/daily/2024-01-15.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.openPeriodicNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "daily",
        expect.any(Date)
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
    });

    it("should open weekly note when selected", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showQuickPick
        .mockResolvedValueOnce({ label: "$(calendar) Weekly", description: "Open this week's note", type: "weekly" })
        .mockResolvedValueOnce({ label: "Current", description: "Open the current weekly note", current: true });
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/weekly/2024-W03.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.openPeriodicNote");
      await command!();

      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "weekly",
        expect.any(Date)
      );
    });

    it("should show date input when choose date is selected", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showQuickPick
        .mockResolvedValueOnce({ label: "$(calendar) Monthly", description: "Open this month's note", type: "monthly" })
        .mockResolvedValueOnce({ label: "Choose date...", description: "Specify a custom date/period", current: false });
      mockVscode.window.showInputBox.mockResolvedValue("last month");
      mockNoteService.ensureNote.mockResolvedValue("/test/vault/monthly/2023-12.md");
      mockNoteService.noteExists.mockResolvedValue(true);
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.openPeriodicNote");
      await command!();

      expect(mockVscode.window.showInputBox).toHaveBeenCalled();
      expect(mockNoteService.ensureNote).toHaveBeenCalledWith(
        "monthly",
        expect.any(Date)
      );
    });

    it("should do nothing when user cancels date choice", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockVscode.window.showQuickPick
        .mockResolvedValueOnce({ label: "$(calendar) Daily", description: "Open today's daily note", type: "daily" })
        .mockResolvedValueOnce(undefined);

      activate(context);

      const command = mockCommands.get("cadence.openPeriodicNote");
      await command!();

      expect(mockNoteService.ensureNote).not.toHaveBeenCalled();
    });
  });

  describe("cadence.newFromTemplate command", () => {
    it("should show error when no workspace folder is open", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = undefined;

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      expect(command).toBeDefined();
      await command!();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        "Cadence: No workspace folder open. Please open a folder to use Cadence."
      );
    });

    it("should show info message when no templates are configured", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockConfigLoader.loadConfig.mockResolvedValue({ templates: {} });
      mockTemplateRegistry.list.mockResolvedValue([]);

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      await command!();

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        "Cadence: No templates configured. Add templates to your .cadence/config.json file."
      );
    });

    it("should do nothing when user cancels template selection", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockConfigLoader.loadConfig.mockResolvedValue({ templates: { meeting: "templates/meeting.md" } });
      mockTemplateRegistry.list.mockResolvedValue([
        { name: "meeting", path: "templates/meeting.md", description: "Meeting notes template" },
      ]);
      mockVscode.window.showQuickPick.mockResolvedValue(undefined);

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      await command!();

      expect(mockCreateFromTemplate).not.toHaveBeenCalled();
    });

    it("should show templates with name and description in quick pick", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockConfigLoader.loadConfig.mockResolvedValue({ templates: { meeting: "templates/meeting.md" } });
      mockTemplateRegistry.list.mockResolvedValue([
        { name: "meeting", path: "templates/meeting.md", description: "Meeting notes template" },
        { name: "project", path: "templates/project.md", description: "Project kickoff template" },
      ]);
      mockVscode.window.showQuickPick.mockResolvedValue(undefined);

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      await command!();

      // Templates without categories should be shown without separators
      expect(mockVscode.window.showQuickPick).toHaveBeenCalledWith(
        [
          { label: "$(file) meeting", description: "Meeting notes template", templateName: "meeting" },
          { label: "$(file) project", description: "Project kickoff template", templateName: "project" },
        ],
        { placeHolder: "Select a template", title: "New from Template" }
      );
    });

    it("should group templates by category with separators", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockConfigLoader.loadConfig.mockResolvedValue({ templates: {} });
      mockTemplateRegistry.list.mockResolvedValue([
        { name: "meeting", path: "templates/meeting.md", description: "Meeting notes", category: "Work" },
        { name: "standup", path: "templates/standup.md", description: "Daily standup", category: "Work" },
        { name: "journal", path: "templates/journal.md", description: "Personal journal", category: "Personal" },
        { name: "generic", path: "templates/generic.md", description: "Generic note" },
      ]);
      mockVscode.window.showQuickPick.mockResolvedValue(undefined);

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      await command!();

      // Should group by category with separators, sorted alphabetically, uncategorized last
      expect(mockVscode.window.showQuickPick).toHaveBeenCalledWith(
        [
          // Personal category first (alphabetically)
          { label: "Personal", kind: mockVscode.QuickPickItemKind.Separator },
          { label: "$(file) journal", description: "Personal journal", templateName: "journal", category: "Personal" },
          // Work category second
          { label: "Work", kind: mockVscode.QuickPickItemKind.Separator },
          { label: "$(file) meeting", description: "Meeting notes", templateName: "meeting", category: "Work" },
          { label: "$(file) standup", description: "Daily standup", templateName: "standup", category: "Work" },
          // Uncategorized with "Other" separator
          { label: "Other", kind: mockVscode.QuickPickItemKind.Separator },
          { label: "$(file) generic", description: "Generic note", templateName: "generic" },
        ],
        { placeHolder: "Select a template", title: "New from Template" }
      );
    });

    it("should prompt for required variables", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockConfigLoader.loadConfig.mockResolvedValue({ templates: { meeting: "templates/meeting.md" } });
      mockTemplateRegistry.list.mockResolvedValue([
        { name: "meeting", path: "templates/meeting.md", description: "Meeting notes" },
      ]);
      mockTemplateRegistry.getVariables.mockResolvedValue([
        { name: "title", required: true, description: "Meeting title" },
        { name: "attendees", required: true, description: "List of attendees" },
      ]);
      mockVscode.window.showQuickPick.mockResolvedValue({
        label: "$(file) meeting",
        description: "Meeting notes",
        templateName: "meeting",
      });
      // User cancels on first input
      mockVscode.window.showInputBox.mockResolvedValue(undefined);

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      await command!();

      expect(mockVscode.window.showInputBox).toHaveBeenCalledWith({
        prompt: 'Enter value for "title"',
        placeHolder: "Meeting title",
        validateInput: expect.any(Function),
      });
      expect(mockCreateFromTemplate).not.toHaveBeenCalled();
    });

    it("should create note from template with variable values", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockConfigLoader.loadConfig.mockResolvedValue({
        templates: { meeting: "templates/meeting.md" },
        paths: { templates: ".cadence/templates" },
      });
      mockTemplateRegistry.list.mockResolvedValue([
        { name: "meeting", path: "templates/meeting.md", description: "Meeting notes" },
      ]);
      mockTemplateRegistry.getVariables.mockResolvedValue([
        { name: "title", required: true, description: "Meeting title" },
      ]);
      mockVscode.window.showQuickPick.mockResolvedValue({
        label: "$(file) meeting",
        description: "Meeting notes",
        templateName: "meeting",
      });
      mockVscode.window.showInputBox
        .mockResolvedValueOnce("Team Standup") // title value
        .mockResolvedValueOnce("team-standup.md"); // file name
      mockCreateFromTemplate.mockResolvedValue({
        path: "/test/vault/team-standup.md",
        content: "# Team Standup",
        frontmatter: {},
        body: "# Team Standup",
      });
      mockVscode.workspace.openTextDocument.mockResolvedValue({});

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      await command!();

      expect(mockCreateFromTemplate).toHaveBeenCalledWith(
        "meeting",
        "/test/vault/team-standup.md",
        { title: "Team Standup" },
        { fs: expect.anything(), registry: expect.anything() }
      );
      expect(mockVscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(mockVscode.window.showTextDocument).toHaveBeenCalled();
      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Cadence: Created "team-standup.md" from template "meeting"'
      );
    });

    it("should do nothing when user cancels file name input", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockConfigLoader.loadConfig.mockResolvedValue({ templates: { meeting: "templates/meeting.md" } });
      mockTemplateRegistry.list.mockResolvedValue([
        { name: "meeting", path: "templates/meeting.md" },
      ]);
      mockTemplateRegistry.getVariables.mockResolvedValue([]);
      mockVscode.window.showQuickPick.mockResolvedValue({
        label: "$(file) meeting",
        templateName: "meeting",
      });
      mockVscode.window.showInputBox.mockResolvedValue(undefined); // Cancel file name

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      await command!();

      expect(mockCreateFromTemplate).not.toHaveBeenCalled();
    });

    it("should validate file name ends with .md", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockConfigLoader.loadConfig.mockResolvedValue({ templates: { meeting: "templates/meeting.md" } });
      mockTemplateRegistry.list.mockResolvedValue([
        { name: "meeting", path: "templates/meeting.md" },
      ]);
      mockTemplateRegistry.getVariables.mockResolvedValue([]);
      mockVscode.window.showQuickPick.mockResolvedValue({
        label: "$(file) meeting",
        templateName: "meeting",
      });

      // Capture the validateInput function
      let validateFn: ((input: string) => string | null) | undefined;
      mockVscode.window.showInputBox.mockImplementation((options: { validateInput?: (input: string) => string | null }) => {
        if (options.validateInput) {
          validateFn = options.validateInput;
        }
        return Promise.resolve(undefined);
      });

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      await command!();

      // Test the validation function
      expect(validateFn).toBeDefined();
      expect(validateFn!("")).toBe("File name is required");
      expect(validateFn!("test.txt")).toBe("File name must end with .md");
      expect(validateFn!("test.md")).toBeNull();
    });

    it("should validate required variables", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockConfigLoader.loadConfig.mockResolvedValue({ templates: { meeting: "templates/meeting.md" } });
      mockTemplateRegistry.list.mockResolvedValue([
        { name: "meeting", path: "templates/meeting.md" },
      ]);
      mockTemplateRegistry.getVariables.mockResolvedValue([
        { name: "title", required: true, description: "Meeting title" },
      ]);
      mockVscode.window.showQuickPick.mockResolvedValue({
        label: "$(file) meeting",
        templateName: "meeting",
      });

      // Capture the validateInput function for the title variable
      let validateFn: ((input: string) => string | null) | undefined;
      mockVscode.window.showInputBox.mockImplementation((options: { validateInput?: (input: string) => string | null }) => {
        if (options.validateInput && !validateFn) {
          validateFn = options.validateInput;
        }
        return Promise.resolve(undefined);
      });

      activate(context);

      const command = mockCommands.get("cadence.newFromTemplate");
      await command!();

      // Test the validation function
      expect(validateFn).toBeDefined();
      expect(validateFn!("")).toBe("title is required");
      expect(validateFn!("My Meeting")).toBeNull();
    });
  });

  describe("status bar", () => {
    it("should show period context in status bar", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockNoteService.noteExists.mockResolvedValue(false);

      activate(context);

      // Wait for initial status bar update
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Status bar text should include period context (W<number> · Q<number> · <year>)
      expect(mockStatusBarItem.text).toMatch(/\$\(calendar\)/);
      expect(mockStatusBarItem.text).toMatch(/W\d+/);
      expect(mockStatusBarItem.text).toMatch(/Q\d/);
    });

    it("should show indicators for existing notes", async () => {
      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockNoteService.noteExists
        .mockResolvedValueOnce(true)  // daily
        .mockResolvedValueOnce(true)  // weekly
        .mockResolvedValueOnce(false) // monthly
        .mockResolvedValueOnce(false) // quarterly
        .mockResolvedValueOnce(false); // yearly

      activate(context);

      // Wait for status bar update
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Status bar should show [DW] for daily and weekly
      expect(mockStatusBarItem.text).toMatch(/\[DW\]/);
    });
  });

  describe("error handling", () => {
    it("should show appropriate error for VaultNotFoundError", async () => {
      const { VaultNotFoundError } = await import("@cadence/core");

      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockNoteService.ensureNote.mockRejectedValue(new VaultNotFoundError());

      activate(context);

      const command = mockCommands.get("cadence.openTodaysNote");
      await command!();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("No vault found")
      );
    });

    it("should show appropriate error for ConfigNotFoundError", async () => {
      const { ConfigNotFoundError } = await import("@cadence/core");

      const context = { subscriptions: [] as { dispose: () => void }[] };
      mockVscode.workspace.workspaceFolders = [
        { uri: { fsPath: "/test/vault" } },
      ];
      mockNoteService.ensureNote.mockRejectedValue(
        new ConfigNotFoundError("/test/vault")
      );

      activate(context);

      const command = mockCommands.get("cadence.openTodaysNote");
      await command!();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("No config found")
      );
    });
  });
});
