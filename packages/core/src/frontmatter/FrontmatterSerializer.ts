import { stringify as stringifyYaml } from "yaml";

/**
 * Serializes frontmatter and body content back into a note string.
 *
 * Uses YAML formatting with `---` delimiters for the frontmatter block.
 */
export class FrontmatterSerializer {
  /**
   * Serializes frontmatter and body into a complete note string.
   *
   * @param frontmatter - The frontmatter object to serialize
   * @param body - The body content of the note
   * @returns The complete note string with frontmatter and body
   */
  serialize(frontmatter: Record<string, unknown>, body: string): string {
    // If frontmatter is empty, just return the body
    if (Object.keys(frontmatter).length === 0) {
      return body;
    }

    // Serialize the frontmatter to YAML
    const yamlContent = stringifyYaml(frontmatter, {
      // Use block style for better readability
      defaultStringType: "QUOTE_SINGLE",
      defaultKeyType: "PLAIN",
      lineWidth: 0, // Disable line wrapping
      nullStr: "null",
    });

    // Remove trailing newline from YAML output if present
    const trimmedYaml = yamlContent.endsWith("\n")
      ? yamlContent.slice(0, -1)
      : yamlContent;

    // Combine with delimiters and body
    if (body === "") {
      return `---\n${trimmedYaml}\n---`;
    }

    return `---\n${trimmedYaml}\n---\n${body}`;
  }
}
