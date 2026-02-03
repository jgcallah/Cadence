import { describe, it, expect } from "vitest";
import { PeriodCalculator } from "./PeriodCalculator.js";

// Helper to create dates in local timezone at noon to avoid timezone issues
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe("PeriodCalculator", () => {
  const calculator = new PeriodCalculator();

  describe("getCurrentPeriod - daily", () => {
    it("should return correct period for a daily note", () => {
      const date = localDate(2026, 3, 15);
      const period = calculator.getCurrentPeriod("daily", date);

      expect(period.label).toBe("March 15, 2026");
      expect(period.start.getDate()).toBe(15);
      expect(period.end.getDate()).toBe(15);
    });
  });

  describe("getCurrentPeriod - weekly", () => {
    it("should return correct period for a weekly note", () => {
      const date = localDate(2026, 3, 15); // Sunday, Week 11
      const period = calculator.getCurrentPeriod("weekly", date);

      expect(period.label).toBe("Week 11, 2026");
      // Week should start on Monday and end on Sunday
      expect(period.start.getDay()).toBe(1); // Monday
      expect(period.end.getDay()).toBe(0); // Sunday
    });

    it("should handle week 52 correctly", () => {
      const date = localDate(2025, 12, 29); // Late December 2025
      const period = calculator.getCurrentPeriod("weekly", date);

      expect(period.label).toMatch(/Week \d+, \d{4}/);
      expect(period.start.getDay()).toBe(1); // Monday
    });

    it("should handle week 1 at year boundary", () => {
      // January 1, 2026 is a Thursday, ISO week 1 of 2026
      const date = localDate(2026, 1, 1);
      const period = calculator.getCurrentPeriod("weekly", date);

      expect(period.label).toBe("Week 1, 2026");
    });

    it("should handle week 53 when it exists", () => {
      // 2020 had 53 weeks - December 31, 2020 was Thursday of week 53
      const date = localDate(2020, 12, 31);
      const period = calculator.getCurrentPeriod("weekly", date);

      expect(period.label).toBe("Week 53, 2020");
    });
  });

  describe("getCurrentPeriod - monthly", () => {
    it("should return correct period for a monthly note", () => {
      const date = localDate(2026, 3, 15);
      const period = calculator.getCurrentPeriod("monthly", date);

      expect(period.label).toBe("March 2026");
      expect(period.start.getDate()).toBe(1);
      expect(period.end.getDate()).toBe(31); // March has 31 days
    });

    it("should handle February in a leap year", () => {
      const date = localDate(2024, 2, 15); // 2024 is a leap year
      const period = calculator.getCurrentPeriod("monthly", date);

      expect(period.label).toBe("February 2024");
      expect(period.end.getDate()).toBe(29);
    });

    it("should handle February in a non-leap year", () => {
      const date = localDate(2025, 2, 15);
      const period = calculator.getCurrentPeriod("monthly", date);

      expect(period.label).toBe("February 2025");
      expect(period.end.getDate()).toBe(28);
    });
  });

  describe("getCurrentPeriod - quarterly", () => {
    it("should return correct period for Q1", () => {
      const date = localDate(2026, 2, 15);
      const period = calculator.getCurrentPeriod("quarterly", date);

      expect(period.label).toBe("Q1 2026");
      expect(period.start.getMonth()).toBe(0); // January
      expect(period.end.getMonth()).toBe(2); // March
    });

    it("should return correct period for Q2", () => {
      const date = localDate(2026, 5, 15);
      const period = calculator.getCurrentPeriod("quarterly", date);

      expect(period.label).toBe("Q2 2026");
      expect(period.start.getMonth()).toBe(3); // April
      expect(period.end.getMonth()).toBe(5); // June
    });

    it("should return correct period for Q3", () => {
      const date = localDate(2026, 8, 15);
      const period = calculator.getCurrentPeriod("quarterly", date);

      expect(period.label).toBe("Q3 2026");
      expect(period.start.getMonth()).toBe(6); // July
      expect(period.end.getMonth()).toBe(8); // September
    });

    it("should return correct period for Q4", () => {
      const date = localDate(2026, 11, 15);
      const period = calculator.getCurrentPeriod("quarterly", date);

      expect(period.label).toBe("Q4 2026");
      expect(period.start.getMonth()).toBe(9); // October
      expect(period.end.getMonth()).toBe(11); // December
    });
  });

  describe("getCurrentPeriod - yearly", () => {
    it("should return correct period for a yearly note", () => {
      const date = localDate(2026, 6, 15);
      const period = calculator.getCurrentPeriod("yearly", date);

      expect(period.label).toBe("2026");
      expect(period.start.getMonth()).toBe(0); // January
      expect(period.start.getDate()).toBe(1);
      expect(period.end.getMonth()).toBe(11); // December
      expect(period.end.getDate()).toBe(31);
    });
  });

  describe("getParentType", () => {
    it("should return weekly for daily", () => {
      expect(calculator.getParentType("daily")).toBe("weekly");
    });

    it("should return monthly for weekly", () => {
      expect(calculator.getParentType("weekly")).toBe("monthly");
    });

    it("should return quarterly for monthly", () => {
      expect(calculator.getParentType("monthly")).toBe("quarterly");
    });

    it("should return yearly for quarterly", () => {
      expect(calculator.getParentType("quarterly")).toBe("yearly");
    });

    it("should return null for yearly", () => {
      expect(calculator.getParentType("yearly")).toBeNull();
    });
  });

  describe("getChildType", () => {
    it("should return quarterly for yearly", () => {
      expect(calculator.getChildType("yearly")).toBe("quarterly");
    });

    it("should return monthly for quarterly", () => {
      expect(calculator.getChildType("quarterly")).toBe("monthly");
    });

    it("should return weekly for monthly", () => {
      expect(calculator.getChildType("monthly")).toBe("weekly");
    });

    it("should return daily for weekly", () => {
      expect(calculator.getChildType("weekly")).toBe("daily");
    });

    it("should return null for daily", () => {
      expect(calculator.getChildType("daily")).toBeNull();
    });
  });

  describe("getParentPeriod", () => {
    it("should return weekly period for daily note", () => {
      const date = localDate(2026, 3, 15);
      const parentPeriod = calculator.getParentPeriod("daily", date);

      expect(parentPeriod).not.toBeNull();
      expect(parentPeriod!.label).toBe("Week 11, 2026");
    });

    it("should return monthly period for weekly note", () => {
      const date = localDate(2026, 3, 15);
      const parentPeriod = calculator.getParentPeriod("weekly", date);

      expect(parentPeriod).not.toBeNull();
      expect(parentPeriod!.label).toBe("March 2026");
    });

    it("should return null for yearly note", () => {
      const date = localDate(2026, 3, 15);
      const parentPeriod = calculator.getParentPeriod("yearly", date);

      expect(parentPeriod).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("should handle year boundary - Dec 31 to Jan 1", () => {
      const dec31 = localDate(2025, 12, 31);
      const jan1 = localDate(2026, 1, 1);

      const dec31Period = calculator.getCurrentPeriod("daily", dec31);
      const jan1Period = calculator.getCurrentPeriod("daily", jan1);

      expect(dec31Period.label).toBe("December 31, 2025");
      expect(jan1Period.label).toBe("January 1, 2026");
    });

    it("should handle ISO week year boundary correctly", () => {
      // Dec 29, 2025 is Monday of ISO week 1 of 2026
      const date = localDate(2025, 12, 29);
      const period = calculator.getCurrentPeriod("weekly", date);

      // This date falls in ISO week 1 of 2026, not week 52 of 2025
      expect(period.label).toBe("Week 1, 2026");
    });

    it("should handle last day of month correctly", () => {
      const date = localDate(2026, 1, 31); // January 31
      const period = calculator.getCurrentPeriod("monthly", date);

      expect(period.label).toBe("January 2026");
      expect(period.end.getDate()).toBe(31);
    });

    it("should handle quarter boundaries correctly", () => {
      // Last day of Q1
      const lastDayQ1 = localDate(2026, 3, 31);
      const q1Period = calculator.getCurrentPeriod("quarterly", lastDayQ1);
      expect(q1Period.label).toBe("Q1 2026");

      // First day of Q2
      const firstDayQ2 = localDate(2026, 4, 1);
      const q2Period = calculator.getCurrentPeriod("quarterly", firstDayQ2);
      expect(q2Period.label).toBe("Q2 2026");
    });

    it("should default to current date when no date provided", () => {
      const period = calculator.getCurrentPeriod("daily");

      // Should not throw and should return a valid period
      expect(period.label).toBeDefined();
      expect(period.start).toBeInstanceOf(Date);
      expect(period.end).toBeInstanceOf(Date);
    });
  });
});
