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

describe("list command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { listCommand } = await import("./list.js");
    expect(listCommand.description()).toBe("List notes of a specific type");
  });

  it("should have type argument", async () => {
    const { listCommand } = await import("./list.js");
    const args = listCommand.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0]?.name()).toBe("type");
  });

  it("should have --range option", async () => {
    const { listCommand } = await import("./list.js");
    const rangeOption = listCommand.options.find((opt) =>
      opt.flags.includes("--range")
    );
    expect(rangeOption).toBeDefined();
    expect(rangeOption?.description).toBe(
      "Date range (e.g., 'last 3 months', 'last week')"
    );
  });

  it("should accept range argument format", async () => {
    const { listCommand } = await import("./list.js");
    const rangeOption = listCommand.options.find((opt) =>
      opt.flags.includes("--range")
    );
    expect(rangeOption?.flags).toBe("--range <range>");
  });

  it("should have --json option", async () => {
    const { listCommand } = await import("./list.js");
    const jsonOption = listCommand.options.find((opt) =>
      opt.flags.includes("--json")
    );
    expect(jsonOption).toBeDefined();
    expect(jsonOption?.description).toBe("Output as JSON");
  });
});
