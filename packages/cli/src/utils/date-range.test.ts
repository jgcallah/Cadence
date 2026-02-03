import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseRange, getNotesInRange } from "./date-range.js";
import { DateParser } from "@cadence/core";

describe("date-range utilities", () => {
  let dateParser: DateParser;
  const fixedDate = new Date("2026-02-02T12:00:00.000Z");

  beforeEach(() => {
    dateParser = new DateParser();
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("parseRange", () => {
    describe("'last N <unit>' format", () => {
      it("should parse 'last 3 months'", () => {
        const { start, end } = parseRange("last 3 months", "monthly", dateParser);
        expect(start.getMonth()).toBe(10); // November 2025
        expect(start.getFullYear()).toBe(2025);
        expect(end.getMonth()).toBe(1); // February 2026
      });

      it("should parse 'last week'", () => {
        const { start, end: _end } = parseRange("last week", "weekly", dateParser);
        expect(start.getDate()).toBe(26); // January 26, 2026
        expect(start.getMonth()).toBe(0);
      });

      it("should parse 'last 7 days'", () => {
        const { start, end: _end } = parseRange("last 7 days", "daily", dateParser);
        expect(start.getDate()).toBe(26); // January 26, 2026
        expect(start.getMonth()).toBe(0);
      });

      it("should parse 'last 2 quarters'", () => {
        const { start, end: _end } = parseRange("last 2 quarters", "quarterly", dateParser);
        expect(start.getMonth()).toBe(7); // August 2025
        expect(start.getFullYear()).toBe(2025);
      });

      it("should parse 'last year'", () => {
        const { start, end: _end } = parseRange("last year", "yearly", dateParser);
        expect(start.getFullYear()).toBe(2025);
      });

      it("should parse 'last 5 years'", () => {
        const { start, end: _end } = parseRange("last 5 years", "yearly", dateParser);
        expect(start.getFullYear()).toBe(2021);
      });
    });

    describe("singular unit format", () => {
      it("should parse 'last month' as 1 month", () => {
        const { start, end: _end } = parseRange("last month", "monthly", dateParser);
        expect(start.getMonth()).toBe(0); // January 2026
        expect(start.getFullYear()).toBe(2026);
      });

      it("should parse 'last day' as 1 day", () => {
        const { start, end: _end } = parseRange("last day", "daily", dateParser);
        expect(start.getDate()).toBe(1); // February 1, 2026
      });
    });

    describe("date range with 'to' separator", () => {
      it("should parse '2024-01 to 2024-06' for monthly", () => {
        const { start, end } = parseRange("2024-01 to 2024-06", "monthly", dateParser);
        expect(start.getFullYear()).toBe(2024);
        expect(start.getMonth()).toBe(0); // January
        expect(end.getFullYear()).toBe(2024);
        expect(end.getMonth()).toBe(5); // June
      });

      it("should parse 'Q1 2024 to Q3 2024' for quarterly", () => {
        const { start, end } = parseRange("Q1 2024 to Q3 2024", "quarterly", dateParser);
        expect(start.getMonth()).toBe(0); // January
        expect(end.getMonth()).toBe(6); // July (start of Q3)
      });
    });

    describe("single period format", () => {
      it("should parse '2024-01' for monthly as the whole month", () => {
        const { start, end } = parseRange("2024-01", "monthly", dateParser);
        expect(start.getFullYear()).toBe(2024);
        expect(start.getMonth()).toBe(0);
        expect(start.getDate()).toBe(1);
        expect(end.getDate()).toBe(31);
      });

      it("should parse 'Q1 2024' for quarterly", () => {
        const { start, end } = parseRange("Q1 2024", "quarterly", dateParser);
        expect(start.getMonth()).toBe(0); // January
        expect(end.getMonth()).toBe(2); // March
      });
    });

    describe("error handling", () => {
      it("should throw for invalid range format", () => {
        expect(() =>
          parseRange("not a valid range", "daily", dateParser)
        ).toThrow(/Unable to parse range/);
      });
    });
  });

  describe("getNotesInRange", () => {
    describe("daily notes", () => {
      it("should return all days in range", () => {
        const start = new Date(2026, 0, 1); // Jan 1
        const end = new Date(2026, 0, 7); // Jan 7
        const dates = getNotesInRange("daily", start, end);
        expect(dates.length).toBe(7);
        expect(dates[0]?.getDate()).toBe(1);
        expect(dates[6]?.getDate()).toBe(7);
      });
    });

    describe("weekly notes", () => {
      it("should return start of each week in range", () => {
        const start = new Date(2026, 0, 1); // Jan 1 (Thursday)
        const end = new Date(2026, 0, 31); // Jan 31
        const dates = getNotesInRange("weekly", start, end);
        expect(dates.length).toBeGreaterThanOrEqual(4);
        // All dates should be Mondays (weekStartsOn: 1)
        dates.forEach((date) => {
          expect(date.getDay()).toBe(1);
        });
      });
    });

    describe("monthly notes", () => {
      it("should return start of each month in range", () => {
        const start = new Date(2025, 0, 1); // Jan 2025
        const end = new Date(2025, 11, 31); // Dec 2025
        const dates = getNotesInRange("monthly", start, end);
        expect(dates.length).toBe(12);
        dates.forEach((date, index) => {
          expect(date.getMonth()).toBe(index);
          expect(date.getDate()).toBe(1);
        });
      });
    });

    describe("quarterly notes", () => {
      it("should return start of each quarter in range", () => {
        const start = new Date(2025, 0, 1); // Q1 2025
        const end = new Date(2025, 11, 31); // Q4 2025
        const dates = getNotesInRange("quarterly", start, end);
        expect(dates.length).toBe(4);
        expect(dates[0]?.getMonth()).toBe(0); // Q1: January
        expect(dates[1]?.getMonth()).toBe(3); // Q2: April
        expect(dates[2]?.getMonth()).toBe(6); // Q3: July
        expect(dates[3]?.getMonth()).toBe(9); // Q4: October
      });
    });

    describe("yearly notes", () => {
      it("should return start of each year in range", () => {
        const start = new Date(2020, 0, 1);
        const end = new Date(2025, 11, 31);
        const dates = getNotesInRange("yearly", start, end);
        expect(dates.length).toBe(6);
        dates.forEach((date, index) => {
          expect(date.getFullYear()).toBe(2020 + index);
          expect(date.getMonth()).toBe(0);
          expect(date.getDate()).toBe(1);
        });
      });
    });
  });
});
