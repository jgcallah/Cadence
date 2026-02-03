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

describe("quarterly command", () => {
  let quarterlyCommand: Command;

  beforeAll(async () => {
    const module = await import("./quarterly.js");
    quarterlyCommand = module.quarterlyCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(quarterlyCommand.description()).toBe("Create or get this quarter's note");
  });

  it("should have --date option", () => {
    const dateOption = quarterlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'last quarter', 'Q1 2024')"
    );
  });

  it("should accept date argument format", () => {
    const dateOption = quarterlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption?.flags).toBe("--date <date>");
  });
});
