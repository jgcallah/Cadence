import { Command } from "commander";
import { format } from "date-fns";
import {
  ContextBuilder,
  type Context,
  type TaskWithSource,
} from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";

/**
 * Format context as markdown for human consumption.
 */
function formatContextMarkdown(context: Context, vaultPath: string): string {
  const lines: string[] = [];

  lines.push("# Context");
  lines.push("");
  lines.push(context.summary);
  lines.push("");

  // Daily notes
  if (context.daily.length > 0) {
    lines.push("## Daily Notes");
    lines.push("");
    for (const note of context.daily) {
      const relativePath = getRelativePath(note.path, vaultPath);
      lines.push(`### ${relativePath}`);
      lines.push("");
      lines.push(note.body.trim());
      lines.push("");
    }
  }

  // Weekly note
  if (context.weekly) {
    lines.push("## Weekly Note");
    lines.push("");
    const relativePath = getRelativePath(context.weekly.path, vaultPath);
    lines.push(`### ${relativePath}`);
    lines.push("");
    lines.push(context.weekly.body.trim());
    lines.push("");
  }

  // Monthly note
  if (context.monthly) {
    lines.push("## Monthly Note");
    lines.push("");
    const relativePath = getRelativePath(context.monthly.path, vaultPath);
    lines.push(`### ${relativePath}`);
    lines.push("");
    lines.push(context.monthly.body.trim());
    lines.push("");
  }

  // Quarterly note
  if (context.quarterly) {
    lines.push("## Quarterly Note");
    lines.push("");
    const relativePath = getRelativePath(context.quarterly.path, vaultPath);
    lines.push(`### ${relativePath}`);
    lines.push("");
    lines.push(context.quarterly.body.trim());
    lines.push("");
  }

  // Tasks
  if (context.tasks.open.length > 0 || context.tasks.overdue.length > 0) {
    lines.push("## Tasks");
    lines.push("");

    if (context.tasks.overdue.length > 0) {
      lines.push("### Overdue");
      lines.push("");
      for (const task of context.tasks.overdue) {
        lines.push(formatTaskMarkdown(task, vaultPath));
      }
      lines.push("");
    }

    if (context.tasks.open.length > 0) {
      lines.push("### Open");
      lines.push("");
      for (const task of context.tasks.open) {
        lines.push(formatTaskMarkdown(task, vaultPath));
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Format a single task for markdown output.
 */
function formatTaskMarkdown(task: TaskWithSource, vaultPath: string): string {
  const parts: string[] = ["- [ ]"];

  // Priority
  if (task.metadata.priority) {
    parts.push(`[${task.metadata.priority}]`);
  }

  // Task text
  parts.push(task.text);

  // Due date
  if (task.metadata.due) {
    parts.push(`(due: ${format(task.metadata.due, "yyyy-MM-dd")})`);
  }

  // Source
  const relativePath = getRelativePath(task.sourcePath, vaultPath);
  parts.push(`- ${relativePath}:${task.line}`);

  return parts.join(" ");
}

/**
 * Format context as JSON.
 */
function formatContextJson(context: Context, vaultPath: string): string {
  // Create a serializable version of the context
  const serializable = {
    summary: context.summary,
    daily: context.daily.map((note) => ({
      path: getRelativePath(note.path, vaultPath),
      frontmatter: note.frontmatter,
      body: note.body,
    })),
    weekly: context.weekly
      ? {
          path: getRelativePath(context.weekly.path, vaultPath),
          frontmatter: context.weekly.frontmatter,
          body: context.weekly.body,
        }
      : undefined,
    monthly: context.monthly
      ? {
          path: getRelativePath(context.monthly.path, vaultPath),
          frontmatter: context.monthly.frontmatter,
          body: context.monthly.body,
        }
      : undefined,
    quarterly: context.quarterly
      ? {
          path: getRelativePath(context.quarterly.path, vaultPath),
          frontmatter: context.quarterly.frontmatter,
          body: context.quarterly.body,
        }
      : undefined,
    tasks: {
      open: context.tasks.open.map((task) => formatTaskJson(task, vaultPath)),
      overdue: context.tasks.overdue.map((task) =>
        formatTaskJson(task, vaultPath)
      ),
    },
  };

  return JSON.stringify(serializable, null, 2);
}

/**
 * Format a task for JSON output.
 */
function formatTaskJson(
  task: TaskWithSource,
  vaultPath: string
): Record<string, unknown> {
  return {
    text: task.text,
    completed: task.completed,
    line: task.line,
    sourcePath: getRelativePath(task.sourcePath, vaultPath),
    sourceDate: format(task.sourceDate, "yyyy-MM-dd"),
    metadata: {
      priority: task.metadata.priority,
      due: task.metadata.due
        ? format(task.metadata.due, "yyyy-MM-dd")
        : undefined,
      tags: task.metadata.tags,
      age: task.metadata.age,
    },
  };
}

/**
 * Get path relative to vault root.
 */
function getRelativePath(fullPath: string, vaultPath: string): string {
  // Normalize separators
  const normalizedFull = fullPath.replace(/\\/g, "/");
  const normalizedVault = vaultPath.replace(/\\/g, "/");

  if (normalizedFull.startsWith(normalizedVault)) {
    let relative = normalizedFull.slice(normalizedVault.length);
    if (relative.startsWith("/")) {
      relative = relative.slice(1);
    }
    return relative;
  }
  return fullPath;
}

export const contextCommand = new Command("context")
  .description("Output formatted context from recent notes")
  .option("--days <number>", "Number of daily notes to include", "5")
  .option("--no-tasks", "Exclude tasks from context")
  .option("--no-weekly", "Exclude weekly note from context")
  .option("--no-monthly", "Exclude monthly note from context")
  .option("--quarterly", "Include quarterly note in context")
  .option("--json", "Output as JSON instead of markdown")
  .action(async function (
    this: Command,
    options: {
      days?: string;
      tasks?: boolean;
      weekly?: boolean;
      monthly?: boolean;
      quarterly?: boolean;
      json?: boolean;
    }
  ) {
    try {
      const { vaultPath, fs, configLoader } = await getVaultContext(this);

      const dailyCount = parseInt(options.days ?? "5", 10);
      if (isNaN(dailyCount) || dailyCount < 1) {
        throw new Error("--days must be a positive integer");
      }

      const contextBuilder = new ContextBuilder(fs, configLoader, vaultPath);
      const context = await contextBuilder.getContext({
        dailyCount,
        includeTasks: options.tasks !== false,
        includeWeekly: options.weekly !== false,
        includeMonthly: options.monthly !== false,
        includeQuarterly: options.quarterly === true,
      });

      // Output based on format
      if (options.json) {
        console.log(formatContextJson(context, vaultPath));
      } else {
        console.log(formatContextMarkdown(context, vaultPath));
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
