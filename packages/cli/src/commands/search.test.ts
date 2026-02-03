import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { searchCommand } = await import("./search.js");
    expect(searchCommand.description()).toBe("Search for notes in the vault");
  });

  it("should have optional query argument", async () => {
    const { searchCommand } = await import("./search.js");
    const args = searchCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0]?.name()).toBe("query");
    expect(args[0]?.required).toBe(false);
  });

  it("should have --content option", async () => {
    const { searchCommand } = await import("./search.js");
    const contentOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--content")
    );
    expect(contentOption).toBeDefined();
    expect(contentOption?.description).toBe("Search within note contents");
  });

  it("should have --frontmatter option", async () => {
    const { searchCommand } = await import("./search.js");
    const frontmatterOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--frontmatter")
    );
    expect(frontmatterOption).toBeDefined();
    expect(frontmatterOption?.description).toBe(
      "Search by frontmatter field (e.g., status:active, tags:project)"
    );
  });

  it("should have --json option", async () => {
    const { searchCommand } = await import("./search.js");
    const jsonOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--json")
    );
    expect(jsonOption).toBeDefined();
    expect(jsonOption?.description).toBe("Output as JSON");
  });

  it("should have --limit option", async () => {
    const { searchCommand } = await import("./search.js");
    const limitOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--limit")
    );
    expect(limitOption).toBeDefined();
    expect(limitOption?.description).toBe("Maximum number of results");
  });

  it("should have --path option", async () => {
    const { searchCommand } = await import("./search.js");
    const pathOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--path")
    );
    expect(pathOption).toBeDefined();
    expect(pathOption?.description).toBe("Limit search to path prefix");
  });

  it("should accept content option format", async () => {
    const { searchCommand } = await import("./search.js");
    const contentOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--content")
    );
    expect(contentOption?.flags).toBe("--content <query>");
  });

  it("should accept frontmatter option format", async () => {
    const { searchCommand } = await import("./search.js");
    const frontmatterOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--frontmatter")
    );
    expect(frontmatterOption?.flags).toBe("--frontmatter <field:value>");
  });

  it("should accept limit option format", async () => {
    const { searchCommand } = await import("./search.js");
    const limitOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--limit")
    );
    expect(limitOption?.flags).toBe("--limit <number>");
  });

  it("should accept path option format", async () => {
    const { searchCommand } = await import("./search.js");
    const pathOption = searchCommand.options.find((opt) =>
      opt.flags.includes("--path")
    );
    expect(pathOption?.flags).toBe("--path <prefix>");
  });
});
