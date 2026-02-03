import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    green: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
    blue: (str: string) => str,
    cyan: (str: string) => str,
    bold: Object.assign((str: string) => str, {
      yellow: (str: string) => str,
    }),
  },
}));

describe("tasks command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should have correct description", async () => {
    const { tasksCommand } = await import("./tasks.js");
    expect(tasksCommand.description()).toBe(
      "Manage and view tasks from periodic notes"
    );
  });

  it("should have --days option", async () => {
    const { tasksCommand } = await import("./tasks.js");
    const daysOption = tasksCommand.options.find((opt) =>
      opt.flags.includes("--days")
    );
    expect(daysOption).toBeDefined();
    expect(daysOption?.description).toBe("Number of days to look back");
    expect(daysOption?.defaultValue).toBe("7");
  });

  it("should have --overdue option", async () => {
    const { tasksCommand } = await import("./tasks.js");
    const overdueOption = tasksCommand.options.find((opt) =>
      opt.flags.includes("--overdue")
    );
    expect(overdueOption).toBeDefined();
    expect(overdueOption?.description).toBe("Show only overdue tasks");
  });

  it("should have --stale option", async () => {
    const { tasksCommand } = await import("./tasks.js");
    const staleOption = tasksCommand.options.find((opt) =>
      opt.flags.includes("--stale")
    );
    expect(staleOption).toBeDefined();
    expect(staleOption?.description).toBe("Show only stale tasks");
  });

  it("should have --priority option", async () => {
    const { tasksCommand } = await import("./tasks.js");
    const priorityOption = tasksCommand.options.find((opt) =>
      opt.flags.includes("--priority")
    );
    expect(priorityOption).toBeDefined();
    expect(priorityOption?.description).toBe(
      "Filter by priority (high, medium, low)"
    );
  });

  it("should have --tag option", async () => {
    const { tasksCommand } = await import("./tasks.js");
    const tagOption = tasksCommand.options.find((opt) =>
      opt.flags.includes("--tag")
    );
    expect(tagOption).toBeDefined();
    expect(tagOption?.description).toBe("Filter by tag");
  });

  it("should have --flat option", async () => {
    const { tasksCommand } = await import("./tasks.js");
    const flatOption = tasksCommand.options.find((opt) =>
      opt.flags.includes("--flat")
    );
    expect(flatOption).toBeDefined();
    expect(flatOption?.description).toBe(
      "Show tasks in flat list instead of grouped"
    );
  });

  it("should have --json option", async () => {
    const { tasksCommand } = await import("./tasks.js");
    const jsonOption = tasksCommand.options.find((opt) =>
      opt.flags.includes("--json")
    );
    expect(jsonOption).toBeDefined();
    expect(jsonOption?.description).toBe("Output as JSON");
  });

  describe("rollover subcommand", () => {
    it("should have rollover subcommand", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const rolloverCmd = tasksCommand.commands.find(
        (cmd) => cmd.name() === "rollover"
      );
      expect(rolloverCmd).toBeDefined();
      expect(rolloverCmd?.description()).toBe(
        "Roll over incomplete tasks from previous days to today"
      );
    });

    it("should have --dry-run option on rollover", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const rolloverCmd = tasksCommand.commands.find(
        (cmd) => cmd.name() === "rollover"
      );
      const dryRunOption = rolloverCmd?.options.find((opt) =>
        opt.flags.includes("--dry-run")
      );
      expect(dryRunOption).toBeDefined();
      expect(dryRunOption?.description).toBe(
        "Show what would be rolled over without making changes"
      );
    });

    it("should have --days option on rollover", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const rolloverCmd = tasksCommand.commands.find(
        (cmd) => cmd.name() === "rollover"
      );
      const daysOption = rolloverCmd?.options.find((opt) =>
        opt.flags.includes("--days")
      );
      expect(daysOption).toBeDefined();
      expect(daysOption?.description).toBe(
        "Number of days to scan back for tasks"
      );
    });
  });

  describe("toggle subcommand", () => {
    it("should have toggle subcommand", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const toggleCmd = tasksCommand.commands.find(
        (cmd) => cmd.name() === "toggle"
      );
      expect(toggleCmd).toBeDefined();
      expect(toggleCmd?.description()).toBe(
        "Toggle a task's completion status (file:line format)"
      );
    });

    it("should have location argument", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const toggleCmd = tasksCommand.commands.find(
        (cmd) => cmd.name() === "toggle"
      );
      const args = toggleCmd?.registeredArguments;
      expect(args?.length).toBe(1);
      expect(args?.[0]?.name()).toBe("location");
    });
  });

  describe("add subcommand", () => {
    it("should have add subcommand", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const addCmd = tasksCommand.commands.find((cmd) => cmd.name() === "add");
      expect(addCmd).toBeDefined();
      expect(addCmd?.description()).toBe("Add a new task to today's daily note");
    });

    it("should have text argument", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const addCmd = tasksCommand.commands.find((cmd) => cmd.name() === "add");
      const args = addCmd?.registeredArguments;
      expect(args?.length).toBe(1);
      expect(args?.[0]?.name()).toBe("text");
    });

    it("should have --due option on add", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const addCmd = tasksCommand.commands.find((cmd) => cmd.name() === "add");
      const dueOption = addCmd?.options.find((opt) =>
        opt.flags.includes("--due")
      );
      expect(dueOption).toBeDefined();
      expect(dueOption?.description).toBe(
        "Due date (e.g., 'tomorrow', '2024-01-20')"
      );
    });

    it("should have --priority option on add", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const addCmd = tasksCommand.commands.find((cmd) => cmd.name() === "add");
      const priorityOption = addCmd?.options.find((opt) =>
        opt.flags.includes("--priority")
      );
      expect(priorityOption).toBeDefined();
      expect(priorityOption?.description).toBe(
        "Priority level (high, medium, low)"
      );
    });

    it("should have --tag option on add", async () => {
      const { tasksCommand } = await import("./tasks.js");
      const addCmd = tasksCommand.commands.find((cmd) => cmd.name() === "add");
      const tagOption = addCmd?.options.find((opt) =>
        opt.flags.includes("--tag")
      );
      expect(tagOption).toBeDefined();
      expect(tagOption?.description).toBe("Comma-separated tags (without #)");
    });
  });
});
