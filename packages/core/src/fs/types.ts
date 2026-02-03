/**
 * File statistics returned by the stat() method.
 */
export interface FileStat {
  /**
   * True if the path is a file.
   */
  isFile: boolean;

  /**
   * True if the path is a directory.
   */
  isDirectory: boolean;

  /**
   * Size in bytes (0 for directories).
   */
  size: number;

  /**
   * Last modification time.
   */
  mtime: Date;

  /**
   * Creation time.
   */
  ctime: Date;
}

/**
 * Abstract file system interface for Cadence operations.
 * Allows swapping between real file system (NodeFileSystem) and
 * in-memory file system (MemoryFileSystem) for testing.
 */
export interface IFileSystem {
  /**
   * Reads the entire contents of a file as a UTF-8 string.
   * @param path - The path to the file.
   * @returns The file contents as a string.
   * @throws Error if the file does not exist or cannot be read.
   */
  readFile(path: string): Promise<string>;

  /**
   * Writes content to a file, creating the file if it doesn't exist.
   * Implementations should use atomic writes when possible.
   * @param path - The path to the file.
   * @param content - The content to write.
   * @throws Error if the file cannot be written.
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Checks if a file or directory exists at the given path.
   * @param path - The path to check.
   * @returns True if the path exists, false otherwise.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Creates a directory at the given path.
   * @param path - The path where the directory should be created.
   * @param recursive - If true, creates parent directories as needed.
   * @throws Error if the directory cannot be created.
   */
  mkdir(path: string, recursive?: boolean): Promise<void>;

  /**
   * Reads the contents of a directory.
   * @param path - The path to the directory.
   * @returns An array of file/directory names in the directory.
   * @throws Error if the directory does not exist or cannot be read.
   */
  readdir(path: string): Promise<string[]>;

  /**
   * Gets file/directory statistics.
   * @param path - The path to get stats for.
   * @returns The file statistics.
   * @throws Error if the path does not exist.
   */
  stat(path: string): Promise<FileStat>;

  /**
   * Deletes a file.
   * @param path - The path to the file to delete.
   * @throws Error if the file does not exist or cannot be deleted.
   */
  unlink(path: string): Promise<void>;

  /**
   * Renames/moves a file or directory.
   * @param oldPath - The current path.
   * @param newPath - The new path.
   * @throws Error if the operation fails.
   */
  rename(oldPath: string, newPath: string): Promise<void>;
}
