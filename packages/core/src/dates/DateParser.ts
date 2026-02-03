import * as chrono from "chrono-node";
import { parseISO, isValid, startOfWeek, addWeeks, startOfYear, addMonths, startOfMonth, subQuarters, subYears } from "date-fns";
import type { NoteType } from "../notes/types.js";

/**
 * DateParser handles parsing of date strings including natural language
 * expressions and ISO date formats.
 */
export class DateParser {
  /**
   * Parse a date input into a Date object.
   *
   * Supports:
   * - Date objects (returned as-is)
   * - ISO date strings (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss.sssZ)
   * - Natural language expressions via chrono-node:
   *   - "today", "yesterday", "tomorrow"
   *   - "last friday", "next tuesday"
   *   - "3 days ago", "in 2 weeks"
   *
   * @param input - Date object or string to parse
   * @returns Parsed Date object
   * @throws Error if the input cannot be parsed
   */
  parse(input: string | Date): Date {
    if (input instanceof Date) {
      return input;
    }

    const trimmed = input.trim();

    if (trimmed === "") {
      throw new Error("Cannot parse empty string as date");
    }

    // Try ISO date string first
    const isoDate = parseISO(trimmed);
    if (isValid(isoDate)) {
      return isoDate;
    }

    // Try natural language parsing with chrono-node
    const results = chrono.parse(trimmed);
    const firstResult = results[0];
    if (firstResult) {
      const parsed = firstResult.date();
      if (parsed) {
        return parsed;
      }
    }

    throw new Error(`Unable to parse date: "${input}"`);
  }

  /**
   * Parse a period-specific date input for a given note type.
   *
   * Supports additional formats based on note type:
   * - Weekly: "2024-W05", "W05", "week 5", "last week", "this week"
   * - Monthly: "2024-01", "January 2024", "last month"
   * - Quarterly: "Q1 2024", "2024-Q1", "Q1", "last quarter"
   * - Yearly: "2024", "last year", "this year"
   *
   * Falls back to standard parse() if period-specific parsing fails.
   *
   * @param input - String to parse
   * @param type - The note type for context-aware parsing
   * @returns Parsed Date object
   * @throws Error if the input cannot be parsed
   */
  parseForType(input: string, type: NoteType): Date {
    const trimmed = input.trim();

    if (trimmed === "") {
      throw new Error("Cannot parse empty string as date");
    }

    // Try period-specific parsing first
    const periodDate = this.tryParsePeriodFormat(trimmed, type);
    if (periodDate) {
      return periodDate;
    }

    // Fall back to standard parsing
    return this.parse(trimmed);
  }

  /**
   * Try to parse period-specific formats.
   * Returns null if no period-specific format matches.
   */
  private tryParsePeriodFormat(input: string, type: NoteType): Date | null {
    const normalized = input.toLowerCase().trim();

    switch (type) {
      case "weekly":
        return this.tryParseWeeklyFormat(normalized, input);
      case "monthly":
        return this.tryParseMonthlyFormat(normalized, input);
      case "quarterly":
        return this.tryParseQuarterlyFormat(normalized, input);
      case "yearly":
        return this.tryParseYearlyFormat(normalized, input);
      default:
        return null;
    }
  }

  /**
   * Parse weekly-specific formats: 2024-W05, W05, week 5
   */
  private tryParseWeeklyFormat(normalized: string, _original: string): Date | null {
    // ISO week format: 2024-W05 or 2024-w05
    const isoWeekMatch = /^(\d{4})-w(\d{1,2})$/.exec(normalized);
    if (isoWeekMatch) {
      const year = parseInt(isoWeekMatch[1]!, 10);
      const week = parseInt(isoWeekMatch[2]!, 10);
      return this.getDateFromWeekNumber(year, week);
    }

    // Short week format: W05 or w05 (uses current year)
    const shortWeekMatch = /^w(\d{1,2})$/.exec(normalized);
    if (shortWeekMatch) {
      const year = new Date().getFullYear();
      const week = parseInt(shortWeekMatch[1]!, 10);
      return this.getDateFromWeekNumber(year, week);
    }

    // "week N" format
    const weekNMatch = /^week\s+(\d{1,2})$/.exec(normalized);
    if (weekNMatch) {
      const year = new Date().getFullYear();
      const week = parseInt(weekNMatch[1]!, 10);
      return this.getDateFromWeekNumber(year, week);
    }

    // "this week" / "last week" / "next week" - let chrono handle these
    if (normalized === "this week" || normalized === "last week" || normalized === "next week") {
      return null; // Fall through to chrono
    }

    return null;
  }

  /**
   * Parse monthly-specific formats: 2024-01, January 2024
   */
  private tryParseMonthlyFormat(normalized: string, _original: string): Date | null {
    // YYYY-MM format: 2024-01
    const yearMonthMatch = /^(\d{4})-(\d{2})$/.exec(normalized);
    if (yearMonthMatch) {
      const year = parseInt(yearMonthMatch[1]!, 10);
      const month = parseInt(yearMonthMatch[2]!, 10);
      if (month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1);
      }
    }

    return null;
  }

  /**
   * Parse quarterly-specific formats: Q1 2024, 2024-Q1, Q1
   */
  private tryParseQuarterlyFormat(normalized: string, _original: string): Date | null {
    // Q1 2024 or Q1-2024
    const quarterYearMatch = /^q([1-4])[\s-]+(\d{4})$/.exec(normalized);
    if (quarterYearMatch) {
      const quarter = parseInt(quarterYearMatch[1]!, 10);
      const year = parseInt(quarterYearMatch[2]!, 10);
      return this.getDateFromQuarter(year, quarter);
    }

    // 2024-Q1 or 2024 Q1
    const yearQuarterMatch = /^(\d{4})[\s-]+q([1-4])$/.exec(normalized);
    if (yearQuarterMatch) {
      const year = parseInt(yearQuarterMatch[1]!, 10);
      const quarter = parseInt(yearQuarterMatch[2]!, 10);
      return this.getDateFromQuarter(year, quarter);
    }

    // Just Q1, Q2, Q3, Q4 (uses current year)
    const quarterOnlyMatch = /^q([1-4])$/.exec(normalized);
    if (quarterOnlyMatch) {
      const quarter = parseInt(quarterOnlyMatch[1]!, 10);
      const year = new Date().getFullYear();
      return this.getDateFromQuarter(year, quarter);
    }

    // "last quarter" / "this quarter" / "next quarter"
    if (normalized === "last quarter") {
      return subQuarters(this.getStartOfCurrentQuarter(), 1);
    }
    if (normalized === "this quarter") {
      return this.getStartOfCurrentQuarter();
    }
    if (normalized === "next quarter") {
      return addMonths(this.getStartOfCurrentQuarter(), 3);
    }

    return null;
  }

  /**
   * Parse yearly-specific formats: 2024
   */
  private tryParseYearlyFormat(normalized: string, _original: string): Date | null {
    // Just a year: 2024
    const yearOnlyMatch = /^(\d{4})$/.exec(normalized);
    if (yearOnlyMatch) {
      const year = parseInt(yearOnlyMatch[1]!, 10);
      // Validate it's a reasonable year
      if (year >= 1900 && year <= 2100) {
        return new Date(year, 0, 1);
      }
    }

    // "last year" / "this year" / "next year"
    if (normalized === "last year") {
      return subYears(startOfYear(new Date()), 1);
    }
    if (normalized === "this year") {
      return startOfYear(new Date());
    }
    if (normalized === "next year") {
      return startOfYear(new Date(new Date().getFullYear() + 1, 0, 1));
    }

    return null;
  }

  /**
   * Get a date from an ISO week number.
   * Returns the Monday of the specified week.
   */
  private getDateFromWeekNumber(year: number, week: number): Date {
    // Start from January 4th which is always in week 1
    const jan4 = new Date(year, 0, 4);
    const startOfFirstWeek = startOfWeek(jan4, { weekStartsOn: 1 });
    return addWeeks(startOfFirstWeek, week - 1);
  }

  /**
   * Get a date from a quarter number.
   * Returns the first day of the specified quarter.
   */
  private getDateFromQuarter(year: number, quarter: number): Date {
    const month = (quarter - 1) * 3;
    return new Date(year, month, 1);
  }

  /**
   * Get the start of the current quarter.
   */
  private getStartOfCurrentQuarter(): Date {
    const now = new Date();
    const currentMonth = now.getMonth();
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    return startOfMonth(new Date(now.getFullYear(), quarterStartMonth, 1));
  }

  /**
   * Parse a date input relative to a custom reference date.
   *
   * Useful for parsing expressions like "yesterday" or "last friday"
   * relative to a date other than the current system time.
   *
   * @param input - String to parse
   * @param referenceDate - The date to use as "now" for relative parsing
   * @returns Parsed Date object
   * @throws Error if the input cannot be parsed
   */
  parseWithReference(input: string, referenceDate: Date): Date {
    const trimmed = input.trim();

    if (trimmed === "") {
      throw new Error("Cannot parse empty string as date");
    }

    // Try ISO date string first (not affected by reference)
    const isoDate = parseISO(trimmed);
    if (isValid(isoDate)) {
      return isoDate;
    }

    // Try natural language parsing with custom reference
    const results = chrono.parse(trimmed, referenceDate);
    const firstResult = results[0];
    if (firstResult) {
      const parsed = firstResult.date();
      if (parsed) {
        return parsed;
      }
    }

    throw new Error(`Unable to parse date: "${input}"`);
  }
}
