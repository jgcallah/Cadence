import Handlebars from "handlebars";
import type { IFileSystem } from "../fs/index.js";
import { TemplateNotFoundError, TemplateValidationError } from "../errors/index.js";
import { FrontmatterParser } from "../frontmatter/index.js";
import type {
  TemplateInfo,
  TemplateMetadata,
  TemplateVariableInfo,
} from "./types.js";
import type { TemplatesConfig } from "../config/types.js";

/**
 * Registry for named templates.
 * Manages registration, retrieval, and listing of templates.
 */
export class TemplateRegistry {
  private fs: IFileSystem;
  private frontmatterParser: FrontmatterParser;
  private templates = new Map<string, string>();

  /**
   * Creates a new TemplateRegistry.
   *
   * @param fs - The filesystem abstraction to use for loading templates
   */
  constructor(fs: IFileSystem) {
    this.fs = fs;
    this.frontmatterParser = new FrontmatterParser();
  }

  /**
   * Registers a template with a name.
   *
   * @param name - The unique name to register the template under
   * @param templatePath - The path to the template file
   */
  register(name: string, templatePath: string): void {
    this.templates.set(name, templatePath);
  }

  /**
   * Loads templates from a configuration object.
   * Registers all templates defined in the configuration.
   *
   * @param config - The templates configuration object
   */
  loadFromConfig(config: TemplatesConfig): void {
    for (const [name, path] of Object.entries(config)) {
      this.register(name, path);
    }
  }

  /**
   * Gets the path for a registered template.
   *
   * @param name - The name of the registered template
   * @returns The path to the template file
   * @throws TemplateNotFoundError if the template is not registered
   */
  getPath(name: string): string {
    const path = this.templates.get(name);
    if (!path) {
      throw new TemplateNotFoundError(name);
    }
    return path;
  }

  /**
   * Checks if a template is registered.
   *
   * @param name - The name to check
   * @returns True if the template is registered
   */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Gets the content of a registered template.
   *
   * @param name - The name of the registered template
   * @returns The template content as a string
   * @throws TemplateNotFoundError if the template is not registered or file doesn't exist
   */
  async get(name: string): Promise<string> {
    const path = this.getPath(name);

    const exists = await this.fs.exists(path);
    if (!exists) {
      throw new TemplateNotFoundError(name);
    }

    return await this.fs.readFile(path);
  }

  /**
   * Gets the metadata for a registered template.
   *
   * @param name - The name of the registered template
   * @returns The template metadata, or undefined values if not present
   */
  async getMetadata(name: string): Promise<TemplateMetadata> {
    const content = await this.get(name);
    return this.parseTemplateMetadata(content);
  }

  /**
   * Gets the variable definitions for a template.
   *
   * @param name - The name of the registered template
   * @returns Array of variable info, or empty array if not defined
   */
  async getVariables(name: string): Promise<TemplateVariableInfo[]> {
    const metadata = await this.getMetadata(name);
    return metadata.variables ?? [];
  }

  /**
   * Lists all registered templates with their info.
   * Loads metadata from each template file.
   *
   * @returns Array of template information objects
   */
  async list(): Promise<TemplateInfo[]> {
    const result: TemplateInfo[] = [];

    for (const [name, path] of this.templates) {
      let description: string | undefined;
      let category: string | undefined;

      try {
        const content = await this.fs.readFile(path);
        const metadata = this.parseTemplateMetadata(content);
        description = metadata.description;
        category = metadata.category;
      } catch {
        // If we can't read the template, just skip the description/category
      }

      const info: TemplateInfo = { name, path };
      if (description !== undefined) {
        info.description = description;
      }
      if (category !== undefined) {
        info.category = category;
      }
      result.push(info);
    }

    return result;
  }

  /**
   * Parses template metadata from content frontmatter.
   *
   * @param content - The template file content
   * @returns Parsed template metadata
   */
  parseTemplateMetadata(content: string): TemplateMetadata {
    const { frontmatter } = this.frontmatterParser.parse(content);

    // Extract template metadata from frontmatter
    const templateData = frontmatter["template"] as Record<string, unknown> | undefined;

    if (!templateData || typeof templateData !== "object") {
      return {};
    }

    const metadata: TemplateMetadata = {};

    if (typeof templateData["name"] === "string") {
      metadata.name = templateData["name"];
    }

    if (typeof templateData["description"] === "string") {
      metadata.description = templateData["description"];
    }

    if (typeof templateData["category"] === "string") {
      metadata.category = templateData["category"];
    }

    if (Array.isArray(templateData["variables"])) {
      metadata.variables = this.parseVariables(templateData["variables"]);
    }

    return metadata;
  }

  /**
   * Parses variable definitions from frontmatter.
   *
   * @param variables - Raw variable definitions from YAML
   * @returns Parsed variable info array
   */
  private parseVariables(variables: unknown[]): TemplateVariableInfo[] {
    const result: TemplateVariableInfo[] = [];

    for (const v of variables) {
      if (typeof v !== "object" || v === null) {
        continue;
      }

      const varObj = v as Record<string, unknown>;
      const name = varObj["name"];

      if (typeof name !== "string") {
        continue;
      }

      const variable: TemplateVariableInfo = {
        name,
        required: varObj["required"] === true,
      };

      if ("default" in varObj) {
        variable.default = varObj["default"];
      }

      if (typeof varObj["description"] === "string") {
        variable.description = varObj["description"];
      }

      result.push(variable);
    }

    return result;
  }

  /**
   * Clears all registered templates.
   */
  clear(): void {
    this.templates.clear();
  }

  /**
   * Unregisters a template by name.
   *
   * @param name - The name of the template to unregister
   * @returns True if the template was found and removed, false if it wasn't registered
   */
  unregister(name: string): boolean {
    return this.templates.delete(name);
  }

  /**
   * Exports the registry as a TemplatesConfig object.
   * Useful for saving to configuration.
   *
   * @returns A record of template names to paths
   */
  toConfig(): TemplatesConfig {
    const config: TemplatesConfig = {};
    for (const [name, path] of this.templates) {
      config[name] = path;
    }
    return config;
  }

  /**
   * Validates template content for correct Handlebars syntax.
   * Throws TemplateValidationError if the content is invalid.
   *
   * @param content - The template content to validate
   * @param name - The template name (for error messages)
   * @throws TemplateValidationError if the Handlebars syntax is invalid
   */
  validateContent(content: string, name: string): void {
    try {
      // Attempt to compile the template - this will catch syntax errors
      const compiled = Handlebars.compile(content);
      // Also try to render with empty object to catch additional errors
      // We use a Proxy to return empty strings for any accessed property
      const emptyProxy = new Proxy({}, {
        get: () => "",
        has: () => true,
      });
      compiled(emptyProxy);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const options: { validationErrors: string[]; cause?: Error } = {
        validationErrors: [message],
      };
      if (error instanceof Error) {
        options.cause = error;
      }
      throw new TemplateValidationError(name, message, options);
    }
  }
}
