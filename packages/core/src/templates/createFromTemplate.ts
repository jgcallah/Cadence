import * as path from "path";
import type { IFileSystem } from "../fs/index.js";
import { TemplateRenderError } from "../errors/index.js";
import type { Note } from "../notes/types.js";
import { FrontmatterParser } from "../frontmatter/index.js";
import { TemplateEngine } from "./TemplateEngine.js";
import type { TemplateRegistry } from "./TemplateRegistry.js";
import type { TemplateVariableInfo } from "./types.js";

/**
 * Options for createFromTemplate.
 */
export interface CreateFromTemplateOptions {
  /** The filesystem to use */
  fs: IFileSystem;
  /** The template registry containing registered templates */
  registry: TemplateRegistry;
  /** Optional template engine instance (creates new one if not provided) */
  engine?: TemplateEngine;
}

/**
 * Validates that all required variables are provided.
 * Returns variables with defaults applied for optional variables.
 *
 * @param variableDefs - Variable definitions from template metadata
 * @param providedVars - Variables provided by the user
 * @param templateName - Name of the template (for error messages)
 * @returns Variables with defaults applied
 * @throws TemplateRenderError if required variables are missing
 */
export function validateAndApplyDefaults(
  variableDefs: TemplateVariableInfo[],
  providedVars: Record<string, unknown>,
  templateName: string
): Record<string, unknown> {
  const missingVars: string[] = [];
  const result = { ...providedVars };

  for (const varDef of variableDefs) {
    const hasValue = varDef.name in providedVars && providedVars[varDef.name] !== undefined;

    if (varDef.required && !hasValue) {
      missingVars.push(varDef.name);
    } else if (!hasValue && "default" in varDef) {
      // Apply default for optional variables
      result[varDef.name] = varDef.default;
    }
  }

  if (missingVars.length > 0) {
    throw new TemplateRenderError(
      templateName,
      `Missing required variables: ${missingVars.join(", ")}`,
      { missingVariables: missingVars }
    );
  }

  return result;
}

/**
 * Strips template metadata from frontmatter content.
 * The 'template' block in frontmatter is metadata about the template,
 * not content that should appear in rendered notes.
 *
 * @param content - The raw template content
 * @returns Content with template metadata removed from frontmatter
 */
export function stripTemplateMetadata(content: string): string {
  // Check if content starts with frontmatter
  if (!content.startsWith("---\n")) {
    return content;
  }

  // Find the closing delimiter
  const closingIndex = content.indexOf("\n---\n", 4);
  const closingAtEnd = content.indexOf("\n---", 4);

  let yamlEnd: number;
  let bodyStart: number;

  if (closingIndex !== -1) {
    yamlEnd = closingIndex;
    bodyStart = closingIndex + 5;
  } else if (closingAtEnd !== -1 && content.substring(closingAtEnd) === "\n---") {
    yamlEnd = closingAtEnd;
    bodyStart = content.length;
  } else {
    return content;
  }

  // Parse the YAML to remove the template block
  const yamlContent = content.substring(4, yamlEnd);
  const lines = yamlContent.split("\n");
  const filteredLines: string[] = [];
  let inTemplateBlock = false;
  let templateIndent = 0;
  let foundTemplateBlock = false;

  for (const line of lines) {
    // Check if this is the start of the template block
    if (line.startsWith("template:")) {
      inTemplateBlock = true;
      foundTemplateBlock = true;
      templateIndent = 0;
      continue;
    }

    if (inTemplateBlock) {
      // Check if we're still in the template block
      const trimmedLine = line.trimStart();
      const currentIndent = line.length - trimmedLine.length;

      if (trimmedLine === "" || currentIndent > templateIndent || line.startsWith("  ")) {
        // Skip lines that are part of the template block
        if (trimmedLine !== "") {
          templateIndent = currentIndent > 0 ? currentIndent : 2;
        }
        continue;
      } else {
        // We've exited the template block
        inTemplateBlock = false;
      }
    }

    filteredLines.push(line);
  }

  // If no template block was found, return content unchanged
  if (!foundTemplateBlock) {
    return content;
  }

  // Reconstruct the content
  const filteredYaml = filteredLines.join("\n").trim();

  // Get the body content (everything after the closing ---)
  let body = bodyStart < content.length ? content.substring(bodyStart) : "";

  // Remove leading newline from body if present
  if (body.startsWith("\n")) {
    body = body.substring(1);
  }

  if (filteredYaml === "") {
    // No remaining frontmatter, return just the body
    return body;
  }

  // Rebuild frontmatter with remaining content
  return `---\n${filteredYaml}\n---\n${body}`;
}

/**
 * Creates a new note from a named template.
 *
 * @param templateName - The name of the registered template
 * @param targetPath - The path where the new note should be created
 * @param variables - Variables to substitute in the template
 * @param options - Options including filesystem and registry
 * @returns The created note object
 * @throws TemplateNotFoundError if the template doesn't exist
 * @throws TemplateRenderError if required variables are missing or rendering fails
 */
export async function createFromTemplate(
  templateName: string,
  targetPath: string,
  variables: Record<string, unknown>,
  options: CreateFromTemplateOptions
): Promise<Note> {
  const { fs, registry, engine = new TemplateEngine() } = options;
  const frontmatterParser = new FrontmatterParser();

  // Load the template content
  const templateContent = await registry.get(templateName);

  // Get variable definitions from template metadata
  const variableDefs = await registry.getVariables(templateName);

  // Validate and apply defaults
  const validatedVars = validateAndApplyDefaults(variableDefs, variables, templateName);

  // Strip template metadata from content before rendering
  const contentToRender = stripTemplateMetadata(templateContent);

  // Render the template
  const renderedContent = engine.render(contentToRender, validatedVars);

  // Ensure parent directories exist
  const parentDir = path.dirname(targetPath);
  if (parentDir && parentDir !== ".") {
    await fs.mkdir(parentDir, true);
  }

  // Write the file
  await fs.writeFile(targetPath, renderedContent);

  // Parse the rendered content to return a Note object
  const { frontmatter, body } = frontmatterParser.parse(renderedContent);

  return {
    path: targetPath,
    content: renderedContent,
    frontmatter,
    body,
  };
}
