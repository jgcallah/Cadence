import { describe, it, expect, beforeEach } from "vitest";
import { NoteService } from "./NoteService.js";
import { MemoryFileSystem } from "../fs/MemoryFileSystem.js";
import { ConfigLoader, getDefaultConfig } from "../config/index.js";
import { NoteNotFoundError } from "../errors/index.js";
import type { CadenceConfig } from "../config/types.js";

// Helper to create dates in local timezone at noon to avoid timezone issues
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe("NoteService", () => {
  let fs: MemoryFileSystem;
  let configLoader: ConfigLoader;
  let noteService: NoteService;
  const vaultPath = "/vault";

  beforeEach(async () => {
    fs = new MemoryFileSystem();
    configLoader = new ConfigLoader(fs);

    // Set up vault with config
    const config: CadenceConfig = {
      ...getDefaultConfig(),
      paths: {
        daily: "Journal/Daily/{year}/{month}/{date}.md",
        weekly: "Journal/Weekly/{year}/W{week}.md",
        monthly: "Journal/Monthly/{year}/{month}.md",
        quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
        yearly: "Journal/Yearly/{year}.md",
        templates: "Templates",
      },
      templates: {
        daily: "Templates/daily.md",
      },
    };

    await fs.mkdir(`${vaultPath}/.cadence`, true);
    await fs.writeFile(
      `${vaultPath}/.cadence/config.json`,
      JSON.stringify(config)
    );

    // Create daily template
    await fs.mkdir(`${vaultPath}/Templates`, true);
    await fs.writeFile(
      `${vaultPath}/Templates/daily.md`,
      `---
type: daily
created: '{{date}}'
---
# Daily Note for {{date}}

## Tasks

## Notes
`
    );

    noteService = new NoteService(fs, configLoader, vaultPath);
  });


  describe("noteExists", () => {
    it("should return false when note does not exist", async () => {
      const date = localDate(2026, 3, 15);

      const exists = await noteService.noteExists("daily", date);

      expect(exists).toBe(false);
    });

    it("should return true when note exists", async () => {
      const date = localDate(2026, 3, 15);
      const notePath = `${vaultPath}/Journal/Daily/2026/03/15.md`;

      await fs.mkdir(`${vaultPath}/Journal/Daily/2026/03`, true);
      await fs.writeFile(notePath, "# Test note");

      const exists = await noteService.noteExists("daily", date);

      expect(exists).toBe(true);
    });
  });

  describe("ensureNote", () => {
    it("should create a new note when it does not exist", async () => {
      const date = localDate(2026, 3, 15);
      const expectedPath = `${vaultPath}/Journal/Daily/2026/03/15.md`;

      const path = await noteService.ensureNote("daily", date);

      expect(path).toBe(expectedPath);
      expect(await fs.exists(expectedPath)).toBe(true);
    });

    it("should create parent folders automatically", async () => {
      const date = localDate(2026, 3, 15);

      await noteService.ensureNote("daily", date);

      expect(await fs.exists(`${vaultPath}/Journal/Daily/2026/03`)).toBe(true);
    });

    it("should use template to render new note content", async () => {
      const date = localDate(2026, 3, 15);

      const path = await noteService.ensureNote("daily", date);

      const content = await fs.readFile(path);
      expect(content).toContain("# Daily Note for");
      expect(content).toContain("type: daily");
    });

    it("should return existing path without modifying note when note already exists", async () => {
      const date = localDate(2026, 3, 15);
      const notePath = `${vaultPath}/Journal/Daily/2026/03/15.md`;
      const originalContent = `---
type: daily
custom: value
---
# My existing note`;

      await fs.mkdir(`${vaultPath}/Journal/Daily/2026/03`, true);
      await fs.writeFile(notePath, originalContent);

      const path = await noteService.ensureNote("daily", date);

      expect(path).toBe(notePath);
      const content = await fs.readFile(path);
      expect(content).toBe(originalContent);
    });

    it("should be idempotent - calling twice returns same result", async () => {
      const date = localDate(2026, 3, 15);

      const path1 = await noteService.ensureNote("daily", date);
      const content1 = await fs.readFile(path1);

      const path2 = await noteService.ensureNote("daily", date);
      const content2 = await fs.readFile(path2);

      expect(path1).toBe(path2);
      expect(content1).toBe(content2);
    });

    it("should create note without template when template not configured", async () => {
      // Create config without daily template
      const config: CadenceConfig = {
        ...getDefaultConfig(),
        paths: {
          daily: "Journal/Daily/{year}/{month}/{date}.md",
          weekly: "Journal/Weekly/{year}/W{week}.md",
          monthly: "Journal/Monthly/{year}/{month}.md",
          quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
          yearly: "Journal/Yearly/{year}.md",
          templates: "Templates",
        },
        templates: {}, // No templates configured
      };

      await fs.writeFile(
        `${vaultPath}/.cadence/config.json`,
        JSON.stringify(config)
      );

      const date = localDate(2026, 3, 15);

      const path = await noteService.ensureNote("daily", date);

      expect(await fs.exists(path)).toBe(true);
      const content = await fs.readFile(path);
      // Should create empty note or basic note structure
      expect(content).toBeDefined();
    });
  });

  describe("getNote", () => {
    it("should read and parse an existing note with frontmatter", async () => {
      const date = localDate(2026, 3, 15);
      const notePath = `${vaultPath}/Journal/Daily/2026/03/15.md`;
      const noteContent = `---
type: daily
tags:
  - journal
  - work
priority: 1
---
# Daily Note

Some content here.`;

      await fs.mkdir(`${vaultPath}/Journal/Daily/2026/03`, true);
      await fs.writeFile(notePath, noteContent);

      const note = await noteService.getNote("daily", date);

      expect(note.path).toBe(notePath);
      expect(note.content).toBe(noteContent);
      expect(note.frontmatter).toEqual({
        type: "daily",
        tags: ["journal", "work"],
        priority: 1,
      });
      expect(note.body).toBe("# Daily Note\n\nSome content here.");
    });

    it("should read note without frontmatter", async () => {
      const date = localDate(2026, 3, 15);
      const notePath = `${vaultPath}/Journal/Daily/2026/03/15.md`;
      const noteContent = `# Daily Note

No frontmatter here.`;

      await fs.mkdir(`${vaultPath}/Journal/Daily/2026/03`, true);
      await fs.writeFile(notePath, noteContent);

      const note = await noteService.getNote("daily", date);

      expect(note.path).toBe(notePath);
      expect(note.content).toBe(noteContent);
      expect(note.frontmatter).toEqual({});
      expect(note.body).toBe(noteContent);
    });

    it("should throw NoteNotFoundError when note does not exist", async () => {
      const date = localDate(2026, 3, 15);

      await expect(noteService.getNote("daily", date)).rejects.toThrow(
        NoteNotFoundError
      );
    });

    it("should include the note path in the error", async () => {
      const date = localDate(2026, 3, 15);

      const error = await noteService.getNote("daily", date).catch((e) => e);

      expect(error).toBeInstanceOf(NoteNotFoundError);
      expect(error.notePath).toContain("2026/03/15.md");
    });
  });

  describe("weekly notes", () => {
    it("should generate correct path for weekly notes", async () => {
      const date = localDate(2026, 3, 15); // Week 11 of 2026

      const exists = await noteService.noteExists("weekly", date);

      expect(exists).toBe(false);
    });

    it("should create weekly note with correct path", async () => {
      // Create weekly template
      await fs.writeFile(
        `${vaultPath}/Templates/weekly.md`,
        `---
type: weekly
---
# Week {{weekNum}}
`
      );

      // Update config with weekly template
      const config: CadenceConfig = {
        ...getDefaultConfig(),
        paths: {
          daily: "Journal/Daily/{year}/{month}/{date}.md",
          weekly: "Journal/Weekly/{year}/W{week}.md",
          monthly: "Journal/Monthly/{year}/{month}.md",
          quarterly: "Journal/Quarterly/{year}/Q{quarter}.md",
          yearly: "Journal/Yearly/{year}.md",
          templates: "Templates",
        },
        templates: {
          daily: "Templates/daily.md",
          weekly: "Templates/weekly.md",
        },
      };
      await fs.writeFile(
        `${vaultPath}/.cadence/config.json`,
        JSON.stringify(config)
      );

      const date = localDate(2026, 3, 15); // Week 11

      const path = await noteService.ensureNote("weekly", date);

      expect(path).toBe(`${vaultPath}/Journal/Weekly/2026/W11.md`);
      expect(await fs.exists(path)).toBe(true);
    });
  });

  describe("monthly notes", () => {
    it("should create monthly note with correct path", async () => {
      const date = localDate(2026, 3, 15);

      const path = await noteService.ensureNote("monthly", date);

      expect(path).toBe(`${vaultPath}/Journal/Monthly/2026/03.md`);
      expect(await fs.exists(path)).toBe(true);
    });
  });

  describe("quarterly notes", () => {
    it("should create quarterly note with correct path", async () => {
      const date = localDate(2026, 3, 15); // Q1

      const path = await noteService.ensureNote("quarterly", date);

      expect(path).toBe(`${vaultPath}/Journal/Quarterly/2026/Q1.md`);
      expect(await fs.exists(path)).toBe(true);
    });
  });

  describe("yearly notes", () => {
    it("should create yearly note with correct path", async () => {
      const date = localDate(2026, 3, 15);

      const path = await noteService.ensureNote("yearly", date);

      expect(path).toBe(`${vaultPath}/Journal/Yearly/2026.md`);
      expect(await fs.exists(path)).toBe(true);
    });
  });

  describe("getCurrentPeriod", () => {
    it("should return period info for daily notes", () => {
      const date = localDate(2026, 3, 15);
      const period = noteService.getCurrentPeriod("daily", date);

      expect(period.label).toBe("March 15, 2026");
      expect(period.start).toBeInstanceOf(Date);
      expect(period.end).toBeInstanceOf(Date);
    });

    it("should return period info for weekly notes", () => {
      const date = localDate(2026, 3, 15);
      const period = noteService.getCurrentPeriod("weekly", date);

      expect(period.label).toBe("Week 11, 2026");
    });

    it("should return period info for monthly notes", () => {
      const date = localDate(2026, 3, 15);
      const period = noteService.getCurrentPeriod("monthly", date);

      expect(period.label).toBe("March 2026");
    });

    it("should return period info for quarterly notes", () => {
      const date = localDate(2026, 3, 15);
      const period = noteService.getCurrentPeriod("quarterly", date);

      expect(period.label).toBe("Q1 2026");
    });

    it("should return period info for yearly notes", () => {
      const date = localDate(2026, 3, 15);
      const period = noteService.getCurrentPeriod("yearly", date);

      expect(period.label).toBe("2026");
    });
  });

  describe("getNoteLinks", () => {
    it("should return parent link for daily note", async () => {
      const date = localDate(2026, 3, 15);
      const links = await noteService.getNoteLinks("daily", date);

      // Daily notes should link to their weekly note
      expect(links.parentNote).toBe("[[Journal/Weekly/2026/W11]]");
    });

    it("should return parent link for weekly note", async () => {
      const date = localDate(2026, 3, 15);
      const links = await noteService.getNoteLinks("weekly", date);

      // Weekly notes should link to their monthly note
      expect(links.parentNote).toBe("[[Journal/Monthly/2026/03]]");
    });

    it("should return parent link for monthly note", async () => {
      const date = localDate(2026, 3, 15);
      const links = await noteService.getNoteLinks("monthly", date);

      // Monthly notes should link to their quarterly note
      expect(links.parentNote).toBe("[[Journal/Quarterly/2026/Q1]]");
    });

    it("should return parent link for quarterly note", async () => {
      const date = localDate(2026, 3, 15);
      const links = await noteService.getNoteLinks("quarterly", date);

      // Quarterly notes should link to their yearly note
      expect(links.parentNote).toBe("[[Journal/Yearly/2026]]");
    });

    it("should return null parent for yearly note", async () => {
      const date = localDate(2026, 3, 15);
      const links = await noteService.getNoteLinks("yearly", date);

      // Yearly notes have no parent
      expect(links.parentNote).toBeNull();
    });

    it("should return child links for weekly note", async () => {
      const date = localDate(2026, 3, 9); // Start of week 11
      const links = await noteService.getNoteLinks("weekly", date);

      // Weekly notes should have 7 daily child links
      expect(links.childNotes.length).toBe(7);
      expect(links.childNotes[0]).toMatch(/\[\[Journal\/Daily\/2026\/03\/\d{2}\]\]/);
    });

    it("should return child links for monthly note", async () => {
      const date = localDate(2026, 3, 15);
      const links = await noteService.getNoteLinks("monthly", date);

      // Monthly notes should have multiple weekly child links
      expect(links.childNotes.length).toBeGreaterThan(0);
      expect(links.childNotes[0]).toMatch(/\[\[Journal\/Weekly\/2026\/W\d+\]\]/);
    });

    it("should return child links for quarterly note", async () => {
      const date = localDate(2026, 3, 15);
      const links = await noteService.getNoteLinks("quarterly", date);

      // Quarterly notes should have 3 monthly child links
      expect(links.childNotes.length).toBe(3);
      expect(links.childNotes).toContain("[[Journal/Monthly/2026/01]]");
      expect(links.childNotes).toContain("[[Journal/Monthly/2026/02]]");
      expect(links.childNotes).toContain("[[Journal/Monthly/2026/03]]");
    });

    it("should return child links for yearly note", async () => {
      const date = localDate(2026, 3, 15);
      const links = await noteService.getNoteLinks("yearly", date);

      // Yearly notes should have 4 quarterly child links
      expect(links.childNotes.length).toBe(4);
      expect(links.childNotes).toContain("[[Journal/Quarterly/2026/Q1]]");
      expect(links.childNotes).toContain("[[Journal/Quarterly/2026/Q2]]");
      expect(links.childNotes).toContain("[[Journal/Quarterly/2026/Q3]]");
      expect(links.childNotes).toContain("[[Journal/Quarterly/2026/Q4]]");
    });

    it("should return empty child links for daily note", async () => {
      const date = localDate(2026, 3, 15);
      const links = await noteService.getNoteLinks("daily", date);

      // Daily notes have no children
      expect(links.childNotes).toEqual([]);
    });
  });

  describe("template with navigation links", () => {
    it("should include parentNote in template variables", async () => {
      // Create a template that uses parentNote
      await fs.writeFile(
        `${vaultPath}/Templates/daily.md`,
        `---
type: daily
---
# Daily Note

Parent: {{parentNote}}
`
      );

      const date = localDate(2026, 3, 15);
      const path = await noteService.ensureNote("daily", date);
      const content = await fs.readFile(path);

      expect(content).toContain("Parent: [[Journal/Weekly/2026/W11]]");
    });

    it("should include periodLabel in template variables", async () => {
      await fs.writeFile(
        `${vaultPath}/Templates/daily.md`,
        `---
type: daily
---
# {{periodLabel}}
`
      );

      const date = localDate(2026, 3, 15);
      const path = await noteService.ensureNote("daily", date);
      const content = await fs.readFile(path);

      expect(content).toContain("# March 15, 2026");
    });
  });

  describe("edge cases", () => {
    it("should handle Windows-style paths", async () => {
      const windowsVaultPath = "C:\\Users\\Test\\vault";
      const windowsFs = new MemoryFileSystem();
      const windowsConfigLoader = new ConfigLoader(windowsFs);

      const config: CadenceConfig = {
        ...getDefaultConfig(),
        paths: {
          daily: "Journal\\Daily\\{year}\\{month}\\{date}.md",
          weekly: "Journal\\Weekly\\{year}\\W{week}.md",
          monthly: "Journal\\Monthly\\{year}\\{month}.md",
          quarterly: "Journal\\Quarterly\\{year}\\Q{quarter}.md",
          yearly: "Journal\\Yearly\\{year}.md",
          templates: "Templates",
        },
        templates: {},
      };

      await windowsFs.mkdir(`${windowsVaultPath}\\.cadence`, true);
      await windowsFs.writeFile(
        `${windowsVaultPath}\\.cadence\\config.json`,
        JSON.stringify(config)
      );

      const windowsNoteService = new NoteService(
        windowsFs,
        windowsConfigLoader,
        windowsVaultPath
      );
      const date = localDate(2026, 3, 15);

      const exists = await windowsNoteService.noteExists("daily", date);

      expect(exists).toBe(false);
    });

    it("should handle empty frontmatter blocks", async () => {
      const date = localDate(2026, 3, 15);
      const notePath = `${vaultPath}/Journal/Daily/2026/03/15.md`;
      const noteContent = `---
---
# Daily Note`;

      await fs.mkdir(`${vaultPath}/Journal/Daily/2026/03`, true);
      await fs.writeFile(notePath, noteContent);

      const note = await noteService.getNote("daily", date);

      expect(note.frontmatter).toEqual({});
      expect(note.body).toBe("# Daily Note");
    });
  });
});
