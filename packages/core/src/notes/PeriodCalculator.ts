import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  getISOWeek,
  getISOWeekYear,
  getQuarter,
  format,
} from "date-fns";
import type { NoteType, PeriodInfo } from "./types.js";

/**
 * Calculates period information for different note types.
 * Uses ISO week numbering for consistent week calculations.
 */
export class PeriodCalculator {
  /**
   * Gets the period information for a given note type and date.
   *
   * @param type - The type of note (daily, weekly, monthly, quarterly, yearly)
   * @param date - The date to calculate the period for
   * @returns PeriodInfo with start date, end date, and human-readable label
   */
  getCurrentPeriod(type: NoteType, date: Date = new Date()): PeriodInfo {
    switch (type) {
      case "daily":
        return this.getDailyPeriod(date);
      case "weekly":
        return this.getWeeklyPeriod(date);
      case "monthly":
        return this.getMonthlyPeriod(date);
      case "quarterly":
        return this.getQuarterlyPeriod(date);
      case "yearly":
        return this.getYearlyPeriod(date);
      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unknown note type: ${String(_exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Gets the parent note type for a given note type.
   * Returns null for yearly notes (top of hierarchy).
   */
  getParentType(type: NoteType): NoteType | null {
    switch (type) {
      case "daily":
        return "weekly";
      case "weekly":
        return "monthly";
      case "monthly":
        return "quarterly";
      case "quarterly":
        return "yearly";
      case "yearly":
        return null;
      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unknown note type: ${String(_exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Gets the child note type for a given note type.
   * Returns null for daily notes (bottom of hierarchy).
   */
  getChildType(type: NoteType): NoteType | null {
    switch (type) {
      case "yearly":
        return "quarterly";
      case "quarterly":
        return "monthly";
      case "monthly":
        return "weekly";
      case "weekly":
        return "daily";
      case "daily":
        return null;
      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unknown note type: ${String(_exhaustiveCheck)}`);
      }
    }
  }

  /**
   * Gets the parent period for a given date and note type.
   * Useful for getting the period that a note belongs to in the hierarchy.
   */
  getParentPeriod(type: NoteType, date: Date): PeriodInfo | null {
    const parentType = this.getParentType(type);
    if (!parentType) {
      return null;
    }
    return this.getCurrentPeriod(parentType, date);
  }

  private getDailyPeriod(date: Date): PeriodInfo {
    return {
      start: startOfDay(date),
      end: endOfDay(date),
      label: format(date, "MMMM d, yyyy"),
    };
  }

  private getWeeklyPeriod(date: Date): PeriodInfo {
    // Use ISO week (Monday as first day)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    const weekNum = getISOWeek(date);
    const year = getISOWeekYear(date);

    return {
      start: weekStart,
      end: weekEnd,
      label: `Week ${weekNum}, ${year}`,
    };
  }

  private getMonthlyPeriod(date: Date): PeriodInfo {
    return {
      start: startOfMonth(date),
      end: endOfMonth(date),
      label: format(date, "MMMM yyyy"),
    };
  }

  private getQuarterlyPeriod(date: Date): PeriodInfo {
    const quarter = getQuarter(date);
    const year = date.getFullYear();

    return {
      start: startOfQuarter(date),
      end: endOfQuarter(date),
      label: `Q${quarter} ${year}`,
    };
  }

  private getYearlyPeriod(date: Date): PeriodInfo {
    const year = date.getFullYear();

    return {
      start: startOfYear(date),
      end: endOfYear(date),
      label: `${year}`,
    };
  }
}
