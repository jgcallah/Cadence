import { describe, it, expect } from "vitest";
import { completionsCommand } from "./completions.js";

describe("completions command", () => {
  it("should have correct description", () => {
    expect(completionsCommand.description()).toBe(
      "Generate shell completion scripts"
    );
  });

  it("should require shell argument", () => {
    const args = completionsCommand.registeredArguments;
    expect(args).toHaveLength(1);
    expect(args[0].name()).toBe("shell");
    expect(args[0].required).toBe(true);
  });

  it("should have help text with examples", () => {
    // Check that the command has help text configured
    const helpInfo = completionsCommand.helpInformation();
    expect(helpInfo).toContain("shell");
    expect(helpInfo).toContain("bash");
  });
});
