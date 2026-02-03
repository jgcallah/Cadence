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

describe("monthly command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { monthlyCommand } = await import("./monthly.js");
    expect(monthlyCommand.description()).toBe("Create or get this month's note");
  });

  it("should have --date option", async () => {
    const { monthlyCommand } = await import("./monthly.js");
    const dateOption = monthlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'last month', '2024-01')"
    );
  });

  it("should accept date argument format", async () => {
    const { monthlyCommand } = await import("./monthly.js");
    const dateOption = monthlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption?.flags).toBe("--date <date>");
  });
});
