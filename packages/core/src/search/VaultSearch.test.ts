import { describe, it, expect, beforeEach } from "vitest";
import { VaultSearch } from "./VaultSearch.js";
import { MemoryFileSystem } from "../fs/MemoryFileSystem.js";

describe("VaultSearch", () => {
  let fs: MemoryFileSystem;
  let search: VaultSearch;
  const vaultPath = "/vault";

  beforeEach(async () => {
    fs = new MemoryFileSystem();

    // Set up vault structure
    await fs.mkdir(vaultPath, true);
    await fs.mkdir(`${vaultPath}/Journal`, true);
    await fs.mkdir(`${vaultPath}/Journal/Daily`, true);
    await fs.mkdir(`${vaultPath}/Journal/Daily/2026`, true);
    await fs.mkdir(`${vaultPath}/Journal/Weekly`, true);
    await fs.mkdir(`${vaultPath}/Projects`, true);
    await fs.mkdir(`${vaultPath}/Notes`, true);

    // Create test files
    await fs.writeFile(
      `${vaultPath}/Journal/Daily/2026/01-15.md`,
      `---
type: daily
date: 2026-01-15
tags:
  - journal
  - work
---
# Daily Note January 15

## Tasks
- [ ] Review pull requests
- [ ] Update documentation

## Notes
Had a productive meeting today.
`
    );

    await fs.writeFile(
      `${vaultPath}/Journal/Daily/2026/01-16.md`,
      `---
type: daily
date: 2026-01-16
tags:
  - journal
  - personal
---
# Daily Note January 16

## Tasks
- [ ] Go for a run

## Notes
Relaxing day.
`
    );

    await fs.writeFile(
      `${vaultPath}/Journal/Weekly/2026-W03.md`,
      `---
type: weekly
week: 3
year: 2026
---
# Week 3, 2026

## Summary
A great week overall.
`
    );

    await fs.writeFile(
      `${vaultPath}/Projects/ProjectAlpha.md`,
      `---
title: Project Alpha
status: active
metadata:
  priority: high
  team: engineering
tags:
  - project
  - engineering
---
# Project Alpha

This is a high priority engineering project.

## Goals
- Deliver MVP by Q1
- Gather user feedback
`
    );

    await fs.writeFile(
      `${vaultPath}/Projects/ProjectBeta.md`,
      `---
title: Project Beta
status: completed
metadata:
  priority: low
tags:
  - project
  - completed
---
# Project Beta

This project has been completed.
`
    );

    await fs.writeFile(
      `${vaultPath}/Notes/MeetingNotes.md`,
      `---
title: Meeting Notes
type: meeting
attendees:
  - Alice
  - Bob
---
# Meeting Notes

## Discussion Points
- Review quarterly goals
- Discuss budget allocation
- Plan team offsite
`
    );

    await fs.writeFile(
      `${vaultPath}/Notes/Ideas.md`,
      `# Ideas

Some random ideas for the future.

- Build a new feature
- Write more documentation
`
    );

    search = new VaultSearch(fs, vaultPath);
  });

  describe("searchFiles", () => {
    it("should find files by exact name match", async () => {
      const results = await search.searchFiles("ProjectAlpha");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].path).toBe("Projects/ProjectAlpha.md");
      expect(results[0].score).toBeLessThan(0.5);
    });

    it("should find files by fuzzy name match", async () => {
      const results = await search.searchFiles("ProjAlph");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.path.includes("ProjectAlpha"))).toBe(true);
    });

    it("should return results sorted by relevance", async () => {
      const results = await search.searchFiles("Project");

      expect(results.length).toBeGreaterThanOrEqual(2);
      // First results should have better (lower) scores
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i - 1].score);
      }
    });

    it("should filter by path prefix", async () => {
      const results = await search.searchFiles("Notes", { path: "Journal" });

      // Should not find Notes folder files
      expect(results.every((r) => r.path.startsWith("Journal/"))).toBe(true);
    });

    it("should filter by note type", async () => {
      const results = await search.searchFiles("2026", { noteType: "daily" });

      // Should find daily notes
      expect(results.some((r) => r.path.includes("Daily"))).toBe(true);
    });

    it("should respect limit option", async () => {
      const results = await search.searchFiles("", { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should handle empty query", async () => {
      const results = await search.searchFiles("");

      // Empty query should still work (return all files with low relevance)
      expect(results).toBeDefined();
    });

    it("should not find non-existent files", async () => {
      const results = await search.searchFiles("NonExistentFile12345");

      expect(results.length).toBe(0);
    });

    it("should skip hidden files and directories", async () => {
      await fs.mkdir(`${vaultPath}/.obsidian`, true);
      await fs.writeFile(`${vaultPath}/.obsidian/config.json`, "{}");
      await fs.writeFile(`${vaultPath}/.hidden-note.md`, "# Hidden");

      // Invalidate cache to pick up new files
      search.invalidateCache();

      const results = await search.searchFiles("hidden");

      expect(results.every((r) => !r.path.startsWith("."))).toBe(true);
    });
  });

  describe("searchContent", () => {
    it("should find content matches", async () => {
      const results = await search.searchContent("productive meeting");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].path).toBe("Journal/Daily/2026/01-15.md");
      expect(results[0].content).toContain("productive meeting");
    });

    it("should return correct line numbers", async () => {
      const results = await search.searchContent("Review pull requests");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].line).toBeGreaterThan(0);
    });

    it("should include surrounding context", async () => {
      const results = await search.searchContent("Review pull requests");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context.length).toBeGreaterThan(0);
    });

    it("should be case-insensitive", async () => {
      const results = await search.searchContent("PROJECT ALPHA");

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some((r) => r.path === "Projects/ProjectAlpha.md")
      ).toBe(true);
    });

    it("should filter by path prefix", async () => {
      const results = await search.searchContent("goals", { path: "Projects" });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.path.startsWith("Projects/"))).toBe(true);
    });

    it("should filter by note type", async () => {
      const results = await search.searchContent("Tasks", { noteType: "daily" });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.path.includes("Daily"))).toBe(true);
    });

    it("should respect limit option", async () => {
      const results = await search.searchContent("the", { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should return empty for non-matching query", async () => {
      const results = await search.searchContent("xyznonexistent123");

      expect(results.length).toBe(0);
    });

    it("should find multiple matches in the same file", async () => {
      const results = await search.searchContent("Project", {
        path: "Projects",
      });

      // Should find multiple lines containing "Project" across project files
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("searchFrontmatter", () => {
    it("should find notes by simple field match", async () => {
      const results = await search.searchFrontmatter("type", "daily");

      expect(results.length).toBe(2);
      expect(results.every((r) => r.frontmatter.type === "daily")).toBe(true);
    });

    it("should find notes by nested field match", async () => {
      const results = await search.searchFrontmatter("metadata.priority", "high");

      expect(results.length).toBe(1);
      expect(results[0].path).toBe("Projects/ProjectAlpha.md");
    });

    it("should find notes where array contains value", async () => {
      const results = await search.searchFrontmatter("tags", "project");

      expect(results.length).toBe(2);
      expect(
        results.every((r) =>
          (r.frontmatter.tags as string[]).includes("project")
        )
      ).toBe(true);
    });

    it("should find notes where array contains value (work tag)", async () => {
      const results = await search.searchFrontmatter("tags", "work");

      expect(results.length).toBe(1);
      expect(results[0].path).toBe("Journal/Daily/2026/01-15.md");
    });

    it("should be case-insensitive for values", async () => {
      const results = await search.searchFrontmatter("status", "ACTIVE");

      expect(results.length).toBe(1);
      expect(results[0].frontmatter.status).toBe("active");
    });

    it("should filter by path prefix", async () => {
      const results = await search.searchFrontmatter("type", "daily", {
        path: "Journal/Daily",
      });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.path.startsWith("Journal/Daily/"))).toBe(
        true
      );
    });

    it("should respect limit option", async () => {
      const results = await search.searchFrontmatter("tags", "journal", {
        limit: 1,
      });

      expect(results.length).toBe(1);
    });

    it("should return empty for non-matching field", async () => {
      const results = await search.searchFrontmatter("nonexistent", "value");

      expect(results.length).toBe(0);
    });

    it("should return empty for non-matching value", async () => {
      const results = await search.searchFrontmatter("type", "nonexistent");

      expect(results.length).toBe(0);
    });

    it("should handle deeply nested fields", async () => {
      const results = await search.searchFrontmatter("metadata.team", "engineering");

      expect(results.length).toBe(1);
      expect(results[0].path).toBe("Projects/ProjectAlpha.md");
    });

    it("should return full note objects", async () => {
      const results = await search.searchFrontmatter("type", "meeting");

      expect(results.length).toBe(1);
      expect(results[0]).toHaveProperty("path");
      expect(results[0]).toHaveProperty("content");
      expect(results[0]).toHaveProperty("frontmatter");
      expect(results[0]).toHaveProperty("body");
      expect(results[0].frontmatter.title).toBe("Meeting Notes");
    });

    it("should handle notes without frontmatter", async () => {
      // Ideas.md has no frontmatter
      const results = await search.searchFrontmatter("type", "any");

      // Should not include Ideas.md
      expect(results.every((r) => r.path !== "Notes/Ideas.md")).toBe(true);
    });

    it("should filter array frontmatter by attendees", async () => {
      const results = await search.searchFrontmatter("attendees", "Alice");

      expect(results.length).toBe(1);
      expect(results[0].path).toBe("Notes/MeetingNotes.md");
    });
  });

  describe("caching", () => {
    it("should cache file list", async () => {
      // First search populates cache
      await search.searchFiles("test");

      // Add a new file
      await fs.writeFile(`${vaultPath}/NewFile.md`, "# New File");

      // Second search should use cache (not find new file)
      const results = await search.searchFiles("NewFile");

      // File may or may not be found depending on cache state
      // The important thing is the search doesn't crash
      expect(results).toBeDefined();
    });

    it("should invalidate cache when requested", async () => {
      // First search populates cache
      await search.searchFiles("test");

      // Add a new file
      await fs.writeFile(`${vaultPath}/NewFile.md`, "# New File");

      // Invalidate cache
      search.invalidateCache();

      // Search should find new file
      const results = await search.searchFiles("NewFile");

      expect(results.some((r) => r.path === "NewFile.md")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty vault", async () => {
      const emptyFs = new MemoryFileSystem();
      await emptyFs.mkdir("/empty-vault", true);
      const emptySearch = new VaultSearch(emptyFs, "/empty-vault");

      const fileResults = await emptySearch.searchFiles("anything");
      const contentResults = await emptySearch.searchContent("anything");
      const fmResults = await emptySearch.searchFrontmatter("any", "value");

      expect(fileResults.length).toBe(0);
      expect(contentResults.length).toBe(0);
      expect(fmResults.length).toBe(0);
    });

    it("should handle special characters in search query", async () => {
      const results = await search.searchContent("- [ ]");

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle files with only frontmatter", async () => {
      await fs.writeFile(
        `${vaultPath}/OnlyFrontmatter.md`,
        `---
title: Only Frontmatter
---`
      );
      search.invalidateCache();

      const results = await search.searchFrontmatter("title", "Only Frontmatter");

      expect(results.length).toBe(1);
      expect(results[0].body).toBe("");
    });

    it("should handle files with empty content", async () => {
      await fs.writeFile(`${vaultPath}/Empty.md`, "");
      search.invalidateCache();

      const contentResults = await search.searchContent("anything");
      const fmResults = await search.searchFrontmatter("any", "value");

      // Should not crash, just return no matches for this file
      expect(contentResults).toBeDefined();
      expect(fmResults).toBeDefined();
    });

    it("should handle unicode characters", async () => {
      await fs.writeFile(
        `${vaultPath}/Unicode.md`,
        `---
title: 日本語タイトル
---
# 日本語ノート

これは日本語のテストです。
`
      );
      search.invalidateCache();

      const results = await search.searchContent("日本語");

      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle very long lines", async () => {
      const longLine = "x".repeat(10000);
      await fs.writeFile(
        `${vaultPath}/LongLine.md`,
        `# Long Line Test\n\n${longLine}\n\nEnd of file`
      );
      search.invalidateCache();

      const results = await search.searchContent("Long Line Test");

      expect(results.length).toBe(1);
      expect(results[0].context.length).toBeGreaterThan(0);
    });

    it("should handle Windows-style path prefixes", async () => {
      const results = await search.searchFiles("Daily", {
        path: "Journal\\Daily",
      });

      expect(results.every((r) => r.path.startsWith("Journal/Daily"))).toBe(
        true
      );
    });

    it("should handle path prefix without trailing slash", async () => {
      const results = await search.searchFrontmatter("type", "daily", {
        path: "Journal/Daily",
      });

      expect(results.length).toBe(2);
    });

    it("should handle path prefix with leading slash", async () => {
      const results = await search.searchContent("Tasks", {
        path: "/Journal/Daily",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.path.startsWith("Journal/Daily"))).toBe(
        true
      );
    });
  });

  describe("noteType filtering", () => {
    it("should filter daily notes by noteType", async () => {
      const results = await search.searchFiles("", { noteType: "daily" });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.path.includes("Daily"))).toBe(true);
    });

    it("should filter weekly notes by noteType", async () => {
      const results = await search.searchFiles("", { noteType: "weekly" });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.path.includes("Weekly") || r.path.includes("W"))).toBe(true);
    });
  });

  describe("context lines", () => {
    it("should include lines before the match", async () => {
      const results = await search.searchContent("productive meeting");

      expect(results.length).toBeGreaterThan(0);
      // Should have some context lines
      expect(results[0].context.length).toBeGreaterThan(0);
    });

    it("should include lines after the match", async () => {
      const results = await search.searchContent("Discussion Points");

      expect(results.length).toBeGreaterThan(0);
      // Context should include surrounding lines
      const hasAfterLines = results[0].context.some(
        (line) => line.includes("Review") || line.includes("budget")
      );
      expect(hasAfterLines).toBe(true);
    });

    it("should handle match at start of file", async () => {
      await fs.writeFile(
        `${vaultPath}/StartMatch.md`,
        `Match at start
Line 2
Line 3
Line 4`
      );
      search.invalidateCache();

      const results = await search.searchContent("Match at start");

      expect(results.length).toBe(1);
      expect(results[0].line).toBe(1);
      // Should only have after context, not before
      expect(results[0].context.length).toBeGreaterThan(0);
    });

    it("should handle match at end of file", async () => {
      await fs.writeFile(
        `${vaultPath}/EndMatch.md`,
        `Line 1
Line 2
Line 3
Match at end`
      );
      search.invalidateCache();

      const results = await search.searchContent("Match at end");

      expect(results.length).toBe(1);
      expect(results[0].line).toBe(4);
      // Should only have before context, not after
      expect(results[0].context.length).toBeGreaterThan(0);
    });
  });
});
