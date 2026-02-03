import { describe, it, expect, beforeEach } from "vitest";
import {
  createFromTemplate,
  validateAndApplyDefaults,
  stripTemplateMetadata,
} from "./createFromTemplate.js";
import { TemplateRegistry } from "./TemplateRegistry.js";
import { MemoryFileSystem } from "../fs/index.js";
import { TemplateRenderError, TemplateNotFoundError } from "../errors/index.js";

describe("createFromTemplate", () => {
  let fs: MemoryFileSystem;
  let registry: TemplateRegistry;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    registry = new TemplateRegistry(fs);
  });

  describe("basic functionality", () => {
    it("should create a note from a simple template", async () => {
      const templateContent = `# {{title}}

Created on {{date}}`;
      await fs.writeFile("/templates/simple.md", templateContent);
      registry.register("simple", "/templates/simple.md");

      const note = await createFromTemplate(
        "simple",
        "/notes/test.md",
        { title: "Test Note", date: "2024-01-15" },
        { fs, registry }
      );

      expect(note.path).toBe("/notes/test.md");
      expect(note.content).toBe("# Test Note\n\nCreated on 2024-01-15");
      expect(note.body).toBe("# Test Note\n\nCreated on 2024-01-15");
    });

    it("should create a note with frontmatter", async () => {
      const templateContent = `---
title: {{title}}
date: {{date}}
---

# {{title}}

Content here.`;
      await fs.writeFile("/templates/with-fm.md", templateContent);
      registry.register("with-fm", "/templates/with-fm.md");

      const note = await createFromTemplate(
        "with-fm",
        "/notes/test.md",
        { title: "My Note", date: "2024-01-15" },
        { fs, registry }
      );

      expect(note.frontmatter).toEqual({
        title: "My Note",
        date: "2024-01-15",
      });
      // Body includes content after the frontmatter closing delimiter, including leading newline
      expect(note.body).toBe("\n# My Note\n\nContent here.");
    });

    it("should create parent directories if they don't exist", async () => {
      await fs.writeFile("/templates/simple.md", "# {{title}}");
      registry.register("simple", "/templates/simple.md");

      await createFromTemplate(
        "simple",
        "/deep/nested/path/note.md",
        { title: "Test" },
        { fs, registry }
      );

      expect(await fs.exists("/deep/nested/path/note.md")).toBe(true);
    });

    it("should write the rendered content to the target path", async () => {
      await fs.writeFile("/templates/simple.md", "Hello {{name}}!");
      registry.register("simple", "/templates/simple.md");

      await createFromTemplate("simple", "/output.md", { name: "World" }, { fs, registry });

      const written = await fs.readFile("/output.md");
      expect(written).toBe("Hello World!");
    });
  });

  describe("template metadata stripping", () => {
    it("should strip template metadata from frontmatter", async () => {
      const templateContent = `---
template:
  name: Meeting Notes
  description: Template for meetings
  variables:
    - name: title
      required: true
title: {{title}}
---

# {{title}}`;
      await fs.writeFile("/templates/meeting.md", templateContent);
      registry.register("meeting", "/templates/meeting.md");

      const note = await createFromTemplate(
        "meeting",
        "/notes/meeting.md",
        { title: "Project Sync" },
        { fs, registry }
      );

      // Template metadata should be stripped, only title should remain
      expect(note.frontmatter).toEqual({ title: "Project Sync" });
      expect(note.content).not.toContain("template:");
      expect(note.content).not.toContain("Meeting Notes");
    });

    it("should remove frontmatter entirely if only template block exists", async () => {
      const templateContent = `---
template:
  name: Simple
  variables:
    - name: content
      required: true
---

{{content}}`;
      await fs.writeFile("/templates/simple.md", templateContent);
      registry.register("simple", "/templates/simple.md");

      const note = await createFromTemplate(
        "simple",
        "/notes/simple.md",
        { content: "Hello!" },
        { fs, registry }
      );

      expect(note.content).toBe("Hello!");
      expect(note.frontmatter).toEqual({});
    });
  });

  describe("variable validation", () => {
    it("should throw error for missing required variables", async () => {
      const templateContent = `---
template:
  variables:
    - name: title
      required: true
    - name: author
      required: true
---

# {{title}} by {{author}}`;
      await fs.writeFile("/templates/article.md", templateContent);
      registry.register("article", "/templates/article.md");

      await expect(
        createFromTemplate("article", "/notes/article.md", { title: "My Article" }, { fs, registry })
      ).rejects.toThrow(TemplateRenderError);
    });

    it("should include missing variable names in error", async () => {
      const templateContent = `---
template:
  variables:
    - name: var1
      required: true
    - name: var2
      required: true
    - name: var3
      required: true
---

{{var1}} {{var2}} {{var3}}`;
      await fs.writeFile("/templates/multi.md", templateContent);
      registry.register("multi", "/templates/multi.md");

      try {
        await createFromTemplate("multi", "/notes/test.md", { var1: "one" }, { fs, registry });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateRenderError);
        const renderError = error as TemplateRenderError;
        expect(renderError.missingVariables).toContain("var2");
        expect(renderError.missingVariables).toContain("var3");
      }
    });

    it("should apply default values for optional variables", async () => {
      const templateContent = `---
template:
  variables:
    - name: title
      required: true
    - name: status
      required: false
      default: draft
---

# {{title}}

Status: {{status}}`;
      await fs.writeFile("/templates/with-default.md", templateContent);
      registry.register("with-default", "/templates/with-default.md");

      const note = await createFromTemplate(
        "with-default",
        "/notes/note.md",
        { title: "My Note" },
        { fs, registry }
      );

      expect(note.content).toContain("Status: draft");
    });

    it("should allow overriding default values", async () => {
      const templateContent = `---
template:
  variables:
    - name: status
      required: false
      default: draft
---

Status: {{status}}`;
      await fs.writeFile("/templates/override.md", templateContent);
      registry.register("override", "/templates/override.md");

      const note = await createFromTemplate(
        "override",
        "/notes/note.md",
        { status: "published" },
        { fs, registry }
      );

      expect(note.content).toContain("Status: published");
    });

    it("should handle array default values", async () => {
      const templateContent = `---
template:
  variables:
    - name: tags
      required: false
      default:
        - general
---

Tags: {{tags}}`;
      await fs.writeFile("/templates/tags.md", templateContent);
      registry.register("tags", "/templates/tags.md");

      const note = await createFromTemplate("tags", "/notes/note.md", {}, { fs, registry });

      expect(note.content).toContain("Tags: general");
    });

    it("should succeed with all required variables provided", async () => {
      const templateContent = `---
template:
  variables:
    - name: a
      required: true
    - name: b
      required: true
---

{{a}} and {{b}}`;
      await fs.writeFile("/templates/required.md", templateContent);
      registry.register("required", "/templates/required.md");

      const note = await createFromTemplate(
        "required",
        "/notes/note.md",
        { a: "first", b: "second" },
        { fs, registry }
      );

      expect(note.content).toBe("first and second");
    });
  });

  describe("error handling", () => {
    it("should throw TemplateNotFoundError for unregistered template", async () => {
      await expect(
        createFromTemplate("unknown", "/notes/note.md", {}, { fs, registry })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it("should throw TemplateNotFoundError for missing template file", async () => {
      registry.register("missing", "/templates/missing.md");

      await expect(
        createFromTemplate("missing", "/notes/note.md", {}, { fs, registry })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it("should throw TemplateRenderError for invalid Handlebars syntax", async () => {
      await fs.writeFile("/templates/invalid.md", "{{#each items}}{{/if}}");
      registry.register("invalid", "/templates/invalid.md");

      await expect(
        createFromTemplate("invalid", "/notes/note.md", { items: [] }, { fs, registry })
      ).rejects.toThrow(TemplateRenderError);
    });
  });

  describe("templates without variable definitions", () => {
    it("should work with templates that have no variable definitions", async () => {
      const templateContent = `# {{title}}

{{content}}`;
      await fs.writeFile("/templates/legacy.md", templateContent);
      registry.register("legacy", "/templates/legacy.md");

      const note = await createFromTemplate(
        "legacy",
        "/notes/note.md",
        { title: "Hello", content: "World" },
        { fs, registry }
      );

      expect(note.content).toBe("# Hello\n\nWorld");
    });

    it("should use built-in variables from TemplateEngine", async () => {
      const templateContent = "Today is {{date}}";
      await fs.writeFile("/templates/date.md", templateContent);
      registry.register("date", "/templates/date.md");

      const note = await createFromTemplate("date", "/notes/note.md", {}, { fs, registry });

      // Should have a date in YYYY-MM-DD format
      expect(note.content).toMatch(/Today is \d{4}-\d{2}-\d{2}/);
    });
  });
});

describe("validateAndApplyDefaults", () => {
  it("should return provided variables when all required are present", () => {
    const variableDefs = [
      { name: "title", required: true },
      { name: "author", required: true },
    ];
    const provided = { title: "Test", author: "Me" };

    const result = validateAndApplyDefaults(variableDefs, provided, "test");
    expect(result).toEqual({ title: "Test", author: "Me" });
  });

  it("should throw TemplateRenderError for missing required variables", () => {
    const variableDefs = [{ name: "title", required: true }];
    const provided = {};

    expect(() => validateAndApplyDefaults(variableDefs, provided, "test")).toThrow(
      TemplateRenderError
    );
  });

  it("should list all missing variables in error", () => {
    const variableDefs = [
      { name: "a", required: true },
      { name: "b", required: true },
      { name: "c", required: true },
    ];
    const provided = {};

    try {
      validateAndApplyDefaults(variableDefs, provided, "test");
      expect.fail("Should have thrown");
    } catch (error) {
      const renderError = error as TemplateRenderError;
      expect(renderError.missingVariables).toEqual(["a", "b", "c"]);
    }
  });

  it("should apply defaults for optional variables", () => {
    const variableDefs = [
      { name: "title", required: true },
      { name: "status", required: false, default: "draft" },
    ];
    const provided = { title: "Test" };

    const result = validateAndApplyDefaults(variableDefs, provided, "test");
    expect(result).toEqual({ title: "Test", status: "draft" });
  });

  it("should not apply default if value is explicitly provided", () => {
    const variableDefs = [{ name: "status", required: false, default: "draft" }];
    const provided = { status: "published" };

    const result = validateAndApplyDefaults(variableDefs, provided, "test");
    expect(result).toEqual({ status: "published" });
  });

  it("should not apply default if value is empty string", () => {
    const variableDefs = [{ name: "status", required: false, default: "draft" }];
    const provided = { status: "" };

    const result = validateAndApplyDefaults(variableDefs, provided, "test");
    expect(result).toEqual({ status: "" });
  });

  it("should apply default if value is undefined", () => {
    const variableDefs = [{ name: "status", required: false, default: "draft" }];
    const provided = { status: undefined };

    const result = validateAndApplyDefaults(variableDefs, provided, "test");
    expect(result).toEqual({ status: "draft" });
  });

  it("should not apply default if value is null", () => {
    const variableDefs = [{ name: "status", required: false, default: "draft" }];
    const provided = { status: null };

    const result = validateAndApplyDefaults(variableDefs, provided, "test");
    expect(result).toEqual({ status: null });
  });

  it("should handle empty variable definitions", () => {
    const result = validateAndApplyDefaults([], { extra: "value" }, "test");
    expect(result).toEqual({ extra: "value" });
  });

  it("should preserve extra variables not in definitions", () => {
    const variableDefs = [{ name: "title", required: true }];
    const provided = { title: "Test", extra: "bonus", another: 42 };

    const result = validateAndApplyDefaults(variableDefs, provided, "test");
    expect(result).toEqual({ title: "Test", extra: "bonus", another: 42 });
  });

  it("should handle complex default values", () => {
    const variableDefs = [
      {
        name: "config",
        required: false,
        default: { nested: { deep: true }, array: [1, 2, 3] },
      },
    ];
    const provided = {};

    const result = validateAndApplyDefaults(variableDefs, provided, "test");
    expect(result).toEqual({
      config: { nested: { deep: true }, array: [1, 2, 3] },
    });
  });
});

describe("stripTemplateMetadata", () => {
  it("should remove template block from frontmatter", () => {
    const content = `---
template:
  name: Test
  description: A test
title: My Note
---

Content`;
    const result = stripTemplateMetadata(content);

    expect(result).not.toContain("template:");
    expect(result).toContain("title: My Note");
    expect(result).toContain("Content");
  });

  it("should handle frontmatter with only template block", () => {
    const content = `---
template:
  name: Test
  variables:
    - name: var1
      required: true
---

Body content`;
    const result = stripTemplateMetadata(content);

    expect(result).toBe("Body content");
  });

  it("should not modify content without frontmatter", () => {
    const content = "# Just a heading\n\nSome content.";
    const result = stripTemplateMetadata(content);

    expect(result).toBe(content);
  });

  it("should not modify content without template block", () => {
    const content = `---
title: Note
date: 2024-01-15
---

Content`;
    const result = stripTemplateMetadata(content);

    expect(result).toBe(content);
  });

  it("should handle nested template variables", () => {
    const content = `---
template:
  name: Complex
  variables:
    - name: var1
      required: true
      description: First variable
    - name: var2
      required: false
      default:
        nested: value
        array:
          - item1
          - item2
other_key: value
---

Body`;
    const result = stripTemplateMetadata(content);

    expect(result).not.toContain("template:");
    expect(result).not.toContain("name: Complex");
    expect(result).toContain("other_key: value");
    expect(result).toContain("Body");
  });

  it("should handle empty frontmatter after stripping", () => {
    const content = `---
template:
  name: Only Template
---

Content`;
    const result = stripTemplateMetadata(content);

    expect(result).toBe("Content");
  });

  it("should preserve body content exactly", () => {
    const content = `---
template:
  name: Test
---

# Heading

- Item 1
- Item 2

\`\`\`javascript
const x = 1;
\`\`\``;
    const result = stripTemplateMetadata(content);

    expect(result).toBe(`# Heading

- Item 1
- Item 2

\`\`\`javascript
const x = 1;
\`\`\``);
  });
});
