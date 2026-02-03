import { describe, it, expect, beforeEach } from "vitest";
import { FrontmatterParser } from "./FrontmatterParser.js";
import { FrontmatterSerializer } from "./FrontmatterSerializer.js";
import { FrontmatterMerger } from "./FrontmatterMerger.js";

describe("Round-trip integrity", () => {
  let parser: FrontmatterParser;
  let serializer: FrontmatterSerializer;
  let merger: FrontmatterMerger;

  beforeEach(() => {
    parser = new FrontmatterParser();
    serializer = new FrontmatterSerializer();
    merger = new FrontmatterMerger();
  });

  describe("parse -> serialize -> parse", () => {
    it("should maintain integrity for simple frontmatter", () => {
      const original = `---
title: My Note
date: '2024-01-15'
---
Body content here.`;

      const { frontmatter, body } = parser.parse(original);
      const reserialized = serializer.serialize(frontmatter, body);
      const reparsed = parser.parse(reserialized);

      expect(reparsed.frontmatter).toEqual(frontmatter);
      expect(reparsed.body).toBe(body);
    });

    it("should maintain integrity for complex frontmatter", () => {
      const original = `---
title: Complex Note
tags:
  - daily
  - work
  - important
metadata:
  author: John Doe
  version: 2
  settings:
    draft: false
    priority: high
---
# Heading

Some body content with **markdown**.`;

      const { frontmatter, body } = parser.parse(original);
      const reserialized = serializer.serialize(frontmatter, body);
      const reparsed = parser.parse(reserialized);

      expect(reparsed.frontmatter).toEqual(frontmatter);
      expect(reparsed.body).toBe(body);
    });

    it("should maintain integrity for frontmatter with various types", () => {
      const original = `---
string: hello
number: 42
float: 3.14
bool_true: true
bool_false: false
null_value: null
array:
  - one
  - two
---
Body`;

      const { frontmatter, body } = parser.parse(original);
      const reserialized = serializer.serialize(frontmatter, body);
      const reparsed = parser.parse(reserialized);

      expect(reparsed.frontmatter).toEqual(frontmatter);
      expect(reparsed.body).toBe(body);
    });

    it("should maintain integrity for empty frontmatter", () => {
      const original = `---
---
Just body content.`;

      const { frontmatter, body } = parser.parse(original);
      const reserialized = serializer.serialize(frontmatter, body);
      const reparsed = parser.parse(reserialized);

      expect(reparsed.frontmatter).toEqual(frontmatter);
      expect(reparsed.body).toBe(body);
    });

    it("should maintain integrity for content without frontmatter", () => {
      const original = `# Just a heading

Some content without frontmatter.`;

      const { frontmatter, body } = parser.parse(original);
      const reserialized = serializer.serialize(frontmatter, body);
      const reparsed = parser.parse(reserialized);

      expect(reparsed.frontmatter).toEqual({});
      expect(reparsed.body).toBe(original);
    });

    it("should maintain integrity for unicode content", () => {
      const original = `---
title: 日本語タイトル
emoji: 🎉
---
Content with émojis 🚀 and ünïcödé.`;

      const { frontmatter, body } = parser.parse(original);
      const reserialized = serializer.serialize(frontmatter, body);
      const reparsed = parser.parse(reserialized);

      expect(reparsed.frontmatter).toEqual(frontmatter);
      expect(reparsed.body).toBe(body);
    });
  });

  describe("parse -> modify -> serialize -> parse", () => {
    it("should correctly handle parse-modify-serialize workflow", () => {
      const original = `---
title: Original Title
count: 1
---
Original body.`;

      // Parse
      const { frontmatter, body } = parser.parse(original);

      // Modify using merger
      const updates = { title: "Updated Title", newField: "added" };
      const merged = merger.merge(frontmatter, updates);

      // Serialize and re-parse
      const serialized = serializer.serialize(merged, body);
      const reparsed = parser.parse(serialized);

      expect(reparsed.frontmatter).toEqual({
        title: "Updated Title",
        count: 1,
        newField: "added",
      });
      expect(reparsed.body).toBe("Original body.");
    });

    it("should handle deep modifications through the workflow", () => {
      const original = `---
title: Note
metadata:
  author: John
  version: 1
---
Content`;

      const { frontmatter, body } = parser.parse(original);

      const updates = {
        metadata: {
          version: 2,
          editor: "Jane",
        },
      };
      const merged = merger.merge(frontmatter, updates);
      const serialized = serializer.serialize(merged, body);
      const reparsed = parser.parse(serialized);

      expect(reparsed.frontmatter.metadata).toEqual({
        author: "John",
        version: 2,
        editor: "Jane",
      });
    });

    it("should handle adding frontmatter to content without it", () => {
      const original = `# Heading

Just content.`;

      const { frontmatter, body } = parser.parse(original);
      expect(frontmatter).toEqual({});

      const updates = { title: "New Title", created: "2024-01-15" };
      const merged = merger.merge(frontmatter, updates);
      const serialized = serializer.serialize(merged, body);
      const reparsed = parser.parse(serialized);

      expect(reparsed.frontmatter).toEqual({
        title: "New Title",
        created: "2024-01-15",
      });
      expect(reparsed.body).toBe(original);
    });

    it("should handle removing frontmatter by merging with empty", () => {
      const original = `---
title: To Remove
---
Body content.`;

      const { body } = parser.parse(original);
      const serialized = serializer.serialize({}, body);
      const reparsed = parser.parse(serialized);

      expect(reparsed.frontmatter).toEqual({});
      expect(reparsed.body).toBe("Body content.");
    });
  });

  describe("multiple round-trips", () => {
    it("should maintain integrity through multiple round-trips", () => {
      const original = `---
title: Stable Note
version: 1
---
Content that should remain stable.`;

      let content = original;
      for (let i = 0; i < 5; i++) {
        const { frontmatter, body } = parser.parse(content);
        content = serializer.serialize(frontmatter, body);
      }

      const final = parser.parse(content);
      const originalParsed = parser.parse(original);

      expect(final.frontmatter).toEqual(originalParsed.frontmatter);
      expect(final.body).toBe(originalParsed.body);
    });

    it("should maintain integrity through multiple modifications", () => {
      let content = `---
title: Initial
count: 0
---
Body`;

      for (let i = 1; i <= 5; i++) {
        const { frontmatter, body } = parser.parse(content);
        const merged = merger.merge(frontmatter, { count: i, [`field_${i}`]: true });
        content = serializer.serialize(merged, body);
      }

      const final = parser.parse(content);
      expect(final.frontmatter.title).toBe("Initial");
      expect(final.frontmatter.count).toBe(5);
      expect(final.frontmatter.field_1).toBe(true);
      expect(final.frontmatter.field_5).toBe(true);
    });
  });
});
