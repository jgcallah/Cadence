/**
 * Types for named template support in Cadence.
 */

/**
 * Information about a template variable.
 */
export interface TemplateVariableInfo {
  /** The name of the variable */
  name: string;
  /** Whether the variable is required */
  required: boolean;
  /** Default value if the variable is optional */
  default?: unknown;
  /** Description of the variable's purpose */
  description?: string;
}

/**
 * Template metadata extracted from frontmatter.
 * This is the structure expected in template files.
 */
export interface TemplateMetadata {
  /** Human-readable name of the template */
  name?: string;
  /** Description of what the template is for */
  description?: string;
  /** Category for grouping templates in UI */
  category?: string;
  /** Variable definitions for the template */
  variables?: TemplateVariableInfo[];
}

/**
 * Information about a registered template.
 * Returned by TemplateRegistry.list().
 */
export interface TemplateInfo {
  /** The registered name of the template */
  name: string;
  /** The path to the template file */
  path: string;
  /** Optional description from template metadata */
  description?: string;
  /** Optional category for grouping in UI */
  category?: string;
}
