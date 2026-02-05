import { describe, it, expect, beforeEach } from "vitest";
import { TemplateManager } from "./TemplateManager.js";
import { ConfigLoader, getDefaultConfig } from "../config/index.js";
import { MemoryFileSystem } from "../fs/index.js";
import {
  TemplateExistsError,
  TemplateNotFoundError,
  TemplateProtectedError,
  TemplateValidationError,
} from "../errors/index.js";

describe("TemplateManager", () => {
  let fs: MemoryFileSystem;
  let configLoader: ConfigLoader;
  let manager: TemplateManager;
  const vaultPath = "/vault";

  beforeEach(async () => {
    fs = new MemoryFileSystem();
    configLoader = new ConfigLoader(fs);

    // Set up a minimal config
    const config = getDefaultConfig();
    await fs.mkdir("/vault/.cadence", true);
    await fs.writeFile("/vault/.cadence/config.json", JSON.stringify(config, null, 2));

    // Set up templates directory
    await fs.mkdir("/vault/Templates", true);

    // Create default templates for protected template tests
    await fs.writeFile("/vault/Templates/daily.md", "# Daily Note\n{{date}}");
    await fs.writeFile("/vault/Templates/weekly.md", "# Weekly Note\n{{weekNum}}");
    await fs.writeFile("/vault/Templates/monthly.md", "# Monthly Note\n{{month}}");
    await fs.writeFile("/vault/Templates/quarterly.md", "# Quarterly Note\n{{quarter}}");
    await fs.writeFile("/vault/Templates/yearly.md", "# Yearly Note\n{{year}}");

    manager = new TemplateManager(fs, configLoader, vaultPath);
  });

  describe("create", () => {
    it("should create a new template", async () => {
      const result = await manager.create({
        name: "meeting",
        content: "# {{title}}\n\nAttendees: {{attendees}}",
      });

      expect(result.name).toBe("meeting");
      expect(result.path).toBe("Templates/meeting.md");
      expect(result.created).toBe(true);

      // Verify file was created
      const content = await fs.readFile("/vault/Templates/meeting.md");
      expect(content).toBe("# {{title}}\n\nAttendees: {{attendees}}");

      // Verify config was updated
      const config = await configLoader.loadConfig(vaultPath);
      expect(config.templates["meeting"]).toBe("Templates/meeting.md");
    });

    it("should create template with custom path", async () => {
      const result = await manager.create({
        name: "project",
        content: "# {{title}}",
        path: "CustomTemplates/project.md",
      });

      expect(result.path).toBe("CustomTemplates/project.md");

      // Verify file was created at custom path
      const content = await fs.readFile("/vault/CustomTemplates/project.md");
      expect(content).toBe("# {{title}}");
    });

    it("should create template with metadata", async () => {
      const result = await manager.create({
        name: "meeting",
        content: "# Meeting\n\nContent here",
        metadata: {
          description: "Template for meeting notes",
          category: "work",
          variables: [
            { name: "title", required: true },
            { name: "attendees", required: false, default: [] },
          ],
        },
      });

      expect(result.created).toBe(true);

      // Verify metadata was injected into frontmatter
      const content = await fs.readFile("/vault/Templates/meeting.md");
      expect(content).toContain("template:");
      expect(content).toContain("description: 'Template for meeting notes'");
      expect(content).toContain("category: 'work'");
      expect(content).toContain("variables:");
    });

    it("should throw TemplateExistsError if template already exists", async () => {
      await manager.create({
        name: "meeting",
        content: "# Original",
      });

      await expect(
        manager.create({
          name: "meeting",
          content: "# New",
        })
      ).rejects.toThrow(TemplateExistsError);
    });

    it("should overwrite existing template if overwrite is true", async () => {
      await manager.create({
        name: "meeting",
        content: "# Original",
      });

      const result = await manager.create({
        name: "meeting",
        content: "# Updated",
        overwrite: true,
      });

      expect(result.created).toBe(false);

      const content = await fs.readFile("/vault/Templates/meeting.md");
      expect(content).toBe("# Updated");
    });

    it("should throw TemplateValidationError for invalid Handlebars syntax", async () => {
      await expect(
        manager.create({
          name: "invalid",
          content: "# {{unclosed",
        })
      ).rejects.toThrow(TemplateValidationError);
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      // Create a template to update
      await manager.create({
        name: "meeting",
        content: "# {{title}}\n\nOriginal content",
      });
    });

    it("should update template content", async () => {
      const result = await manager.update({
        name: "meeting",
        content: "# {{title}}\n\nUpdated content",
      });

      expect(result.name).toBe("meeting");
      expect(result.path).toBe("Templates/meeting.md");

      const content = await fs.readFile("/vault/Templates/meeting.md");
      expect(content).toBe("# {{title}}\n\nUpdated content");
    });

    it("should update template metadata only", async () => {
      const result = await manager.update({
        name: "meeting",
        metadata: {
          description: "Updated description",
        },
      });

      expect(result.name).toBe("meeting");

      // Verify metadata was merged
      const content = await fs.readFile("/vault/Templates/meeting.md");
      expect(content).toContain("template:");
      expect(content).toContain("description: 'Updated description'");
      // Original content should still be there
      expect(content).toContain("# {{title}}");
    });

    it("should rename template", async () => {
      const result = await manager.update({
        name: "meeting",
        newName: "standup",
      });

      expect(result.name).toBe("standup");
      expect(result.previousName).toBe("meeting");

      // Verify config was updated
      const config = await configLoader.loadConfig(vaultPath);
      expect(config.templates["standup"]).toBeDefined();
      expect(config.templates["meeting"]).toBeUndefined();
    });

    it("should move template file", async () => {
      const result = await manager.update({
        name: "meeting",
        newPath: "CustomTemplates/meeting.md",
      });

      expect(result.path).toBe("CustomTemplates/meeting.md");
      expect(result.previousPath).toBe("Templates/meeting.md");

      // Verify file was moved
      expect(await fs.exists("/vault/CustomTemplates/meeting.md")).toBe(true);
      expect(await fs.exists("/vault/Templates/meeting.md")).toBe(false);

      // Verify config was updated
      const config = await configLoader.loadConfig(vaultPath);
      expect(config.templates["meeting"]).toBe("CustomTemplates/meeting.md");
    });

    it("should throw TemplateNotFoundError for non-existent template", async () => {
      await expect(
        manager.update({
          name: "nonexistent",
          content: "# Updated",
        })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it("should throw TemplateExistsError when renaming to existing name", async () => {
      await manager.create({
        name: "standup",
        content: "# Standup",
      });

      await expect(
        manager.update({
          name: "meeting",
          newName: "standup",
        })
      ).rejects.toThrow(TemplateExistsError);
    });

    it("should throw TemplateValidationError for invalid content", async () => {
      await expect(
        manager.update({
          name: "meeting",
          content: "# {{unclosed",
        })
      ).rejects.toThrow(TemplateValidationError);
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      // Create a template to delete
      await manager.create({
        name: "meeting",
        content: "# {{title}}",
      });
    });

    it("should delete template file and config", async () => {
      const result = await manager.delete({
        name: "meeting",
      });

      expect(result.name).toBe("meeting");
      expect(result.path).toBe("Templates/meeting.md");
      expect(result.fileDeleted).toBe(true);
      expect(result.configUpdated).toBe(true);

      // Verify file was deleted
      expect(await fs.exists("/vault/Templates/meeting.md")).toBe(false);

      // Verify config was updated
      const config = await configLoader.loadConfig(vaultPath);
      expect(config.templates["meeting"]).toBeUndefined();
    });

    it("should keep file if keepFile is true", async () => {
      const result = await manager.delete({
        name: "meeting",
        keepFile: true,
      });

      expect(result.fileDeleted).toBe(false);
      expect(result.configUpdated).toBe(true);

      // Verify file still exists
      expect(await fs.exists("/vault/Templates/meeting.md")).toBe(true);

      // Verify config was updated
      const config = await configLoader.loadConfig(vaultPath);
      expect(config.templates["meeting"]).toBeUndefined();
    });

    it("should throw TemplateNotFoundError for non-existent template", async () => {
      await expect(
        manager.delete({
          name: "nonexistent",
        })
      ).rejects.toThrow(TemplateNotFoundError);
    });

    it("should throw TemplateProtectedError for daily template", async () => {
      await expect(
        manager.delete({
          name: "daily",
        })
      ).rejects.toThrow(TemplateProtectedError);
    });

    it("should throw TemplateProtectedError for weekly template", async () => {
      await expect(
        manager.delete({
          name: "weekly",
        })
      ).rejects.toThrow(TemplateProtectedError);
    });

    it("should throw TemplateProtectedError for monthly template", async () => {
      await expect(
        manager.delete({
          name: "monthly",
        })
      ).rejects.toThrow(TemplateProtectedError);
    });

    it("should throw TemplateProtectedError for quarterly template", async () => {
      await expect(
        manager.delete({
          name: "quarterly",
        })
      ).rejects.toThrow(TemplateProtectedError);
    });

    it("should throw TemplateProtectedError for yearly template", async () => {
      await expect(
        manager.delete({
          name: "yearly",
        })
      ).rejects.toThrow(TemplateProtectedError);
    });
  });

  describe("isProtected", () => {
    it("should return true for protected templates", () => {
      expect(manager.isProtected("daily")).toBe(true);
      expect(manager.isProtected("weekly")).toBe(true);
      expect(manager.isProtected("monthly")).toBe(true);
      expect(manager.isProtected("quarterly")).toBe(true);
      expect(manager.isProtected("yearly")).toBe(true);
    });

    it("should return false for non-protected templates", () => {
      expect(manager.isProtected("meeting")).toBe(false);
      expect(manager.isProtected("project")).toBe(false);
      expect(manager.isProtected("custom")).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete template lifecycle", async () => {
      // Create
      const createResult = await manager.create({
        name: "project",
        content: "# {{title}}\n\nProject content",
        metadata: {
          description: "Project template",
        },
      });
      expect(createResult.created).toBe(true);

      // Update content
      await manager.update({
        name: "project",
        content: "# {{title}}\n\nUpdated project content",
      });

      // Update metadata
      await manager.update({
        name: "project",
        metadata: {
          description: "Updated project template",
          category: "projects",
        },
      });

      // Rename
      const renameResult = await manager.update({
        name: "project",
        newName: "initiative",
      });
      expect(renameResult.previousName).toBe("project");

      // Delete
      const deleteResult = await manager.delete({
        name: "initiative",
      });
      expect(deleteResult.fileDeleted).toBe(true);
      expect(deleteResult.configUpdated).toBe(true);
    });

    it("should handle multiple templates", async () => {
      // Create several templates
      await manager.create({ name: "meeting", content: "# Meeting" });
      await manager.create({ name: "standup", content: "# Standup" });
      await manager.create({ name: "retrospective", content: "# Retro" });

      // Verify all exist in config
      const config = await configLoader.loadConfig(vaultPath);
      expect(config.templates["meeting"]).toBeDefined();
      expect(config.templates["standup"]).toBeDefined();
      expect(config.templates["retrospective"]).toBeDefined();

      // Delete one
      await manager.delete({ name: "standup" });

      // Verify others still exist
      const updatedConfig = await configLoader.loadConfig(vaultPath);
      expect(updatedConfig.templates["meeting"]).toBeDefined();
      expect(updatedConfig.templates["standup"]).toBeUndefined();
      expect(updatedConfig.templates["retrospective"]).toBeDefined();
    });
  });
});
