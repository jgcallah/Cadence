import { Command } from "commander";
import chalk from "chalk";
import {
  VaultSearch,
  type SearchResult,
  type ContentMatch,
  type Note,
} from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";

/**
 * Highlight the query within text for terminal display.
 */
function highlightMatch(text: string, query: string): string {
  if (!query) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);

  return before + chalk.yellow.bold(match) + after;
}

/**
 * Format fuzzy search results for display.
 */
function formatFileResults(
  results: SearchResult[],
  query: string,
  json: boolean
): void {
  if (json) {
    console.log(
      JSON.stringify(
        results.map((r) => ({ path: r.path, score: r.score })),
        null,
        2
      )
    );
    return;
  }

  if (results.length === 0) {
    console.log(chalk.gray("No files found."));
    return;
  }

  console.log(chalk.bold(`Found ${results.length} file(s):`));
  console.log();

  for (const result of results) {
    // Format score as percentage relevance (lower score = better match)
    const relevance = Math.round((1 - result.score) * 100);
    const scoreDisplay =
      result.score > 0 ? chalk.gray(` (${relevance}% match)`) : "";

    // Highlight matching parts of the filename
    const filename = result.path.split("/").pop() ?? result.path;
    const dir = result.path.includes("/")
      ? chalk.gray(result.path.slice(0, result.path.lastIndexOf("/") + 1))
      : "";

    console.log(`  ${dir}${highlightMatch(filename, query)}${scoreDisplay}`);
  }
}

/**
 * Format content search results for display.
 */
function formatContentResults(
  matches: ContentMatch[],
  query: string,
  json: boolean
): void {
  if (json) {
    console.log(
      JSON.stringify(
        matches.map((m) => ({
          path: m.path,
          line: m.line,
          content: m.content,
          context: m.context,
        })),
        null,
        2
      )
    );
    return;
  }

  if (matches.length === 0) {
    console.log(chalk.gray("No matches found."));
    return;
  }

  console.log(chalk.bold(`Found ${matches.length} match(es):`));
  console.log();

  // Group by file
  const grouped = new Map<string, ContentMatch[]>();
  for (const match of matches) {
    if (!grouped.has(match.path)) {
      grouped.set(match.path, []);
    }
    grouped.get(match.path)!.push(match);
  }

  for (const [path, fileMatches] of grouped) {
    console.log(chalk.cyan.bold(path));

    for (const match of fileMatches) {
      const lineNum = chalk.gray(`${match.line}:`);
      const highlighted = highlightMatch(match.content, query);
      console.log(`  ${lineNum} ${highlighted}`);

      // Show context lines in gray
      if (match.context.length > 0) {
        for (const contextLine of match.context) {
          console.log(chalk.gray(`     ${contextLine.trim()}`));
        }
      }
    }
    console.log();
  }
}

/**
 * Format frontmatter search results for display.
 */
function formatFrontmatterResults(
  notes: Note[],
  field: string,
  value: string,
  json: boolean
): void {
  if (json) {
    console.log(
      JSON.stringify(
        notes.map((n) => ({
          path: n.path,
          frontmatter: n.frontmatter,
        })),
        null,
        2
      )
    );
    return;
  }

  if (notes.length === 0) {
    console.log(chalk.gray("No notes found."));
    return;
  }

  console.log(
    chalk.bold(`Found ${notes.length} note(s) with ${field}:${value}:`)
  );
  console.log();

  for (const note of notes) {
    console.log(`  ${chalk.cyan(note.path)}`);

    // Show matching frontmatter field
    const fieldValue = getNestedValue(note.frontmatter, field);
    if (fieldValue !== undefined) {
      let valueStr: string;
      if (Array.isArray(fieldValue)) {
        valueStr = fieldValue.join(", ");
      } else if (typeof fieldValue === "object" && fieldValue !== null) {
        valueStr = JSON.stringify(fieldValue);
      } else {
        valueStr = String(fieldValue as string | number | boolean);
      }
      console.log(chalk.gray(`    ${field}: ${valueStr}`));
    }
  }
}

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export const searchCommand = new Command("search")
  .description("Search for notes in the vault")
  .argument("[query]", "Search query (fuzzy filename match by default)")
  .option("--content <query>", "Search within note contents")
  .option(
    "--frontmatter <field:value>",
    "Search by frontmatter field (e.g., status:active, tags:project)"
  )
  .option("--json", "Output as JSON")
  .option("--limit <number>", "Maximum number of results")
  .option("--path <prefix>", "Limit search to path prefix")
  .action(async function (
    this: Command,
    query: string | undefined,
    options: {
      content?: string;
      frontmatter?: string;
      json?: boolean;
      limit?: string;
      path?: string;
    }
  ) {
    try {
      const { vaultPath, fs } = await getVaultContext(this);

      const search = new VaultSearch(fs, vaultPath);

      // Parse limit if provided
      let limit: number | undefined;
      if (options.limit) {
        limit = parseInt(options.limit, 10);
        if (isNaN(limit) || limit < 1) {
          throw new Error("--limit must be a positive integer");
        }
      }

      // Build search options, only including defined values
      // (exactOptionalPropertyTypes requires this)
      const searchOptions: { path?: string; limit?: number } = {};
      if (options.path !== undefined) {
        searchOptions.path = options.path;
      }
      if (limit !== undefined) {
        searchOptions.limit = limit;
      }

      // Determine search mode
      if (options.frontmatter) {
        // Frontmatter search: --frontmatter field:value
        const colonIndex = options.frontmatter.indexOf(":");
        if (colonIndex === -1) {
          throw new Error(
            "Frontmatter search requires format 'field:value' (e.g., --frontmatter status:active)"
          );
        }
        const field = options.frontmatter.slice(0, colonIndex);
        const value = options.frontmatter.slice(colonIndex + 1);

        if (!field || !value) {
          throw new Error(
            "Both field and value are required for frontmatter search"
          );
        }

        const results = await search.searchFrontmatter(
          field,
          value,
          searchOptions
        );
        formatFrontmatterResults(
          results,
          field,
          value,
          options.json === true
        );
      } else if (options.content) {
        // Content search: --content <query>
        const results = await search.searchContent(
          options.content,
          searchOptions
        );
        formatContentResults(results, options.content, options.json === true);
      } else {
        // Default: fuzzy filename search
        if (!query) {
          // List all files if no query provided
          const results = await search.searchFiles("", searchOptions);
          formatFileResults(results, "", options.json === true);
        } else {
          const results = await search.searchFiles(query, searchOptions);
          formatFileResults(results, query, options.json === true);
        }
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
