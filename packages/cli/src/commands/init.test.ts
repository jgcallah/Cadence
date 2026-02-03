import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { Command as _Command } from "commander";
import { MemoryFileSystem as _MemoryFileSystem } from "@cadence/core";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    green: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
  },
}));

// We need to mock the NodeFileSystem since init uses it directly
vi.mock("@cadence/core", async () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await vi.importActual<typeof import("@cadence/core")>(
    "@cadence/core"
  );
  return {
    ...actual,
    NodeFileSystem: vi.fn().mockImplementation(() => {
      const fs = new actual.MemoryFileSystem();
      return fs;
    }),
  };
});

describe("init command", () => {
  let _consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let _consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let _processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    _consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    _processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { initCommand } = await import("./init.js");
    expect(initCommand.description()).toBe(
      "Initialize a vault with Cadence configuration"
    );
  });

  it("should have --force option", async () => {
    const { initCommand } = await import("./init.js");
    const forceOption = initCommand.options.find((opt) =>
      opt.flags.includes("--force")
    );
    expect(forceOption).toBeDefined();
    expect(forceOption?.description).toBe("Overwrite existing configuration");
  });

  it("should have --dry-run option", async () => {
    const { initCommand } = await import("./init.js");
    const dryRunOption = initCommand.options.find((opt) =>
      opt.flags.includes("--dry-run")
    );
    expect(dryRunOption).toBeDefined();
    expect(dryRunOption?.description).toBe(
      "Show what would be created without making changes"
    );
  });
});
