import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  MemoryFileSystem,
  ConfigLoader,
  NoteService,
  DateParser,
  TemplateRegistry,
  createFromTemplate,
  type NoteType as _NoteType,
} from "@cadence/core";
import { parseRange, getNotesInRange } from "./utils/date-range.js";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    bold: (str: string) => str,
    cyan: (str: string) => str,
    green: (str: string) => str,
    gray: (str: string) => str,
    red: (str: string) => str,
    yellow: (str: string) => str,
  },
}));

describe("CLI Integration with mocked IFileSystem", () => {
  let fs: MemoryFileSystem;
  let configLoader: ConfigLoader;
  const vaultPath = "/test/vault";

  beforeEach(async () => {
    fs = new MemoryFileSystem();
    configLoader = new ConfigLoader(fs);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("init workflow", () => {
    it("should create .cadence/config.json with default config", async () => {
      await configLoader.generateDefaultConfigFile(vaultPath);

      const configExists = await fs.exists("/test/vault/.cadence/config.json");
      expect(configExists).toBe(true);

      const config = await configLoader.loadConfig(vaultPath);
      expect(config.version).toBe(1);
      expect(config.paths.daily).toBeDefined();
      expect(config.paths.weekly).toBeDefined();
      expect(config.paths.monthly).toBeDefined();
    });

    it("should fail when config already exists without force", async () => {
      await configLoader.generateDefaultConfigFile(vaultPath);

      await expect(
        configLoader.generateDefaultConfigFile(vaultPath)
      ).rejects.toThrow(/already exists/);
    });

    it("should overwrite config with force option", async () => {
      await configLoader.generateDefaultConfigFile(vaultPath);

      // This should not throw
      await configLoader.generateDefaultConfigFile(vaultPath, { force: true });

      const config = await configLoader.loadConfig(vaultPath);
      expect(config.version).toBe(1);
    });
  });

  describe("daily workflow", () => {
    beforeEach(async () => {
      await configLoader.generateDefaultConfigFile(vaultPath);
    });

    it("should create today's daily note", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const today = new Date();

      const notePath = await noteService.ensureNote("daily", today);

      expect(notePath).toContain("/Daily/");
      expect(notePath).toContain(".md");

      const noteExists = await fs.exists(notePath);
      expect(noteExists).toBe(true);
    });

    it("should return same path if note already exists", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const today = new Date();

      const firstPath = await noteService.ensureNote("daily", today);
      const secondPath = await noteService.ensureNote("daily", today);

      expect(firstPath).toBe(secondPath);
    });

    it("should create note for parsed date (yesterday)", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const dateParser = new DateParser();
      const yesterday = dateParser.parse("yesterday");

      const notePath = await noteService.ensureNote("daily", yesterday);

      expect(notePath).toContain("/Daily/");
      expect(notePath).toContain(".md");

      const noteExists = await fs.exists(notePath);
      expect(noteExists).toBe(true);
    });

    it("should check note existence", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const today = new Date();

      expect(await noteService.noteExists("daily", today)).toBe(false);

      await noteService.ensureNote("daily", today);

      expect(await noteService.noteExists("daily", today)).toBe(true);
    });
  });

  describe("different note types", () => {
    beforeEach(async () => {
      await configLoader.generateDefaultConfigFile(vaultPath);
    });

    it("should create weekly note", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const today = new Date();

      const notePath = await noteService.ensureNote("weekly", today);

      expect(notePath).toContain("/Weekly/");
      expect(notePath).toContain("/W");
      expect(notePath).toContain(".md");
    });

    it("should create monthly note", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const today = new Date();

      const notePath = await noteService.ensureNote("monthly", today);

      expect(notePath).toContain("/Monthly/");
      expect(notePath).toContain(".md");
    });

    it("should create quarterly note", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const today = new Date();

      const notePath = await noteService.ensureNote("quarterly", today);

      expect(notePath).toContain("/Quarterly/");
      expect(notePath).toContain("/Q");
      expect(notePath).toContain(".md");
    });

    it("should create yearly note", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const today = new Date();

      const notePath = await noteService.ensureNote("yearly", today);

      expect(notePath).toContain("/Year.md");
    });
  });

  describe("period-specific date parsing", () => {
    const fixedDate = new Date("2026-02-02T12:00:00.000Z");

    beforeEach(async () => {
      vi.setSystemTime(fixedDate);
      await configLoader.generateDefaultConfigFile(vaultPath);
    });

    it("should create weekly note from ISO week format", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const dateParser = new DateParser();
      const weekDate = dateParser.parseForType("2026-W05", "weekly");

      const notePath = await noteService.ensureNote("weekly", weekDate);

      expect(notePath).toContain("/Weekly/");
      expect(notePath).toContain("W05");
    });

    it("should create quarterly note from Q1 format", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const dateParser = new DateParser();
      const quarterDate = dateParser.parseForType("Q1 2026", "quarterly");

      const notePath = await noteService.ensureNote("quarterly", quarterDate);

      expect(notePath).toContain("/Quarterly/");
      expect(notePath).toContain("Q1");
    });

    it("should create yearly note from year format", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const dateParser = new DateParser();
      const yearDate = dateParser.parseForType("2025", "yearly");

      const notePath = await noteService.ensureNote("yearly", yearDate);

      expect(notePath).toContain("2025");
      expect(notePath).toContain("Year.md");
    });

    it("should create monthly note from YYYY-MM format", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const dateParser = new DateParser();
      const monthDate = dateParser.parseForType("2026-01", "monthly");

      const notePath = await noteService.ensureNote("monthly", monthDate);

      expect(notePath).toContain("/Monthly/");
      expect(notePath).toContain("/01.md");
    });
  });

  describe("list command workflow", () => {
    const fixedDate = new Date("2026-02-02T12:00:00.000Z");

    beforeEach(async () => {
      vi.setSystemTime(fixedDate);
      await configLoader.generateDefaultConfigFile(vaultPath);
    });

    it("should list existing daily notes in range", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const dateParser = new DateParser();

      // Create a few daily notes
      const jan1 = new Date(2026, 0, 1);
      const jan2 = new Date(2026, 0, 2);
      const jan3 = new Date(2026, 0, 3);

      await noteService.ensureNote("daily", jan1);
      await noteService.ensureNote("daily", jan2);
      await noteService.ensureNote("daily", jan3);

      // Get all dates in range
      const { start, end } = parseRange("last 40 days", "daily", dateParser);
      const dates = getNotesInRange("daily", start, end);

      // Check which notes exist
      const existingNotes: string[] = [];
      for (const date of dates) {
        if (await noteService.noteExists("daily", date)) {
          existingNotes.push(await noteService.ensureNote("daily", date));
        }
      }

      expect(existingNotes.length).toBe(3);
      expect(existingNotes.some((p) => p.includes("/01/01.md"))).toBe(true);
      expect(existingNotes.some((p) => p.includes("/01/02.md"))).toBe(true);
      expect(existingNotes.some((p) => p.includes("/01/03.md"))).toBe(true);
    });

    it("should list existing monthly notes in range", async () => {
      const noteService = new NoteService(fs, configLoader, vaultPath);
      const dateParser = new DateParser();

      // Create monthly notes
      const jan = new Date(2026, 0, 1);
      const feb = new Date(2026, 1, 1);

      await noteService.ensureNote("monthly", jan);
      await noteService.ensureNote("monthly", feb);

      // Parse range and get dates
      const { start, end } = parseRange("last 3 months", "monthly", dateParser);
      const dates = getNotesInRange("monthly", start, end);

      // Check which notes exist
      const existingNotes: string[] = [];
      for (const date of dates) {
        if (await noteService.noteExists("monthly", date)) {
          existingNotes.push(await noteService.ensureNote("monthly", date));
        }
      }

      expect(existingNotes.length).toBe(2);
    });
  });

  describe("template workflow", () => {
    const fixedDate = new Date("2026-02-02T12:00:00.000Z");

    beforeEach(async () => {
      vi.setSystemTime(fixedDate);
      await configLoader.generateDefaultConfigFile(vaultPath);
    });

    it("should list available templates", async () => {
      const config = await configLoader.loadConfig(vaultPath);
      const registry = new TemplateRegistry(fs);
      registry.loadFromConfig(config.templates);

      const templates = await registry.list();

      // Default config should have at least daily, weekly, monthly templates
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t) => t.name === "daily")).toBe(true);
      expect(templates.some((t) => t.name === "weekly")).toBe(true);
    });

    it("should check if template exists", async () => {
      const config = await configLoader.loadConfig(vaultPath);
      const registry = new TemplateRegistry(fs);
      registry.loadFromConfig(config.templates);

      expect(registry.has("daily")).toBe(true);
      expect(registry.has("nonexistent")).toBe(false);
    });

    it("should create note from template with custom variables", async () => {
      const config = await configLoader.loadConfig(vaultPath);
      const registry = new TemplateRegistry(fs);
      registry.loadFromConfig(config.templates);

      // First create a custom template
      const templatePath = "/test/vault/.cadence/templates/meeting.md";
      const templateContent = `---
template:
  name: Meeting Notes
  description: Template for meeting notes
  variables:
    - name: title
      required: true
      description: Meeting title
    - name: attendees
      required: false
      default: "TBD"
---

# {{title}}

**Attendees:** {{attendees}}
**Date:** {{date}}

## Notes

`;

      await fs.mkdir("/test/vault/.cadence/templates", true);
      await fs.writeFile(templatePath, templateContent);

      // Register the template
      registry.register("meeting", templatePath);

      // Create note from template
      const targetPath = "/test/vault/Notes/meeting-test.md";
      const note = await createFromTemplate(
        "meeting",
        targetPath,
        { title: "Sprint Planning", attendees: "Alice, Bob" },
        { fs, registry }
      );

      expect(note.path).toBe(targetPath);
      expect(note.content).toContain("# Sprint Planning");
      expect(note.content).toContain("**Attendees:** Alice, Bob");

      // Verify file was created
      const exists = await fs.exists(targetPath);
      expect(exists).toBe(true);
    });

    it("should get template variables", async () => {
      const config = await configLoader.loadConfig(vaultPath);
      const registry = new TemplateRegistry(fs);
      registry.loadFromConfig(config.templates);

      // Create a template with variables
      const templatePath = "/test/vault/.cadence/templates/test.md";
      const templateContent = `---
template:
  name: Test Template
  description: A test template
  variables:
    - name: required_var
      required: true
      description: A required variable
    - name: optional_var
      required: false
      default: "default value"
      description: An optional variable
---

Content with {{required_var}} and {{optional_var}}
`;

      await fs.mkdir("/test/vault/.cadence/templates", true);
      await fs.writeFile(templatePath, templateContent);
      registry.register("test", templatePath);

      const variables = await registry.getVariables("test");

      expect(variables.length).toBe(2);

      const requiredVar = variables.find((v) => v.name === "required_var");
      expect(requiredVar).toBeDefined();
      expect(requiredVar?.required).toBe(true);
      expect(requiredVar?.description).toBe("A required variable");

      const optionalVar = variables.find((v) => v.name === "optional_var");
      expect(optionalVar).toBeDefined();
      expect(optionalVar?.required).toBe(false);
      expect(optionalVar?.default).toBe("default value");
    });

    it("should apply default values for optional variables", async () => {
      const config = await configLoader.loadConfig(vaultPath);
      const registry = new TemplateRegistry(fs);
      registry.loadFromConfig(config.templates);

      // Create a template with optional variable that has default
      const templatePath = "/test/vault/.cadence/templates/defaults.md";
      const templateContent = `---
template:
  name: Defaults Template
  variables:
    - name: title
      required: true
    - name: status
      required: false
      default: "Draft"
---

# {{title}}

Status: {{status}}
`;

      await fs.mkdir("/test/vault/.cadence/templates", true);
      await fs.writeFile(templatePath, templateContent);
      registry.register("defaults", templatePath);

      // Create note without providing optional variable
      const targetPath = "/test/vault/Notes/defaults-test.md";
      const note = await createFromTemplate(
        "defaults",
        targetPath,
        { title: "My Note" },
        { fs, registry }
      );

      expect(note.content).toContain("# My Note");
      expect(note.content).toContain("Status: Draft");
    });
  });
});
