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

describe("yearly command", () => {
  let yearlyCommand: Command;

  beforeAll(async () => {
    const module = await import("./yearly.js");
    yearlyCommand = module.yearlyCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(yearlyCommand.description()).toBe("Create or get this year's note");
  });

  it("should have --date option", () => {
    const dateOption = yearlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'last year', '2024')"
    );
  });

  it("should accept date argument format", () => {
    const dateOption = yearlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption?.flags).toBe("--date <date>");
  });
});
