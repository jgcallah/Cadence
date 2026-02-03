import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

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

describe("templates command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { templatesCommand } = await import("./templates.js");
    expect(templatesCommand.description()).toBe(
      "Manage and inspect templates"
    );
  });

  it("should have list subcommand", async () => {
    const { templatesCommand } = await import("./templates.js");
    const listCmd = templatesCommand.commands.find((c) => c.name() === "list");
    expect(listCmd).toBeDefined();
    expect(listCmd?.description()).toBe("List all available templates");
  });

  it("should have show subcommand", async () => {
    const { templatesCommand } = await import("./templates.js");
    const showCmd = templatesCommand.commands.find((c) => c.name() === "show");
    expect(showCmd).toBeDefined();
    expect(showCmd?.description()).toBe(
      "Show detailed information about a template"
    );
  });

  it("show subcommand should have name argument", async () => {
    const { templatesCommand } = await import("./templates.js");
    const showCmd = templatesCommand.commands.find((c) => c.name() === "show");
    expect(showCmd).toBeDefined();

    const args = showCmd?.registeredArguments;
    expect(args?.length).toBe(1);
    expect(args?.[0]?.name()).toBe("name");
  });
});
