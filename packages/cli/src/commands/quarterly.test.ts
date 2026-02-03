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

describe("quarterly command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { quarterlyCommand } = await import("./quarterly.js");
    expect(quarterlyCommand.description()).toBe("Create or get this quarter's note");
  });

  it("should have --date option", async () => {
    const { quarterlyCommand } = await import("./quarterly.js");
    const dateOption = quarterlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'last quarter', 'Q1 2024')"
    );
  });

  it("should accept date argument format", async () => {
    const { quarterlyCommand } = await import("./quarterly.js");
    const dateOption = quarterlyCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption?.flags).toBe("--date <date>");
  });
});
