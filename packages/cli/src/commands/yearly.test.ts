import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    green: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
  },
}));

describe("yearly command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { yearlyCommand } = await import("./yearly.js");
    expect(yearlyCommand.description()).toBe("Create or get this year's note");
  });

  it("should have --date option", async () => {
    const { yearlyCommand } = await import("./yearly.js");
    const dateOption = yearlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'last year', '2024')"
    );
  });

  it("should accept date argument format", async () => {
    const { yearlyCommand } = await import("./yearly.js");
    const dateOption = yearlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption?.flags).toBe("--date <date>");
  });
});
