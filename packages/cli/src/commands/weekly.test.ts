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

describe("weekly command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { weeklyCommand } = await import("./weekly.js");
    expect(weeklyCommand.description()).toBe("Create or get this week's note");
  });

  it("should have --date option", async () => {
    const { weeklyCommand } = await import("./weekly.js");
    const dateOption = weeklyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'last week', '2024-W05')"
    );
  });

  it("should accept date argument format", async () => {
    const { weeklyCommand } = await import("./weekly.js");
    const dateOption = weeklyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption?.flags).toBe("--date <date>");
  });
});
