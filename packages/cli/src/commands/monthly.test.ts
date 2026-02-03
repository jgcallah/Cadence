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

describe("monthly command", () => {
  let monthlyCommand: Command;

  beforeAll(async () => {
    const module = await import("./monthly.js");
    monthlyCommand = module.monthlyCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(monthlyCommand.description()).toBe("Create or get this month's note");
  });

  it("should have --date option", () => {
    const dateOption = monthlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'last month', '2024-01')"
    );
  });

  it("should accept date argument format", () => {
    const dateOption = monthlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption?.flags).toBe("--date <date>");
  });
});
