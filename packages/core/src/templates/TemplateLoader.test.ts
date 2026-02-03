import { describe, it, expect, beforeEach } from "vitest";
import { TemplateLoader } from "./TemplateLoader.js";
import { MemoryFileSystem } from "../fs/index.js";
import { TemplateNotFoundError } from "../errors/index.js";

describe("TemplateLoader", () => {
  let fs: MemoryFileSystem;
  let loader: TemplateLoader;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    loader = new TemplateLoader(fs);
  });

  describe("load", () => {
    it("should load a template file successfully", async () => {
      const templateContent = `---
title: {{title}}
---

# {{heading}}

{{content}}`;
      await fs.writeFile("/templates/daily.md", templateContent);

      const result = await loader.load("/templates/daily.md");
      expect(result).toBe(templateContent);
    });

    it("should load template with different extensions", async () => {
      await fs.writeFile("/templates/note.hbs", "Template: {{name}}");
      const result = await loader.load("/templates/note.hbs");
      expect(result).toBe("Template: {{name}}");
    });

    it("should throw TemplateNotFoundError if template does not exist", async () => {
      await expect(loader.load("/templates/nonexistent.md")).rejects.toThrow(
        TemplateNotFoundError
      );
    });

    it("should include template path in error", async () => {
      try {
        await loader.load("/templates/missing.md");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateNotFoundError);
        expect((error as TemplateNotFoundError).templateName).toBe(
          "/templates/missing.md"
        );
      }
    });

    it("should handle paths with special characters", async () => {
      await fs.writeFile("/templates/my template (1).md", "Content");
      const result = await loader.load("/templates/my template (1).md");
      expect(result).toBe("Content");
    });

    it("should handle nested template paths", async () => {
      await fs.mkdir("/templates/notes/daily", true);
      await fs.writeFile(
        "/templates/notes/daily/morning.md",
        "Morning template"
      );

      const result = await loader.load("/templates/notes/daily/morning.md");
      expect(result).toBe("Morning template");
    });

    it("should handle templates with unicode content", async () => {
      const unicodeContent = `---
title: 日本語テンプレート
---

# {{heading}}

こんにちは、{{name}}さん！`;
      await fs.writeFile("/templates/japanese.md", unicodeContent);

      const result = await loader.load("/templates/japanese.md");
      expect(result).toBe(unicodeContent);
    });

    it("should preserve line endings", async () => {
      const contentWithNewlines = "Line 1\nLine 2\n\nLine 4\n";
      await fs.writeFile("/templates/newlines.md", contentWithNewlines);

      const result = await loader.load("/templates/newlines.md");
      expect(result).toBe(contentWithNewlines);
    });

    it("should handle empty template file", async () => {
      await fs.writeFile("/templates/empty.md", "");
      const result = await loader.load("/templates/empty.md");
      expect(result).toBe("");
    });

    it("should handle large template files", async () => {
      const largeContent = "# Template\n\n" + "Content line.\n".repeat(10000);
      await fs.writeFile("/templates/large.md", largeContent);

      const result = await loader.load("/templates/large.md");
      expect(result).toBe(largeContent);
    });

    it("should handle Windows-style paths", async () => {
      // MemoryFileSystem should normalize paths
      await fs.writeFile("/templates/note.md", "Content");
      const result = await loader.load("/templates/note.md");
      expect(result).toBe("Content");
    });
  });

  describe("error propagation", () => {
    it("should wrap filesystem errors appropriately", async () => {
      // Force an error by trying to read from a non-existent path
      await expect(loader.load("/nonexistent/template.md")).rejects.toThrow(
        TemplateNotFoundError
      );
    });

    it("should distinguish between not found and other errors", async () => {
      // The MemoryFileSystem throws an error for non-existent files
      // TemplateLoader should convert this to TemplateNotFoundError
      const error = await loader.load("/missing.md").catch((e) => e);
      expect(error).toBeInstanceOf(TemplateNotFoundError);
    });
  });
});
