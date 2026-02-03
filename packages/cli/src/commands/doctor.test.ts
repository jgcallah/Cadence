import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MemoryFileSystem, ConfigLoader } from "@cadence/core";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    green: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
    cyan: (str: string) => str,
    bold: Object.assign((str: string) => str, {
      yellow: (str: string) => str,
    }),
  },
}));

// Mock logger
vi.mock("../utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    debugVault: vi.fn(),
    debugConfig: vi.fn(),
  },
}));

describe("doctor command", () => {
  let _consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let _consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    _consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { doctorCommand } = await import("./doctor.js");
    expect(doctorCommand.description()).toBe(
      "Check vault health and configuration"
    );
  });

  it("should have --json option", async () => {
    const { doctorCommand } = await import("./doctor.js");
    const jsonOption = doctorCommand.options.find((opt) =>
      opt.flags.includes("--json")
    );
    expect(jsonOption).toBeDefined();
    expect(jsonOption?.description).toBe("Output as JSON");
  });
});

describe("doctor checks", () => {
  it("should detect missing vault", async () => {
    const fs = new MemoryFileSystem();

    // No vault directory exists
    const exists = await fs.exists("/test/.cadence");
    expect(exists).toBe(false);
  });

  it("should detect missing config", async () => {
    const fs = new MemoryFileSystem();
    // Create the parent directory structure properly
    await fs.mkdir("/test", { recursive: true });
    await fs.mkdir("/test/.cadence", { recursive: true });

    const configLoader = new ConfigLoader(fs);

    await expect(configLoader.loadConfig("/test")).rejects.toThrow();
  });

  it("should validate config structure", async () => {
    const fs = new MemoryFileSystem();
    // Create the parent directory structure properly
    await fs.mkdir("/test", { recursive: true });
    await fs.mkdir("/test/.cadence", { recursive: true });
    await fs.writeFile(
      "/test/.cadence/config.json",
      JSON.stringify({
        version: 1,
        paths: {
          daily: "daily/{year}/{month}/{date}.md",
          weekly: "weekly/{year}/{week}.md",
          monthly: "monthly/{year}/{month}.md",
          quarterly: "quarterly/{year}/Q{quarter}.md",
          yearly: "yearly/{year}.md",
          templates: ".cadence/templates",
        },
        templates: {
          meeting: ".cadence/templates/meeting.md",
        },
        sections: {
          tasks: "## Tasks",
        },
        tasks: {
          rolloverEnabled: true,
          scanDaysBack: 7,
          staleAfterDays: 3,
        },
        hooks: {
          preCreate: null,
          postCreate: null,
        },
        linkFormat: "wikilink",
      })
    );

    const configLoader = new ConfigLoader(fs);
    const config = await configLoader.loadConfig("/test");

    expect(config.paths.daily).toBe("daily/{year}/{month}/{date}.md");
    expect(config.tasks.scanDaysBack).toBe(7);
  });
});
