import Fuse from "fuse.js";
import type { IFileSystem } from "../fs/types.js";
import { FrontmatterParser } from "../frontmatter/index.js";
import type { Note, NoteType } from "../notes/types.js";
import type { SearchOptions, SearchResult, ContentMatch } from "./types.js";

/**
 * Cache entry for file list.
 */
interface FileListCache {
  files: string[];
  timestamp: number;
}

/**
 * Provides search functionality for an Obsidian vault.
 *
 * Features:
 * - Fuzzy file name search using fuse.js
 * - Content search with surrounding context
 * - Frontmatter field search with nested field and array support
 * - Caching for improved performance
 */
export class VaultSearch {
  private fs: IFileSystem;
  private vaultPath: string;
  private frontmatterParser: FrontmatterParser;
  private fileListCache: FileListCache | null = null;

  /** Cache TTL in milliseconds (5 minutes) */
  private static readonly CACHE_TTL = 5 * 60 * 1000;

  /** Default number of context lines to show */
  private static readonly DEFAULT_CONTEXT_LINES = 2;

  /**
   * Creates a new VaultSearch instance.
   *
   * @param fs - The filesystem abstraction to use
   * @param vaultPath - The path to the vault root
   */
  constructor(fs: IFileSystem, vaultPath: string) {
    this.fs = fs;
    this.vaultPath = vaultPath;
    this.frontmatterParser = new FrontmatterParser();
  }

  /**
   * Search for files by filename using fuzzy matching.
   *
   * @param query - The search query to match against filenames
   * @param options - Optional search options to filter results
   * @returns Array of search results sorted by relevance (best matches first)
   */
  async searchFiles(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const allFiles = await this.getFileList();
    let files = allFiles;

    // Apply path filter
    if (options?.path) {
      const pathPrefix = this.normalizePathPrefix(options.path);
      files = files.filter((f) => this.matchesPathFilter(f, pathPrefix));
    }

    // Apply noteType filter (match common patterns)
    if (options?.noteType) {
      files = this.filterByNoteType(files, options.noteType);
    }

    // Handle empty query - return all matching files with score 0
    if (!query.trim()) {
      const limit = options?.limit ?? files.length;
      return files.slice(0, limit).map((file) => ({
        path: file,
        score: 0,
      }));
    }

    // Create or update fuse instance
    const fuse = this.getFuseInstance(files);

    // Perform fuzzy search
    const results = fuse.search(query);

    // Apply limit
    const limit = options?.limit ?? results.length;
    const limitedResults = results.slice(0, limit);

    return limitedResults.map((result) => ({
      path: result.item,
      score: result.score ?? 0,
    }));
  }

  /**
   * Search for content within files.
   *
   * @param query - The search query (case-insensitive substring match)
   * @param options - Optional search options to filter results
   * @returns Array of content matches with surrounding context
   */
  async searchContent(
    query: string,
    options?: SearchOptions
  ): Promise<ContentMatch[]> {
    const allFiles = await this.getFileList();
    let files = allFiles;

    // Apply path filter
    if (options?.path) {
      const pathPrefix = this.normalizePathPrefix(options.path);
      files = files.filter((f) => this.matchesPathFilter(f, pathPrefix));
    }

    // Apply noteType filter
    if (options?.noteType) {
      files = this.filterByNoteType(files, options.noteType);
    }

    const matches: ContentMatch[] = [];
    const lowerQuery = query.toLowerCase();
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;

    // Stream through files to find content matches
    for (const file of files) {
      if (matches.length >= limit) {
        break;
      }

      const fullPath = this.joinPath(this.vaultPath, file);
      try {
        const content = await this.fs.readFile(fullPath);
        const fileMatches = this.findContentMatches(
          file,
          content,
          lowerQuery,
          limit - matches.length
        );
        matches.push(...fileMatches);
      } catch {
        // Skip files that can't be read
        continue;
      }
    }

    return matches;
  }

  /**
   * Search for notes by frontmatter field value.
   *
   * Supports:
   * - Simple field match: field="status", value="done"
   * - Nested field match: field="metadata.status", value="done"
   * - Array contains: field="tags", value="project" (matches if tags array contains "project")
   *
   * @param field - The frontmatter field to search (supports dot notation for nested fields)
   * @param value - The value to match against
   * @param options - Optional search options to filter results
   * @returns Array of notes with matching frontmatter
   */
  async searchFrontmatter(
    field: string,
    value: string,
    options?: SearchOptions
  ): Promise<Note[]> {
    const allFiles = await this.getFileList();
    let files = allFiles;

    // Apply path filter
    if (options?.path) {
      const pathPrefix = this.normalizePathPrefix(options.path);
      files = files.filter((f) => this.matchesPathFilter(f, pathPrefix));
    }

    // Apply noteType filter
    if (options?.noteType) {
      files = this.filterByNoteType(files, options.noteType);
    }

    const matches: Note[] = [];
    const limit = options?.limit ?? Number.MAX_SAFE_INTEGER;

    for (const file of files) {
      if (matches.length >= limit) {
        break;
      }

      const fullPath = this.joinPath(this.vaultPath, file);
      try {
        const content = await this.fs.readFile(fullPath);
        const parsed = this.frontmatterParser.parse(content);

        if (this.matchesFrontmatter(parsed.frontmatter, field, value)) {
          matches.push({
            path: file,
            content,
            frontmatter: parsed.frontmatter,
            body: parsed.body,
          });
        }
      } catch {
        // Skip files that can't be read
        continue;
      }
    }

    return matches;
  }

  /**
   * Invalidates the file list cache, forcing a refresh on next search.
   */
  invalidateCache(): void {
    this.fileListCache = null;
  }

  /**
   * Gets the list of all markdown files in the vault.
   * Results are cached for performance.
   */
  private async getFileList(): Promise<string[]> {
    const now = Date.now();

    // Return cached list if still valid
    if (
      this.fileListCache &&
      now - this.fileListCache.timestamp < VaultSearch.CACHE_TTL
    ) {
      return this.fileListCache.files;
    }

    // Recursively collect all markdown files
    const files: string[] = [];
    await this.collectFiles("", files);

    // Update cache
    this.fileListCache = {
      files,
      timestamp: now,
    };

    return files;
  }

  /**
   * Recursively collects markdown files from a directory.
   */
  private async collectFiles(relativePath: string, files: string[]): Promise<void> {
    const fullPath = relativePath
      ? this.joinPath(this.vaultPath, relativePath)
      : this.vaultPath;

    try {
      const entries = await this.fs.readdir(fullPath);

      for (const entry of entries) {
        // Skip hidden files and directories
        if (entry.startsWith(".")) {
          continue;
        }

        const entryRelPath = relativePath ? `${relativePath}/${entry}` : entry;
        const entryFullPath = this.joinPath(this.vaultPath, entryRelPath);

        try {
          const stat = await this.fs.stat(entryFullPath);

          if (stat.isDirectory) {
            await this.collectFiles(entryRelPath, files);
          } else if (stat.isFile && entry.endsWith(".md")) {
            files.push(entryRelPath);
          }
        } catch {
          // Skip entries that can't be accessed
          continue;
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }

  /**
   * Gets or creates a Fuse instance for the given file list.
   */
  private getFuseInstance(files: string[]): Fuse<string> {
    // Create a new Fuse instance for the current file list
    return new Fuse(files, {
      includeScore: true,
      threshold: 0.6, // More lenient threshold for better fuzzy matching
      distance: 100,  // Allow matches further apart
      // Search the filename (last part of path) more heavily
      getFn: (obj: string): string => {
        const parts = obj.split("/");
        return parts[parts.length - 1] ?? obj;
      },
    });
  }

  /**
   * Filters files by note type based on common path patterns.
   */
  private filterByNoteType(files: string[], noteType: NoteType): string[] {
    // Common patterns for different note types
    const patterns: Record<NoteType, RegExp[]> = {
      daily: [/daily/i, /\d{4}[-/]\d{2}[-/]\d{2}/],
      weekly: [/weekly/i, /[Ww]\d{1,2}/],
      monthly: [/monthly/i],
      quarterly: [/quarterly/i, /[Qq][1-4]/],
      yearly: [/yearly/i, /^\d{4}\.md$/],
    };

    const typePatterns = patterns[noteType];
    return files.filter((file) =>
      typePatterns.some((pattern) => pattern.test(file))
    );
  }

  /**
   * Finds content matches within a file.
   */
  private findContentMatches(
    path: string,
    content: string,
    lowerQuery: string,
    maxMatches: number
  ): ContentMatch[] {
    const matches: ContentMatch[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length && matches.length < maxMatches; i++) {
      const line = lines[i] ?? "";
      if (line.toLowerCase().includes(lowerQuery)) {
        matches.push({
          path,
          line: i + 1, // 1-indexed
          content: line.trim(),
          context: this.getContextLines(lines, i),
        });
      }
    }

    return matches;
  }

  /**
   * Gets surrounding context lines for a match.
   */
  private getContextLines(lines: string[], matchIndex: number): string[] {
    const context: string[] = [];
    const contextCount = VaultSearch.DEFAULT_CONTEXT_LINES;

    // Add lines before
    for (
      let i = Math.max(0, matchIndex - contextCount);
      i < matchIndex;
      i++
    ) {
      const line = lines[i];
      if (line !== undefined) {
        context.push(line);
      }
    }

    // Add lines after
    for (
      let i = matchIndex + 1;
      i <= Math.min(lines.length - 1, matchIndex + contextCount);
      i++
    ) {
      const line = lines[i];
      if (line !== undefined) {
        context.push(line);
      }
    }

    return context;
  }

  /**
   * Checks if frontmatter matches the given field/value.
   */
  private matchesFrontmatter(
    frontmatter: Record<string, unknown>,
    field: string,
    value: string
  ): boolean {
    const fieldValue = this.getNestedValue(frontmatter, field);

    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    // Handle array contains
    if (Array.isArray(fieldValue)) {
      return fieldValue.some(
        (item) => String(item).toLowerCase() === value.toLowerCase()
      );
    }

    // Handle direct value match (only for string, number, boolean)
    if (typeof fieldValue === "string") {
      return fieldValue.toLowerCase() === value.toLowerCase();
    }
    if (typeof fieldValue === "number" || typeof fieldValue === "boolean") {
      return String(fieldValue).toLowerCase() === value.toLowerCase();
    }
    return false;
  }

  /**
   * Gets a nested value from an object using dot notation.
   */
  private getNestedValue(
    obj: Record<string, unknown>,
    path: string
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Normalizes a path prefix for filtering.
   * Returns the normalized path without trailing slash - caller handles matching logic.
   */
  private normalizePathPrefix(path: string): string {
    // Convert backslashes to forward slashes
    let normalized = path.replace(/\\/g, "/");
    // Remove leading slash
    if (normalized.startsWith("/")) {
      normalized = normalized.slice(1);
    }
    // Remove trailing slash
    if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  /**
   * Checks if a file path matches the given path filter.
   * Matches if file starts with the path prefix (as directory) or equals it exactly.
   */
  private matchesPathFilter(filePath: string, pathFilter: string): boolean {
    if (!pathFilter) return true;
    // Match exact path or path as directory prefix
    return filePath === pathFilter ||
           filePath.startsWith(pathFilter + "/") ||
           filePath === pathFilter + ".md";
  }

  /**
   * Joins path segments with forward slashes.
   */
  private joinPath(...segments: string[]): string {
    return segments
      .map((segment, index) => {
        // Remove leading slashes except for first segment
        if (index > 0) {
          segment = segment.replace(/^[/\\]+/, "");
        }
        // Remove trailing slashes
        segment = segment.replace(/[/\\]+$/, "");
        return segment;
      })
      .filter(Boolean)
      .join("/");
  }
}
