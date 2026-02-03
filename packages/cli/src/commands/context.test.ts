import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { contextCommand } = await import("./context.js");
    expect(contextCommand.description()).toBe(
      "Output formatted context from recent notes"
    );
  });

  it("should have --days option with default", async () => {
    const { contextCommand } = await import("./context.js");
    const daysOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--days")
    );
    expect(daysOption).toBeDefined();
    expect(daysOption?.defaultValue).toBe("5");
  });

  it("should have --no-tasks option", async () => {
    const { contextCommand } = await import("./context.js");
    const noTasksOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--no-tasks")
    );
    expect(noTasksOption).toBeDefined();
    expect(noTasksOption?.description).toBe("Exclude tasks from context");
  });

  it("should have --no-weekly option", async () => {
    const { contextCommand } = await import("./context.js");
    const noWeeklyOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--no-weekly")
    );
    expect(noWeeklyOption).toBeDefined();
    expect(noWeeklyOption?.description).toBe(
      "Exclude weekly note from context"
    );
  });

  it("should have --no-monthly option", async () => {
    const { contextCommand } = await import("./context.js");
    const noMonthlyOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--no-monthly")
    );
    expect(noMonthlyOption).toBeDefined();
    expect(noMonthlyOption?.description).toBe(
      "Exclude monthly note from context"
    );
  });

  it("should have --quarterly option", async () => {
    const { contextCommand } = await import("./context.js");
    const quarterlyOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--quarterly")
    );
    expect(quarterlyOption).toBeDefined();
    expect(quarterlyOption?.description).toBe(
      "Include quarterly note in context"
    );
  });

  it("should have --json option", async () => {
    const { contextCommand } = await import("./context.js");
    const jsonOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--json")
    );
    expect(jsonOption).toBeDefined();
    expect(jsonOption?.description).toBe(
      "Output as JSON instead of markdown"
    );
  });

  it("should accept days option format", async () => {
    const { contextCommand } = await import("./context.js");
    const daysOption = contextCommand.options.find((opt) =>
      opt.flags.includes("--days")
    );
    expect(daysOption?.flags).toBe("--days <number>");
  });
});
