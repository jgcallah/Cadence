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

describe("daily command", () => {
  let dailyCommand: Command;

  beforeAll(async () => {
    const module = await import("./daily.js");
    dailyCommand = module.dailyCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(dailyCommand.description()).toBe("Create or get today's daily note");
  });

  it("should have --date option", () => {
    const dateOption = dailyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'yesterday', '2024-01-15')"
    );
  });

  it("should accept date argument format", () => {
    const dateOption = dailyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption?.flags).toBe("--date <date>");
  });
});
