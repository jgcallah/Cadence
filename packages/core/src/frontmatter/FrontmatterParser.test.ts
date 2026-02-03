import { describe, it, expect, beforeEach } from "vitest";
import { FrontmatterParser } from "./FrontmatterParser.js";

describe("FrontmatterParser", () => {
  let parser: FrontmatterParser;

  beforeEach(() => {
    parser = new FrontmatterParser();
  });

  describe("parse", () => {
    describe("notes with frontmatter", () => {
      it("should parse simple frontmatter with title", () => {
        const content = `---
title: My Note
---
This is the body.`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({ title: "My Note" });
        expect(result.body).toBe("This is the body.");
      });

      it("should parse frontmatter with multiple fields", () => {
        const content = `---
title: Daily Note
date: 2024-01-15
tags:
  - daily
  - work
---
# Hello World

Content here.`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({
          title: "Daily Note",
          date: "2024-01-15",
          tags: ["daily", "work"],
        });
        expect(result.body).toBe("# Hello World\n\nContent here.");
      });

      it("should parse nested frontmatter objects", () => {
        const content = `---
title: Complex Note
metadata:
  author: John Doe
  version: 1.0
  settings:
    draft: true
    priority: high
---
Body content`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({
          title: "Complex Note",
          metadata: {
            author: "John Doe",
            version: 1.0,
            settings: {
              draft: true,
              priority: "high",
            },
          },
        });
        expect(result.body).toBe("Body content");
      });

      it("should handle frontmatter with numbers and booleans", () => {
        const content = `---
count: 42
rating: 4.5
published: true
archived: false
---
Body`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({
          count: 42,
          rating: 4.5,
          published: true,
          archived: false,
        });
      });

      it("should handle frontmatter with null values", () => {
        const content = `---
title: Test
description: null
---
Body`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({
          title: "Test",
          description: null,
        });
      });

      it("should preserve body content exactly including leading newlines", () => {
        const content = `---
title: Test
---

First paragraph.

Second paragraph.`;
        const result = parser.parse(content);
        expect(result.body).toBe("\nFirst paragraph.\n\nSecond paragraph.");
      });
    });

    describe("notes without frontmatter", () => {
      it("should handle content without frontmatter", () => {
        const content = `# Just a Heading

Some content without frontmatter.`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({});
        expect(result.body).toBe("# Just a Heading\n\nSome content without frontmatter.");
      });

      it("should handle empty content", () => {
        const content = "";
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({});
        expect(result.body).toBe("");
      });

      it("should handle content that starts with --- but is not frontmatter", () => {
        const content = `---

Not frontmatter, just a horizontal rule.`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({});
        expect(result.body).toBe("---\n\nNot frontmatter, just a horizontal rule.");
      });

      it("should handle content with --- in the body", () => {
        const content = `# Heading

---

Some content with a horizontal rule.`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({});
        expect(result.body).toBe("# Heading\n\n---\n\nSome content with a horizontal rule.");
      });
    });

    describe("empty frontmatter", () => {
      it("should handle empty frontmatter block", () => {
        const content = `---
---
Body content`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({});
        expect(result.body).toBe("Body content");
      });

      it("should handle frontmatter with only whitespace", () => {
        const content = `---

---
Body content`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({});
        expect(result.body).toBe("Body content");
      });
    });

    describe("edge cases", () => {
      it("should handle frontmatter with special characters in values", () => {
        const content = `---
title: 'Title with: colons and "quotes"'
description: 'Single quotes work too'
path: /path/to/file.md
---
Body`;
        const result = parser.parse(content);
        expect(result.frontmatter.title).toBe('Title with: colons and "quotes"');
        expect(result.frontmatter.description).toBe("Single quotes work too");
        expect(result.frontmatter.path).toBe("/path/to/file.md");
      });

      it("should handle frontmatter with multi-line strings", () => {
        const content = `---
description: |
  This is a multi-line
  description that spans
  several lines.
---
Body`;
        const result = parser.parse(content);
        expect(result.frontmatter.description).toBe(
          "This is a multi-line\ndescription that spans\nseveral lines.\n"
        );
      });

      it("should handle frontmatter with folded strings", () => {
        const content = `---
summary: >
  This is a folded
  string that becomes
  one line.
---
Body`;
        const result = parser.parse(content);
        expect(result.frontmatter.summary).toBe(
          "This is a folded string that becomes one line.\n"
        );
      });

      it("should handle frontmatter with arrays in various formats", () => {
        const content = `---
inline_array: [one, two, three]
block_array:
  - item1
  - item2
  - item3
---
Body`;
        const result = parser.parse(content);
        expect(result.frontmatter.inline_array).toEqual(["one", "two", "three"]);
        expect(result.frontmatter.block_array).toEqual(["item1", "item2", "item3"]);
      });

      it("should handle frontmatter with dates", () => {
        const content = `---
created: 2024-01-15
modified: 2024-01-20T10:30:00
---
Body`;
        const result = parser.parse(content);
        // YAML dates can be parsed as strings or Date objects depending on schema
        // We'll treat them as strings for consistency
        expect(result.frontmatter.created).toBe("2024-01-15");
        expect(result.frontmatter.modified).toMatch(/2024-01-20/);
      });

      it("should handle unicode characters in frontmatter", () => {
        const content = `---
title: 日本語タイトル
emoji: 🎉
author: José García
---
Body`;
        const result = parser.parse(content);
        expect(result.frontmatter.title).toBe("日本語タイトル");
        expect(result.frontmatter.emoji).toBe("🎉");
        expect(result.frontmatter.author).toBe("José García");
      });

      it("should handle frontmatter ending with newline variations", () => {
        const content = "---\ntitle: Test\n---\nBody";
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({ title: "Test" });
        expect(result.body).toBe("Body");
      });

      it("should handle content that is only frontmatter", () => {
        const content = `---
title: Just Frontmatter
---`;
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({ title: "Just Frontmatter" });
        expect(result.body).toBe("");
      });

      it("should handle Windows-style line endings", () => {
        const content = "---\r\ntitle: Test\r\n---\r\nBody content";
        const result = parser.parse(content);
        expect(result.frontmatter).toEqual({ title: "Test" });
        expect(result.body).toBe("Body content");
      });
    });
  });
});
