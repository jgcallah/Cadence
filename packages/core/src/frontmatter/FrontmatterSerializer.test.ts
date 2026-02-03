import { describe, it, expect, beforeEach } from "vitest";
import { FrontmatterSerializer } from "./FrontmatterSerializer.js";

describe("FrontmatterSerializer", () => {
  let serializer: FrontmatterSerializer;

  beforeEach(() => {
    serializer = new FrontmatterSerializer();
  });

  describe("serialize", () => {
    describe("basic serialization", () => {
      it("should serialize empty frontmatter with body", () => {
        const result = serializer.serialize({}, "Body content");
        expect(result).toBe("Body content");
      });

      it("should serialize frontmatter with simple fields", () => {
        const frontmatter = { title: "My Note", date: "2024-01-15" };
        const result = serializer.serialize(frontmatter, "Body content");
        expect(result).toContain("---");
        expect(result).toContain("title:");
        expect(result).toContain("My Note");
        expect(result).toContain("2024-01-15");
        expect(result).toContain("Body content");
        expect(result).toMatch(/^---\n[\s\S]*\n---\nBody content$/);
      });

      it("should serialize frontmatter with arrays", () => {
        const frontmatter = {
          title: "Note",
          tags: ["daily", "work", "important"],
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("tags:");
        expect(result).toContain("daily");
        expect(result).toContain("work");
        expect(result).toContain("important");
      });

      it("should serialize frontmatter with nested objects", () => {
        const frontmatter = {
          title: "Note",
          metadata: {
            author: "John",
            version: 1,
          },
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("metadata:");
        expect(result).toContain("author:");
        expect(result).toContain("John");
        expect(result).toContain("version: 1");
      });

      it("should serialize frontmatter with various types", () => {
        const frontmatter = {
          title: "Test",
          count: 42,
          rating: 4.5,
          published: true,
          archived: false,
          description: null,
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("count: 42");
        expect(result).toContain("rating: 4.5");
        expect(result).toContain("published: true");
        expect(result).toContain("archived: false");
        expect(result).toContain("description: null");
      });
    });

    describe("YAML formatting", () => {
      it("should use proper --- delimiters", () => {
        const frontmatter = { title: "Test" };
        const result = serializer.serialize(frontmatter, "Body");
        const lines = result.split("\n");
        expect(lines[0]).toBe("---");
        expect(lines).toContain("---");
        // Should have opening and closing ---
        const dashCount = lines.filter((l) => l === "---").length;
        expect(dashCount).toBe(2);
      });

      it("should have proper newline between frontmatter and body", () => {
        const frontmatter = { title: "Test" };
        const result = serializer.serialize(frontmatter, "Body content");
        expect(result).toMatch(/---\nBody content$/);
      });

      it("should handle body with leading newline", () => {
        const frontmatter = { title: "Test" };
        const result = serializer.serialize(frontmatter, "\nBody content");
        expect(result).toMatch(/---\n\nBody content$/);
      });

      it("should handle multi-line body content", () => {
        const frontmatter = { title: "Test" };
        const body = "Line 1\nLine 2\nLine 3";
        const result = serializer.serialize(frontmatter, body);
        expect(result).toContain("Line 1\nLine 2\nLine 3");
      });
    });

    describe("special character handling", () => {
      it("should properly quote strings with colons", () => {
        const frontmatter = { title: "Title: With Colon" };
        const result = serializer.serialize(frontmatter, "Body");
        // YAML should quote or escape the colon
        expect(result).toContain("title:");
        expect(result).toContain("With Colon");
      });

      it("should handle strings with quotes", () => {
        const frontmatter = { title: 'Title with "quotes"' };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("title:");
      });

      it("should handle unicode characters", () => {
        const frontmatter = {
          title: "日本語タイトル",
          emoji: "🎉",
          author: "José García",
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("日本語タイトル");
        expect(result).toContain("🎉");
        expect(result).toContain("José García");
      });

      it("should handle special YAML characters in values", () => {
        const frontmatter = {
          pattern: "*.md",
          path: "/path/to/file",
          at: "@mention",
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("*.md");
        expect(result).toContain("/path/to/file");
        expect(result).toContain("@mention");
      });
    });

    describe("empty body handling", () => {
      it("should handle empty body string", () => {
        const frontmatter = { title: "Just Frontmatter" };
        const result = serializer.serialize(frontmatter, "");
        expect(result).toMatch(/^---\n[\s\S]*\n---$/);
      });

      it("should handle body with only whitespace", () => {
        const frontmatter = { title: "Test" };
        const result = serializer.serialize(frontmatter, "   ");
        expect(result).toContain("---");
        expect(result.endsWith("   ")).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("should handle deeply nested structures", () => {
        const frontmatter = {
          level1: {
            level2: {
              level3: {
                value: "deep",
              },
            },
          },
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("level1:");
        expect(result).toContain("level2:");
        expect(result).toContain("level3:");
        expect(result).toContain("value:");
        expect(result).toContain("deep");
      });

      it("should handle arrays of objects", () => {
        const frontmatter = {
          items: [
            { id: 1, name: "One" },
            { id: 2, name: "Two" },
          ],
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("items:");
        expect(result).toContain("id: 1");
        expect(result).toContain("name:");
        expect(result).toContain("One");
      });

      it("should handle inline arrays", () => {
        const frontmatter = {
          simple: [1, 2, 3],
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("simple:");
      });

      it("should preserve empty arrays", () => {
        const frontmatter = {
          title: "Test",
          tags: [],
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("tags: []");
      });

      it("should preserve empty objects", () => {
        const frontmatter = {
          title: "Test",
          metadata: {},
        };
        const result = serializer.serialize(frontmatter, "Body");
        expect(result).toContain("metadata: {}");
      });
    });
  });
});
