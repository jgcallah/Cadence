import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from "vitest";
import type { Command } from "commander";

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
  let weeklyCommand: Command;

  beforeAll(async () => {
    const module = await import("./weekly.js");
    weeklyCommand = module.weeklyCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(weeklyCommand.description()).toBe("Create or get this week's note");
  });

  it("should have --date option", () => {
    const dateOption = weeklyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'last week', '2024-W05')"
    );
  });

  it("should accept date argument format", () => {
    const dateOption = weeklyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption?.flags).toBe("--date <date>");
  });
});
