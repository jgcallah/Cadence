import { format, getISOWeek, getQuarter } from "date-fns";

/**
 * PathGenerator generates file paths from templates by substituting
 * date-based variables.
 */
export class PathGenerator {
  private readonly variables: string[] = [
    "year",
    "month",
    "date",
    "week",
    "quarter",
    "day",
  ];

  /**
   * Generate a path from a template by substituting date variables.
   *
   * Supported variables:
   * - {year} - 4-digit year (e.g., "2026")
   * - {month} - 2-digit month (e.g., "03" for March)
   * - {date} - 2-digit day of month (e.g., "15")
   * - {week} - 2-digit ISO week number (e.g., "11")
   * - {quarter} - Quarter number (1-4)
   * - {day} - Day name (e.g., "Monday")
   *
   * @param template - Path template with variables like {year}, {month}, etc.
   * @param date - Date to use for variable substitution
   * @returns Generated path with variables replaced
   */
  generatePath(template: string, date: Date): string {
    let result = template;

    // Replace {year} with 4-digit year
    result = result.replace(/\{year\}/g, format(date, "yyyy"));

    // Replace {month} with 2-digit month
    result = result.replace(/\{month\}/g, format(date, "MM"));

    // Replace {date} with 2-digit day
    result = result.replace(/\{date\}/g, format(date, "dd"));

    // Replace {week} with 2-digit ISO week number
    const weekNum = getISOWeek(date);
    result = result.replace(/\{week\}/g, weekNum.toString().padStart(2, "0"));

    // Replace {quarter} with quarter number
    const quarterNum = getQuarter(date);
    result = result.replace(/\{quarter\}/g, quarterNum.toString());

    // Replace {day} with day name
    result = result.replace(/\{day\}/g, format(date, "EEEE"));

    return result;
  }

  /**
   * Get the list of available template variables.
   *
   * @returns Array of variable names (without braces)
   */
  getAvailableVariables(): string[] {
    return [...this.variables];
  }
}
