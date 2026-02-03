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

describe("list command", () => {
  let listCommand: Command;

  beforeAll(async () => {
    const module = await import("./list.js");
    listCommand = module.listCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(listCommand.description()).toBe("List notes of a specific type");
  });

  it("should have type argument", () => {
    const args = listCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0]?.name()).toBe("type");
  });

  it("should have --range option", () => {
    const rangeOption = listCommand.options.find((opt) =>
      opt.flags.includes("--range")
    );
    expect(rangeOption).toBeDefined();
    expect(rangeOption?.description).toBe(
      "Date range (e.g., 'last 3 months', 'last week')"
    );
  });

  it("should accept range argument format", () => {
    const rangeOption = listCommand.options.find((opt) =>
      opt.flags.includes("--range")
    );
    expect(rangeOption?.flags).toBe("--range <range>");
  });

  it("should have --json option", () => {
    const jsonOption = listCommand.options.find((opt) =>
      opt.flags.includes("--json")
    );
    expect(jsonOption).toBeDefined();
    expect(jsonOption?.description).toBe("Output as JSON");
  });
});
