import type { IFileSystem, FileStat } from "./types.js";

/**
 * A file entry in the in-memory file system.
 */
interface FileEntry {
  type: "file";
  content: string;
  mtime: Date;
  ctime: Date;
}

/**
 * A directory entry in the in-memory file system.
 */
interface DirectoryEntry {
  type: "directory";
  mtime: Date;
  ctime: Date;
}

type Entry = FileEntry | DirectoryEntry;

/**
 * Method names that can have simulated errors.
 */
type SimulatableMethod = keyof IFileSystem;

/**
 * In-memory file system implementation for testing.
 * Supports simulating errors for edge case testing.
 */
export class MemoryFileSystem implements IFileSystem {
  private entries = new Map<string, Entry>();
  private simulatedErrors = new Map<SimulatableMethod, Error>();
  private oneTimeErrors = new Map<SimulatableMethod, Error>();

  /**
   * Normalizes a path to use forward slashes and remove trailing slashes.
   */
  private normalizePath(inputPath: string): string {
    // Convert backslashes to forward slashes
    let normalized = inputPath.replace(/\\/g, "/");
    // Remove trailing slash (except for root)
    if (normalized.length > 1 && normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  /**
   * Gets the parent directory path.
   */
  private getParentPath(normalizedPath: string): string | null {
    const lastSlash = normalizedPath.lastIndexOf("/");
    if (lastSlash <= 0) {
      return normalizedPath.startsWith("/") ? "/" : null;
    }
    return normalizedPath.slice(0, lastSlash);
  }

  /**
   * Checks and throws any simulated error for a method.
   */
  private checkError(method: SimulatableMethod): void {
    // Check one-time errors first
    const oneTimeError = this.oneTimeErrors.get(method);
    if (oneTimeError) {
      this.oneTimeErrors.delete(method);
      throw oneTimeError;
    }

    // Check persistent errors
    const error = this.simulatedErrors.get(method);
    if (error) {
      throw error;
    }
  }

  /**
   * Simulates an error for a specific method. The error will be thrown
   * every time the method is called until cleared.
   */
  simulateError(method: SimulatableMethod, error: Error): void {
    this.simulatedErrors.set(method, error);
  }

  /**
   * Simulates an error that only occurs once, then succeeds.
   */
  simulateErrorOnce(method: SimulatableMethod, error: Error): void {
    this.oneTimeErrors.set(method, error);
  }

  /**
   * Clears all simulated errors.
   */
  clearSimulatedErrors(): void {
    this.simulatedErrors.clear();
    this.oneTimeErrors.clear();
  }

  async readFile(filePath: string): Promise<string> {
    this.checkError("readFile");

    const normalized = this.normalizePath(filePath);
    const entry = this.entries.get(normalized);

    if (entry?.type !== "file") {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return entry.content;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.checkError("writeFile");

    const normalized = this.normalizePath(filePath);

    // Ensure parent directories exist
    const parentPath = this.getParentPath(normalized);
    if (parentPath && parentPath !== "/") {
      await this.mkdir(parentPath, true);
    }

    const now = new Date();
    const existing = this.entries.get(normalized);

    this.entries.set(normalized, {
      type: "file",
      content,
      mtime: now,
      ctime: existing?.ctime ?? now,
    });
  }

  async exists(filePath: string): Promise<boolean> {
    this.checkError("exists");

    const normalized = this.normalizePath(filePath);
    return this.entries.has(normalized);
  }

  async mkdir(dirPath: string, recursive = false): Promise<void> {
    this.checkError("mkdir");

    const normalized = this.normalizePath(dirPath);

    if (this.entries.has(normalized)) {
      // Directory already exists
      if (recursive) {
        return;
      }
      const error = new Error(`EEXIST: file already exists, mkdir '${dirPath}'`) as NodeJS.ErrnoException;
      error.code = "EEXIST";
      throw error;
    }

    // Check parent exists
    const parentPath = this.getParentPath(normalized);
    if (parentPath && parentPath !== "/" && !this.entries.has(parentPath)) {
      if (!recursive) {
        const error = new Error(`ENOENT: no such file or directory, mkdir '${dirPath}'`) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      // Create parent directories recursively
      await this.mkdir(parentPath, true);
    }

    const now = new Date();
    this.entries.set(normalized, {
      type: "directory",
      mtime: now,
      ctime: now,
    });
  }

  async readdir(dirPath: string): Promise<string[]> {
    this.checkError("readdir");

    const normalized = this.normalizePath(dirPath);
    const entry = this.entries.get(normalized);

    if (entry?.type !== "directory") {
      const error = new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    const prefix = normalized === "/" ? "/" : `${normalized}/`;
    const results: string[] = [];

    for (const key of this.entries.keys()) {
      if (key === normalized) continue;

      if (key.startsWith(prefix)) {
        const relativePath = key.slice(prefix.length);
        // Only include direct children (no slashes in relative path)
        if (!relativePath.includes("/")) {
          results.push(relativePath);
        }
      }
    }

    return results;
  }

  async stat(filePath: string): Promise<FileStat> {
    this.checkError("stat");

    const normalized = this.normalizePath(filePath);
    const entry = this.entries.get(normalized);

    if (!entry) {
      const error = new Error(`ENOENT: no such file or directory, stat '${filePath}'`) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    return {
      isFile: entry.type === "file",
      isDirectory: entry.type === "directory",
      size: entry.type === "file" ? Buffer.byteLength(entry.content, "utf-8") : 0,
      mtime: entry.mtime,
      ctime: entry.ctime,
    };
  }

  async unlink(filePath: string): Promise<void> {
    this.checkError("unlink");

    const normalized = this.normalizePath(filePath);
    const entry = this.entries.get(normalized);

    if (!entry) {
      const error = new Error(`ENOENT: no such file or directory, unlink '${filePath}'`) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    if (entry.type === "directory") {
      const error = new Error(`EISDIR: illegal operation on a directory, unlink '${filePath}'`) as NodeJS.ErrnoException;
      error.code = "EISDIR";
      throw error;
    }

    this.entries.delete(normalized);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    this.checkError("rename");

    const normalizedOld = this.normalizePath(oldPath);
    const normalizedNew = this.normalizePath(newPath);

    const entry = this.entries.get(normalizedOld);
    if (!entry) {
      const error = new Error(`ENOENT: no such file or directory, rename '${oldPath}' -> '${newPath}'`) as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    }

    // For directories, we need to move all children too
    if (entry.type === "directory") {
      const oldPrefix = normalizedOld === "/" ? "/" : `${normalizedOld}/`;
      const newPrefix = normalizedNew === "/" ? "/" : `${normalizedNew}/`;

      // Collect all entries to move
      const toMove: [string, Entry][] = [];
      for (const [key, value] of this.entries) {
        if (key === normalizedOld || key.startsWith(oldPrefix)) {
          const newKey = key === normalizedOld ? normalizedNew : `${newPrefix}${key.slice(oldPrefix.length)}`;
          toMove.push([newKey, value]);
        }
      }

      // Delete old entries
      for (const [key] of toMove) {
        const oldKey = key === normalizedNew ? normalizedOld : `${normalizedOld}/${key.slice(newPrefix.length)}`;
        this.entries.delete(oldKey);
      }

      // Add new entries
      for (const [key, value] of toMove) {
        this.entries.set(key, value);
      }
    } else {
      // Simple file rename
      this.entries.delete(normalizedOld);
      this.entries.set(normalizedNew, entry);
    }
  }
}
