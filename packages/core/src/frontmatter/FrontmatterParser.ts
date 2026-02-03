import { parse as parseYaml } from "yaml";

/**
 * Result of parsing a note's frontmatter.
 */
export interface ParseResult {
  /** The parsed frontmatter as a key-value object. Empty object if no frontmatter. */
  frontmatter: Record<string, unknown>;
  /** The body content of the note (everything after the frontmatter). */
  body: string;
}

/**
 * Parses YAML frontmatter from markdown note content.
 *
 * Frontmatter is expected to be delimited by `---` at the start of the content.
 * The parser handles notes with or without frontmatter gracefully.
 */
export class FrontmatterParser {
  /**
   * Parses the content of a note, extracting frontmatter and body.
   *
   * @param content - The full content of the note
   * @returns An object containing the parsed frontmatter and body
   */
  parse(content: string): ParseResult {
    // Normalize line endings to Unix-style for consistent parsing
    const normalizedContent = content.replace(/\r\n/g, "\n");

    // Check if the content starts with frontmatter delimiter
    if (!normalizedContent.startsWith("---\n")) {
      return {
        frontmatter: {},
        body: content,
      };
    }

    // Find the closing delimiter
    // Start searching after the opening "---\n" (position 4)
    const openingDelimiterEnd = 4; // "---\n".length

    // Look for closing delimiter patterns
    // Pattern 1: "\n---\n" with content after
    // Pattern 2: "\n---" at end of content
    // Pattern 3: "---\n" right after opening (empty frontmatter)

    // Check for empty frontmatter (---\n---\n)
    if (normalizedContent.startsWith("---\n", openingDelimiterEnd)) {
      // Empty frontmatter block
      const bodyStartIndex = openingDelimiterEnd + 4; // after the second "---\n"
      return {
        frontmatter: {},
        body: bodyStartIndex < normalizedContent.length
          ? normalizedContent.substring(bodyStartIndex)
          : "",
      };
    }

    // Look for closing delimiter
    const closingDelimiterIndex = normalizedContent.indexOf("\n---\n", openingDelimiterEnd);
    const closingDelimiterAtEnd = normalizedContent.indexOf("\n---", openingDelimiterEnd);

    let actualClosingIndex: number;
    let bodyStartIndex: number;

    if (closingDelimiterIndex !== -1) {
      // Found closing delimiter with content after it
      actualClosingIndex = closingDelimiterIndex;
      bodyStartIndex = closingDelimiterIndex + 5; // "\n---\n".length
    } else if (
      closingDelimiterAtEnd !== -1 &&
      normalizedContent.substring(closingDelimiterAtEnd) === "\n---"
    ) {
      // Closing delimiter at end of content
      actualClosingIndex = closingDelimiterAtEnd;
      bodyStartIndex = normalizedContent.length;
    } else {
      // No closing delimiter found - treat entire content as body (not valid frontmatter)
      return {
        frontmatter: {},
        body: content,
      };
    }

    // Extract the YAML content between delimiters
    const yamlContent = normalizedContent.substring(openingDelimiterEnd, actualClosingIndex);

    // Parse the YAML
    let frontmatter: Record<string, unknown> = {};
    try {
      const parsed: unknown = parseYaml(yamlContent);
      // YAML can return null for empty content
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        frontmatter = parsed as Record<string, unknown>;
      }
    } catch {
      // If YAML parsing fails, treat as no frontmatter
      return {
        frontmatter: {},
        body: content,
      };
    }

    // Extract the body (everything after the closing delimiter)
    const body = bodyStartIndex < normalizedContent.length
      ? normalizedContent.substring(bodyStartIndex)
      : "";

    return {
      frontmatter,
      body,
    };
  }
}
