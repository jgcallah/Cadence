import * as vscode from "vscode";
import type { TaskWithSource, AggregatedTasks } from "@cadence/core";

/**
 * Tree item representing a task or task group in the sidebar.
 */
export class TaskTreeItem extends vscode.TreeItem {
  public readonly task: TaskWithSource | undefined;
  public readonly groupId: string | undefined;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    task?: TaskWithSource,
    groupId?: string
  ) {
    super(label, collapsibleState);
    this.task = task;
    this.groupId = groupId;

    if (task) {
      this.setupTaskItem(task);
    }
  }

  private setupTaskItem(task: TaskWithSource): void {
    // Set checkbox icon based on completion status
    this.iconPath = task.completed
      ? new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"))
      : new vscode.ThemeIcon("circle-outline");

    // Build description with metadata icons
    const descParts: string[] = [];

    // Priority indicator
    if (task.metadata.priority) {
      const priorityIcons: Record<string, string> = {
        high: "🔴",
        medium: "🟡",
        low: "🔵",
      };
      descParts.push(priorityIcons[task.metadata.priority] || "");
    }

    // Due date
    if (task.metadata.due) {
      const isOverdue = task.metadata.due < new Date();
      const dueStr = formatDate(task.metadata.due);
      descParts.push(isOverdue ? `⚠️ ${dueStr}` : `📅 ${dueStr}`);
    }

    // Tags
    if (task.metadata.tags.length > 0) {
      descParts.push(task.metadata.tags.map((t) => `#${t}`).join(" "));
    }

    this.description = descParts.join(" ");

    // Set tooltip with full task info
    const tooltipLines: string[] = [
      task.text,
      "",
      `Source: ${getFileName(task.sourcePath)}`,
      `Line: ${task.line}`,
    ];

    if (task.metadata.due) {
      tooltipLines.push(`Due: ${formatDate(task.metadata.due)}`);
    }
    if (task.metadata.priority) {
      tooltipLines.push(`Priority: ${task.metadata.priority}`);
    }
    if (task.metadata.tags.length > 0) {
      tooltipLines.push(`Tags: ${task.metadata.tags.join(", ")}`);
    }
    if (task.metadata.age !== undefined) {
      tooltipLines.push(`Age: ${task.metadata.age} days`);
    }

    this.tooltip = new vscode.MarkdownString(tooltipLines.join("\n"));

    // Set command to navigate to task on click
    this.command = {
      command: "cadence.navigateToTask",
      title: "Navigate to Task",
      arguments: [task],
    };

    // Context value for context menu
    this.contextValue = task.completed ? "task-completed" : "task-open";
  }
}

/**
 * Groups tasks by their source note file.
 */
interface TaskGroup {
  sourcePath: string;
  sourceFileName: string;
  tasks: TaskWithSource[];
}

/**
 * Filter mode for the task tree view.
 */
export type TaskFilterMode = "all" | "overdue" | "today" | "high-priority";

/**
 * Tree data provider for tasks in the sidebar.
 */
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: AggregatedTasks | null = null;
  private filterMode: TaskFilterMode = "all";

  /**
   * Refresh the tree view with new task data.
   */
  refresh(tasks: AggregatedTasks | null): void {
    this.tasks = tasks;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Set the filter mode and refresh the view.
   */
  setFilterMode(mode: TaskFilterMode): void {
    this.filterMode = mode;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get the current filter mode.
   */
  getFilterMode(): TaskFilterMode {
    return this.filterMode;
  }

  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TaskTreeItem): TaskTreeItem[] {
    if (!this.tasks) {
      return [];
    }

    // If no element, return top-level groups
    if (!element) {
      return this.getTopLevelItems();
    }

    // If element is a group, return its tasks
    if (element.groupId) {
      return this.getTasksForGroup(element.groupId);
    }

    return [];
  }

  private getTopLevelItems(): TaskTreeItem[] {
    if (!this.tasks) {
      return [];
    }

    // Get filtered tasks based on current filter mode
    const filteredTasks = this.getFilteredTasks();

    if (filteredTasks.length === 0) {
      return [
        new TaskTreeItem(
          this.getEmptyMessage(),
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }

    // Group tasks by source note
    const groups = this.groupTasksBySource(filteredTasks);

    return groups.map(
      (group) =>
        new TaskTreeItem(
          `${group.sourceFileName} (${group.tasks.length})`,
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          group.sourcePath
        )
    );
  }

  private getFilteredTasks(): TaskWithSource[] {
    if (!this.tasks) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (this.filterMode) {
      case "overdue":
        return this.tasks.overdue;
      case "today":
        return this.tasks.open.filter((task) => {
          if (!task.metadata.due) return false;
          const due = new Date(task.metadata.due);
          due.setHours(0, 0, 0, 0);
          return due >= today && due < tomorrow;
        });
      case "high-priority":
        return this.tasks.byPriority.high;
      case "all":
      default:
        return this.tasks.open;
    }
  }

  private getEmptyMessage(): string {
    switch (this.filterMode) {
      case "overdue":
        return "No overdue tasks";
      case "today":
        return "No tasks due today";
      case "high-priority":
        return "No high-priority tasks";
      default:
        return "No open tasks";
    }
  }

  private getTasksForGroup(sourcePath: string): TaskTreeItem[] {
    if (!this.tasks) {
      return [];
    }

    const filteredTasks = this.getFilteredTasks();
    const groupTasks = filteredTasks.filter((t) => t.sourcePath === sourcePath);

    return groupTasks.map(
      (task) =>
        new TaskTreeItem(
          task.text,
          vscode.TreeItemCollapsibleState.None,
          task
        )
    );
  }

  private groupTasksBySource(tasks: TaskWithSource[]): TaskGroup[] {
    const groupMap = new Map<string, TaskGroup>();

    for (const task of tasks) {
      if (!groupMap.has(task.sourcePath)) {
        groupMap.set(task.sourcePath, {
          sourcePath: task.sourcePath,
          sourceFileName: getFileName(task.sourcePath),
          tasks: [],
        });
      }
      groupMap.get(task.sourcePath)!.tasks.push(task);
    }

    // Sort groups by source date (most recent first)
    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => {
      const dateA = a.tasks[0]?.sourceDate.getTime() ?? 0;
      const dateB = b.tasks[0]?.sourceDate.getTime() ?? 0;
      return dateB - dateA;
    });

    return groups;
  }

  /**
   * Get the total count of open tasks.
   */
  getOpenTaskCount(): number {
    return this.tasks?.open.length ?? 0;
  }

  /**
   * Get the count of overdue tasks.
   */
  getOverdueTaskCount(): number {
    return this.tasks?.overdue.length ?? 0;
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
 * Format a date for display.
 */
function formatDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 0 && diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;

  return date.toLocaleDateString();
}
