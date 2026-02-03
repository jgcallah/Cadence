import { describe, it, expect, beforeEach } from "vitest";
import { TemplateRegistry } from "./TemplateRegistry.js";
import { MemoryFileSystem } from "../fs/index.js";
import { TemplateNotFoundError } from "../errors/index.js";

describe("TemplateRegistry", () => {
  let fs: MemoryFileSystem;
  let registry: TemplateRegistry;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    registry = new TemplateRegistry(fs);
  });

  describe("register", () => {
    it("should register a template with a name", () => {
      registry.register("meeting", "/templates/meeting.md");
      expect(registry.has("meeting")).toBe(true);
    });

    it("should overwrite existing registration", () => {
      registry.register("meeting", "/templates/old.md");
      registry.register("meeting", "/templates/new.md");
      expect(registry.getPath("meeting")).toBe("/templates/new.md");
    });

    it("should handle multiple template registrations", () => {
      registry.register("meeting", "/templates/meeting.md");
      registry.register("daily", "/templates/daily.md");
      registry.register("weekly", "/templates/weekly.md");

      expect(registry.has("meeting")).toBe(true);
      expect(registry.has("daily")).toBe(true);
      expect(registry.has("weekly")).toBe(true);
    });
  });

  describe("loadFromConfig", () => {
    it("should load templates from config object", () => {
      registry.loadFromConfig({
        daily: "Templates/daily.md",
        weekly: "Templates/weekly.md",
        meeting: "Templates/meeting.md",
      });

      expect(registry.has("daily")).toBe(true);
      expect(registry.has("weekly")).toBe(true);
      expect(registry.has("meeting")).toBe(true);
    });

    it("should handle empty config", () => {
      registry.loadFromConfig({});
      expect(registry.has("anything")).toBe(false);
    });
  });

  describe("getPath", () => {
    it("should return the path for a registered template", () => {
      registry.register("meeting", "/templates/meeting.md");
      expect(registry.getPath("meeting")).toBe("/templates/meeting.md");
    });

    it("should throw TemplateNotFoundError for unregistered template", () => {
      expect(() => registry.getPath("unknown")).toThrow(TemplateNotFoundError);
    });

    it("should include template name in error", () => {
      try {
        registry.getPath("missing");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateNotFoundError);
        expect((error as TemplateNotFoundError).templateName).toBe("missing");
      }
    });
  });

  describe("has", () => {
    it("should return true for registered template", () => {
      registry.register("test", "/test.md");
      expect(registry.has("test")).toBe(true);
    });

    it("should return false for unregistered template", () => {
      expect(registry.has("unknown")).toBe(false);
    });
  });

  describe("get", () => {
    it("should return template content", async () => {
      const content = "# Meeting Notes\n\n{{title}}";
      await fs.writeFile("/templates/meeting.md", content);
      registry.register("meeting", "/templates/meeting.md");

      const result = await registry.get("meeting");
      expect(result).toBe(content);
    });

    it("should throw TemplateNotFoundError for unregistered template", async () => {
      await expect(registry.get("unknown")).rejects.toThrow(TemplateNotFoundError);
    });

    it("should throw TemplateNotFoundError if file doesn't exist", async () => {
      registry.register("meeting", "/templates/missing.md");
      await expect(registry.get("meeting")).rejects.toThrow(TemplateNotFoundError);
    });

    it("should handle templates with special characters", async () => {
      const content = "Special chars: @#$%^&*()";
      await fs.writeFile("/templates/special.md", content);
      registry.register("special", "/templates/special.md");

      const result = await registry.get("special");
      expect(result).toBe(content);
    });
  });

  describe("getMetadata", () => {
    it("should parse template metadata from frontmatter", async () => {
      const content = `---
template:
  name: Meeting Notes
  description: Template for meeting notes
  variables:
    - name: title
      required: true
    - name: attendees
      required: false
      default: []
---

# {{title}}

Attendees: {{attendees}}`;
      await fs.writeFile("/templates/meeting.md", content);
      registry.register("meeting", "/templates/meeting.md");

      const metadata = await registry.getMetadata("meeting");
      expect(metadata.name).toBe("Meeting Notes");
      expect(metadata.description).toBe("Template for meeting notes");
      expect(metadata.variables).toHaveLength(2);
    });

    it("should return empty metadata for template without template block", async () => {
      const content = `---
title: Regular Note
---

# Content`;
      await fs.writeFile("/templates/plain.md", content);
      registry.register("plain", "/templates/plain.md");

      const metadata = await registry.getMetadata("plain");
      expect(metadata.name).toBeUndefined();
      expect(metadata.description).toBeUndefined();
      expect(metadata.variables).toBeUndefined();
    });

    it("should return empty metadata for template without frontmatter", async () => {
      const content = "# Just content\n\nNo frontmatter here.";
      await fs.writeFile("/templates/simple.md", content);
      registry.register("simple", "/templates/simple.md");

      const metadata = await registry.getMetadata("simple");
      expect(metadata).toEqual({});
    });
  });

  describe("getVariables", () => {
    it("should return variable definitions from template", async () => {
      const content = `---
template:
  variables:
    - name: title
      required: true
      description: The meeting title
    - name: date
      required: true
    - name: attendees
      required: false
      default: []
---

Content`;
      await fs.writeFile("/templates/meeting.md", content);
      registry.register("meeting", "/templates/meeting.md");

      const variables = await registry.getVariables("meeting");
      expect(variables).toHaveLength(3);

      expect(variables[0]).toEqual({
        name: "title",
        required: true,
        description: "The meeting title",
      });

      expect(variables[1]).toEqual({
        name: "date",
        required: true,
      });

      expect(variables[2]).toEqual({
        name: "attendees",
        required: false,
        default: [],
      });
    });

    it("should return empty array for template without variables", async () => {
      const content = `---
template:
  name: Simple Template
---

Content`;
      await fs.writeFile("/templates/simple.md", content);
      registry.register("simple", "/templates/simple.md");

      const variables = await registry.getVariables("simple");
      expect(variables).toEqual([]);
    });

    it("should return empty array for template without template block", async () => {
      const content = "# No metadata";
      await fs.writeFile("/templates/plain.md", content);
      registry.register("plain", "/templates/plain.md");

      const variables = await registry.getVariables("plain");
      expect(variables).toEqual([]);
    });

    it("should handle various default value types", async () => {
      const content = `---
template:
  variables:
    - name: stringVar
      required: false
      default: "hello"
    - name: numberVar
      required: false
      default: 42
    - name: boolVar
      required: false
      default: true
    - name: arrayVar
      required: false
      default:
        - item1
        - item2
    - name: objectVar
      required: false
      default:
        key: value
---

Content`;
      await fs.writeFile("/templates/defaults.md", content);
      registry.register("defaults", "/templates/defaults.md");

      const variables = await registry.getVariables("defaults");
      expect(variables).toHaveLength(5);

      expect(variables[0].default).toBe("hello");
      expect(variables[1].default).toBe(42);
      expect(variables[2].default).toBe(true);
      expect(variables[3].default).toEqual(["item1", "item2"]);
      expect(variables[4].default).toEqual({ key: "value" });
    });
  });

  describe("list", () => {
    it("should return list of all registered templates", async () => {
      await fs.writeFile("/templates/meeting.md", `---
template:
  description: Meeting notes template
---

Content`);
      await fs.writeFile("/templates/daily.md", `---
template:
  description: Daily journal template
---

Content`);

      registry.register("meeting", "/templates/meeting.md");
      registry.register("daily", "/templates/daily.md");

      const list = await registry.list();
      expect(list).toHaveLength(2);

      const meeting = list.find((t) => t.name === "meeting");
      expect(meeting).toBeDefined();
      expect(meeting!.path).toBe("/templates/meeting.md");
      expect(meeting!.description).toBe("Meeting notes template");

      const daily = list.find((t) => t.name === "daily");
      expect(daily).toBeDefined();
      expect(daily!.path).toBe("/templates/daily.md");
      expect(daily!.description).toBe("Daily journal template");
    });

    it("should return empty array for empty registry", async () => {
      const list = await registry.list();
      expect(list).toEqual([]);
    });

    it("should handle templates without descriptions", async () => {
      await fs.writeFile("/templates/plain.md", "# No metadata");
      registry.register("plain", "/templates/plain.md");

      const list = await registry.list();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("plain");
      expect(list[0].description).toBeUndefined();
    });

    it("should handle unreadable templates gracefully", async () => {
      registry.register("missing", "/templates/missing.md");

      const list = await registry.list();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("missing");
      expect(list[0].path).toBe("/templates/missing.md");
      expect(list[0].description).toBeUndefined();
    });
  });

  describe("parseTemplateMetadata", () => {
    it("should parse complete template metadata", () => {
      const content = `---
template:
  name: Test Template
  description: A test template
  variables:
    - name: var1
      required: true
---

Content`;
      const metadata = registry.parseTemplateMetadata(content);

      expect(metadata.name).toBe("Test Template");
      expect(metadata.description).toBe("A test template");
      expect(metadata.variables).toHaveLength(1);
    });

    it("should handle partial metadata", () => {
      const content = `---
template:
  description: Just a description
---

Content`;
      const metadata = registry.parseTemplateMetadata(content);

      expect(metadata.name).toBeUndefined();
      expect(metadata.description).toBe("Just a description");
      expect(metadata.variables).toBeUndefined();
    });

    it("should skip invalid variable entries", () => {
      const content = `---
template:
  variables:
    - name: valid
      required: true
    - invalid: entry
    - 42
    - name: also_valid
      required: false
---

Content`;
      const metadata = registry.parseTemplateMetadata(content);

      expect(metadata.variables).toHaveLength(2);
      expect(metadata.variables![0].name).toBe("valid");
      expect(metadata.variables![1].name).toBe("also_valid");
    });
  });

  describe("clear", () => {
    it("should remove all registered templates", () => {
      registry.register("one", "/one.md");
      registry.register("two", "/two.md");
      registry.register("three", "/three.md");

      expect(registry.has("one")).toBe(true);
      expect(registry.has("two")).toBe(true);
      expect(registry.has("three")).toBe(true);

      registry.clear();

      expect(registry.has("one")).toBe(false);
      expect(registry.has("two")).toBe(false);
      expect(registry.has("three")).toBe(false);
    });
  });
});
