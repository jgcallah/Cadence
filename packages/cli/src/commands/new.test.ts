import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from "vitest";
import type { Command } from "commander";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    bold: (str: string) => str,
    cyan: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
  },
}));

// Mock @inquirer/prompts
vi.mock("@inquirer/prompts", () => ({
  input: vi.fn().mockResolvedValue("test value"),
}));

describe("new command", () => {
  let newCommand: Command;

  beforeAll(async () => {
    const module = await import("./new.js");
    newCommand = module.newCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(newCommand.description()).toBe(
      "Create a new note from a template"
    );
  });

  it("should have template argument", () => {
    const args = newCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0]?.name()).toBe("template");
  });

  it("should have --title option", () => {
    const titleOption = newCommand.options.find((opt) =>
      opt.flags.includes("--title")
    );
    expect(titleOption).toBeDefined();
    expect(titleOption?.flags).toBe("--title <title>");
  });

  it("should have --date option", () => {
    const dateOption = newCommand.options.find((opt) =>
      opt.flags.includes("--date")
    );
    expect(dateOption).toBeDefined();
    expect(dateOption?.flags).toBe("--date <date>");
  });

  it("should have --output option", () => {
    const outputOption = newCommand.options.find((opt) =>
      opt.flags.includes("--output")
    );
    expect(outputOption).toBeDefined();
    expect(outputOption?.flags).toBe("--output <path>");
  });

  it("should have --var option", () => {
    const varOption = newCommand.options.find((opt) =>
      opt.flags.includes("--var")
    );
    expect(varOption).toBeDefined();
    expect(varOption?.flags).toBe("--var <key=value>");
  });

  it("should have --open option", () => {
    const openOption = newCommand.options.find((opt) =>
      opt.flags.includes("--open")
    );
    expect(openOption).toBeDefined();
  });

  it("should allow multiple --var options", () => {
    const varOption = newCommand.options.find((opt) =>
      opt.flags.includes("--var")
    );
    // Commander variadic options return array by default when using collection function
    expect(varOption).toBeDefined();
    expect(varOption?.description).toContain("can be used multiple times");
  });
});
