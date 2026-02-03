import { DateParser } from "../dates/DateParser.js";
import type { Task, TaskMetadata } from "./types.js";

/**
 * Parses markdown checkbox tasks from content, extracting metadata.
 *
 * Supports:
 * - Checkbox syntax: - [ ] (incomplete) and - [x]/- [X] (complete)
 * - Metadata patterns:
 *   - due:YYYY-MM-DD or due:natural-language
 *   - priority:high|medium|low or !!!|!!|!
 *   - #tagname (multiple allowed)
 *   - scheduled:YYYY-MM-DD
 *   - age:N (integer days)
 *   - created:YYYY-MM-DD
 */
export class TaskParser {
  private dateParser: DateParser;

  constructor() {
    this.dateParser = new DateParser();
  }

  /**
   * Parse markdown content and extract all tasks.
   *
   * @param content - The markdown content to parse
   * @returns Array of parsed tasks
   */
  parse(content: string): Task[] {
    const tasks: Task[] = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const task = this.parseLine(line, i + 1);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Parse a single line and return a Task if it matches checkbox syntax.
   */
  private parseLine(line: string, lineNumber: number): Task | null {
    // Match checkbox syntax: - [ ] or - [x] or - [X]
    // Also support * [ ] and + [ ] as list markers
    const checkboxMatch = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (!checkboxMatch) {
      return null;
    }

    const completed = checkboxMatch[2]!.toLowerCase() === "x";
    const rawContent = checkboxMatch[3]!;

    const metadata = this.parseMetadata(rawContent);
    const text = this.extractCleanText(rawContent);

    return {
      line: lineNumber,
      text,
      completed,
      metadata,
      raw: line,
    };
  }

  /**
   * Parse metadata from task content.
   */
  private parseMetadata(content: string): TaskMetadata {
    const metadata: TaskMetadata = {
      tags: [],
    };

    // Parse due date: due:YYYY-MM-DD or due:some-text
    const dueMatch = /due:(\S+)/i.exec(content);
    if (dueMatch) {
      const dueValue = dueMatch[1]!;
      const parsed = this.tryParseDate(dueValue);
      if (parsed) {
        metadata.due = parsed;
      }
    }

    // Parse scheduled date: scheduled:YYYY-MM-DD
    const scheduledMatch = /scheduled:(\S+)/i.exec(content);
    if (scheduledMatch) {
      const scheduledValue = scheduledMatch[1]!;
      const parsed = this.tryParseDate(scheduledValue);
      if (parsed) {
        metadata.scheduled = parsed;
      }
    }

    // Parse created date: created:YYYY-MM-DD
    const createdMatch = /created:(\S+)/i.exec(content);
    if (createdMatch) {
      const createdValue = createdMatch[1]!;
      const parsed = this.tryParseDate(createdValue);
      if (parsed) {
        metadata.created = parsed;
      }
    }

    // Parse age: age:N (integer days)
    const ageMatch = /age:(\d+)/i.exec(content);
    if (ageMatch) {
      metadata.age = parseInt(ageMatch[1]!, 10);
    }

    // Parse priority: priority:high|medium|low
    const priorityMatch = /priority:(high|medium|low)/i.exec(content);
    if (priorityMatch) {
      metadata.priority = priorityMatch[1]!.toLowerCase() as "high" | "medium" | "low";
    } else {
      // Check for exclamation mark syntax: !!!, !!, !
      const exclamationPriority = this.parseExclamationPriority(content);
      if (exclamationPriority) {
        metadata.priority = exclamationPriority;
      }
    }

    // Parse tags: #tagname
    const tagMatches = content.matchAll(/#([a-zA-Z0-9_-]+)/g);
    for (const match of tagMatches) {
      metadata.tags.push(match[1]!);
    }

    return metadata;
  }

  /**
   * Parse priority from exclamation mark syntax.
   * !!! = high, !! = medium, ! = low
   */
  private parseExclamationPriority(content: string): "high" | "medium" | "low" | null {
    // Match standalone exclamation marks (not part of URLs or other content)
    // Look for !!! or !! or ! surrounded by whitespace or at start/end
    if (/(?:^|\s)!!!(?:\s|$)/.test(content)) {
      return "high";
    }
    if (/(?:^|\s)!!(?!!)(?:\s|$)/.test(content)) {
      return "medium";
    }
    if (/(?:^|\s)!(?!!)(?:\s|$)/.test(content)) {
      return "low";
    }
    return null;
  }

  /**
   * Try to parse a date string, returning null if parsing fails.
   */
  private tryParseDate(value: string): Date | null {
    try {
      return this.dateParser.parse(value);
    } catch {
      return null;
    }
  }

  /**
   * Extract clean text by removing metadata patterns.
   */
  private extractCleanText(content: string): string {
    let text = content;

    // Remove due:value
    text = text.replace(/\s*due:\S+/gi, "");

    // Remove scheduled:value
    text = text.replace(/\s*scheduled:\S+/gi, "");

    // Remove created:value
    text = text.replace(/\s*created:\S+/gi, "");

    // Remove age:N
    text = text.replace(/\s*age:\d+/gi, "");

    // Remove priority:value
    text = text.replace(/\s*priority:(high|medium|low)/gi, "");

    // Remove exclamation priority markers (!!!, !!, !)
    text = text.replace(/(?:^|\s)!!!(?=\s|$)/g, " ");
    text = text.replace(/(?:^|\s)!!(?!!)(?=\s|$)/g, " ");
    text = text.replace(/(?:^|\s)!(?!!)(?=\s|$)/g, " ");

    // Remove tags
    text = text.replace(/\s*#[a-zA-Z0-9_-]+/g, "");

    // Clean up extra whitespace
    text = text.replace(/\s+/g, " ").trim();

    return text;
  }
}
