import { format } from "date-fns";
import type { IFileSystem } from "../fs/types.js";
import { TaskParser } from "./TaskParser.js";
import type { Task, TaskMetadata } from "./types.js";

/**
 * Input for creating a new task.
 */
export interface NewTask {
  /** The task text (without checkbox syntax) */
  text: string;
  /** Whether the task is completed (default: false) */
  completed?: boolean;
  /** Optional metadata to include */
  metadata?: Partial<Omit<TaskMetadata, "tags">> & { tags?: string[] };
}

/**
 * Updates to apply to task metadata.
 * Use null to remove a metadata field.
 */
export type MetadataUpdates = {
  [K in keyof TaskMetadata]?: TaskMetadata[K] | null;
};

/**
 * Modifies tasks in markdown files.
 *
 * Provides atomic operations for:
 * - Toggling task completion status
 * - Updating task metadata
 * - Adding new tasks to specific sections
 *
 * All operations are atomic: read file, modify specific line, write back.
 */
export class TaskModifier {
  private fs: IFileSystem;
  private taskParser: TaskParser;

  constructor(fs: IFileSystem) {
    this.fs = fs;
    this.taskParser = new TaskParser();
  }

  /**
   * Toggle a task's completion status.
   * - [ ] text -> - [x] text
   * - [x] text -> - [ ] text
   *
   * Preserves all metadata and formatting.
   *
   * @param filePath - Path to the markdown file
   * @param lineNumber - Line number of the task (1-indexed)
   * @returns The updated task
   * @throws Error if line is not a task or file doesn't exist
   */
  async toggleTask(filePath: string, lineNumber: number): Promise<Task> {
    const content = await this.fs.readFile(filePath);
    const lines = content.split(/\r?\n/);
    const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";

    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(
        `Line number ${lineNumber} is out of range (1-${lines.length})`
      );
    }

    const lineIndex = lineNumber - 1;
    const line = lines[lineIndex]!;

    // Parse to verify it's a task
    const tasks = this.taskParser.parse(line);
    if (tasks.length === 0) {
      throw new Error(`Line ${lineNumber} is not a task: "${line}"`);
    }

    const task = tasks[0]!;
    const newCompleted = !task.completed;

    // Toggle the checkbox - match the specific checkbox pattern
    let newLine: string;
    if (task.completed) {
      // [x] or [X] -> [ ]
      newLine = line.replace(/\[([xX])\]/, "[ ]");
    } else {
      // [ ] -> [x]
      newLine = line.replace(/\[ \]/, "[x]");
    }

    lines[lineIndex] = newLine;

    // Write back atomically
    await this.fs.writeFile(filePath, lines.join(lineEnding));

    // Return the updated task
    return {
      line: lineNumber,
      text: task.text,
      completed: newCompleted,
      metadata: task.metadata,
      raw: newLine,
    };
  }

  /**
   * Update specific metadata fields on a task.
   *
   * - Updates existing metadata in-place
   * - Adds metadata if not present
   * - Removes metadata if value is null
   *
   * @param filePath - Path to the markdown file
   * @param lineNumber - Line number of the task (1-indexed)
   * @param updates - Metadata updates to apply
   * @returns The updated task
   * @throws Error if line is not a task or file doesn't exist
   */
  async updateMetadata(
    filePath: string,
    lineNumber: number,
    updates: MetadataUpdates
  ): Promise<Task> {
    const content = await this.fs.readFile(filePath);
    const lines = content.split(/\r?\n/);
    const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";

    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(
        `Line number ${lineNumber} is out of range (1-${lines.length})`
      );
    }

    const lineIndex = lineNumber - 1;
    const line = lines[lineIndex]!;

    // Parse to verify it's a task
    const tasks = this.taskParser.parse(line);
    if (tasks.length === 0) {
      throw new Error(`Line ${lineNumber} is not a task: "${line}"`);
    }

    const task = tasks[0]!;
    let newLine = line;
    const newMetadata = { ...task.metadata };

    // Process each update
    for (const [key, value] of Object.entries(updates)) {
      const metadataKey = key as keyof TaskMetadata;

      if (value === null) {
        // Remove metadata
        newLine = this.removeMetadata(newLine, metadataKey);
        if (metadataKey === "tags") {
          newMetadata.tags = [];
        } else {
          (newMetadata as Record<string, unknown>)[metadataKey] = undefined;
        }
      } else if (value !== undefined) {
        // Update or add metadata
        newLine = this.updateOrAddMetadata(
          newLine,
          metadataKey,
          value,
          task.metadata
        );
        if (metadataKey === "tags") {
          newMetadata.tags = value as string[];
        } else {
          (newMetadata as Record<string, unknown>)[metadataKey] = value;
        }
      }
    }

    lines[lineIndex] = newLine;

    // Write back atomically
    await this.fs.writeFile(filePath, lines.join(lineEnding));

    // Return the updated task
    return {
      line: lineNumber,
      text: task.text,
      completed: task.completed,
      metadata: newMetadata,
      raw: newLine,
    };
  }

  /**
   * Add a new task to a specific section in a file.
   *
   * - Auto-adds created date if not specified
   * - Supports all metadata fields
   * - Inserts after the section heading
   *
   * @param filePath - Path to the markdown file
   * @param section - Section heading to add task under (e.g., "## Tasks")
   * @param task - The new task to add
   * @returns The created task
   * @throws Error if section not found or file doesn't exist
   */
  async addTask(
    filePath: string,
    section: string,
    task: NewTask
  ): Promise<Task> {
    let content = "";
    const fileExists = await this.fs.exists(filePath);

    if (fileExists) {
      content = await this.fs.readFile(filePath);
    }

    const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
    const lines = content ? content.split(/\r?\n/) : [];

    // Build the task line
    const taskLine = this.buildTaskLine(task);

    // Find the section
    const sectionIndex = this.findSectionIndex(lines, section);

    let insertLineNumber: number;

    if (sectionIndex !== -1) {
      // Insert after the section heading
      insertLineNumber = sectionIndex + 2; // 1-indexed, after section
      lines.splice(sectionIndex + 1, 0, taskLine);
    } else {
      // Section not found - append section and task
      if (lines.length > 0 && lines[lines.length - 1] !== "") {
        lines.push("");
      }
      lines.push(section);
      lines.push(taskLine);
      insertLineNumber = lines.length;
    }

    // Write back atomically
    await this.fs.writeFile(filePath, lines.join(lineEnding));

    // Parse and return the created task
    const parsedTasks = this.taskParser.parse(taskLine);
    const parsedTask = parsedTasks[0]!;

    return {
      ...parsedTask,
      line: insertLineNumber,
    };
  }

  /**
   * Remove a specific metadata field from a line.
   */
  private removeMetadata(line: string, key: keyof TaskMetadata): string {
    switch (key) {
      case "due":
        return line.replace(/\s*due:\S+/gi, "");
      case "scheduled":
        return line.replace(/\s*scheduled:\S+/gi, "");
      case "created":
        return line.replace(/\s*created:\S+/gi, "");
      case "age":
        return line.replace(/\s*age:\d+/gi, "");
      case "priority": {
        // Remove both priority:value and exclamation syntax
        let result = line.replace(/\s*priority:(high|medium|low)/gi, "");
        result = result.replace(/(?:^|\s)!!!(?=\s|$)/g, " ");
        result = result.replace(/(?:^|\s)!!(?!!)(?=\s|$)/g, " ");
        result = result.replace(/(?:^|\s)!(?!!)(?=\s|$)/g, " ");
        return result.replace(/\s+/g, " ").trimEnd();
      }
      case "tags":
        return line.replace(/\s*#[a-zA-Z0-9_-]+/g, "");
      default:
        return line;
    }
  }

  /**
   * Update existing metadata or add it if not present.
   */
  private updateOrAddMetadata(
    line: string,
    key: keyof TaskMetadata,
    value: unknown,
    existingMetadata: TaskMetadata
  ): string {
    const hasExisting = this.hasMetadata(existingMetadata, key);

    switch (key) {
      case "due": {
        const dateStr = this.formatDate(value as Date);
        if (hasExisting) {
          return line.replace(/due:\S+/i, `due:${dateStr}`);
        }
        return line.trimEnd() + ` due:${dateStr}`;
      }
      case "scheduled": {
        const dateStr = this.formatDate(value as Date);
        if (hasExisting) {
          return line.replace(/scheduled:\S+/i, `scheduled:${dateStr}`);
        }
        return line.trimEnd() + ` scheduled:${dateStr}`;
      }
      case "created": {
        const dateStr = this.formatDate(value as Date);
        if (hasExisting) {
          return line.replace(/created:\S+/i, `created:${dateStr}`);
        }
        return line.trimEnd() + ` created:${dateStr}`;
      }
      case "age": {
        const ageNum = value as number;
        if (hasExisting) {
          return line.replace(/age:\d+/i, `age:${ageNum}`);
        }
        return line.trimEnd() + ` age:${ageNum}`;
      }
      case "priority": {
        const priorityVal = value as "high" | "medium" | "low";
        if (hasExisting) {
          // First remove exclamation syntax if present
          let result = line;
          result = result.replace(/(?:^|\s)!!!(?=\s|$)/g, " ");
          result = result.replace(/(?:^|\s)!!(?!!)(?=\s|$)/g, " ");
          result = result.replace(/(?:^|\s)!(?!!)(?=\s|$)/g, " ");
          result = result.replace(/\s+/g, " ");
          // Then update priority:value if present, or add it
          if (/priority:(high|medium|low)/i.test(result)) {
            return result.replace(
              /priority:(high|medium|low)/i,
              `priority:${priorityVal}`
            );
          }
          return result.trimEnd() + ` priority:${priorityVal}`;
        }
        return line.trimEnd() + ` priority:${priorityVal}`;
      }
      case "tags": {
        const tags = value as string[];
        // First remove all existing tags
        let result = line.replace(/\s*#[a-zA-Z0-9_-]+/g, "");
        // Then add new tags
        if (tags.length > 0) {
          result = result.trimEnd() + " " + tags.map((t) => `#${t}`).join(" ");
        }
        return result;
      }
      default:
        return line;
    }
  }

  /**
   * Check if metadata field has an existing value.
   */
  private hasMetadata(metadata: TaskMetadata, key: keyof TaskMetadata): boolean {
    switch (key) {
      case "due":
        return metadata.due !== undefined;
      case "scheduled":
        return metadata.scheduled !== undefined;
      case "created":
        return metadata.created !== undefined;
      case "age":
        return metadata.age !== undefined;
      case "priority":
        return metadata.priority !== undefined;
      case "tags":
        return metadata.tags.length > 0;
      default:
        return false;
    }
  }

  /**
   * Format a date for metadata.
   */
  private formatDate(date: Date): string {
    return format(date, "yyyy-MM-dd");
  }

  /**
   * Find the index of a section heading in lines.
   */
  private findSectionIndex(lines: string[], section: string): number {
    const normalizedSection = section.trim().toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.trim().toLowerCase() === normalizedSection) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Build a task line from a NewTask object.
   */
  private buildTaskLine(task: NewTask): string {
    const checkbox = task.completed ? "[x]" : "[ ]";
    let line = `- ${checkbox} ${task.text}`;

    // Add metadata
    const metadata = task.metadata ?? {};

    // Add created date (auto-add if not specified)
    const createdDate = metadata.created ?? new Date();
    line += ` created:${this.formatDate(createdDate)}`;

    // Add due date if specified
    if (metadata.due) {
      line += ` due:${this.formatDate(metadata.due)}`;
    }

    // Add scheduled date if specified
    if (metadata.scheduled) {
      line += ` scheduled:${this.formatDate(metadata.scheduled)}`;
    }

    // Add priority if specified
    if (metadata.priority) {
      line += ` priority:${metadata.priority}`;
    }

    // Add age if specified
    if (metadata.age !== undefined) {
      line += ` age:${metadata.age}`;
    }

    // Add tags if specified
    if (metadata.tags && metadata.tags.length > 0) {
      line += " " + metadata.tags.map((t) => `#${t}`).join(" ");
    }

    return line;
  }
}
