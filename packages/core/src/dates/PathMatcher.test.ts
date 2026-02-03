import { describe, it, expect } from "vitest";
import { PathMatcher } from "./PathMatcher.js";

describe("PathMatcher", () => {
  const matcher = new PathMatcher();

  describe("patternToRegex", () => {
    it("should create regex for daily pattern with nested directories", () => {
      const pattern = "Journal/{year}/Daily/{month}/{date}.md";
      const regex = matcher.patternToRegex(pattern);

      expect(regex.test("Journal/2026/Daily/02/03.md")).toBe(true);
      expect(regex.test("C:/vault/Journal/2026/Daily/02/03.md")).toBe(true);
      expect(regex.test("Journal/2026/Daily/12/31.md")).toBe(true);
    });

    it("should create regex for flat daily pattern", () => {
      const pattern = "Journal/Daily/{year}-{month}-{date}.md";
      const regex = matcher.patternToRegex(pattern);

      expect(regex.test("Journal/Daily/2026-02-03.md")).toBe(true);
      expect(regex.test("vault/Journal/Daily/2026-02-03.md")).toBe(true);
    });

    it("should create regex for weekly pattern", () => {
      const pattern = "Journal/{year}/Weekly/W{week}.md";
      const regex = matcher.patternToRegex(pattern);

      expect(regex.test("Journal/2026/Weekly/W05.md")).toBe(true);
      expect(regex.test("Journal/2026/Weekly/W1.md")).toBe(true);
      expect(regex.test("Journal/2026/Weekly/W52.md")).toBe(true);
    });

    it("should create regex for monthly pattern", () => {
      const pattern = "Journal/{year}/Monthly/{month}.md";
      const regex = matcher.patternToRegex(pattern);

      expect(regex.test("Journal/2026/Monthly/02.md")).toBe(true);
      expect(regex.test("Journal/2026/Monthly/12.md")).toBe(true);
    });

    it("should create regex for quarterly pattern", () => {
      const pattern = "Journal/{year}/Quarterly/Q{quarter}.md";
      const regex = matcher.patternToRegex(pattern);

      expect(regex.test("Journal/2026/Quarterly/Q1.md")).toBe(true);
      expect(regex.test("Journal/2026/Quarterly/Q4.md")).toBe(true);
    });

    it("should create regex for yearly pattern", () => {
      const pattern = "Journal/{year}/{year}.md";
      const regex = matcher.patternToRegex(pattern);

      expect(regex.test("Journal/2026/2026.md")).toBe(true);
    });

    it("should handle Windows backslash paths", () => {
      const pattern = "Journal/{year}/Daily/{month}/{date}.md";
      const regex = matcher.patternToRegex(pattern);

      expect(regex.test("Journal\\2026\\Daily\\02\\03.md")).toBe(true);
      expect(regex.test("C:\\vault\\Journal\\2026\\Daily\\02\\03.md")).toBe(true);
    });

    it("should not match non-conforming paths", () => {
      const pattern = "Journal/{year}/Daily/{month}/{date}.md";
      const regex = matcher.patternToRegex(pattern);

      expect(regex.test("Journal/2026/Daily/02/03.txt")).toBe(false);
      expect(regex.test("Other/2026/Daily/02/03.md")).toBe(false);
    });
  });

  describe("extractDateComponents", () => {
    it("should extract components from nested daily pattern", () => {
      const pattern = "Journal/{year}/Daily/{month}/{date}.md";
      const components = matcher.extractDateComponents(
        "Journal/2026/Daily/02/03.md",
        pattern
      );

      expect(components).toEqual({
        year: 2026,
        month: 2,
        date: 3,
      });
    });

    it("should extract components from flat daily pattern", () => {
      const pattern = "Journal/Daily/{year}-{month}-{date}.md";
      const components = matcher.extractDateComponents(
        "Journal/Daily/2026-02-03.md",
        pattern
      );

      expect(components).toEqual({
        year: 2026,
        month: 2,
        date: 3,
      });
    });

    it("should extract components from weekly pattern", () => {
      const pattern = "Journal/{year}/Weekly/W{week}.md";
      const components = matcher.extractDateComponents(
        "Journal/2026/Weekly/W05.md",
        pattern
      );

      expect(components).toEqual({
        year: 2026,
        week: 5,
      });
    });

    it("should extract components from monthly pattern", () => {
      const pattern = "Journal/{year}/Monthly/{month}.md";
      const components = matcher.extractDateComponents(
        "Journal/2026/Monthly/02.md",
        pattern
      );

      expect(components).toEqual({
        year: 2026,
        month: 2,
      });
    });

    it("should extract components from quarterly pattern", () => {
      const pattern = "Journal/{year}/Quarterly/Q{quarter}.md";
      const components = matcher.extractDateComponents(
        "Journal/2026/Quarterly/Q1.md",
        pattern
      );

      expect(components).toEqual({
        year: 2026,
        quarter: 1,
      });
    });

    it("should extract components from yearly pattern", () => {
      const pattern = "Journal/{year}/{year}.md";
      const components = matcher.extractDateComponents(
        "Journal/2026/2026.md",
        pattern
      );

      expect(components).toEqual({
        year: 2026,
      });
    });

    it("should handle full paths with vault prefix", () => {
      const pattern = "Journal/{year}/Daily/{month}/{date}.md";
      const components = matcher.extractDateComponents(
        "C:/Users/test/vault/Journal/2026/Daily/02/03.md",
        pattern
      );

      expect(components).toEqual({
        year: 2026,
        month: 2,
        date: 3,
      });
    });

    it("should handle Windows backslash paths", () => {
      const pattern = "Journal/{year}/Daily/{month}/{date}.md";
      const components = matcher.extractDateComponents(
        "C:\\Users\\test\\vault\\Journal\\2026\\Daily\\02\\03.md",
        pattern
      );

      expect(components).toEqual({
        year: 2026,
        month: 2,
        date: 3,
      });
    });

    it("should return null for non-matching paths", () => {
      const pattern = "Journal/{year}/Daily/{month}/{date}.md";

      expect(matcher.extractDateComponents("Other/2026/Daily/02/03.md", pattern)).toBeNull();
      expect(matcher.extractDateComponents("Journal/2026/Daily/02/03.txt", pattern)).toBeNull();
      expect(matcher.extractDateComponents("random-file.md", pattern)).toBeNull();
    });
  });

  describe("componentsToDate", () => {
    it("should create date from year/month/date", () => {
      const date = matcher.componentsToDate({ year: 2026, month: 2, date: 3 });

      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(1); // 0-indexed
      expect(date.getDate()).toBe(3);
    });

    it("should create date from year/month (first day of month)", () => {
      const date = matcher.componentsToDate({ year: 2026, month: 6 });

      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(5); // 0-indexed
      expect(date.getDate()).toBe(1);
    });

    it("should create date from year/week (approximate first day)", () => {
      const date = matcher.componentsToDate({ year: 2026, week: 5 });

      expect(date.getFullYear()).toBe(2026);
      // Week 5 starts around late January
      expect(date.getMonth()).toBe(0); // January
    });

    it("should create date from year/quarter (first day of quarter)", () => {
      const dateQ1 = matcher.componentsToDate({ year: 2026, quarter: 1 });
      expect(dateQ1.getMonth()).toBe(0); // January

      const dateQ2 = matcher.componentsToDate({ year: 2026, quarter: 2 });
      expect(dateQ2.getMonth()).toBe(3); // April

      const dateQ3 = matcher.componentsToDate({ year: 2026, quarter: 3 });
      expect(dateQ3.getMonth()).toBe(6); // July

      const dateQ4 = matcher.componentsToDate({ year: 2026, quarter: 4 });
      expect(dateQ4.getMonth()).toBe(9); // October
    });

    it("should create date from year only (Jan 1)", () => {
      const date = matcher.componentsToDate({ year: 2026 });

      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(1);
    });

    it("should throw for empty components", () => {
      expect(() => matcher.componentsToDate({})).toThrow(
        "Cannot convert components to date: insufficient data"
      );
    });
  });

  describe("extractDate", () => {
    it("should extract date from nested daily pattern", () => {
      const pattern = "Journal/{year}/Daily/{month}/{date}.md";
      const date = matcher.extractDate("Journal/2026/Daily/02/03.md", pattern);

      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2026);
      expect(date!.getMonth()).toBe(1);
      expect(date!.getDate()).toBe(3);
    });

    it("should extract date from flat daily pattern", () => {
      const pattern = "Journal/Daily/{year}-{month}-{date}.md";
      const date = matcher.extractDate("Journal/Daily/2026-02-03.md", pattern);

      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2026);
      expect(date!.getMonth()).toBe(1);
      expect(date!.getDate()).toBe(3);
    });

    it("should return null for non-matching paths", () => {
      const pattern = "Journal/{year}/Daily/{month}/{date}.md";
      const date = matcher.extractDate("random-file.md", pattern);

      expect(date).toBeNull();
    });
  });

  describe("formatComponents", () => {
    it("should format daily components as YYYY-MM-DD", () => {
      expect(matcher.formatComponents({ year: 2026, month: 2, date: 3 })).toBe("2026-02-03");
      expect(matcher.formatComponents({ year: 2026, month: 12, date: 31 })).toBe("2026-12-31");
    });

    it("should format monthly components as YYYY-MM", () => {
      expect(matcher.formatComponents({ year: 2026, month: 2 })).toBe("2026-02");
      expect(matcher.formatComponents({ year: 2026, month: 12 })).toBe("2026-12");
    });

    it("should format weekly components as YYYY-Www", () => {
      expect(matcher.formatComponents({ year: 2026, week: 5 })).toBe("2026-W05");
      expect(matcher.formatComponents({ year: 2026, week: 52 })).toBe("2026-W52");
    });

    it("should format quarterly components as YYYY-Qq", () => {
      expect(matcher.formatComponents({ year: 2026, quarter: 1 })).toBe("2026-Q1");
      expect(matcher.formatComponents({ year: 2026, quarter: 4 })).toBe("2026-Q4");
    });

    it("should format yearly components as YYYY", () => {
      expect(matcher.formatComponents({ year: 2026 })).toBe("2026");
    });

    it("should return empty string for empty components", () => {
      expect(matcher.formatComponents({})).toBe("");
    });
  });
});
