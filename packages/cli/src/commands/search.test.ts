import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from "vitest";
import type { Command } from "commander";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    green: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: {
      bold: (str: string) => str,
    },
    cyan: {
      bold: (str: string) => str,
    },
    blue: (str: string) => str,
    bold: (str: string) => str,
  },
}));

describe("search command", () => {
  let searchCommand: Command;

  beforeAll(async () => {
    const module = await import("./search.js");
    searchCommand = module.searchCommand;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", () => {
    expect(searchCommand.description()).toBe("Search for notes in the vault");
  });

  it("should have optional query argument", () => {
    const args = searchCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0]?.name()).toBe("query");
    expect(args[0]?.required).toBe(false);
  });

  it("should have --content option", () => {
    const contentOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--content")
    );
    expect(contentOption).toBeDefined();
    expect(contentOption?.description).toBe("Search within note contents");
  });

  it("should have --frontmatter option", () => {
    const frontmatterOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--frontmatter")
    );
    expect(frontmatterOption).toBeDefined();
    expect(frontmatterOption?.description).toBe(
      "Search by frontmatter field (e.g., status:active, tags:project)"
    );
  });

  it("should have --json option", () => {
    const jsonOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--json")
    );
    expect(jsonOption).toBeDefined();
    expect(jsonOption?.description).toBe("Output as JSON");
  });

  it("should have --limit option", () => {
    const limitOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--limit")
    );
    expect(limitOption).toBeDefined();
    expect(limitOption?.description).toBe("Maximum number of results");
  });

  it("should have --path option", () => {
    const pathOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--path")
    );
    expect(pathOption).toBeDefined();
    expect(pathOption?.description).toBe("Limit search to path prefix");
  });

  it("should accept content option format", () => {
    const contentOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--content")
    );
    expect(contentOption?.flags).toBe("--content <query>");
  });

  it("should accept frontmatter option format", () => {
    const frontmatterOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--frontmatter")
    );
    expect(frontmatterOption?.flags).toBe("--frontmatter <field:value>");
  });

  it("should accept limit option format", () => {
    const limitOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--limit")
    );
    expect(limitOption?.flags).toBe("--limit <number>");
  });

  it("should accept path option format", () => {
    const pathOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--path")
    );
    expect(pathOption?.flags).toBe("--path <prefix>");
  });
});
