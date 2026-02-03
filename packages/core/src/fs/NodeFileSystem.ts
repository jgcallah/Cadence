import fse from "fs-extra";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { IFileSystem, FileStat } from "./types.js";

/**
 * Production file system implementation using fs-extra.
 * Uses atomic writes to prevent corruption: writes to a .tmp file, then renames.
 */
export class NodeFileSystem implements IFileSystem {
  async readFile(filePath: string): Promise<string> {
    return fse.readFile(filePath, "utf-8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await fse.ensureDir(dir);

    // Generate a unique temporary file name in the same directory
    const randomSuffix = crypto.randomBytes(8).toString("hex");
    const tmpPath = `${filePath}.${randomSuffix}.tmp`;

    try {
      // Write to temporary file first
      await fse.writeFile(tmpPath, content, "utf-8");

      // Atomically rename to target (rename is atomic on most file systems)
      await fse.rename(tmpPath, filePath);
    } catch (error) {
      // Clean up temp file if rename fails
      try {
        await fse.unlink(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    return fse.pathExists(filePath);
  }

  async mkdir(dirPath: string, recursive = false): Promise<void> {
    if (recursive) {
      await fse.ensureDir(dirPath);
    } else {
      await fse.mkdir(dirPath);
    }
  }

  async readdir(dirPath: string): Promise<string[]> {
    return fse.readdir(dirPath);
  }

  async stat(filePath: string): Promise<FileStat> {
    const stats = await fse.stat(filePath);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime,
      ctime: stats.ctime,
    };
  }

  async unlink(filePath: string): Promise<void> {
    await fse.unlink(filePath);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await fse.rename(oldPath, newPath);
  }
}
