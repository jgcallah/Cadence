import type { IFileSystem } from "../fs/index.js";
import { TemplateNotFoundError } from "../errors/index.js";

/**
 * Loads template files from the filesystem.
 * Uses the IFileSystem abstraction for testability.
 */
export class TemplateLoader {
  private fs: IFileSystem;

  /**
   * Creates a new TemplateLoader.
   *
   * @param fs - The filesystem abstraction to use for loading templates
   */
  constructor(fs: IFileSystem) {
    this.fs = fs;
  }

  /**
   * Loads a template file from the given path.
   *
   * @param templatePath - The absolute path to the template file
   * @returns The template content as a string
   * @throws TemplateNotFoundError if the template file does not exist
   */
  async load(templatePath: string): Promise<string> {
    try {
      // Check if the file exists first
      const exists = await this.fs.exists(templatePath);
      if (!exists) {
        throw new TemplateNotFoundError(templatePath);
      }

      // Read the template file
      return await this.fs.readFile(templatePath);
    } catch (error) {
      // If it's already a TemplateNotFoundError, re-throw it
      if (error instanceof TemplateNotFoundError) {
        throw error;
      }

      // Convert other errors to TemplateNotFoundError
      // This handles cases where the file doesn't exist but fs.exists returned true
      // (race condition) or other read errors
      if (error instanceof Error) {
        throw new TemplateNotFoundError(templatePath, { cause: error });
      }

      throw new TemplateNotFoundError(templatePath);
    }
  }
}
