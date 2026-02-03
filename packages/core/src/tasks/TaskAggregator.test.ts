import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TaskAggregator } from "./TaskAggregator.js";
import { MemoryFileSystem } from "../fs/MemoryFileSystem.js";
import { ConfigLoader } from "../config/ConfigLoader.js";
import type { CadenceConfig } from "../config/types.js";
import type { AggregatedTasks as _AggregatedTasks } from "./types.js";

describe("TaskAggregator", () => {
  let fs: MemoryFileSystem;
  let configLoader: ConfigLoader;
  let aggregator: TaskAggregator;
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

    aggregator = new TaskAggregator(fs, configLoader);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("aggregate", () => {
    describe("basic functionality", () => {
      it("should return empty results when no notes exist", async () => {
        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open).toEqual([]);
        expect(result.completed).toEqual([]);
        expect(result.overdue).toEqual([]);
        expect(result.stale).toEqual([]);
        expect(result.byPriority.high).toEqual([]);
        expect(result.byPriority.medium).toEqual([]);
        expect(result.byPriority.low).toEqual([]);
        expect(result.byPriority.none).toEqual([]);
      });

      it("should parse tasks from a single daily note", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `# Daily Note

## Tasks
- [ ] Open task
- [x] Completed task
`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open).toHaveLength(1);
        expect(result.open[0]!.text).toBe("Open task");
        expect(result.open[0]!.sourcePath).toBe(
          `${vaultPath}/Journal/Daily/2026-02-01.md`
        );
      });

      it("should aggregate tasks from multiple daily notes", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);

        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "- [ ] Task from Feb 1"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-01-30.md`,
          "- [ ] Task from Jan 30"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-01-28.md`,
          "- [ ] Task from Jan 28"
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open).toHaveLength(3);
        const texts = result.open.map((t) => t.text);
        expect(texts).toContain("Task from Feb 1");
        expect(texts).toContain("Task from Jan 30");
        expect(texts).toContain("Task from Jan 28");
      });
    });

    describe("filtering by status", () => {
      it("should exclude completed tasks by default", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Open task
- [x] Completed task`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open).toHaveLength(1);
        expect(result.completed).toHaveLength(0);
      });

      it("should include completed tasks when includeCompleted is true", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Open task
- [x] Completed task`
        );

        const result = await aggregator.aggregate({
          vaultPath,
          includeCompleted: true,
        });

        expect(result.open).toHaveLength(1);
        expect(result.completed).toHaveLength(1);
        expect(result.completed[0]!.text).toBe("Completed task");
      });
    });

    describe("overdue detection", () => {
      it("should detect overdue tasks", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Overdue task due:2026-01-15
- [ ] Future task due:2026-02-15`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.overdue).toHaveLength(1);
        expect(result.overdue[0]!.text).toBe("Overdue task");
      });

      it("should not include tasks due today as overdue", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Task due today due:2026-02-02`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.overdue).toHaveLength(0);
      });
    });

    describe("stale detection", () => {
      it("should detect stale tasks based on source date", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        // Task from 20 days ago should be stale (staleAfterDays is 14)
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-01-13.md`,
          `- [ ] Old task`
        );

        const result = await aggregator.aggregate({
          vaultPath,
          daysBack: 30,
        });

        expect(result.stale).toHaveLength(1);
        expect(result.stale[0]!.text).toBe("Old task");
      });

      it("should detect stale tasks based on age metadata", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Old task age:20`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.stale).toHaveLength(1);
      });

      it("should detect stale tasks based on created metadata", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Old task created:2026-01-10`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.stale).toHaveLength(1);
      });

      it("should not mark recent tasks as stale", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Recent task`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.stale).toHaveLength(0);
      });
    });

    describe("priority categorization", () => {
      it("should categorize tasks by priority", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] High priority priority:high
- [ ] Medium priority priority:medium
- [ ] Low priority priority:low
- [ ] No priority`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.byPriority.high).toHaveLength(1);
        expect(result.byPriority.high[0]!.text).toBe("High priority");

        expect(result.byPriority.medium).toHaveLength(1);
        expect(result.byPriority.medium[0]!.text).toBe("Medium priority");

        expect(result.byPriority.low).toHaveLength(1);
        expect(result.byPriority.low[0]!.text).toBe("Low priority");

        expect(result.byPriority.none).toHaveLength(1);
        expect(result.byPriority.none[0]!.text).toBe("No priority");
      });

      it("should categorize tasks with exclamation mark priority", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Urgent task !!!
- [ ] Important task !!
- [ ] Minor task !`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.byPriority.high).toHaveLength(1);
        expect(result.byPriority.medium).toHaveLength(1);
        expect(result.byPriority.low).toHaveLength(1);
      });
    });

    describe("sorting", () => {
      it("should sort tasks by priority first", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] No priority
- [ ] Medium task priority:medium
- [ ] High task priority:high
- [ ] Low task priority:low`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open[0]!.text).toBe("High task");
        expect(result.open[1]!.text).toBe("Medium task");
        expect(result.open[2]!.text).toBe("Low task");
        expect(result.open[3]!.text).toBe("No priority");
      });

      it("should sort by due date within same priority", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Due later due:2026-02-20 priority:high
- [ ] Due soon due:2026-02-05 priority:high
- [ ] Due middle due:2026-02-10 priority:high`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open[0]!.text).toBe("Due soon");
        expect(result.open[1]!.text).toBe("Due middle");
        expect(result.open[2]!.text).toBe("Due later");
      });

      it("should put tasks without due date at the end within priority", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] No due priority:high
- [ ] Has due due:2026-02-10 priority:high`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open[0]!.text).toBe("Has due");
        expect(result.open[1]!.text).toBe("No due");
      });
    });

    describe("daysBack option", () => {
      it("should only scan notes within daysBack range", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "- [ ] Recent task"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-01-20.md`,
          "- [ ] Old task"
        );

        const result = await aggregator.aggregate({
          vaultPath,
          daysBack: 7,
        });

        expect(result.open).toHaveLength(1);
        expect(result.open[0]!.text).toBe("Recent task");
      });

      it("should use default daysBack of 7", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);

        // Create notes for the past 10 days
        for (let i = 0; i < 10; i++) {
          const date = new Date(fixedDate);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split("T")[0];
          await fs.writeFile(
            `${vaultPath}/Journal/Daily/${dateStr}.md`,
            `- [ ] Task ${i}`
          );
        }

        const result = await aggregator.aggregate({ vaultPath });

        // Should only include 8 notes (today + 7 days back)
        expect(result.open).toHaveLength(8);
      });
    });

    describe("noteTypes option", () => {
      it("should scan only specified note types", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.mkdir(`${vaultPath}/Journal/Weekly`, true);

        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "- [ ] Daily task"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Weekly/2026-W05.md`,
          "- [ ] Weekly task"
        );

        const result = await aggregator.aggregate({
          vaultPath,
          noteTypes: ["daily"],
        });

        expect(result.open).toHaveLength(1);
        expect(result.open[0]!.text).toBe("Daily task");
      });

      it("should scan multiple note types", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.mkdir(`${vaultPath}/Journal/Weekly`, true);

        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "- [ ] Daily task"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Weekly/2026-W05.md`,
          "- [ ] Weekly task"
        );

        const result = await aggregator.aggregate({
          vaultPath,
          noteTypes: ["daily", "weekly"],
          daysBack: 14,
        });

        expect(result.open).toHaveLength(2);
        const texts = result.open.map((t) => t.text);
        expect(texts).toContain("Daily task");
        expect(texts).toContain("Weekly task");
      });

      it("should default to daily notes only", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.mkdir(`${vaultPath}/Journal/Weekly`, true);

        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "- [ ] Daily task"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Weekly/2026-W05.md`,
          "- [ ] Weekly task"
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open).toHaveLength(1);
        expect(result.open[0]!.text).toBe("Daily task");
      });
    });

    describe("TaskWithSource properties", () => {
      it("should include sourcePath for each task", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "- [ ] Test task"
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open[0]!.sourcePath).toBe(
          `${vaultPath}/Journal/Daily/2026-02-01.md`
        );
      });

      it("should include sourceDate for each task", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "- [ ] Test task"
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open[0]!.sourceDate).toEqual(new Date(2026, 1, 1));
      });
    });

    describe("error handling", () => {
      it("should skip notes that cannot be read", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "- [ ] Readable task"
        );

        // Simulate an error for the next readFile call on a specific file
        const originalReadFile = fs.readFile.bind(fs);
        const _callCount = 0;
        vi.spyOn(fs, "readFile").mockImplementation(async (path: string) => {
          if (path.includes("2026-01-31")) {
            throw new Error("Read error");
          }
          return originalReadFile(path);
        });

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open).toHaveLength(1);
        expect(result.open[0]!.text).toBe("Readable task");
      });
    });

    describe("complex scenarios", () => {
      it("should handle mixed task states", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `# Daily Note

## Tasks
- [ ] Normal task
- [x] Done task
- [ ] Urgent task !!! due:2026-01-20
- [ ] Stale task created:2026-01-01
- [ ] Future task due:2026-03-01
`
        );

        const result = await aggregator.aggregate({
          vaultPath,
          includeCompleted: true,
        });

        expect(result.open).toHaveLength(4);
        expect(result.completed).toHaveLength(1);
        expect(result.overdue).toHaveLength(1);
        expect(result.overdue[0]!.text).toBe("Urgent task");
        expect(result.stale).toHaveLength(1);
        expect(result.stale[0]!.text).toBe("Stale task");
        expect(result.byPriority.high).toHaveLength(1);
      });

      it("should handle tasks with all metadata", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Complex task #project #urgent due:2026-02-10 priority:high scheduled:2026-02-05 created:2026-01-20 age:13`
        );

        const result = await aggregator.aggregate({ vaultPath });

        expect(result.open).toHaveLength(1);
        const task = result.open[0]!;
        expect(task.text).toBe("Complex task");
        expect(task.metadata.tags).toEqual(["project", "urgent"]);
        expect(task.metadata.due).toEqual(new Date(2026, 1, 10));
        expect(task.metadata.priority).toBe("high");
        expect(task.metadata.scheduled).toEqual(new Date(2026, 1, 5));
        expect(task.metadata.created).toEqual(new Date(2026, 0, 20));
        expect(task.metadata.age).toBe(13);
      });

      it("should aggregate tasks from monthly notes", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Monthly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Monthly/2026-02.md`,
          "- [ ] Monthly task"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Monthly/2026-01.md`,
          "- [ ] Previous month task"
        );

        const result = await aggregator.aggregate({
          vaultPath,
          noteTypes: ["monthly"],
          daysBack: 60,
        });

        expect(result.open).toHaveLength(2);
      });
    });
  });

  describe("clearConfigCache", () => {
    it("should clear the config cache", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(
        `${vaultPath}/Journal/Daily/2026-02-01.md`,
        "- [ ] Test"
      );

      // First call caches the config
      await aggregator.aggregate({ vaultPath });

      // Modify config - set staleAfterDays to 0 so 1-day-old task is stale (1 > 0)
      const newConfig = { ...defaultConfig };
      newConfig.tasks.staleAfterDays = 0;
      await fs.writeFile(
        `${vaultPath}/.cadence/config.json`,
        JSON.stringify(newConfig)
      );

      // Should still use cached config (staleAfterDays = 14)
      let result = await aggregator.aggregate({ vaultPath });
      expect(result.stale).toHaveLength(0);

      // Clear cache and aggregate again
      aggregator.clearConfigCache();
      result = await aggregator.aggregate({ vaultPath });
      expect(result.stale).toHaveLength(1);
    });
  });
});
