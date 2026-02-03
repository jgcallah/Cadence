import * as vscode from "vscode";
import type { Note, NoteType, TaskWithSource, Context } from "@cadence/core";

/**
 * Tree item representing a context hierarchy node.
 */
export class ContextTreeItem extends vscode.TreeItem {
  public readonly note: Note | undefined;
  public readonly noteType: NoteType | undefined;
  public readonly task: TaskWithSource | undefined;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    options?: {
      note?: Note;
      noteType?: NoteType;
      task?: TaskWithSource;
      description?: string;
      icon?: string;
    }
  ) {
    super(label, collapsibleState);
    this.note = options?.note;
    this.noteType = options?.noteType;
    this.task = options?.task;

    if (options?.description) {
      this.description = options.description;
    }

    if (options?.icon) {
      this.iconPath = new vscode.ThemeIcon(options.icon);
    }

    // Set command to open note on click
    if (this.note) {
      this.command = {
        command: "vscode.open",
        title: "Open Note",
        arguments: [vscode.Uri.file(this.note.path)],
      };
    }

    // Set command to navigate to task on click
    if (this.task) {
      this.command = {
        command: "cadence.navigateToTask",
        title: "Navigate to Task",
        arguments: [this.task],
      };
    }
  }
}

/**
 * Context item identifier for getChildren.
 */
type ContextItemId = "daily" | "weekly" | "monthly" | "quarterly" | "tasks" | "tasks-open" | "tasks-overdue";

/**
 * Tree data provider for the context sidebar view.
 * Shows recent notes hierarchy: Daily -> Weekly -> Monthly
 * And expandable task summary.
 */
export class ContextTreeProvider implements vscode.TreeDataProvider<ContextTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ContextTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private context: Context | null = null;

  /**
   * Refresh the tree view with new context data.
   */
  refresh(context: Context | null): void {
    this.context = context;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ContextTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ContextTreeItem): ContextTreeItem[] {
    if (!this.context) {
      return [
        new ContextTreeItem(
          "No context available",
          vscode.TreeItemCollapsibleState.None,
          { icon: "info" }
        ),
      ];
    }

    // Root level - show categories
    if (!element) {
      return this.getRootItems();
    }

    // Category level - show items
    const id = element.contextValue as ContextItemId | undefined;

    switch (id) {
      case "daily":
        return this.getDailyItems();
      case "weekly":
      case "monthly":
      case "quarterly":
        return this.getPeriodNotePreview(element.note);
      case "tasks":
        return this.getTaskCategories();
      case "tasks-open":
        return this.getTaskItems(this.context.tasks.open);
      case "tasks-overdue":
        return this.getTaskItems(this.context.tasks.overdue);
      default:
        return [];
    }
  }

  private getRootItems(): ContextTreeItem[] {
    const items: ContextTreeItem[] = [];

    if (!this.context) {
      return items;
    }

    // Daily notes section
    if (this.context.daily.length > 0) {
      const dailyItem = new ContextTreeItem(
        `Daily Notes`,
        vscode.TreeItemCollapsibleState.Expanded,
        {
          description: `(${this.context.daily.length})`,
          icon: "calendar",
        }
      );
      dailyItem.contextValue = "daily";
      items.push(dailyItem);
    }

    // Weekly note
    if (this.context.weekly) {
      const weeklyItem = new ContextTreeItem(
        "Weekly Note",
        vscode.TreeItemCollapsibleState.Collapsed,
        {
          note: this.context.weekly,
          noteType: "weekly",
          icon: "calendar",
        }
      );
      weeklyItem.contextValue = "weekly";
      items.push(weeklyItem);
    }

    // Monthly note
    if (this.context.monthly) {
      const monthlyItem = new ContextTreeItem(
        "Monthly Note",
        vscode.TreeItemCollapsibleState.Collapsed,
        {
          note: this.context.monthly,
          noteType: "monthly",
          icon: "calendar",
        }
      );
      monthlyItem.contextValue = "monthly";
      items.push(monthlyItem);
    }

    // Quarterly note
    if (this.context.quarterly) {
      const quarterlyItem = new ContextTreeItem(
        "Quarterly Note",
        vscode.TreeItemCollapsibleState.Collapsed,
        {
          note: this.context.quarterly,
          noteType: "quarterly",
          icon: "calendar",
        }
      );
      quarterlyItem.contextValue = "quarterly";
      items.push(quarterlyItem);
    }

    // Tasks section
    if (this.context.tasks.open.length > 0 || this.context.tasks.overdue.length > 0) {
      const totalTasks = this.context.tasks.open.length;
      const tasksItem = new ContextTreeItem(
        "Tasks",
        vscode.TreeItemCollapsibleState.Collapsed,
        {
          description: `(${totalTasks} open, ${this.context.tasks.overdue.length} overdue)`,
          icon: "checklist",
        }
      );
      tasksItem.contextValue = "tasks";
      items.push(tasksItem);
    }

    return items;
  }

  private getDailyItems(): ContextTreeItem[] {
    if (!this.context) {
      return [];
    }

    return this.context.daily.map((note) => {
      const fileName = this.getFileName(note.path);
      const item = new ContextTreeItem(
        fileName.replace(".md", ""),
        vscode.TreeItemCollapsibleState.None,
        {
          note,
          noteType: "daily",
          icon: "file",
          description: this.getContentPreview(note.body),
        }
      );
      return item;
    });
  }

  private getPeriodNotePreview(note?: Note): ContextTreeItem[] {
    if (!note) {
      return [];
    }

    // Show first few lines as preview
    const lines = note.body.trim().split("\n").slice(0, 5);
    return lines
      .filter((line) => line.trim())
      .map((line) => {
        const item = new ContextTreeItem(
          line.trim().slice(0, 60) + (line.trim().length > 60 ? "..." : ""),
          vscode.TreeItemCollapsibleState.None,
          { icon: "dash" }
        );
        return item;
      });
  }

  private getTaskCategories(): ContextTreeItem[] {
    const items: ContextTreeItem[] = [];

    if (!this.context) {
      return items;
    }

    if (this.context.tasks.open.length > 0) {
      const openItem = new ContextTreeItem(
        "Open Tasks",
        vscode.TreeItemCollapsibleState.Expanded,
        {
          description: `(${this.context.tasks.open.length})`,
          icon: "circle-outline",
        }
      );
      openItem.contextValue = "tasks-open";
      items.push(openItem);
    }

    if (this.context.tasks.overdue.length > 0) {
      const overdueItem = new ContextTreeItem(
        "Overdue Tasks",
        vscode.TreeItemCollapsibleState.Expanded,
        {
          description: `(${this.context.tasks.overdue.length})`,
          icon: "warning",
        }
      );
      overdueItem.contextValue = "tasks-overdue";
      items.push(overdueItem);
    }

    return items;
  }

  private getTaskItems(tasks: TaskWithSource[]): ContextTreeItem[] {
    return tasks.slice(0, 10).map((task) => {
      const item = new ContextTreeItem(
        task.text.slice(0, 50) + (task.text.length > 50 ? "..." : ""),
        vscode.TreeItemCollapsibleState.None,
        {
          task,
          icon: task.completed ? "check" : "circle-outline",
          description: this.getTaskDescription(task),
        }
      );
      return item;
    });
  }

  private getTaskDescription(task: TaskWithSource): string {
    const parts: string[] = [];

    if (task.metadata.priority) {
      const priorityEmoji: Record<string, string> = {
        high: "🔴",
        medium: "🟡",
        low: "🔵",
      };
      parts.push(priorityEmoji[task.metadata.priority] || "");
    }

    if (task.metadata.due) {
      parts.push(`📅 ${task.metadata.due.toLocaleDateString()}`);
    }

    return parts.join(" ");
  }

  private getFileName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  }

  private getContentPreview(body: string): string {
    // Get first non-empty, non-heading line
    const lines = body.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        return trimmed.slice(0, 40) + (trimmed.length > 40 ? "..." : "");
      }
    }
    return "";
  }
}
