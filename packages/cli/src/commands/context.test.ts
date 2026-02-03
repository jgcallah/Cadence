import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from "vitest";
import type { Command } from "commander";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    green: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
    cyan: (str: string) => str,
    blue: (str: string) => str,
    bold: (str: string) => str,
  },
}));

describe("context command", () => {
  let contextCommand: Command;

  beforeAll(async () => {
    const module = await import("./context.js");
    contextCommand = module.contextCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(contextCommand.description()).toBe(
      "Output formatted context from recent notes"
    );
  });

  it("should have --days option with default", () => {
    const daysOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--days")
    );
    expect(daysOption).toBeDefined();
    expect(daysOption?.defaultValue).toBe("5");
  });

  it("should have --no-tasks option", () => {
    const noTasksOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--no-tasks")
    );
    expect(noTasksOption).toBeDefined();
    expect(noTasksOption?.description).toBe("Exclude tasks from context");
  });

  it("should have --no-weekly option", () => {
    const noWeeklyOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--no-weekly")
    );
    expect(noWeeklyOption).toBeDefined();
    expect(noWeeklyOption?.description).toBe(
      "Exclude weekly note from context"
    );
  });

  it("should have --no-monthly option", () => {
    const noMonthlyOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--no-monthly")
    );
    expect(noMonthlyOption).toBeDefined();
    expect(noMonthlyOption?.description).toBe(
      "Exclude monthly note from context"
    );
  });

  it("should have --quarterly option", () => {
    const quarterlyOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--quarterly")
    );
    expect(quarterlyOption).toBeDefined();
    expect(quarterlyOption?.description).toBe(
      "Include quarterly note in context"
    );
  });

  it("should have --json option", () => {
    const jsonOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--json")
    );
    expect(jsonOption).toBeDefined();
    expect(jsonOption?.description).toBe(
      "Output as JSON instead of markdown"
    );
  });

  it("should accept days option format", () => {
    const daysOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--days")
    );
    expect(daysOption?.flags).toBe("--days <number>");
  });
});
