import type { IFileSystem } from "../fs/index.js";
import type { ConfigLoader } from "../config/ConfigLoader.js";
import type { CadenceConfig, TemplatesConfig } from "../config/types.js";
import {
  TemplateExistsError,
  TemplateNotFoundError,
  TemplateProtectedError,
} from "../errors/index.js";
import { FrontmatterParser, FrontmatterSerializer } from "../frontmatter/index.js";
import { TemplateRegistry } from "./TemplateRegistry.js";
import type { TemplateVariableInfo } from "./types.js";

/**
 * Metadata that can be set on a template via CRUD operations.
 */
export interface TemplateMetadataInput {
  /** Human-readable description of the template */
  description?: string;
  /** Category for grouping templates */
  category?: string;
  /** Variable definitions for the template */
  variables?: TemplateVariableInfo[];
}

/**
 * Options for creating a new template.
 */
export interface CreateTemplateOptions {
  /** The unique name for the template */
  name: string;
  /** The template content (Handlebars template) */
  content: string;
  /** Optional custom path for the template file (relative to vault) */
  path?: string;
  /** Optional metadata to inject into the template frontmatter */
  metadata?: TemplateMetadataInput;
  /** If true, overwrite an existing template with the same name */
  overwrite?: boolean;
}

/**
 * Result of creating a template.
 */
export interface CreateTemplateResult {
  /** The registered name of the template */
  name: string;
  /** The path where the template file was created */
  path: string;
  /** Whether a new template was created (false if overwritten) */
  created: boolean;
}

/**
 * Options for updating an existing template.
 */
export interface UpdateTemplateOptions {
  /** The name of the template to update */
  name: string;
  /** New content for the template (replaces entire content) */
  content?: string;
  /** Metadata to merge into the template frontmatter */
  metadata?: TemplateMetadataInput;
  /** New name for the template */
  newName?: string;
  /** New path for the template file (relative to vault) */
  newPath?: string;
}

/**
 * Result of updating a template.
 */
export interface UpdateTemplateResult {
  /** The current name of the template */
  name: string;
  /** The current path of the template */
  path: string;
  /** The previous name if it was changed */
  previousName?: string;
  /** The previous path if it was moved */
  previousPath?: string;
}

/**
 * Options for deleting a template.
 */
export interface DeleteTemplateOptions {
  /** The name of the template to delete */
  name: string;
  /** If true, keep the template file but remove it from config */
  keepFile?: boolean;
}

/**
 * Result of deleting a template.
 */
export interface DeleteTemplateResult {
  /** The name of the deleted template */
  name: string;
  /** The path of the deleted template */
  path: string;
  /** Whether the file was deleted */
  fileDeleted: boolean;
  /** Whether the config was updated */
  configUpdated: boolean;
}

/**
 * TemplateManager provides CRUD operations for templates.
 * It orchestrates template file creation/modification and config updates.
 */
export class TemplateManager {
  /** Templates that cannot be deleted as they are required by the system */
  private readonly PROTECTED_TEMPLATES = [
    "daily",
    "weekly",
    "monthly",
    "quarterly",
    "yearly",
  ];

  private readonly fs: IFileSystem;
  private readonly configLoader: ConfigLoader;
  private readonly vaultPath: string;
  private readonly frontmatterParser: FrontmatterParser;
  private readonly frontmatterSerializer: FrontmatterSerializer;

  constructor(
    fs: IFileSystem,
    configLoader: ConfigLoader,
    vaultPath: string
  ) {
    this.fs = fs;
    this.configLoader = configLoader;
    this.vaultPath = vaultPath;
    this.frontmatterParser = new FrontmatterParser();
    this.frontmatterSerializer = new FrontmatterSerializer();
  }

  /**
   * Creates a new template.
   *
   * @param options - Creation options
   * @returns Result containing the template name and path
   * @throws TemplateExistsError if template exists and overwrite is false
   * @throws TemplateValidationError if template content has invalid Handlebars syntax
   */
  async create(options: CreateTemplateOptions): Promise<CreateTemplateResult> {
    const config = await this.configLoader.loadConfig(this.vaultPath);

    // Check if template already exists
    const templateExists = options.name in config.templates;
    if (templateExists && !options.overwrite) {
      throw new TemplateExistsError(options.name);
    }

    // Create a temporary registry to validate content
    const registry = new TemplateRegistry(this.fs);
    registry.validateContent(options.content, options.name);

    // Determine the template path
    const templatePath = options.path ?? this.getDefaultTemplatePath(config, options.name);
    const fullPath = this.joinPath(this.vaultPath, templatePath);

    // Prepare content with metadata in frontmatter if provided
    let contentToWrite = options.content;
    if (options.metadata) {
      contentToWrite = this.injectMetadataIntoContent(options.content, options.metadata, options.name);
    }

    // Ensure the directory exists
    const dirPath = this.getDirectoryPath(fullPath);
    await this.fs.mkdir(dirPath, true);

    // Write the template file
    await this.fs.writeFile(fullPath, contentToWrite);

    // Update config
    const newTemplates: TemplatesConfig = {
      ...config.templates,
      [options.name]: templatePath,
    };

    await this.configLoader.updateConfig(this.vaultPath, {
      templates: newTemplates,
    });

    return {
      name: options.name,
      path: templatePath,
      created: !templateExists,
    };
  }

  /**
   * Updates an existing template.
   *
   * @param options - Update options
   * @returns Result containing current and previous name/path
   * @throws TemplateNotFoundError if the template doesn't exist
   * @throws TemplateValidationError if new content has invalid Handlebars syntax
   * @throws TemplateExistsError if renaming to a name that already exists
   */
  async update(options: UpdateTemplateOptions): Promise<UpdateTemplateResult> {
    const config = await this.configLoader.loadConfig(this.vaultPath);

    // Check if template exists
    if (!(options.name in config.templates)) {
      throw new TemplateNotFoundError(options.name);
    }

    // If renaming, check the new name doesn't already exist
    if (options.newName && options.newName !== options.name) {
      if (options.newName in config.templates) {
        throw new TemplateExistsError(options.newName);
      }
    }

    const currentPath = config.templates[options.name]!;
    const fullCurrentPath = this.joinPath(this.vaultPath, currentPath);

    let result: UpdateTemplateResult = {
      name: options.newName ?? options.name,
      path: options.newPath ?? currentPath,
    };

    // Handle content update
    if (options.content !== undefined) {
      // Validate new content
      const registry = new TemplateRegistry(this.fs);
      registry.validateContent(options.content, options.name);

      // Write new content (metadata will be handled separately if provided)
      let contentToWrite = options.content;
      if (options.metadata) {
        contentToWrite = this.injectMetadataIntoContent(options.content, options.metadata, options.name);
      }

      await this.fs.writeFile(fullCurrentPath, contentToWrite);
    } else if (options.metadata) {
      // Only updating metadata, read existing content first
      const existingContent = await this.fs.readFile(fullCurrentPath);
      const updatedContent = this.mergeMetadataIntoContent(existingContent, options.metadata, options.name);
      await this.fs.writeFile(fullCurrentPath, updatedContent);
    }

    // Handle path change (move file)
    if (options.newPath && options.newPath !== currentPath) {
      const fullNewPath = this.joinPath(this.vaultPath, options.newPath);

      // Ensure target directory exists
      const dirPath = this.getDirectoryPath(fullNewPath);
      await this.fs.mkdir(dirPath, true);

      // Read current content and write to new location
      const content = await this.fs.readFile(fullCurrentPath);
      await this.fs.writeFile(fullNewPath, content);

      // Delete old file
      await this.fs.unlink(fullCurrentPath);

      result.previousPath = currentPath;
    }

    // Handle name change in config
    if (options.newName || options.newPath) {
      const newTemplates: TemplatesConfig = { ...config.templates };

      if (options.newName && options.newName !== options.name) {
        result.previousName = options.name;
        delete newTemplates[options.name];
      }

      const finalName = options.newName ?? options.name;
      const finalPath = options.newPath ?? currentPath;
      newTemplates[finalName] = finalPath;

      // Use saveConfig directly because updateConfig merges, which won't delete keys
      const updatedConfig = {
        ...config,
        templates: newTemplates,
      };
      await this.configLoader.saveConfig(this.vaultPath, updatedConfig);
    }

    return result;
  }

  /**
   * Deletes a template.
   *
   * @param options - Delete options
   * @returns Result containing deletion status
   * @throws TemplateNotFoundError if the template doesn't exist
   * @throws TemplateProtectedError if the template is protected
   */
  async delete(options: DeleteTemplateOptions): Promise<DeleteTemplateResult> {
    const config = await this.configLoader.loadConfig(this.vaultPath);

    // Check if template exists
    if (!(options.name in config.templates)) {
      throw new TemplateNotFoundError(options.name);
    }

    // Check if template is protected
    if (this.PROTECTED_TEMPLATES.includes(options.name)) {
      throw new TemplateProtectedError(options.name);
    }

    const templatePath = config.templates[options.name]!;
    const fullPath = this.joinPath(this.vaultPath, templatePath);

    let fileDeleted = false;

    // Delete the file unless keepFile is true
    if (!options.keepFile) {
      if (await this.fs.exists(fullPath)) {
        await this.fs.unlink(fullPath);
        fileDeleted = true;
      }
    }

    // Update config to remove the template
    // We need to use saveConfig directly because updateConfig merges,
    // which won't delete keys
    const newTemplates: TemplatesConfig = { ...config.templates };
    delete newTemplates[options.name];

    const updatedConfig = {
      ...config,
      templates: newTemplates,
    };
    await this.configLoader.saveConfig(this.vaultPath, updatedConfig);

    return {
      name: options.name,
      path: templatePath,
      fileDeleted,
      configUpdated: true,
    };
  }

  /**
   * Checks if a template is protected.
   */
  isProtected(name: string): boolean {
    return this.PROTECTED_TEMPLATES.includes(name);
  }

  /**
   * Gets the default template path based on config.
   */
  private getDefaultTemplatePath(config: CadenceConfig, name: string): string {
    const templatesDir = config.paths.templates;
    return `${templatesDir}/${name}.md`;
  }

  /**
   * Injects metadata into template content by adding/updating frontmatter.
   * If the content already has frontmatter with a template section, it merges.
   * If not, it creates new frontmatter.
   */
  private injectMetadataIntoContent(
    content: string,
    metadata: TemplateMetadataInput,
    templateName: string
  ): string {
    const { frontmatter, body } = this.frontmatterParser.parse(content);

    // Build the template metadata object
    const templateMetadata: Record<string, unknown> = {
      name: templateName,
    };

    if (metadata.description !== undefined) {
      templateMetadata["description"] = metadata.description;
    }
    if (metadata.category !== undefined) {
      templateMetadata["category"] = metadata.category;
    }
    if (metadata.variables !== undefined) {
      templateMetadata["variables"] = metadata.variables;
    }

    // Update frontmatter with template metadata
    const newFrontmatter = {
      ...frontmatter,
      template: templateMetadata,
    };

    return this.frontmatterSerializer.serialize(newFrontmatter, body);
  }

  /**
   * Merges metadata into existing template content frontmatter.
   */
  private mergeMetadataIntoContent(
    content: string,
    metadata: TemplateMetadataInput,
    templateName: string
  ): string {
    const { frontmatter, body } = this.frontmatterParser.parse(content);

    // Get existing template metadata or create new
    const existingTemplateMetadata = (frontmatter["template"] as Record<string, unknown>) ?? {};

    // Merge in new metadata
    const templateMetadata: Record<string, unknown> = {
      ...existingTemplateMetadata,
      name: templateName,
    };

    if (metadata.description !== undefined) {
      templateMetadata["description"] = metadata.description;
    }
    if (metadata.category !== undefined) {
      templateMetadata["category"] = metadata.category;
    }
    if (metadata.variables !== undefined) {
      templateMetadata["variables"] = metadata.variables;
    }

    // Update frontmatter with merged template metadata
    const newFrontmatter = {
      ...frontmatter,
      template: templateMetadata,
    };

    return this.frontmatterSerializer.serialize(newFrontmatter, body);
  }

  /**
   * Join path segments.
   */
  private joinPath(...segments: string[]): string {
    const isWindows = segments[0]?.includes("\\") || segments[0]?.match(/^[A-Z]:/i);
    const separator = isWindows ? "\\" : "/";

    return segments
      .map((segment, index) => {
        if (index < segments.length - 1) {
          return segment.replace(/[/\\]+$/, "");
        }
        return segment;
      })
      .join(separator);
  }

  /**
   * Get the directory path from a file path.
   */
  private getDirectoryPath(filePath: string): string {
    const isWindows = filePath.includes("\\") || filePath.match(/^[A-Z]:/i);
    const separator = isWindows ? "\\" : "/";
    const parts = filePath.split(separator);
    parts.pop(); // Remove filename
    return parts.join(separator);
  }
}
