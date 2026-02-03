import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ContextBuilder } from "./ContextBuilder.js";
import { MemoryFileSystem } from "../fs/MemoryFileSystem.js";
import { ConfigLoader } from "../config/ConfigLoader.js";
import type { CadenceConfig } from "../config/types.js";

describe("ContextBuilder", () => {
  let fs: MemoryFileSystem;
  let configLoader: ConfigLoader;
  let builder: ContextBuilder;
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

    builder = new ContextBuilder(fs, configLoader, vaultPath);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getContext", () => {
    describe("default context", () => {
      it("should return empty context when no notes exist", async () => {
        const context = await builder.getContext();

        expect(context.daily).toEqual([]);
        expect(context.weekly).toBeUndefined();
        expect(context.monthly).toBeUndefined();
        expect(context.quarterly).toBeUndefined();
        expect(context.tasks.open).toEqual([]);
        expect(context.tasks.overdue).toEqual([]);
      });

      it("should include daily notes with default count of 3", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          "# Today"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "# Yesterday"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-01-31.md`,
          "# Two days ago"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-01-30.md`,
          "# Three days ago"
        );

        const context = await builder.getContext();

        expect(context.daily).toHaveLength(3);
        expect(context.daily[0]!.content).toBe("# Today");
        expect(context.daily[1]!.content).toBe("# Yesterday");
        expect(context.daily[2]!.content).toBe("# Two days ago");
      });

      it("should include weekly note by default", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Weekly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Weekly/2026-W06.md`,
          "# Week 6"
        );

        const context = await builder.getContext();

        expect(context.weekly).toBeDefined();
        expect(context.weekly!.content).toBe("# Week 6");
      });

      it("should include monthly note by default", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Monthly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Monthly/2026-02.md`,
          "# February"
        );

        const context = await builder.getContext();

        expect(context.monthly).toBeDefined();
        expect(context.monthly!.content).toBe("# February");
      });

      it("should not include quarterly note by default", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Quarterly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Quarterly/2026-Q1.md`,
          "# Q1"
        );

        const context = await builder.getContext();

        expect(context.quarterly).toBeUndefined();
      });

      it("should include tasks by default", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `# Daily
- [ ] Open task
- [x] Completed task`
        );

        const context = await builder.getContext();

        expect(context.tasks.open).toHaveLength(1);
        expect(context.tasks.open[0]!.text).toBe("Open task");
      });
    });

    describe("custom options", () => {
      it("should respect custom dailyCount", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          "# Today"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "# Yesterday"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-01-31.md`,
          "# Two days ago"
        );

        const context = await builder.getContext({ dailyCount: 2 });

        expect(context.daily).toHaveLength(2);
        expect(context.daily[0]!.content).toBe("# Today");
        expect(context.daily[1]!.content).toBe("# Yesterday");
      });

      it("should respect includeWeekly: false", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Weekly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Weekly/2026-W06.md`,
          "# Week 6"
        );

        const context = await builder.getContext({ includeWeekly: false });

        expect(context.weekly).toBeUndefined();
      });

      it("should respect includeMonthly: false", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Monthly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Monthly/2026-02.md`,
          "# February"
        );

        const context = await builder.getContext({ includeMonthly: false });

        expect(context.monthly).toBeUndefined();
      });

      it("should respect includeQuarterly: true", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Quarterly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Quarterly/2026-Q1.md`,
          "# Q1"
        );

        const context = await builder.getContext({ includeQuarterly: true });

        expect(context.quarterly).toBeDefined();
        expect(context.quarterly!.content).toBe("# Q1");
      });

      it("should respect includeTasks: false", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Open task`
        );

        const context = await builder.getContext({ includeTasks: false });

        expect(context.tasks.open).toEqual([]);
        expect(context.tasks.overdue).toEqual([]);
      });
    });

    describe("missing notes handling", () => {
      it("should return fewer daily notes if not enough exist", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          "# Today"
        );

        const context = await builder.getContext();

        expect(context.daily).toHaveLength(1);
      });

      it("should skip missing daily notes and find older ones", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        // No note for today (2026-02-02)
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "# Yesterday"
        );
        // No note for 2026-01-31
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-01-30.md`,
          "# Four days ago"
        );

        const context = await builder.getContext({ dailyCount: 2 });

        expect(context.daily).toHaveLength(2);
        expect(context.daily[0]!.content).toBe("# Yesterday");
        expect(context.daily[1]!.content).toBe("# Four days ago");
      });

      it("should handle missing weekly note gracefully", async () => {
        const context = await builder.getContext();

        expect(context.weekly).toBeUndefined();
      });

      it("should handle missing monthly note gracefully", async () => {
        const context = await builder.getContext();

        expect(context.monthly).toBeUndefined();
      });

      it("should handle missing quarterly note gracefully", async () => {
        const context = await builder.getContext({ includeQuarterly: true });

        expect(context.quarterly).toBeUndefined();
      });
    });

    describe("summary formatting", () => {
      it("should include date in summary", async () => {
        const context = await builder.getContext();

        expect(context.summary).toContain("Context as of 2026-02-02");
      });

      it("should list daily note count in summary", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          "# Today"
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          "# Yesterday"
        );

        const context = await builder.getContext();

        expect(context.summary).toContain("2 daily note(s)");
      });

      it("should mention weekly note in summary when present", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Weekly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Weekly/2026-W06.md`,
          "# Week 6"
        );

        const context = await builder.getContext();

        expect(context.summary).toContain("Current weekly note");
      });

      it("should mention monthly note in summary when present", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Monthly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Monthly/2026-02.md`,
          "# February"
        );

        const context = await builder.getContext();

        expect(context.summary).toContain("Current monthly note");
      });

      it("should mention quarterly note in summary when present", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Quarterly`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Quarterly/2026-Q1.md`,
          "# Q1"
        );

        const context = await builder.getContext({ includeQuarterly: true });

        expect(context.summary).toContain("Current quarterly note");
      });

      it("should include task counts in summary", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Task 1
- [ ] Task 2 due:2026-01-15
- [x] Completed task`
        );

        const context = await builder.getContext();

        expect(context.summary).toContain("2 open task(s)");
        expect(context.summary).toContain("1 overdue task(s)");
      });

      it("should show zero task counts when no tasks", async () => {
        const context = await builder.getContext();

        expect(context.summary).toContain("0 open task(s)");
        expect(context.summary).toContain("0 overdue task(s)");
      });
    });

    describe("task collection", () => {
      it("should collect open tasks from daily notes", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Task from yesterday`
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          `- [ ] Task from today`
        );

        const context = await builder.getContext();

        expect(context.tasks.open).toHaveLength(2);
        const texts = context.tasks.open.map((t) => t.text);
        expect(texts).toContain("Task from today");
        expect(texts).toContain("Task from yesterday");
      });

      it("should not include completed tasks", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Open task
- [x] Completed task`
        );

        const context = await builder.getContext();

        expect(context.tasks.open).toHaveLength(1);
        expect(context.tasks.open[0]!.text).toBe("Open task");
      });

      it("should identify overdue tasks", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Overdue task due:2026-01-15
- [ ] Future task due:2026-02-15`
        );

        const context = await builder.getContext();

        expect(context.tasks.overdue).toHaveLength(1);
        expect(context.tasks.overdue[0]!.text).toBe("Overdue task");
      });

      it("should sort tasks by priority then due date", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Low priority priority:low
- [ ] High priority priority:high
- [ ] Medium priority priority:medium
- [ ] No priority`
        );

        const context = await builder.getContext();

        expect(context.tasks.open[0]!.text).toBe("High priority");
        expect(context.tasks.open[1]!.text).toBe("Medium priority");
        expect(context.tasks.open[2]!.text).toBe("Low priority");
        expect(context.tasks.open[3]!.text).toBe("No priority");
      });

      it("should include source information in tasks", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          `- [ ] Test task`
        );

        const context = await builder.getContext();

        expect(context.tasks.open[0]!.sourcePath).toBe(
          `${vaultPath}/Journal/Daily/2026-02-01.md`
        );
        expect(context.tasks.open[0]!.sourceDate).toEqual(new Date(2026, 1, 1));
      });
    });

    describe("maxTokens option", () => {
      it("should not modify context when under token limit", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          "# Short note"
        );

        const context = await builder.getContext({ maxTokens: 10000 });

        expect(context.daily).toHaveLength(1);
      });

      it("should trim daily notes when over token limit", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        const longContent = "x".repeat(1000);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          longContent
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-01.md`,
          longContent
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-01-31.md`,
          longContent
        );

        // Set a low token limit that can only fit ~1 note
        const context = await builder.getContext({ maxTokens: 300 });

        // Should have trimmed to fewer daily notes
        expect(context.daily.length).toBeLessThan(3);
      });

      it("should remove period notes when needed to fit limit", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.mkdir(`${vaultPath}/Journal/Weekly`, true);
        await fs.mkdir(`${vaultPath}/Journal/Monthly`, true);
        await fs.mkdir(`${vaultPath}/Journal/Quarterly`, true);

        const longContent = "x".repeat(500);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          longContent
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Weekly/2026-W06.md`,
          longContent
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Monthly/2026-02.md`,
          longContent
        );
        await fs.writeFile(
          `${vaultPath}/Journal/Quarterly/2026-Q1.md`,
          longContent
        );

        // Very low limit
        const context = await builder.getContext({
          includeQuarterly: true,
          maxTokens: 200,
        });

        // Should have removed some period notes
        const hasAllPeriods =
          context.weekly !== undefined &&
          context.monthly !== undefined &&
          context.quarterly !== undefined;
        expect(hasAllPeriods).toBe(false);
      });
    });

    describe("frontmatter parsing", () => {
      it("should parse frontmatter from notes", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          `---
title: My Daily Note
tags:
  - journal
  - daily
---
# Content here`
        );

        const context = await builder.getContext();

        expect(context.daily[0]!.frontmatter).toEqual({
          title: "My Daily Note",
          tags: ["journal", "daily"],
        });
        expect(context.daily[0]!.body).toBe("# Content here");
      });

      it("should handle notes without frontmatter", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          "# Just content, no frontmatter"
        );

        const context = await builder.getContext();

        expect(context.daily[0]!.frontmatter).toEqual({});
        expect(context.daily[0]!.body).toBe("# Just content, no frontmatter");
      });
    });

    describe("error handling", () => {
      it("should skip notes that cannot be read", async () => {
        await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
        await fs.writeFile(
          `${vaultPath}/Journal/Daily/2026-02-02.md`,
          "# Readable"
        );

        // Mock an error for a specific file
        const originalReadFile = fs.readFile.bind(fs);
        vi.spyOn(fs, "readFile").mockImplementation(async (path: string) => {
          if (path.includes("2026-02-01")) {
            throw new Error("Read error");
          }
          return originalReadFile(path);
        });

        const context = await builder.getContext();

        // Should still have the readable note
        expect(context.daily).toHaveLength(1);
        expect(context.daily[0]!.content).toBe("# Readable");
      });
    });
  });

  describe("clearConfigCache", () => {
    it("should clear the config cache", async () => {
      await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
      await fs.writeFile(`${vaultPath}/Journal/Daily/2026-02-02.md`, "# Note");

      // First call caches the config
      await builder.getContext();

      // Modify config - change daily path
      const newConfig = { ...defaultConfig };
      newConfig.paths.daily = "Notes/Daily/{year}-{month}-{date}.md";
      await fs.writeFile(
        `${vaultPath}/.cadence/config.json`,
        JSON.stringify(newConfig)
      );

      // Should still use cached config (old path)
      let context = await builder.getContext();
      expect(context.daily).toHaveLength(1);

      // Clear cache and try again
      builder.clearConfigCache();

      // Now should use new config (new path, no notes there)
      context = await builder.getContext();
      expect(context.daily).toHaveLength(0);
    });
  });
});
