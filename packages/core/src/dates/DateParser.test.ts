import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { DateParser } from "./DateParser.js";

describe("DateParser", () => {
  let parser: DateParser;
  const fixedDate = new Date("2026-02-02T12:00:00.000Z");

  beforeEach(() => {
    parser = new DateParser();
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("parse", () => {
    describe("Date object input", () => {
      it("should return the same Date when given a Date object", () => {
        const input = new Date("2026-01-15T10:30:00.000Z");
        const result = parser.parse(input);
        expect(result).toEqual(input);
      });

      it("should handle Date objects at midnight", () => {
        const input = new Date("2026-01-01T00:00:00.000Z");
        const result = parser.parse(input);
        expect(result).toEqual(input);
      });

      it("should handle Date objects at end of day", () => {
        const input = new Date("2026-12-31T23:59:59.999Z");
        const result = parser.parse(input);
        expect(result).toEqual(input);
      });
    });

    describe("ISO date string input", () => {
      it("should parse ISO date string YYYY-MM-DD", () => {
        const result = parser.parse("2026-03-15");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(2); // March (0-indexed)
        expect(result.getDate()).toBe(15);
      });

      it("should parse ISO datetime string", () => {
        const result = parser.parse("2026-06-20T14:30:00.000Z");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(5); // June
        expect(result.getDate()).toBe(20);
      });

      it("should parse date at year boundary", () => {
        const result = parser.parse("2025-12-31");
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(11);
        expect(result.getDate()).toBe(31);
      });

      it("should parse leap year date", () => {
        const result = parser.parse("2024-02-29");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(29);
      });
    });

    describe("natural language: today, yesterday, tomorrow", () => {
      it("should parse 'today'", () => {
        const result = parser.parse("today");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(2);
      });

      it("should parse 'yesterday'", () => {
        const result = parser.parse("yesterday");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(1);
      });

      it("should parse 'tomorrow'", () => {
        const result = parser.parse("tomorrow");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(3);
      });

      it("should be case insensitive for 'Today'", () => {
        const result = parser.parse("Today");
        expect(result.getDate()).toBe(2);
      });

      it("should be case insensitive for 'YESTERDAY'", () => {
        const result = parser.parse("YESTERDAY");
        expect(result.getDate()).toBe(1);
      });
    });

    describe("natural language: relative days", () => {
      it("should parse '3 days ago'", () => {
        const result = parser.parse("3 days ago");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(30);
      });

      it("should parse '1 day ago'", () => {
        const result = parser.parse("1 day ago");
        expect(result.getDate()).toBe(1);
      });

      it("should parse '7 days ago'", () => {
        const result = parser.parse("7 days ago");
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(26);
      });

      it("should parse 'in 2 days'", () => {
        const result = parser.parse("in 2 days");
        expect(result.getDate()).toBe(4);
      });

      it("should parse 'in 5 days'", () => {
        const result = parser.parse("in 5 days");
        expect(result.getDate()).toBe(7);
      });
    });

    describe("natural language: relative weeks", () => {
      it("should parse 'in 2 weeks'", () => {
        const result = parser.parse("in 2 weeks");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(16);
      });

      it("should parse '1 week ago'", () => {
        const result = parser.parse("1 week ago");
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(26);
      });

      it("should parse '3 weeks ago'", () => {
        const result = parser.parse("3 weeks ago");
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(12);
      });
    });

    describe("natural language: weekdays", () => {
      // Feb 2, 2026 is a Monday
      it("should parse 'last friday'", () => {
        const result = parser.parse("last friday");
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(30); // Friday Jan 30
      });

      it("should parse 'last monday'", () => {
        const result = parser.parse("last monday");
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(26);
      });

      it("should parse 'next tuesday'", () => {
        const result = parser.parse("next tuesday");
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(10);
      });

      it("should parse 'next sunday'", () => {
        // chrono-node interprets "next sunday" as the sunday after this week's sunday
        const result = parser.parse("next sunday");
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(15); // Feb 15, 2026
      });

      it("should parse 'last wednesday'", () => {
        const result = parser.parse("last wednesday");
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(28);
      });

      it("should be case insensitive for weekdays", () => {
        const result = parser.parse("Last Friday");
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(30);
      });
    });

    describe("edge cases", () => {
      it("should throw error for invalid date string", () => {
        expect(() => parser.parse("not a date")).toThrow();
      });

      it("should throw error for empty string", () => {
        expect(() => parser.parse("")).toThrow();
      });

      it("should throw error for gibberish", () => {
        expect(() => parser.parse("asdfghjkl")).toThrow();
      });

      it("should handle whitespace around input", () => {
        const result = parser.parse("  today  ");
        expect(result.getDate()).toBe(2);
      });
    });

    describe("year boundary handling", () => {
      it("should correctly cross year boundary going backwards", () => {
        // Set to Jan 1, 2026
        vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));

        const result = parser.parse("yesterday");
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(11); // December
        expect(result.getDate()).toBe(31);
      });

      it("should correctly cross year boundary going forwards", () => {
        // Set to Dec 31, 2025
        vi.setSystemTime(new Date("2025-12-31T12:00:00.000Z"));

        const result = parser.parse("tomorrow");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(1);
      });

      it("should handle '5 days ago' at start of January", () => {
        vi.setSystemTime(new Date("2026-01-03T12:00:00.000Z"));

        const result = parser.parse("5 days ago");
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(11);
        expect(result.getDate()).toBe(29);
      });
    });

    describe("DST transition handling", () => {
      it("should handle spring forward DST transition", () => {
        // March 8, 2026 is DST transition in US
        vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));

        const result = parser.parse("yesterday");
        expect(result.getMonth()).toBe(2); // March
        expect(result.getDate()).toBe(8);
      });

      it("should handle fall back DST transition", () => {
        // November 1, 2026 is DST transition in US
        vi.setSystemTime(new Date("2026-11-02T12:00:00.000Z"));

        const result = parser.parse("yesterday");
        expect(result.getMonth()).toBe(10); // November
        expect(result.getDate()).toBe(1);
      });
    });
  });

  describe("parseWithReference", () => {
    it("should parse relative to a custom reference date", () => {
      const reference = new Date("2025-06-15T12:00:00.000Z");
      const result = parser.parseWithReference("yesterday", reference);
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(5); // June
      expect(result.getDate()).toBe(14);
    });

    it("should parse tomorrow relative to reference", () => {
      const reference = new Date("2025-12-31T12:00:00.000Z");
      const result = parser.parseWithReference("tomorrow", reference);
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(1);
    });
  });

  describe("parseForType", () => {
    describe("weekly type", () => {
      it("should parse ISO week format '2024-W05'", () => {
        const result = parser.parseForType("2024-W05", "weekly");
        expect(result.getFullYear()).toBe(2024);
        // Week 5 of 2024 starts on January 29 (Monday)
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(29);
      });

      it("should parse lowercase ISO week format '2024-w05'", () => {
        const result = parser.parseForType("2024-w05", "weekly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(29);
      });

      it("should parse short week format 'W05' using current year", () => {
        const result = parser.parseForType("W05", "weekly");
        expect(result.getFullYear()).toBe(2026);
        // Week 5 of 2026 starts on January 26 (Monday)
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(26);
      });

      it("should parse 'week 5' format", () => {
        const result = parser.parseForType("week 5", "weekly");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(26);
      });

      it("should fall back to chrono for 'last week'", () => {
        const result = parser.parseForType("last week", "weekly");
        // Should be parsed by chrono-node
        expect(result.getMonth()).toBe(0); // January
      });

      it("should handle single-digit week numbers", () => {
        const result = parser.parseForType("2024-W1", "weekly");
        expect(result.getFullYear()).toBe(2024);
        // Week 1 of 2024 starts on January 1 (Monday)
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(1);
      });
    });

    describe("monthly type", () => {
      it("should parse YYYY-MM format '2024-01'", () => {
        const result = parser.parseForType("2024-01", "monthly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(1);
      });

      it("should parse YYYY-MM format '2024-12'", () => {
        const result = parser.parseForType("2024-12", "monthly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(11); // December
        expect(result.getDate()).toBe(1);
      });

      it("should fall back to chrono for 'January 2024'", () => {
        const result = parser.parseForType("January 2024", "monthly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(0);
      });

      it("should fall back to chrono for 'last month'", () => {
        const result = parser.parseForType("last month", "monthly");
        expect(result.getMonth()).toBe(0); // January (previous month from Feb 2)
      });
    });

    describe("quarterly type", () => {
      it("should parse 'Q1 2024' format", () => {
        const result = parser.parseForType("Q1 2024", "quarterly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(1);
      });

      it("should parse 'Q2 2024' format", () => {
        const result = parser.parseForType("Q2 2024", "quarterly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(3); // April
        expect(result.getDate()).toBe(1);
      });

      it("should parse 'Q3 2024' format", () => {
        const result = parser.parseForType("Q3 2024", "quarterly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(6); // July
      });

      it("should parse 'Q4 2024' format", () => {
        const result = parser.parseForType("Q4 2024", "quarterly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(9); // October
      });

      it("should parse '2024-Q1' format", () => {
        const result = parser.parseForType("2024-Q1", "quarterly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(0);
      });

      it("should parse '2024 Q2' format", () => {
        const result = parser.parseForType("2024 Q2", "quarterly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(3);
      });

      it("should parse 'Q1' with current year", () => {
        const result = parser.parseForType("Q1", "quarterly");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(0);
      });

      it("should parse 'last quarter'", () => {
        // Current date is Feb 2, 2026 (Q1), so last quarter is Q4 2025
        const result = parser.parseForType("last quarter", "quarterly");
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(9); // October (Q4)
      });

      it("should parse 'this quarter'", () => {
        const result = parser.parseForType("this quarter", "quarterly");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(0); // January (Q1)
      });

      it("should parse 'next quarter'", () => {
        const result = parser.parseForType("next quarter", "quarterly");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(3); // April (Q2)
      });

      it("should be case insensitive for quarter format", () => {
        const result = parser.parseForType("q2 2024", "quarterly");
        expect(result.getMonth()).toBe(3);
      });
    });

    describe("yearly type", () => {
      it("should parse '2024' as January 1, 2024", () => {
        const result = parser.parseForType("2024", "yearly");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(1);
      });

      it("should parse '2025'", () => {
        const result = parser.parseForType("2025", "yearly");
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(1);
      });

      it("should parse 'last year'", () => {
        const result = parser.parseForType("last year", "yearly");
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(1);
      });

      it("should parse 'this year'", () => {
        const result = parser.parseForType("this year", "yearly");
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(0);
      });

      it("should parse 'next year'", () => {
        const result = parser.parseForType("next year", "yearly");
        expect(result.getFullYear()).toBe(2027);
        expect(result.getMonth()).toBe(0);
      });
    });

    describe("daily type (fallback)", () => {
      it("should fall back to standard parse for daily type", () => {
        const result = parser.parseForType("yesterday", "daily");
        expect(result.getDate()).toBe(1); // Feb 1
      });

      it("should parse ISO date for daily type", () => {
        const result = parser.parseForType("2024-03-15", "daily");
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(2); // March
        expect(result.getDate()).toBe(15);
      });
    });

    describe("error handling", () => {
      it("should throw for empty string", () => {
        expect(() => parser.parseForType("", "weekly")).toThrow(
          "Cannot parse empty string as date"
        );
      });

      it("should throw for unparseable input", () => {
        expect(() => parser.parseForType("not a date", "weekly")).toThrow(
          /Unable to parse date/
        );
      });
    });
  });
});
