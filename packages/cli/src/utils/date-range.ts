import type { DateParser} from "@cadence/core";
import type { NoteType } from "@cadence/core";
import {
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
} from "date-fns";

/**
 * Parse a date range string into start and end dates.
 *
 * Supports formats like:
 * - "last 3 months"
 * - "last week"
 * - "last 2 years"
 * - "last 30 days"
 */
export function parseRange(
  range: string,
  noteType: NoteType,
  dateParser: DateParser
): { start: Date; end: Date } {
  const normalized = range.toLowerCase().trim();
  const now = new Date();
  const end = now;

  // Match "last N <unit>" or "last <unit>"
  const lastNMatch = /^last\s+(\d+)?\s*(days?|weeks?|months?|quarters?|years?)$/.exec(normalized);

  if (lastNMatch) {
    const count = lastNMatch[1] ? parseInt(lastNMatch[1], 10) : 1;
    const unit = lastNMatch[2]!.replace(/s$/, ""); // Remove plural

    let start: Date;
    switch (unit) {
      case "day":
        start = subDays(now, count);
        break;
      case "week":
        start = subWeeks(now, count);
        break;
      case "month":
        start = subMonths(now, count);
        break;
      case "quarter":
        start = subQuarters(now, count);
        break;
      case "year":
        start = subYears(now, count);
        break;
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }

    return { start, end };
  }

  // Try to parse as a date range with "to" separator
  if (normalized.includes(" to ")) {
    const [startStr, endStr] = normalized.split(" to ").map((s) => s.trim());
    if (startStr && endStr) {
      return {
        start: dateParser.parseForType(startStr, noteType),
        end: dateParser.parseForType(endStr, noteType),
      };
    }
  }

  // Try to parse as a single date (use that date as both start and end for that period)
  try {
    const date = dateParser.parseForType(normalized, noteType);
    const { start, end: periodEnd } = getPeriodBounds(noteType, date);
    return { start, end: periodEnd };
  } catch {
    throw new Error(
      `Unable to parse range: "${range}". Try formats like "last 3 months" or "2024-01 to 2024-03".`
    );
  }
}

/**
 * Get the start and end dates for a period containing the given date.
 */
function getPeriodBounds(
  type: NoteType,
  date: Date
): { start: Date; end: Date } {
  switch (type) {
    case "daily":
      return { start: date, end: date };
    case "weekly": {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      return {
        start: weekStart,
        end: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
      };
    }
    case "monthly": {
      const monthStart = startOfMonth(date);
      const monthEnd = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0
      );
      return { start: monthStart, end: monthEnd };
    }
    case "quarterly": {
      const quarterStart = startOfQuarter(date);
      const quarterEnd = new Date(
        quarterStart.getFullYear(),
        quarterStart.getMonth() + 3,
        0
      );
      return { start: quarterStart, end: quarterEnd };
    }
    case "yearly":
      return {
        start: startOfYear(date),
        end: new Date(date.getFullYear(), 11, 31),
      };
  }
}

/**
 * Get all dates in a range for a specific note type.
 */
export function getNotesInRange(
  type: NoteType,
  start: Date,
  end: Date
): Date[] {
  switch (type) {
    case "daily":
      return eachDayOfInterval({ start, end });
    case "weekly":
      return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    case "monthly":
      return eachMonthOfInterval({ start, end });
    case "quarterly": {
      // Get the start of each quarter in the range
      const quarters: Date[] = [];
      let current = startOfQuarter(start);
      while (current <= end) {
        quarters.push(new Date(current));
        current = new Date(
          current.getFullYear(),
          current.getMonth() + 3,
          1
        );
      }
      return quarters;
    }
    case "yearly": {
      // Get the start of each year in the range
      const years: Date[] = [];
      for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
        years.push(new Date(year, 0, 1));
      }
      return years;
    }
  }
}
