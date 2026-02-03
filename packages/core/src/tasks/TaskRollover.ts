import { subDays, startOfDay, format } from "date-fns";
import type { IFileSystem } from "../fs/types.js";
import type { ConfigLoader } from "../config/ConfigLoader.js";
import type { CadenceConfig } from "../config/types.js";
import { PathGenerator } from "../dates/PathGenerator.js";
import { TaskParser } from "./TaskParser.js";
import type {
  Task,
  TaskWithSource,
  RolloverOptions,
  RolloverResult,
} from "./types.js";

/**
 * Rolls over incomplete tasks from previous days to the current day's note.
 *
 * Features:
 * - Finds incomplete tasks from previous daily notes
 * - Increments age metadata (age:N -> age:N+1)
 * - Adds created date if not present
 * - Inserts into target note under configured tasks section
 * - Prevents duplicate tasks (skips if already in target note)
 */
export class TaskRollover {
  private fs: IFileSystem;
  private configLoader: ConfigLoader;
  private pathGenerator: PathGenerator;
  private taskParser: TaskParser;
  private configCache: CadenceConfig | null = null;

  constructor(fs: IFileSystem, configLoader: ConfigLoader) {
    this.fs = fs;
    this.configLoader = configLoader;
    this.pathGenerator = new PathGenerator();
    this.taskParser = new TaskParser();
  }

  /**
   * Roll over incomplete tasks from previous days to the target date's note.
   *
   * @param options - Rollover options
   * @returns Result containing rolled over tasks, target path, and skipped tasks
   */
  async rollover(options: RolloverOptions): Promise<RolloverResult> {
    const { vaultPath, targetDate = new Date() } = options;

    const config = await this.getConfig(vaultPath);
    const sourceDaysBack = options.sourceDaysBack ?? config.tasks.scanDaysBack;

    const today = startOfDay(targetDate);
    const targetNotePath = await this.getNotePath(vaultPath, config, today);

    // Get incomplete tasks from previous days (excluding target date)
    const sourceTasks = await this.collectSourceTasks(
      vaultPath,
      config,
      today,
      sourceDaysBack
    );

    // Get existing tasks in target note to prevent duplicates
    const existingTasks = await this.getExistingTasks(targetNotePath);

    // Process tasks for rollover
    const { rolledOver, skipped } = this.processTasksForRollover(
      sourceTasks,
      existingTasks,
      today
    );

    // Insert rolled over tasks into target note
    if (rolledOver.length > 0) {
      await this.insertTasksIntoNote(
        targetNotePath,
        rolledOver,
        config.sections["tasks"] ?? "## Tasks"
      );
    }

    return {
      rolledOver,
      targetNotePath,
      skipped,
    };
  }

  /**
   * Collect incomplete tasks from previous daily notes.
   */
  private async collectSourceTasks(
    vaultPath: string,
    config: CadenceConfig,
    targetDate: Date,
    daysBack: number
  ): Promise<TaskWithSource[]> {
    const tasks: TaskWithSource[] = [];
    const startDate = subDays(targetDate, daysBack);

    // Iterate through each day from startDate to day before targetDate
    let current = startOfDay(startDate);
    const dayBeforeTarget = subDays(targetDate, 1);

    while (current <= dayBeforeTarget) {
      const notePath = await this.getNotePath(vaultPath, config, current);

      try {
        if (await this.fs.exists(notePath)) {
          const content = await this.fs.readFile(notePath);
          const noteTasks = this.taskParser.parse(content);

          // Only collect incomplete tasks
          for (const task of noteTasks) {
            if (!task.completed) {
              tasks.push({
                ...task,
                sourcePath: notePath,
                sourceDate: new Date(current),
              });
            }
          }
        }
      } catch {
        // Skip notes that can't be read
      }

      // Move to next day
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }

    return tasks;
  }

  /**
   * Get existing tasks from a note to check for duplicates.
   */
  private async getExistingTasks(notePath: string): Promise<Task[]> {
    try {
      if (await this.fs.exists(notePath)) {
        const content = await this.fs.readFile(notePath);
        return this.taskParser.parse(content);
      }
    } catch {
      // Note doesn't exist or can't be read
    }
    return [];
  }

  /**
   * Process tasks for rollover, filtering duplicates and updating metadata.
   */
  private processTasksForRollover(
    sourceTasks: TaskWithSource[],
    existingTasks: Task[],
    targetDate: Date
  ): { rolledOver: TaskWithSource[]; skipped: { task: Task; reason: string }[] } {
    const rolledOver: TaskWithSource[] = [];
    const skipped: { task: Task; reason: string }[] = [];

    // Create a set of existing task texts for quick duplicate checking
    const existingTaskTexts = new Set(
      existingTasks.map((t) => this.normalizeTaskText(t.text))
    );

    for (const task of sourceTasks) {
      const normalizedText = this.normalizeTaskText(task.text);

      // Check for duplicate
      if (existingTaskTexts.has(normalizedText)) {
        skipped.push({
          task,
          reason: "Task already exists in target note",
        });
        continue;
      }

      // Update task with incremented age and created date
      const updatedTask = this.updateTaskMetadata(task, targetDate);
      rolledOver.push(updatedTask);

      // Add to existing set to prevent duplicates within source tasks
      existingTaskTexts.add(normalizedText);
    }

    return { rolledOver, skipped };
  }

  /**
   * Normalize task text for comparison (trim whitespace, lowercase).
   */
  private normalizeTaskText(text: string): string {
    return text.trim().toLowerCase();
  }

  /**
   * Update task metadata for rollover:
   * - Increment age (or set to 1 if not present)
   * - Add created date if not present (using source date)
   */
  private updateTaskMetadata(
    task: TaskWithSource,
    _targetDate: Date
  ): TaskWithSource {
    const newAge = (task.metadata.age ?? 0) + 1;
    const createdDate = task.metadata.created ?? task.sourceDate;

    // Build new raw line with updated metadata
    const newRaw = this.buildTaskLine(task, newAge, createdDate);

    return {
      ...task,
      raw: newRaw,
      metadata: {
        ...task.metadata,
        age: newAge,
        created: createdDate,
      },
    };
  }

  /**
   * Build a task line with updated metadata.
   */
  private buildTaskLine(
    task: TaskWithSource,
    newAge: number,
    createdDate: Date
  ): string {
    let line = task.raw;

    // Update or add age metadata
    if (task.metadata.age !== undefined) {
      // Replace existing age
      line = line.replace(/age:\d+/i, `age:${newAge}`);
    } else {
      // Add age before any trailing whitespace
      line = line.trimEnd() + ` age:${newAge}`;
    }

    // Update or add created date
    const createdStr = format(createdDate, "yyyy-MM-dd");
    if (task.metadata.created !== undefined) {
      // Replace existing created date
      line = line.replace(/created:\S+/i, `created:${createdStr}`);
    } else {
      // Add created date
      line = line.trimEnd() + ` created:${createdStr}`;
    }

    return line;
  }

  /**
   * Insert rolled over tasks into the target note under the tasks section.
   */
  private async insertTasksIntoNote(
    notePath: string,
    tasks: TaskWithSource[],
    tasksSection: string
  ): Promise<void> {
    let content = "";

    // Read existing content if note exists
    if (await this.fs.exists(notePath)) {
      content = await this.fs.readFile(notePath);
    } else {
      // Create parent directories and the note
      const parentDir = this.getParentDirectory(notePath);
      await this.fs.mkdir(parentDir, true);
    }

    // Build task lines to insert
    const taskLines = tasks.map((t) => t.raw).join("\n");

    // Find the tasks section and insert after it
    const sectionIndex = content.indexOf(tasksSection);

    if (sectionIndex !== -1) {
      // Find the end of the section header line
      const headerEndIndex = content.indexOf("\n", sectionIndex);

      if (headerEndIndex !== -1) {
        // Insert tasks after the section header
        const before = content.slice(0, headerEndIndex + 1);
        const after = content.slice(headerEndIndex + 1);

        // Check if there's already content after the header
        // Add appropriate spacing
        let newContent: string;
        if (after.trim().length === 0 || after.startsWith("\n")) {
          newContent = before + taskLines + "\n" + after;
        } else {
          newContent = before + taskLines + "\n\n" + after;
        }

        await this.fs.writeFile(notePath, newContent);
      } else {
        // Section header is at the end of the file
        content = content + "\n" + taskLines + "\n";
        await this.fs.writeFile(notePath, content);
      }
    } else {
      // No tasks section found, append to end of file
      if (content.length > 0 && !content.endsWith("\n")) {
        content += "\n";
      }

      if (content.length > 0) {
        content += "\n" + tasksSection + "\n" + taskLines + "\n";
      } else {
        content = tasksSection + "\n" + taskLines + "\n";
      }

      await this.fs.writeFile(notePath, content);
    }
  }

  /**
   * Get the path for a daily note.
   */
  private async getNotePath(
    vaultPath: string,
    config: CadenceConfig,
    date: Date
  ): Promise<string> {
    const pathPattern = config.paths.daily;
    const relativePath = this.pathGenerator.generatePath(pathPattern, date);
    return this.joinPath(vaultPath, relativePath);
  }

  /**
   * Gets the parent directory of a path.
   */
  private getParentDirectory(path: string): string {
    const lastSeparator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    if (lastSeparator === -1) {
      return ".";
    }
    return path.substring(0, lastSeparator);
  }

  /**
   * Joins path segments, handling both Unix and Windows separators.
   */
  private joinPath(...segments: string[]): string {
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

  /**
   * Gets the config, caching it for subsequent calls.
   */
  private async getConfig(vaultPath: string): Promise<CadenceConfig> {
    if (!this.configCache) {
      this.configCache = await this.configLoader.loadConfig(vaultPath);
    }
    return this.configCache;
  }

  /**
   * Clear the config cache. Useful when config may have changed.
   */
  clearConfigCache(): void {
    this.configCache = null;
  }
}
