import type { IFileSystem } from "../fs/index.js";
import type { ConfigLoader } from "../config/index.js";
import type { CadenceConfig } from "../config/types.js";
import { PathGenerator } from "../dates/PathGenerator.js";
import { TemplateEngine, TemplateLoader } from "../templates/index.js";
import { FrontmatterParser } from "../frontmatter/index.js";
import { NoteNotFoundError } from "../errors/index.js";
import { PeriodCalculator } from "./PeriodCalculator.js";
import type { Note, NotePath, NoteType, PeriodInfo, NoteLinks } from "./types.js";
import { eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";

/**
 * Service for managing periodic notes (daily, weekly, monthly, etc.).
 *
 * Handles creating, reading, and checking existence of notes with:
 * - Auto-creation of parent folders
 * - Template-based note creation
 * - Frontmatter parsing
 * - Path generation from config patterns
 */
export class NoteService {
  private fs: IFileSystem;
  private configLoader: ConfigLoader;
  private vaultPath: string;
  private pathGenerator: PathGenerator;
  private templateEngine: TemplateEngine;
  private templateLoader: TemplateLoader;
  private frontmatterParser: FrontmatterParser;
  private periodCalculator: PeriodCalculator;
  private configCache: CadenceConfig | null = null;

  /**
   * Creates a new NoteService.
   *
   * @param fs - The filesystem abstraction to use
   * @param configLoader - The config loader for reading vault configuration
   * @param vaultPath - The path to the vault root
   */
  constructor(fs: IFileSystem, configLoader: ConfigLoader, vaultPath: string) {
    this.fs = fs;
    this.configLoader = configLoader;
    this.vaultPath = vaultPath;
    this.pathGenerator = new PathGenerator();
    this.templateEngine = new TemplateEngine();
    this.templateLoader = new TemplateLoader(fs);
    this.frontmatterParser = new FrontmatterParser();
    this.periodCalculator = new PeriodCalculator();
  }

  /**
   * Checks if a note exists for the given type and date.
   *
   * @param type - The type of note (daily, weekly, etc.)
   * @param date - The date for the note
   * @returns True if the note exists, false otherwise
   */
  async noteExists(type: NoteType, date: Date): Promise<boolean> {
    const notePath = await this.getNotePath(type, date);
    return this.fs.exists(notePath);
  }

  /**
   * Ensures a note exists for the given type and date.
   * If the note doesn't exist, it will be created using the appropriate template.
   * If the note already exists, it is not modified.
   *
   * @param type - The type of note (daily, weekly, etc.)
   * @param date - The date for the note
   * @returns The path to the note
   */
  async ensureNote(type: NoteType, date: Date): Promise<NotePath> {
    const notePath = await this.getNotePath(type, date);

    // Check if note already exists
    if (await this.fs.exists(notePath)) {
      return notePath;
    }

    // Create parent directories
    const parentDir = this.getParentDirectory(notePath);
    await this.fs.mkdir(parentDir, true);

    // Generate note content from template
    const content = await this.generateNoteContent(type, date);

    // Write the note
    await this.fs.writeFile(notePath, content);

    return notePath;
  }

  /**
   * Reads and parses a note for the given type and date.
   *
   * @param type - The type of note (daily, weekly, etc.)
   * @param date - The date for the note
   * @returns The parsed note with path, content, frontmatter, and body
   * @throws NoteNotFoundError if the note does not exist
   */
  async getNote(type: NoteType, date: Date): Promise<Note> {
    const notePath = await this.getNotePath(type, date);

    // Check if note exists
    if (!(await this.fs.exists(notePath))) {
      throw new NoteNotFoundError(notePath);
    }

    // Read the note content
    const content = await this.fs.readFile(notePath);

    // Parse frontmatter
    const parsed = this.frontmatterParser.parse(content);

    return {
      path: notePath,
      content,
      frontmatter: parsed.frontmatter,
      body: parsed.body,
    };
  }

  /**
   * Gets the period information for a given note type and date.
   *
   * @param type - The type of note (daily, weekly, monthly, quarterly, yearly)
   * @param date - The date for the period (defaults to current date)
   * @returns PeriodInfo with start date, end date, and human-readable label
   */
  getCurrentPeriod(type: NoteType, date: Date = new Date()): PeriodInfo {
    return this.periodCalculator.getCurrentPeriod(type, date);
  }

  /**
   * Gets navigation links for a note (parent and child notes).
   *
   * @param type - The type of note
   * @param date - The date for the note
   * @returns NoteLinks with parentNote path and childNotes paths
   */
  async getNoteLinks(type: NoteType, date: Date): Promise<NoteLinks> {
    const config = await this.getConfig();
    const parentNote = await this.getParentNoteLink(type, date, config);
    const childNotes = await this.getChildNoteLinks(type, date, config);

    return {
      parentNote,
      childNotes,
    };
  }

  /**
   * Gets the wikilink to the parent note.
   */
  private async getParentNoteLink(
    type: NoteType,
    date: Date,
    config: CadenceConfig
  ): Promise<string | null> {
    const parentType = this.periodCalculator.getParentType(type);
    if (!parentType) {
      return null;
    }

    const pathPattern = config.paths[parentType];
    const relativePath = this.pathGenerator.generatePath(pathPattern, date);
    // Convert to wikilink format (remove .md extension for the link)
    const linkPath = relativePath.replace(/\.md$/, "");
    return `[[${linkPath}]]`;
  }

  /**
   * Gets wikilinks to child notes within this period.
   */
  private async getChildNoteLinks(
    type: NoteType,
    date: Date,
    config: CadenceConfig
  ): Promise<string[]> {
    const childType = this.periodCalculator.getChildType(type);
    if (!childType) {
      return [];
    }

    const period = this.periodCalculator.getCurrentPeriod(type, date);
    const childDates = this.getChildDatesForPeriod(childType, period);
    const pathPattern = config.paths[childType];

    return childDates.map((childDate) => {
      const relativePath = this.pathGenerator.generatePath(pathPattern, childDate);
      const linkPath = relativePath.replace(/\.md$/, "");
      return `[[${linkPath}]]`;
    });
  }

  /**
   * Gets dates for child notes within a period.
   */
  private getChildDatesForPeriod(childType: NoteType, period: PeriodInfo): Date[] {
    switch (childType) {
      case "daily":
        return eachDayOfInterval({ start: period.start, end: period.end });
      case "weekly":
        return eachWeekOfInterval(
          { start: period.start, end: period.end },
          { weekStartsOn: 1 }
        );
      case "monthly":
        return eachMonthOfInterval({ start: period.start, end: period.end });
      case "quarterly":
        // For yearly notes, return start of each quarter
        return [0, 3, 6, 9].map(
          (monthOffset) =>
            new Date(period.start.getFullYear(), monthOffset, 1)
        );
      default:
        return [];
    }
  }

  /**
   * Gets the full path to a note for the given type and date.
   */
  private async getNotePath(type: NoteType, date: Date): Promise<string> {
    const config = await this.getConfig();
    const pathPattern = config.paths[type];
    const relativePath = this.pathGenerator.generatePath(pathPattern, date);
    return this.joinPath(this.vaultPath, relativePath);
  }

  /**
   * Generates the content for a new note using the template if configured.
   */
  private async generateNoteContent(type: NoteType, date: Date): Promise<string> {
    const config = await this.getConfig();
    const templateName = config.templates[type];

    // If no template configured, return empty content
    if (!templateName) {
      return "";
    }

    // Load and render template
    const templatePath = this.joinPath(this.vaultPath, templateName);

    try {
      const templateContent = await this.templateLoader.load(templatePath);

      // Get navigation links
      const noteLinks = await this.getNoteLinks(type, date);
      const periodInfo = this.getCurrentPeriod(type, date);

      return this.templateEngine.render(templateContent, {
        noteDate: date,
        parentNote: noteLinks.parentNote || "",
        childNotes: noteLinks.childNotes.join("\n"),
        periodLabel: periodInfo.label,
        periodStart: periodInfo.start,
        periodEnd: periodInfo.end,
      });
    } catch {
      // If template loading fails, return empty content
      return "";
    }
  }

  /**
   * Gets the parent directory of a path.
   */
  private getParentDirectory(path: string): string {
    // Handle both Unix and Windows paths
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
    // Detect the separator used in the vault path
    const separator = this.vaultPath.includes("\\") ? "\\" : "/";

    return segments
      .map((segment, index) => {
        // Remove trailing separators except for root
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
  private async getConfig(): Promise<CadenceConfig> {
    if (!this.configCache) {
      this.configCache = await this.configLoader.loadConfig(this.vaultPath);
    }
    return this.configCache;
  }
}
