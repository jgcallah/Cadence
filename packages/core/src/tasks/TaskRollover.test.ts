import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TaskRollover } from "./TaskRollover.js";
import { MemoryFileSystem } from "../fs/MemoryFileSystem.js";
import { ConfigLoader } from "../config/ConfigLoader.js";
import type { CadenceConfig } from "../config/types.js";

describe("TaskRollover", () => {
  let fs: MemoryFileSystem;
  let configLoader: ConfigLoader;
  let rollover: TaskRollover;
  const vaultPath = "/vault";
  const fixedDate = new Date("2026-02-02T12:00:00.000Z");

  const defaultConfig: CadenceConfig = {
    version: 1,
    paths: {
      daily: "Journal/Daily/{year}-{month}-{date}.md",
      weekly: "Journal/Weekly/{year}-W{week}.md",
      monthly: "Journal/Monthly/{year}-{month}.md",
      quarterly: "Journal/Quarterly/{year}-Q{quarter}.md",
      yearly: "Journal/Yearly/{year}.md",
      templates: "Templates",
    },
    templates: {
      daily: "Templates/daily.md",
      weekly: "Templates/weekly.md",
      monthly: "Templates/monthly.md",
      quarterly: "Templates/quarterly.md",
      yearly: "Templates/yearly.md",
    },
    sections: {
      tasks: "## Tasks",
      notes: "## Notes",
      reflection: "## Reflection",
    },
    tasks: {
      rolloverEnabled: true,
      scanDaysBack: 7,
      staleAfterDays: 14,
    },
    hooks: {
      preCreate: null,
      postCreate: null,
    },
    linkFormat: "wikilink",
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    fs = new MemoryFileSystem();
    configLoader = new ConfigLoader(fs);

    // Setup config file
    await fs.mkdir(`${vaultPath}/.cadence`, true);
    await fs.writeFile(
      `${vaultPath}/.cadence/config.json`,
      JSON.stringify(defaultConfig)
    );

    rollover = new TaskRollover(fs, configLoader);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic rollover", () => {
    it("should return empty results when no previous notes exist", async () => {
      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.targetNotePath).toBe(`${vaultPath}/Journal/Daily/2026-02-02.md`);
    });

    it("should roll over incomplete tasks from previous day", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        `# Daily Note

## Tasks
- [ ] Incomplete task
- [x] Completed task
`
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.text).toBe("Incomplete task");
    });

    it("should not roll over completed tasks", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        `- [x] Completed task 1
- [x] Completed task 2`
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(0);
    });

    it("should roll over tasks from multiple previous days", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Task from Feb 1"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-01-31.md`,
        "- [ ] Task from Jan 31"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-01-30.md`,
        "- [ ] Task from Jan 30"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(3);
      const texts = result.rolledOver.map((t) => t.text);
      expect(texts).toContain("Task from Feb 1");
      expect(texts).toContain("Task from Jan 31");
      expect(texts).toContain("Task from Jan 30");
    });

    it("should insert tasks into target note with tasks section", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Previous task"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-02.md`,
        `# Today's Note

## Tasks

## Notes
Some notes here
`
      );

      await rollover.rollover({ vaultPath });

      const content = await fs.readFile(`${vaultPath}/Journal/Daily/2026-02-02.md`);
      expect(content).toContain("- [ ] Previous task");
      expect(content).toContain("## Tasks");
    });

    it("should create target note if it does not exist", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Task to roll over"
      );

      await rollover.rollover({ vaultPath });

      const exists = await fs.exists(`${vaultPath}/Journal/Daily/2026-02-02.md`);
      expect(exists).toBe(true);

      const content = await fs.readFile(`${vaultPath}/Journal/Daily/2026-02-02.md`);
      expect(content).toContain("## Tasks");
      expect(content).toContain("- [ ] Task to roll over");
    });
  });

  describe("age increment", () => {
    it("should set age:1 for tasks without age metadata", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] New task"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.metadata.age).toBe(1);
      expect(result.rolledOver[0]!.raw).toContain("age:1");
    });

    it("should increment age from age:1 to age:2", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Old task age:1"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.metadata.age).toBe(2);
      expect(result.rolledOver[0]!.raw).toContain("age:2");
      expect(result.rolledOver[0]!.raw).not.toContain("age:1");
    });

    it("should increment age from age:5 to age:6", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Very old task age:5"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.metadata.age).toBe(6);
      expect(result.rolledOver[0]!.raw).toContain("age:6");
    });

    it("should preserve other metadata when incrementing age", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Task with metadata priority:high due:2026-02-10 #project age:2"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      const raw = result.rolledOver[0]!.raw;
      expect(raw).toContain("priority:high");
      expect(raw).toContain("due:2026-02-10");
      expect(raw).toContain("#project");
      expect(raw).toContain("age:3");
    });
  });

  describe("created date tracking", () => {
    it("should add created date when not present", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Task without created date"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.metadata.created).toEqual(new Date(2026, 1, 1));
      expect(result.rolledOver[0]!.raw).toContain("created:2026-02-01");
    });

    it("should preserve existing created date", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Task with created created:2026-01-15"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.raw).toContain("created:2026-01-15");
      expect(result.rolledOver[0]!.raw).not.toMatch(/created:2026-02-01/);
    });

    it("should use source note date for created when not present", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      // Task from 3 days ago
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-01-30.md`,
        "- [ ] Old task"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.raw).toContain("created:2026-01-30");
    });
  });

  describe("duplicate prevention", () => {
    it("should skip tasks that already exist in target note", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Duplicate task"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-02.md`,
        `## Tasks
- [ ] Duplicate task
`
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]!.reason).toContain("already exists");
    });

    it("should skip duplicates with case-insensitive matching", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Buy Groceries"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-02.md`,
        `## Tasks
- [ ] buy groceries
`
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
    });

    it("should roll over non-duplicate tasks while skipping duplicates", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        `- [ ] Unique task
- [ ] Duplicate task`
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-02.md`,
        `## Tasks
- [ ] Duplicate task
`
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.text).toBe("Unique task");
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]!.task.text).toBe("Duplicate task");
    });

    it("should prevent duplicates from same source appearing multiple times", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      // Same task appears in multiple source notes
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Repeated task"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-01-31.md`,
        "- [ ] Repeated task"
      );

      const result = await rollover.rollover({ vaultPath });

      // Should only roll over once
      expect(result.rolledOver).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
    });
  });

  describe("multiple source days", () => {
    it("should respect sourceDaysBack option", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      // Within range (3 days back)
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Recent task"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-01-31.md`,
        "- [ ] Also recent"
      );
      // Outside range
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-01-25.md`,
        "- [ ] Old task outside range"
      );

      const result = await rollover.rollover({
        vaultPath,
        sourceDaysBack: 3,
      });

      expect(result.rolledOver).toHaveLength(2);
      const texts = result.rolledOver.map((t) => t.text);
      expect(texts).toContain("Recent task");
      expect(texts).toContain("Also recent");
      expect(texts).not.toContain("Old task outside range");
    });

    it("should use config.tasks.scanDaysBack by default", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);

      // Create notes for 10 days back
      for (let i = 1; i <= 10; i++) {
        const date = new Date(fixedDate);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/${dateStr}.md`,
          `- [ ] Task from day -${i}`
        );
      }

      const result = await rollover.rollover({ vaultPath });

      // Default scanDaysBack is 7, so should get 7 tasks
      expect(result.rolledOver).toHaveLength(7);
    });
  });

  describe("stale task handling", () => {
    it("should roll over stale tasks (age > staleAfterDays)", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Very old task age:20 created:2026-01-01"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.metadata.age).toBe(21);
    });

    it("should preserve stale status through rollover", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Stale task age:14 created:2026-01-01 #stale"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver[0]!.raw).toContain("age:15");
      expect(result.rolledOver[0]!.raw).toContain("created:2026-01-01");
      expect(result.rolledOver[0]!.raw).toContain("#stale");
    });
  });

  describe("target date option", () => {
    it("should use custom target date", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-05.md`,
        "- [ ] Task from previous day"
      );

      const result = await rollover.rollover({
        vaultPath,
        targetDate: new Date("2026-02-06T12:00:00.000Z"),
      });

      expect(result.targetNotePath).toBe(`${vaultPath}/Journal/Daily/2026-02-06.md`);
      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.text).toBe("Task from previous day");
    });

    it("should not include tasks from target date", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      // Task on target date should not be included
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-02.md`,
        "- [ ] Task from today"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Task from yesterday"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.text).toBe("Task from yesterday");
    });
  });

  describe("note content handling", () => {
    it("should insert tasks after tasks section header", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Rolled over task"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-02.md`,
        `# Daily Note 2026-02-02

## Tasks
- [ ] Existing task

## Notes
Some notes here
`
      );

      await rollover.rollover({ vaultPath });

      const content = await fs.readFile(`${vaultPath}/Journal/Daily/2026-02-02.md`);
      const lines = content.split("\n");

      // Find the tasks section
      const tasksIndex = lines.findIndex((l) => l === "## Tasks");
      expect(tasksIndex).toBeGreaterThan(-1);

      // Rolled over task should be right after the section header
      expect(lines[tasksIndex + 1]).toContain("Rolled over task");
    });

    it("should add tasks section if not present in target", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Task to roll over"
      );
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-02.md`,
        `# Daily Note

## Notes
Some notes
`
      );

      await rollover.rollover({ vaultPath });

      const content = await fs.readFile(`${vaultPath}/Journal/Daily/2026-02-02.md`);
      expect(content).toContain("## Tasks");
      expect(content).toContain("- [ ] Task to roll over");
    });

    it("should preserve all original metadata in rolled over task", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Complex task #project #urgent due:2026-02-10 priority:high scheduled:2026-02-05"
      );

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      const raw = result.rolledOver[0]!.raw;
      expect(raw).toContain("#project");
      expect(raw).toContain("#urgent");
      expect(raw).toContain("due:2026-02-10");
      expect(raw).toContain("priority:high");
      expect(raw).toContain("scheduled:2026-02-05");
      expect(raw).toContain("age:1");
      expect(raw).toContain("created:2026-02-01");
    });
  });

  describe("error handling", () => {
    it("should skip unreadable source notes", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Readable task"
      );

      // Mock readFile to throw for specific file
      const originalReadFile = fs.readFile.bind(fs);
      vi.spyOn(fs, "readFile").mockImplementation(async (path: string) => {
        if (path.includes("2026-01-31")) {
          throw new Error("Read error");
        }
        return originalReadFile(path);
      });

      const result = await rollover.rollover({ vaultPath });

      expect(result.rolledOver).toHaveLength(1);
      expect(result.rolledOver[0]!.text).toBe("Readable task");
    });

    it("should handle missing config gracefully", async () => {
      // Remove config
      await fs.unlink(`${vaultPath}/.cadence/config.json`);

      await expect(rollover.rollover({ vaultPath })).rejects.toThrow();
    });
  });

  describe("clearConfigCache", () => {
    it("should clear the config cache", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Test task"
      );

      // First call caches the config
      await rollover.rollover({ vaultPath });

      // Modify config - change scanDaysBack to 1
      const newConfig = { ...defaultConfig };
      newConfig.tasks.scanDaysBack = 1;
      await fs.writeFile(
        `${vaultPath}/.cadence/config.json`,
        JSON.stringify(newConfig)
      );

      // Create a note 2 days back that would be included with 7 days but not 1
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-01-30.md`,
        "- [ ] Old task"
      );

      // Should still use cached config (scanDaysBack = 7)
      let result = await rollover.rollover({ vaultPath });
      // Remove the rolled over tasks to reset
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-02.md`,
        "## Tasks\n"
      );

      // Old task should have been included
      const oldTaskIncluded = result.rolledOver.some(
        (t) => t.text === "Old task"
      );
      expect(oldTaskIncluded).toBe(true);

      // Clear cache and rollover again
      rollover.clearConfigCache();

      // Remove previous target note content
      await fs.writeFile(`${vaultPath}/Journal/Daily/2026-02-02.md`, "");

      result = await rollover.rollover({ vaultPath });

      // Now with scanDaysBack = 1, old task should not be included
      const oldTaskIncludedAfterClear = result.rolledOver.some(
        (t) => t.text === "Old task"
      );
      expect(oldTaskIncludedAfterClear).toBe(false);
    });
  });
});
