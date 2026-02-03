import { Command } from "commander";
import chalk from "chalk";
import { format, differenceInDays } from "date-fns";
import {
  TaskAggregator,
  TaskRollover,
  TaskModifier,
  DateParser,
  type TaskWithSource,
  type TaskPriority,
  type AggregatedTasks,
} from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";

/**
 * Format a task for display with colors and metadata.
 */
function formatTask(task: TaskWithSource, vaultPath: string): string {
  const parts: string[] = [];

  // Build file reference
  const relativePath = task.sourcePath.startsWith(vaultPath)
    ? task.sourcePath.slice(vaultPath.length + 1)
    : task.sourcePath;
  const fileRef = `${relativePath}:${task.line}`;

  // Priority indicator with color
  const priorityIndicator = getPriorityIndicator(task.metadata.priority);
  if (priorityIndicator) {
    parts.push(priorityIndicator);
  }

  // Task text
  parts.push(task.text);

  // Metadata badges
  const badges: string[] = [];

  if (task.metadata.due) {
    const dueStr = format(task.metadata.due, "yyyy-MM-dd");
    const today = new Date();
    const daysUntil = differenceInDays(task.metadata.due, today);
    if (daysUntil < 0) {
      badges.push(chalk.red(`due:${dueStr}`));
    } else if (daysUntil === 0) {
      badges.push(chalk.yellow(`due:${dueStr}`));
    } else {
      badges.push(chalk.cyan(`due:${dueStr}`));
    }
  }

  if (task.metadata.age !== undefined && task.metadata.age > 0) {
    badges.push(chalk.gray(`age:${task.metadata.age}d`));
  }

  if (task.metadata.tags.length > 0) {
    badges.push(
      chalk.blue(task.metadata.tags.map((t) => `#${t}`).join(" "))
    );
  }

  if (badges.length > 0) {
    parts.push(badges.join(" "));
  }

  // File reference (dim)
  parts.push(chalk.gray(`[${fileRef}]`));

  return parts.join(" ");
}

/**
 * Get a colored priority indicator.
 */
function getPriorityIndicator(priority?: TaskPriority): string | null {
  switch (priority) {
    case "high":
      return chalk.red("!!!");
    case "medium":
      return chalk.yellow("!!");
    case "low":
      return chalk.blue("!");
    default:
      return null;
  }
}

/**
 * Group tasks by their source file.
 */
function groupBySource(
  tasks: TaskWithSource[],
  vaultPath: string
): Map<string, TaskWithSource[]> {
  const grouped = new Map<string, TaskWithSource[]>();

  for (const task of tasks) {
    const relativePath = task.sourcePath.startsWith(vaultPath)
      ? task.sourcePath.slice(vaultPath.length + 1)
      : task.sourcePath;

    if (!grouped.has(relativePath)) {
      grouped.set(relativePath, []);
    }
    grouped.get(relativePath)!.push(task);
  }

  return grouped;
}

/**
 * Print tasks grouped by source file.
 */
function printGroupedTasks(
  tasks: TaskWithSource[],
  vaultPath: string,
  title?: string
): void {
  if (tasks.length === 0) {
    console.log(chalk.gray("  No tasks found."));
    return;
  }

  if (title) {
    console.log(chalk.bold(title));
    console.log();
  }

  const grouped = groupBySource(tasks, vaultPath);

  for (const [sourcePath, sourceTasks] of grouped) {
    console.log(chalk.cyan.bold(sourcePath));
    for (const task of sourceTasks) {
      console.log(`  ${formatTask(task, vaultPath)}`);
    }
    console.log();
  }
}

/**
 * Print flat task list.
 */
function printTaskList(
  tasks: TaskWithSource[],
  vaultPath: string,
  title?: string
): void {
  if (tasks.length === 0) {
    console.log(chalk.gray("No tasks found."));
    return;
  }

  if (title) {
    console.log(chalk.bold(title));
    console.log();
  }

  for (const task of tasks) {
    console.log(formatTask(task, vaultPath));
  }
}

/**
 * Format task for JSON output.
 */
function formatTaskForJson(
  task: TaskWithSource,
  vaultPath: string
): Record<string, unknown> {
  const relativePath = task.sourcePath.startsWith(vaultPath)
    ? task.sourcePath.slice(vaultPath.length + 1).replace(/\\/g, "/")
    : task.sourcePath;

  return {
    text: task.text,
    completed: task.completed,
    line: task.line,
    sourcePath: relativePath,
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

// Main tasks command with subcommands
export const tasksCommand = new Command("tasks")
  .description("Manage and view tasks from periodic notes")
  .option("--days <number>", "Number of days to look back", "7")
  .option("--overdue", "Show only overdue tasks")
  .option("--stale", "Show only stale tasks")
  .option("--priority <level>", "Filter by priority (high, medium, low)")
  .option("--tag <tag>", "Filter by tag")
  .option("--flat", "Show tasks in flat list instead of grouped")
  .option("--json", "Output as JSON")
  .action(async function (
    this: Command,
    options: {
      days?: string;
      overdue?: boolean;
      stale?: boolean;
      priority?: string;
      tag?: string;
      flat?: boolean;
      json?: boolean;
    }
  ) {
    try {
      const { vaultPath, fs, configLoader } = await getVaultContext(this);

      const daysBack = parseInt(options.days ?? "7", 10);
      if (isNaN(daysBack) || daysBack < 1) {
        throw new Error("--days must be a positive integer");
      }

      const aggregator = new TaskAggregator(fs, configLoader);
      const result: AggregatedTasks = await aggregator.aggregate({
        vaultPath,
        daysBack,
        includeCompleted: false,
        noteTypes: ["daily"],
      });

      // Determine which tasks to show based on filters
      let tasksToShow: TaskWithSource[];
      let title: string;

      if (options.overdue) {
        tasksToShow = result.overdue;
        title = `Overdue Tasks (${tasksToShow.length})`;
      } else if (options.stale) {
        tasksToShow = result.stale;
        title = `Stale Tasks (${tasksToShow.length})`;
      } else if (options.priority) {
        const priority = options.priority.toLowerCase() as TaskPriority;
        if (!["high", "medium", "low", "none"].includes(priority)) {
          throw new Error(
            `Invalid priority: '${options.priority}'. Valid values are: high, medium, low, none`
          );
        }
        tasksToShow = result.byPriority[priority] ?? [];
        title = `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority Tasks (${tasksToShow.length})`;
      } else if (options.tag) {
        const tagFilter = options.tag.toLowerCase();
        tasksToShow = result.open.filter((task) =>
          task.metadata.tags.some((t) => t.toLowerCase() === tagFilter)
        );
        title = `Tasks tagged #${options.tag} (${tasksToShow.length})`;
      } else {
        tasksToShow = result.open;
        title = `Open Tasks (${tasksToShow.length}) - Last ${daysBack} days`;
      }

      // Output results
      if (options.json) {
        const jsonOutput = {
          filter: options.overdue
            ? "overdue"
            : options.stale
              ? "stale"
              : options.priority
                ? `priority:${options.priority}`
                : options.tag
                  ? `tag:${options.tag}`
                  : "open",
          daysBack,
          count: tasksToShow.length,
          tasks: tasksToShow.map((task) => formatTaskForJson(task, vaultPath)),
          summary: {
            total: result.open.length,
            overdue: result.overdue.length,
            stale: result.stale.length,
            byPriority: {
              high: result.byPriority.high.length,
              medium: result.byPriority.medium.length,
              low: result.byPriority.low.length,
              none: result.byPriority.none.length,
            },
          },
        };
        console.log(JSON.stringify(jsonOutput, null, 2));
      } else {
        // Print tasks
        if (options.flat) {
          printTaskList(tasksToShow, vaultPath, title);
        } else {
          printGroupedTasks(tasksToShow, vaultPath, title);
        }

        // Print summary if showing all open tasks
        if (!options.overdue && !options.stale && !options.priority && !options.tag) {
          console.log(chalk.gray("---"));
          const summaryParts: string[] = [];
          if (result.overdue.length > 0) {
            summaryParts.push(chalk.red(`${result.overdue.length} overdue`));
          }
          if (result.stale.length > 0) {
            summaryParts.push(chalk.yellow(`${result.stale.length} stale`));
          }
          if (result.byPriority.high.length > 0) {
            summaryParts.push(chalk.red(`${result.byPriority.high.length} high priority`));
          }
          if (summaryParts.length > 0) {
            console.log(summaryParts.join(" | "));
          }
        }
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

// Rollover subcommand
tasksCommand
  .command("rollover")
  .description("Roll over incomplete tasks from previous days to today")
  .option("--dry-run", "Show what would be rolled over without making changes")
  .option("--days <number>", "Number of days to scan back for tasks")
  .action(async function (
    this: Command,
    options: { dryRun?: boolean; days?: string }
  ) {
    try {
      const parent = this.parent!;
      const { vaultPath, fs, configLoader } = await getVaultContext(parent);

      const rollover = new TaskRollover(fs, configLoader);

      // Parse days option
      const daysBack = options.days ? parseInt(options.days, 10) : undefined;
      if (options.days !== undefined && (isNaN(daysBack!) || daysBack! < 1)) {
        throw new Error("--days must be a positive integer");
      }

      if (options.dryRun) {
        // For dry-run, use aggregator to show what would be rolled over
        const aggregator = new TaskAggregator(fs, configLoader);
        const config = await configLoader.loadConfig(vaultPath);
        const effectiveDaysBack = daysBack ?? config.tasks.scanDaysBack;

        const result = await aggregator.aggregate({
          vaultPath,
          daysBack: effectiveDaysBack,
          includeCompleted: false,
          noteTypes: ["daily"],
        });

        // Filter to tasks not from today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tasksToRollover = result.open.filter((task) => {
          const taskDate = new Date(task.sourceDate);
          taskDate.setHours(0, 0, 0, 0);
          return taskDate.getTime() < today.getTime();
        });

        console.log(chalk.bold.yellow("DRY RUN - No changes will be made"));
        console.log();

        if (tasksToRollover.length === 0) {
          console.log(chalk.gray("No tasks to roll over."));
        } else {
          console.log(
            chalk.bold(`Tasks that would be rolled over (${tasksToRollover.length}):`)
          );
          console.log();
          printGroupedTasks(tasksToRollover, vaultPath);
        }
      } else {
        // Actually perform the rollover
        const rolloverOptions: { vaultPath: string; sourceDaysBack?: number } = {
          vaultPath,
        };
        if (daysBack !== undefined) {
          rolloverOptions.sourceDaysBack = daysBack;
        }
        const result = await rollover.rollover(rolloverOptions);

        if (result.rolledOver.length === 0) {
          console.log(chalk.gray("No tasks to roll over."));
        } else {
          console.log(
            chalk.green(`Rolled over ${result.rolledOver.length} task(s) to:`)
          );
          console.log(chalk.cyan(result.targetNotePath));
          console.log();

          for (const task of result.rolledOver) {
            console.log(`  - ${task.text}`);
          }
        }

        if (result.skipped.length > 0) {
          console.log();
          console.log(chalk.yellow(`Skipped ${result.skipped.length} task(s):`));
          for (const { task, reason } of result.skipped) {
            console.log(chalk.gray(`  - ${task.text}: ${reason}`));
          }
        }
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

// Toggle subcommand
tasksCommand
  .command("toggle <location>")
  .description("Toggle a task's completion status (file:line format)")
  .action(async function (this: Command, location: string) {
    try {
      const parent = this.parent!;
      const { vaultPath, fs } = await getVaultContext(parent);

      // Parse location: file:line
      const colonIndex = location.lastIndexOf(":");
      if (colonIndex === -1) {
        throw new Error(
          `Invalid location format: '${location}'. Expected format: 'file:line' (e.g., 'daily/2024/01/2024-01-15.md:42')`
        );
      }

      const filePart = location.slice(0, colonIndex);
      const linePart = location.slice(colonIndex + 1);
      const lineNumber = parseInt(linePart, 10);

      if (isNaN(lineNumber) || lineNumber < 1) {
        throw new Error(`Invalid line number: '${linePart}'`);
      }

      // Resolve file path
      const filePath = filePart.startsWith(vaultPath)
        ? filePart
        : joinPath(vaultPath, filePart);

      const modifier = new TaskModifier(fs);
      const updatedTask = await modifier.toggleTask(filePath, lineNumber);

      const status = updatedTask.completed
        ? chalk.green("[x]")
        : chalk.yellow("[ ]");
      console.log(`${status} ${updatedTask.text}`);
      console.log(
        chalk.gray(
          `  Status: ${updatedTask.completed ? "completed" : "incomplete"}`
        )
      );
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

// Add subcommand
tasksCommand
  .command("add <text>")
  .description("Add a new task to today's daily note")
  .option("--due <date>", "Due date (e.g., 'tomorrow', '2024-01-20')")
  .option("--priority <level>", "Priority level (high, medium, low)")
  .option("--tag <tags>", "Comma-separated tags (without #)")
  .action(async function (
    this: Command,
    text: string,
    options: { due?: string; priority?: string; tag?: string }
  ) {
    try {
      const parent = this.parent!;
      const { vaultPath, fs, configLoader, noteService } =
        await getVaultContext(parent);

      // Ensure today's daily note exists
      const today = new Date();
      const dailyNotePath = await noteService.ensureNote("daily", today);

      // Parse metadata options
      const dateParser = new DateParser();
      const config = await configLoader.loadConfig(vaultPath);
      const tasksSection = config.sections["tasks"] ?? "## Tasks";

      const metadata: {
        due?: Date;
        priority?: "high" | "medium" | "low";
        tags?: string[];
      } = {};

      if (options.due) {
        metadata.due = dateParser.parse(options.due);
      }

      if (options.priority) {
        const priority = options.priority.toLowerCase();
        if (!["high", "medium", "low"].includes(priority)) {
          throw new Error(
            `Invalid priority: '${options.priority}'. Valid values are: high, medium, low`
          );
        }
        metadata.priority = priority as "high" | "medium" | "low";
      }

      if (options.tag) {
        metadata.tags = options.tag.split(",").map((t) => t.trim());
      }

      const modifier = new TaskModifier(fs);
      const task = await modifier.addTask(dailyNotePath, tasksSection, {
        text,
        metadata,
      });

      console.log(chalk.green("Task added:"));
      console.log(`  [ ] ${task.text}`);
      console.log(chalk.gray(`  Location: ${dailyNotePath}:${task.line}`));
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

/**
 * Join path segments handling both Unix and Windows separators.
 */
function joinPath(...segments: string[]): string {
  const firstSegment = segments[0] ?? "";
  const separator = firstSegment.includes("\\") ? "\\" : "/";

  return segments
    .map((segment, index) => {
      if (index > 0) {
        segment = segment.replace(/^[/\\]+/, "");
      }
      if (index < segments.length - 1) {
        segment = segment.replace(/[/\\]+$/, "");
      }
      return segment;
    })
    .join(separator);
}
