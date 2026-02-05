import * as vscode from "vscode";
import { TaskParser } from "@cadence/core";

/**
 * Provides CodeLens actions above tasks in markdown files.
 */
export class TaskCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private taskParser: TaskParser;

  constructor() {
    this.taskParser = new TaskParser();
  }

  /**
   * Notify that CodeLenses may have changed.
   */
  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    // Only provide CodeLens for markdown files
    if (document.languageId !== "markdown") {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    const content = document.getText();
    const tasks = this.taskParser.parse(content);

    for (const task of tasks) {
      const line = task.line - 1; // Convert to 0-indexed
      const range = new vscode.Range(line, 0, line, task.raw.length);

      // Toggle action
      const toggleLens = new vscode.CodeLens(range, {
        title: task.completed ? "$(check) Mark Open" : "$(circle-outline) Mark Done",
        command: "cadence.toggleTaskAtLine",
        arguments: [document.uri, task.line],
        tooltip: task.completed
          ? "Mark this task as open"
          : "Mark this task as completed",
      });
      codeLenses.push(toggleLens);

      // Metadata display
      const metadataParts: string[] = [];

      if (task.metadata.priority) {
        const priorityIcons: Record<string, string> = {
          high: "$(flame)",
          medium: "$(arrow-up)",
          low: "$(arrow-down)",
        };
        metadataParts.push(
          `${priorityIcons[task.metadata.priority] || ""} ${task.metadata.priority}`
        );
      }

      if (task.metadata.due) {
        const isOverdue = task.metadata.due < new Date();
        const dueStr = formatShortDate(task.metadata.due);
        metadataParts.push(
          isOverdue ? `$(warning) Due: ${dueStr}` : `$(calendar) Due: ${dueStr}`
        );
      }

      if (task.metadata.age !== undefined) {
        metadataParts.push(`$(history) ${task.metadata.age}d old`);
      }

      if (metadataParts.length > 0) {
        const metadataLens = new vscode.CodeLens(range, {
          title: metadataParts.join(" | "),
          command: "cadence.editTaskMetadata",
          arguments: [document.uri, task.line],
          tooltip: "Click to edit task metadata",
        });
        codeLenses.push(metadataLens);
      }
    }

    return codeLenses;
  }
}

/**
 * Format a date in short form.
 */
function formatShortDate(date: Date): string {
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

  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${date.getDate()}`;
}
