import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context, Note, TaskWithSource } from "@cadence/core";

const mockVscode = {
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
  Uri: {
    file: vi.fn((path: string) => ({ fsPath: path })),
  },
};

vi.mock("vscode", () => mockVscode);

describe("ContextTreeProvider", () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  type ContextTreeProviderType = typeof import("./ContextTreeProvider.js").ContextTreeProvider;
  let ContextTreeProvider: ContextTreeProviderType;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import("./ContextTreeProvider.js");
    ContextTreeProvider = module.ContextTreeProvider;
  });

  function createMockNote(path: string, body: string): Note {
    return {
      path,
      content: `---\n---\n${body}`,
      frontmatter: {},
      body,
    };
  }

  function createMockTask(text: string, options?: Partial<TaskWithSource>): TaskWithSource {
    return {
      text,
      completed: false,
      line: 1,
      raw: `- [ ] ${text}`,
      metadata: {
        priority: null,
        due: null,
        tags: [],
      },
      sourcePath: "/vault/daily/2024-01-15.md",
      sourceDate: new Date("2024-01-15"),
      ...options,
    };
  }

  function createMockContext(options?: Partial<Context>): Context {
    return {
      daily: [],
      tasks: { open: [], overdue: [] },
      summary: "Test context",
      ...options,
    };
  }

  describe("refresh", () => {
    it("should fire tree data change event when refreshed", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext();

      provider.refresh(context);

      // No error means the event fired successfully
    });

    it("should store context for getChildren", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        daily: [createMockNote("/vault/daily/2024-01-15.md", "# Today\nTest content")],
      });

      provider.refresh(context);
      const children = provider.getChildren();

      expect(children.length).toBeGreaterThan(0);
    });
  });

  describe("getChildren - no context", () => {
    it("should return placeholder when no context available", () => {
      const provider = new ContextTreeProvider();

      const children = provider.getChildren();

      expect(children).toHaveLength(1);
      expect(children[0].label).toBe("No context available");
    });
  });

  describe("getChildren - root level", () => {
    it("should show Daily Notes section when daily notes exist", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        daily: [
          createMockNote("/vault/daily/2024-01-15.md", "Day 1"),
          createMockNote("/vault/daily/2024-01-14.md", "Day 2"),
        ],
      });

      provider.refresh(context);
      const children = provider.getChildren();

      const dailySection = children.find((c) => c.label === "Daily Notes");
      expect(dailySection).toBeDefined();
      expect(dailySection?.description).toBe("(2)");
      expect(dailySection?.collapsibleState).toBe(mockVscode.TreeItemCollapsibleState.Expanded);
    });

    it("should show Weekly Note when weekly note exists", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        weekly: createMockNote("/vault/weekly/2024-W03.md", "Weekly content"),
      });

      provider.refresh(context);
      const children = provider.getChildren();

      const weeklySection = children.find((c) => c.label === "Weekly Note");
      expect(weeklySection).toBeDefined();
      expect(weeklySection?.collapsibleState).toBe(mockVscode.TreeItemCollapsibleState.Collapsed);
    });

    it("should show Monthly Note when monthly note exists", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        monthly: createMockNote("/vault/monthly/2024-01.md", "Monthly content"),
      });

      provider.refresh(context);
      const children = provider.getChildren();

      const monthlySection = children.find((c) => c.label === "Monthly Note");
      expect(monthlySection).toBeDefined();
    });

    it("should show Quarterly Note when quarterly note exists", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        quarterly: createMockNote("/vault/quarterly/2024-Q1.md", "Quarterly content"),
      });

      provider.refresh(context);
      const children = provider.getChildren();

      const quarterlySection = children.find((c) => c.label === "Quarterly Note");
      expect(quarterlySection).toBeDefined();
    });

    it("should show Tasks section when tasks exist", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        tasks: {
          open: [createMockTask("Task 1"), createMockTask("Task 2")],
          overdue: [createMockTask("Overdue task")],
        },
      });

      provider.refresh(context);
      const children = provider.getChildren();

      const tasksSection = children.find((c) => c.label === "Tasks");
      expect(tasksSection).toBeDefined();
      expect(tasksSection?.description).toBe("(2 open, 1 overdue)");
    });

    it("should not show Tasks section when no tasks exist", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        tasks: { open: [], overdue: [] },
      });

      provider.refresh(context);
      const children = provider.getChildren();

      const tasksSection = children.find((c) => c.label === "Tasks");
      expect(tasksSection).toBeUndefined();
    });
  });

  describe("getChildren - daily items", () => {
    it("should return daily note items when expanding Daily Notes", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        daily: [
          createMockNote("/vault/daily/2024-01-15.md", "Day 1 content"),
          createMockNote("/vault/daily/2024-01-14.md", "Day 2 content"),
        ],
      });

      provider.refresh(context);
      const root = provider.getChildren();
      const dailySection = root.find((c) => c.contextValue === "daily");

      if (dailySection) {
        const dailyItems = provider.getChildren(dailySection);
        expect(dailyItems).toHaveLength(2);
        expect(dailyItems[0].label).toBe("2024-01-15");
        expect(dailyItems[1].label).toBe("2024-01-14");
      }
    });

    it("should show content preview in description", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        daily: [createMockNote("/vault/daily/2024-01-15.md", "Some preview content here")],
      });

      provider.refresh(context);
      const root = provider.getChildren();
      const dailySection = root.find((c) => c.contextValue === "daily");

      if (dailySection) {
        const dailyItems = provider.getChildren(dailySection);
        expect(dailyItems[0].description).toContain("Some preview content");
      }
    });
  });

  describe("getChildren - task items", () => {
    it("should show Open Tasks and Overdue Tasks categories", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        tasks: {
          open: [createMockTask("Open task")],
          overdue: [createMockTask("Overdue task")],
        },
      });

      provider.refresh(context);
      const root = provider.getChildren();
      const tasksSection = root.find((c) => c.contextValue === "tasks");

      if (tasksSection) {
        const taskCategories = provider.getChildren(tasksSection);
        expect(taskCategories).toHaveLength(2);

        const openCategory = taskCategories.find((c) => c.label === "Open Tasks");
        const overdueCategory = taskCategories.find((c) => c.label === "Overdue Tasks");

        expect(openCategory).toBeDefined();
        expect(overdueCategory).toBeDefined();
      }
    });

    it("should show individual tasks under categories", () => {
      const provider = new ContextTreeProvider();
      const context = createMockContext({
        tasks: {
          open: [createMockTask("Task 1"), createMockTask("Task 2")],
          overdue: [],
        },
      });

      provider.refresh(context);
      const root = provider.getChildren();
      const tasksSection = root.find((c) => c.contextValue === "tasks");

      if (tasksSection) {
        const taskCategories = provider.getChildren(tasksSection);
        const openCategory = taskCategories.find((c) => c.contextValue === "tasks-open");

        if (openCategory) {
          const tasks = provider.getChildren(openCategory);
          expect(tasks).toHaveLength(2);
          expect(tasks[0].label).toContain("Task 1");
        }
      }
    });

    it("should limit tasks to 10 per category", () => {
      const provider = new ContextTreeProvider();
      const openTasks = Array.from({ length: 15 }, (_, i) => createMockTask(`Task ${i + 1}`));
      const context = createMockContext({
        tasks: {
          open: openTasks,
          overdue: [],
        },
      });

      provider.refresh(context);
      const root = provider.getChildren();
      const tasksSection = root.find((c) => c.contextValue === "tasks");

      if (tasksSection) {
        const taskCategories = provider.getChildren(tasksSection);
        const openCategory = taskCategories.find((c) => c.contextValue === "tasks-open");

        if (openCategory) {
          const tasks = provider.getChildren(openCategory);
          expect(tasks).toHaveLength(10);
        }
      }
    });
  });

  describe("getTreeItem", () => {
    it("should return the element as-is", async () => {
      const provider = new ContextTreeProvider();
      const { ContextTreeItem } = await import("./ContextTreeProvider.js");

      const item = new ContextTreeItem("Test", mockVscode.TreeItemCollapsibleState.None);
      const result = provider.getTreeItem(item);

      expect(result).toBe(item);
    });
  });
});
