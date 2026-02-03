import { describe, it, expect, beforeEach } from "vitest";
import { PathGenerator } from "./PathGenerator.js";

// Helper to create dates in local timezone at noon to avoid timezone issues
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe("PathGenerator", () => {
  let generator: PathGenerator;

  beforeEach(() => {
    generator = new PathGenerator();
  });

  describe("generatePath", () => {
    describe("basic variable substitution", () => {
      it("should replace {year} with 4-digit year", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath("Journal/{year}/notes.md", date);
        expect(result).toBe("Journal/2026/notes.md");
      });

      it("should replace {month} with 2-digit month", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath("Journal/{month}/notes.md", date);
        expect(result).toBe("Journal/03/notes.md");
      });

      it("should replace {date} with 2-digit day of month", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath("Journal/{date}/notes.md", date);
        expect(result).toBe("Journal/15/notes.md");
      });

      it("should replace {day} with day name", () => {
        const date = localDate(2026, 2, 2); // Monday Feb 2, 2026
        const result = generator.generatePath("Journal/{day}/notes.md", date);
        expect(result).toBe("Journal/Monday/notes.md");
      });

      it("should replace {week} with ISO week number", () => {
        const date = localDate(2026, 2, 2);
        const result = generator.generatePath("Journal/{week}/notes.md", date);
        expect(result).toBe("Journal/06/notes.md");
      });

      it("should replace {quarter} with quarter number", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath("Journal/{quarter}/notes.md", date);
        expect(result).toBe("Journal/1/notes.md");
      });
    });

    describe("multiple variables", () => {
      it("should replace multiple different variables", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath(
          "Journal/{year}/{month}/{date}.md",
          date
        );
        expect(result).toBe("Journal/2026/03/15.md");
      });

      it("should replace same variable multiple times", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath(
          "{year}-{month}-{date}_{year}.md",
          date
        );
        expect(result).toBe("2026-03-15_2026.md");
      });

      it("should handle complex path with all variables", () => {
        const date = localDate(2026, 3, 15); // Sunday
        const result = generator.generatePath(
          "Notes/{year}/Q{quarter}/W{week}/{month}-{date}-{day}.md",
          date
        );
        expect(result).toBe("Notes/2026/Q1/W11/03-15-Sunday.md");
      });
    });

    describe("quarter calculations", () => {
      it("should return Q1 for January", () => {
        const date = localDate(2026, 1, 15);
        const result = generator.generatePath("{quarter}", date);
        expect(result).toBe("1");
      });

      it("should return Q1 for February", () => {
        const date = localDate(2026, 2, 15);
        const result = generator.generatePath("{quarter}", date);
        expect(result).toBe("1");
      });

      it("should return Q1 for March", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath("{quarter}", date);
        expect(result).toBe("1");
      });

      it("should return Q2 for April", () => {
        const date = localDate(2026, 4, 15);
        const result = generator.generatePath("{quarter}", date);
        expect(result).toBe("2");
      });

      it("should return Q2 for June", () => {
        const date = localDate(2026, 6, 15);
        const result = generator.generatePath("{quarter}", date);
        expect(result).toBe("2");
      });

      it("should return Q3 for July", () => {
        const date = localDate(2026, 7, 15);
        const result = generator.generatePath("{quarter}", date);
        expect(result).toBe("3");
      });

      it("should return Q3 for September", () => {
        const date = localDate(2026, 9, 15);
        const result = generator.generatePath("{quarter}", date);
        expect(result).toBe("3");
      });

      it("should return Q4 for October", () => {
        const date = localDate(2026, 10, 15);
        const result = generator.generatePath("{quarter}", date);
        expect(result).toBe("4");
      });

      it("should return Q4 for December", () => {
        const date = localDate(2026, 12, 15);
        const result = generator.generatePath("{quarter}", date);
        expect(result).toBe("4");
      });
    });

    describe("ISO week number calculations", () => {
      it("should handle first week of year", () => {
        // Jan 1, 2026 is Thursday - week 1 of 2026
        const date = localDate(2026, 1, 1);
        const result = generator.generatePath("{week}", date);
        expect(result).toBe("01");
      });

      it("should handle last week of year", () => {
        // Dec 31, 2026 is Thursday - week 53 of 2026
        const date = localDate(2026, 12, 31);
        const result = generator.generatePath("{week}", date);
        expect(result).toBe("53");
      });

      it("should handle week crossing year boundary (week belongs to previous year)", () => {
        // Jan 1, 2025 is Wednesday - still week 1 of 2025
        const date = localDate(2025, 1, 1);
        const result = generator.generatePath("{week}", date);
        expect(result).toBe("01");
      });

      it("should handle week 53", () => {
        // Some years have 53 weeks
        // Dec 28, 2026 is Monday - week 53
        const date = localDate(2026, 12, 28);
        const result = generator.generatePath("{week}", date);
        expect(result).toBe("53");
      });

      it("should handle mid-year week correctly", () => {
        // July 15, 2026 is Wednesday
        const date = localDate(2026, 7, 15);
        const result = generator.generatePath("{week}", date);
        expect(result).toBe("29");
      });
    });

    describe("year boundary edge cases", () => {
      it("should handle Dec 31 correctly", () => {
        const date = localDate(2025, 12, 31);
        const result = generator.generatePath("{year}-{month}-{date}", date);
        expect(result).toBe("2025-12-31");
      });

      it("should handle Jan 1 correctly", () => {
        const date = localDate(2026, 1, 1);
        const result = generator.generatePath("{year}-{month}-{date}", date);
        expect(result).toBe("2026-01-01");
      });

      it("should handle leap year Feb 29", () => {
        const date = localDate(2024, 2, 29);
        const result = generator.generatePath("{year}-{month}-{date}", date);
        expect(result).toBe("2024-02-29");
      });
    });

    describe("day name formatting", () => {
      it("should return Monday for Monday", () => {
        const date = localDate(2026, 2, 2); // Monday
        const result = generator.generatePath("{day}", date);
        expect(result).toBe("Monday");
      });

      it("should return Tuesday for Tuesday", () => {
        const date = localDate(2026, 2, 3); // Tuesday
        const result = generator.generatePath("{day}", date);
        expect(result).toBe("Tuesday");
      });

      it("should return Wednesday for Wednesday", () => {
        const date = localDate(2026, 2, 4); // Wednesday
        const result = generator.generatePath("{day}", date);
        expect(result).toBe("Wednesday");
      });

      it("should return Thursday for Thursday", () => {
        const date = localDate(2026, 2, 5); // Thursday
        const result = generator.generatePath("{day}", date);
        expect(result).toBe("Thursday");
      });

      it("should return Friday for Friday", () => {
        const date = localDate(2026, 2, 6); // Friday
        const result = generator.generatePath("{day}", date);
        expect(result).toBe("Friday");
      });

      it("should return Saturday for Saturday", () => {
        const date = localDate(2026, 2, 7); // Saturday
        const result = generator.generatePath("{day}", date);
        expect(result).toBe("Saturday");
      });

      it("should return Sunday for Sunday", () => {
        const date = localDate(2026, 2, 8); // Sunday
        const result = generator.generatePath("{day}", date);
        expect(result).toBe("Sunday");
      });
    });

    describe("templates without variables", () => {
      it("should return template unchanged if no variables", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath("static/path/file.md", date);
        expect(result).toBe("static/path/file.md");
      });

      it("should handle empty template", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath("", date);
        expect(result).toBe("");
      });
    });

    describe("unknown variables", () => {
      it("should leave unknown variables unchanged", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath("{unknown}/notes.md", date);
        expect(result).toBe("{unknown}/notes.md");
      });

      it("should replace known variables and leave unknown ones", () => {
        const date = localDate(2026, 3, 15);
        const result = generator.generatePath("{year}/{unknown}/notes.md", date);
        expect(result).toBe("2026/{unknown}/notes.md");
      });
    });

    describe("zero padding", () => {
      it("should zero-pad single digit months", () => {
        const date = localDate(2026, 1, 15);
        const result = generator.generatePath("{month}", date);
        expect(result).toBe("01");
      });

      it("should zero-pad single digit dates", () => {
        const date = localDate(2026, 3, 5);
        const result = generator.generatePath("{date}", date);
        expect(result).toBe("05");
      });

      it("should zero-pad single digit weeks", () => {
        const date = localDate(2026, 1, 5);
        const result = generator.generatePath("{week}", date);
        expect(result).toBe("02");
      });

      it("should not add extra zero for double digit values", () => {
        const date = localDate(2026, 12, 25);
        const result = generator.generatePath("{month}-{date}", date);
        expect(result).toBe("12-25");
      });
    });
  });

  describe("getAvailableVariables", () => {
    it("should return list of all available variables", () => {
      const variables = generator.getAvailableVariables();
      expect(variables).toContain("year");
      expect(variables).toContain("month");
      expect(variables).toContain("date");
      expect(variables).toContain("week");
      expect(variables).toContain("quarter");
      expect(variables).toContain("day");
    });
  });
});
