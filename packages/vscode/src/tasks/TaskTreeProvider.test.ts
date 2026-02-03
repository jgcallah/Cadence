import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AggregatedTasks, TaskWithSource } from "@cadence/core";

// Mock vscode module - factory must be hoisted, no external refs
vi.mock("vscode", () => ({
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
  MarkdownString: class MarkdownString {
    value: string;
    constructor(value: string) {
      this.value = value;
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
}));

import { TaskTreeProvider, TaskTreeItem } from "./TaskTreeProvider.js";

// Constants for assertions
const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

function createMockTask(overrides: Partial<TaskWithSource> = {}): TaskWithSource {
  const now = new Date();
  return {
    line: 1,
    text: "Test task",
    completed: false,
    metadata: {
      tags: [],
      ...overrides.metadata,
    },
    raw: "- [ ] Test task",
    sourcePath: "/vault/daily/2024-01-15.md",
    sourceDate: now,
    ...overrides,
  };
}

function createMockAggregatedTasks(overrides: Partial<AggregatedTasks> = {}): AggregatedTasks {
  return {
    open: [],
    completed: [],
    overdue: [],
    stale: [],
    byPriority: {
      high: [],
      medium: [],
      low: [],
      none: [],
    },
    ...overrides,
  };
}

describe("TaskTreeProvider", () => {
  let provider: TaskTreeProvider;

  beforeEach(() => {
    provider = new TaskTreeProvider();
  });

  describe("refresh", () => {
    it("should fire onDidChangeTreeData event when tasks are refreshed", () => {
      let eventFired = false;
      provider.onDidChangeTreeData(() => {
        eventFired = true;
      });

      provider.refresh(createMockAggregatedTasks());

      expect(eventFired).toBe(true);
    });

    it("should handle null tasks", () => {
      provider.refresh(null);

      const children = provider.getChildren();
      expect(children).toEqual([]);
    });
  });

  describe("setFilterMode", () => {
    it("should change filter mode and fire event", () => {
      let eventFired = false;
      provider.onDidChangeTreeData(() => {
        eventFired = true;
      });

      provider.setFilterMode("overdue");

      expect(provider.getFilterMode()).toBe("overdue");
      expect(eventFired).toBe(true);
    });
  });

  describe("getChildren", () => {
    it("should return empty array when no tasks", () => {
      provider.refresh(null);

      const children = provider.getChildren();

      expect(children).toEqual([]);
    });

    it("should return empty message item when tasks array is empty", () => {
      provider.refresh(createMockAggregatedTasks({ open: [] }));

      const children = provider.getChildren();

      expect(children.length).toBe(1);
      expect(children[0]?.label).toBe("No open tasks");
    });

    it("should return grouped tasks by source file", () => {
      const task1 = createMockTask({
        text: "Task 1",
        sourcePath: "/vault/daily/2024-01-15.md",
      });
      const task2 = createMockTask({
        text: "Task 2",
        sourcePath: "/vault/daily/2024-01-15.md",
      });
      const task3 = createMockTask({
        text: "Task 3",
        sourcePath: "/vault/daily/2024-01-14.md",
      });

      provider.refresh(
        createMockAggregatedTasks({
          open: [task1, task2, task3],
        })
      );

      const children = provider.getChildren();

      // Should have 2 groups
      expect(children.length).toBe(2);
      expect(children[0]?.label).toContain("2024-01-15.md");
      expect(children[0]?.label).toContain("(2)");
    });

    it("should return tasks for a specific group", () => {
      const task1 = createMockTask({
        text: "Task 1",
        sourcePath: "/vault/daily/2024-01-15.md",
      });
      const task2 = createMockTask({
        text: "Task 2",
        sourcePath: "/vault/daily/2024-01-15.md",
      });

      provider.refresh(
        createMockAggregatedTasks({
          open: [task1, task2],
        })
      );

      const groups = provider.getChildren();
      const groupItem = groups[0];
      expect(groupItem?.groupId).toBe("/vault/daily/2024-01-15.md");

      const tasks = provider.getChildren(groupItem);

      expect(tasks.length).toBe(2);
      expect(tasks[0]?.label).toBe("Task 1");
      expect(tasks[1]?.label).toBe("Task 2");
    });
  });

  describe("filter modes", () => {
    it("should filter overdue tasks", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const overdueTask = createMockTask({
        text: "Overdue task",
        metadata: {
          tags: [],
          due: yesterday,
        },
      });

      const normalTask = createMockTask({
        text: "Normal task",
      });

      provider.refresh(
        createMockAggregatedTasks({
          open: [overdueTask, normalTask],
          overdue: [overdueTask],
        })
      );

      provider.setFilterMode("overdue");

      const children = provider.getChildren();

      // Should have 1 group with overdue task
      expect(children.length).toBe(1);
    });

    it("should filter high priority tasks", () => {
      const highPriorityTask = createMockTask({
        text: "High priority task",
        metadata: {
          tags: [],
          priority: "high",
        },
      });

      const normalTask = createMockTask({
        text: "Normal task",
      });

      provider.refresh(
        createMockAggregatedTasks({
          open: [highPriorityTask, normalTask],
          byPriority: {
            high: [highPriorityTask],
            medium: [],
            low: [],
            none: [normalTask],
          },
        })
      );

      provider.setFilterMode("high-priority");

      const groups = provider.getChildren();
      expect(groups.length).toBe(1);
    });

    it("should show correct empty message for each filter mode", () => {
      provider.refresh(createMockAggregatedTasks());

      provider.setFilterMode("overdue");
      let children = provider.getChildren();
      expect(children[0]?.label).toBe("No overdue tasks");

      provider.setFilterMode("high-priority");
      children = provider.getChildren();
      expect(children[0]?.label).toBe("No high-priority tasks");

      provider.setFilterMode("all");
      children = provider.getChildren();
      expect(children[0]?.label).toBe("No open tasks");
    });
  });

  describe("getOpenTaskCount", () => {
    it("should return 0 when no tasks", () => {
      provider.refresh(null);

      expect(provider.getOpenTaskCount()).toBe(0);
    });

    it("should return correct count", () => {
      const tasks = [
        createMockTask({ text: "Task 1" }),
        createMockTask({ text: "Task 2" }),
        createMockTask({ text: "Task 3" }),
      ];

      provider.refresh(createMockAggregatedTasks({ open: tasks }));

      expect(provider.getOpenTaskCount()).toBe(3);
    });
  });

  describe("getOverdueTaskCount", () => {
    it("should return 0 when no overdue tasks", () => {
      provider.refresh(createMockAggregatedTasks());

      expect(provider.getOverdueTaskCount()).toBe(0);
    });

    it("should return correct overdue count", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const overdueTask = createMockTask({
        metadata: { tags: [], due: yesterday },
      });

      provider.refresh(
        createMockAggregatedTasks({
          overdue: [overdueTask],
        })
      );

      expect(provider.getOverdueTaskCount()).toBe(1);
    });
  });
});

describe("TaskTreeItem", () => {
  it("should create a group item without task", () => {
    const item = new TaskTreeItem(
      "Daily Notes (3)",
      TreeItemCollapsibleState.Expanded,
      undefined,
      "/vault/daily"
    );

    expect(item.label).toBe("Daily Notes (3)");
    expect(item.collapsibleState).toBe(TreeItemCollapsibleState.Expanded);
    expect(item.groupId).toBe("/vault/daily");
    expect(item.task).toBeUndefined();
  });

  it("should create a task item with correct icon for open task", () => {
    const task = createMockTask({ completed: false });

    const item = new TaskTreeItem(
      task.text,
      TreeItemCollapsibleState.None,
      task
    );

    expect(item.label).toBe("Test task");
    expect(item.iconPath).toBeDefined();
    expect((item.iconPath as { id: string }).id).toBe("circle-outline");
    expect(item.contextValue).toBe("task-open");
  });

  it("should create a task item with correct icon for completed task", () => {
    const task = createMockTask({ completed: true });

    const item = new TaskTreeItem(
      task.text,
      TreeItemCollapsibleState.None,
      task
    );

    expect((item.iconPath as { id: string }).id).toBe("check");
    expect(item.contextValue).toBe("task-completed");
  });

  it("should show priority indicator in description", () => {
    const task = createMockTask({
      metadata: { tags: [], priority: "high" },
    });

    const item = new TaskTreeItem(
      task.text,
      TreeItemCollapsibleState.None,
      task
    );

    expect(item.description).toContain("🔴");
  });

  it("should show due date in description", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const task = createMockTask({
      metadata: { tags: [], due: tomorrow },
    });

    const item = new TaskTreeItem(
      task.text,
      TreeItemCollapsibleState.None,
      task
    );

    expect(item.description).toContain("📅");
    expect(item.description).toContain("Tomorrow");
  });

  it("should show overdue indicator for past due tasks", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const task = createMockTask({
      metadata: { tags: [], due: yesterday },
    });

    const item = new TaskTreeItem(
      task.text,
      TreeItemCollapsibleState.None,
      task
    );

    expect(item.description).toContain("⚠️");
  });

  it("should show tags in description", () => {
    const task = createMockTask({
      metadata: { tags: ["work", "urgent"] },
    });

    const item = new TaskTreeItem(
      task.text,
      TreeItemCollapsibleState.None,
      task
    );

    expect(item.description).toContain("#work");
    expect(item.description).toContain("#urgent");
  });

  it("should set command for navigation", () => {
    const task = createMockTask();

    const item = new TaskTreeItem(
      task.text,
      TreeItemCollapsibleState.None,
      task
    );

    expect(item.command).toBeDefined();
    expect(item.command?.command).toBe("cadence.navigateToTask");
    expect(item.command?.arguments).toEqual([task]);
  });
});
