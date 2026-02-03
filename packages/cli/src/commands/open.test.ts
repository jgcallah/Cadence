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

describe("open command", () => {
  let openCommand: Command;

  beforeAll(async () => {
    const module = await import("./open.js");
    openCommand = module.openCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(openCommand.description()).toBe("Open a note in the default editor");
  });

  it("should have type argument", () => {
    const args = openCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0]?.name()).toBe("type");
  });

  it("should have --date option", () => {
    const dateOption = openCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.description).toBe(
      "Specify a date (e.g., 'yesterday', '2024-01-15')"
    );
  });
});
