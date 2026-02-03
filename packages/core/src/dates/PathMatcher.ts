/**
 * DateComponents extracted from a path.
 */
export interface DateComponents {
  year?: number;
  month?: number; // 1-12
  date?: number; // 1-31
  week?: number; // 1-53
  quarter?: number; // 1-4
}

/**
 * PathMatcher converts path patterns to regexes and extracts dates from matching paths.
 *
 * This solves the problem where path patterns like "Journal/{year}/Daily/{month}/{date}.md"
 * create files like "Journal/2026/Daily/02/03.md" where the date components are spread
 * across directory names rather than being in the filename.
 */
export class PathMatcher {
  /**
   * Convert a path pattern to a regex with named capture groups.
   *
   * Example:
   * "Journal/{year}/Daily/{month}/{date}.md"
   * -> /Journal[/\\](?<year>\d{4})[/\\]Daily[/\\](?<month>\d{2})[/\\](?<date>\d{2})\.md$/
   *
   * Handles duplicate placeholders (e.g., "{year}/{year}.md") by using named groups
   * only for the first occurrence, and non-capturing groups for subsequent ones.
   *
   * @param pattern - Path pattern with placeholders like {year}, {month}, {date}
   * @returns RegExp that matches paths and captures date components
   */
  patternToRegex(pattern: string): RegExp {
    // Track which named groups we've already created
    const seenGroups = new Set<string>();

    // Placeholder definitions: name -> regex pattern
    const placeholders: Record<string, string> = {
      year: "\\d{4}",
      month: "\\d{2}",
      date: "\\d{2}",
      week: "\\d{1,2}",
      quarter: "\\d",
    };

    let regexStr = pattern
      // Handle both forward and back slashes for cross-platform support
      .replace(/[/\\]/g, "[/\\\\]")
      // Escape dots (for .md extension)
      .replace(/\./g, "\\.");

    // Replace each placeholder, using named group for first occurrence only
    for (const [name, regexPattern] of Object.entries(placeholders)) {
      const placeholder = new RegExp(`\\{${name}\\}`, "g");
      regexStr = regexStr.replace(placeholder, () => {
        if (seenGroups.has(name)) {
          // Subsequent occurrences: use non-capturing group
          return `(?:${regexPattern})`;
        } else {
          // First occurrence: use named capture group
          seenGroups.add(name);
          return `(?<${name}>${regexPattern})`;
        }
      });
    }

    return new RegExp(regexStr + "$");
  }

  /**
   * Extract date components from a path using a pattern.
   *
   * @param path - Full path to the file
   * @param pattern - Path pattern with placeholders
   * @returns DateComponents if path matches, null otherwise
   */
  extractDateComponents(path: string, pattern: string): DateComponents | null {
    const regex = this.patternToRegex(pattern);
    const match = regex.exec(path);
    if (!match?.groups) return null;

    const groups = match.groups;
    const components: DateComponents = {};
    if (groups["year"]) components.year = parseInt(groups["year"]);
    if (groups["month"]) components.month = parseInt(groups["month"]);
    if (groups["date"]) components.date = parseInt(groups["date"]);
    if (groups["week"]) components.week = parseInt(groups["week"]);
    if (groups["quarter"]) components.quarter = parseInt(groups["quarter"]);

    return components;
  }

  /**
   * Convert date components to a Date object.
   *
   * @param components - DateComponents to convert
   * @returns Date object
   * @throws Error if insufficient data to create a date
   */
  componentsToDate(components: DateComponents): Date {
    // Full date: year + month + date
    if (
      components.year !== undefined &&
      components.month !== undefined &&
      components.date !== undefined
    ) {
      return new Date(components.year, components.month - 1, components.date);
    }

    // Monthly: year + month
    if (components.year !== undefined && components.month !== undefined) {
      return new Date(components.year, components.month - 1, 1);
    }

    // Weekly: year + week (approximate first day of ISO week)
    if (components.year !== undefined && components.week !== undefined) {
      const jan1 = new Date(components.year, 0, 1);
      const daysToAdd = (components.week - 1) * 7;
      return new Date(jan1.getTime() + daysToAdd * 86400000);
    }

    // Quarterly: year + quarter
    if (components.year !== undefined && components.quarter !== undefined) {
      return new Date(components.year, (components.quarter - 1) * 3, 1);
    }

    // Yearly: year only
    if (components.year !== undefined) {
      return new Date(components.year, 0, 1);
    }

    throw new Error("Cannot convert components to date: insufficient data");
  }

  /**
   * Extract a Date from a path using a pattern.
   *
   * @param path - Full path to the file
   * @param pattern - Path pattern with placeholders
   * @returns Date if path matches and has sufficient data, null otherwise
   */
  extractDate(path: string, pattern: string): Date | null {
    const components = this.extractDateComponents(path, pattern);
    if (!components) return null;

    try {
      return this.componentsToDate(components);
    } catch {
      return null;
    }
  }

  /**
   * Format date components as a string for display.
   *
   * @param components - DateComponents to format
   * @returns Formatted string like "2026-02-03" or "2026-W05"
   */
  formatComponents(components: DateComponents): string {
    if (
      components.year !== undefined &&
      components.month !== undefined &&
      components.date !== undefined
    ) {
      return `${components.year}-${components.month.toString().padStart(2, "0")}-${components.date.toString().padStart(2, "0")}`;
    }

    if (components.year !== undefined && components.month !== undefined) {
      return `${components.year}-${components.month.toString().padStart(2, "0")}`;
    }

    if (components.year !== undefined && components.week !== undefined) {
      return `${components.year}-W${components.week.toString().padStart(2, "0")}`;
    }

    if (components.year !== undefined && components.quarter !== undefined) {
      return `${components.year}-Q${components.quarter}`;
    }

    if (components.year !== undefined) {
      return `${components.year}`;
    }

    return "";
  }
}
