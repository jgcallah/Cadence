import { describe, it, expect, beforeEach } from "vitest";
import { FrontmatterMerger } from "./FrontmatterMerger.js";

describe("FrontmatterMerger", () => {
  let merger: FrontmatterMerger;

  beforeEach(() => {
    merger = new FrontmatterMerger();
  });

  describe("merge", () => {
    describe("basic merging", () => {
      it("should merge empty objects", () => {
        const result = merger.merge({}, {});
        expect(result).toEqual({});
      });

      it("should return updates when existing is empty", () => {
        const updates = { title: "New Title", count: 42 };
        const result = merger.merge({}, updates);
        expect(result).toEqual(updates);
      });

      it("should return existing when updates is empty", () => {
        const existing = { title: "Existing Title", count: 10 };
        const result = merger.merge(existing, {});
        expect(result).toEqual(existing);
      });

      it("should update existing fields with new values", () => {
        const existing = { title: "Old Title", count: 10 };
        const updates = { title: "New Title" };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({ title: "New Title", count: 10 });
      });

      it("should add new fields from updates", () => {
        const existing = { title: "Title" };
        const updates = { description: "A description", tags: ["a", "b"] };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({
          title: "Title",
          description: "A description",
          tags: ["a", "b"],
        });
      });

      it("should preserve existing fields not in updates", () => {
        const existing = {
          title: "Title",
          created: "2024-01-01",
          author: "John",
        };
        const updates = { modified: "2024-01-15" };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({
          title: "Title",
          created: "2024-01-01",
          author: "John",
          modified: "2024-01-15",
        });
      });
    });

    describe("deep merging", () => {
      it("should deep merge nested objects", () => {
        const existing = {
          title: "Note",
          metadata: {
            author: "John",
            version: 1,
          },
        };
        const updates = {
          metadata: {
            version: 2,
            editor: "Jane",
          },
        };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({
          title: "Note",
          metadata: {
            author: "John",
            version: 2,
            editor: "Jane",
          },
        });
      });

      it("should deep merge multiple levels", () => {
        const existing = {
          config: {
            display: {
              theme: "dark",
              fontSize: 14,
            },
            behavior: {
              autoSave: true,
            },
          },
        };
        const updates = {
          config: {
            display: {
              fontSize: 16,
              lineHeight: 1.5,
            },
          },
        };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({
          config: {
            display: {
              theme: "dark",
              fontSize: 16,
              lineHeight: 1.5,
            },
            behavior: {
              autoSave: true,
            },
          },
        });
      });

      it("should replace arrays entirely (not merge them)", () => {
        const existing = {
          tags: ["daily", "work", "important"],
        };
        const updates = {
          tags: ["personal", "home"],
        };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({
          tags: ["personal", "home"],
        });
      });

      it("should handle mixed nested structures", () => {
        const existing = {
          title: "Note",
          data: {
            items: ["a", "b"],
            settings: {
              enabled: true,
            },
          },
        };
        const updates = {
          data: {
            items: ["c"],
            settings: {
              enabled: false,
              newSetting: "value",
            },
          },
        };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({
          title: "Note",
          data: {
            items: ["c"],
            settings: {
              enabled: false,
              newSetting: "value",
            },
          },
        });
      });
    });

    describe("type handling", () => {
      it("should handle null values in updates", () => {
        const existing = { title: "Title", description: "Desc" };
        const updates = { description: null };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({ title: "Title", description: null });
      });

      it("should handle undefined values (should not override)", () => {
        const existing = { title: "Title", description: "Desc" };
        const updates = { description: undefined };
        const result = merger.merge(existing, updates);
        // undefined values should not override existing values
        expect(result).toEqual({ title: "Title", description: "Desc" });
      });

      it("should handle type changes (object to primitive)", () => {
        const existing = {
          data: {
            nested: true,
          },
        };
        const updates = {
          data: "now a string",
        };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({ data: "now a string" });
      });

      it("should handle type changes (primitive to object)", () => {
        const existing = {
          data: "a string",
        };
        const updates = {
          data: {
            nested: true,
          },
        };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({ data: { nested: true } });
      });

      it("should handle boolean values", () => {
        const existing = { published: true, draft: false };
        const updates = { published: false, draft: true };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({ published: false, draft: true });
      });

      it("should handle number values", () => {
        const existing = { count: 10, rating: 4.5 };
        const updates = { count: 20, rating: 5.0 };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({ count: 20, rating: 5.0 });
      });

      it("should handle date strings", () => {
        const existing = { created: "2024-01-01" };
        const updates = { modified: "2024-01-15" };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({
          created: "2024-01-01",
          modified: "2024-01-15",
        });
      });
    });

    describe("edge cases", () => {
      it("should not mutate the original objects", () => {
        const existing = { title: "Original", nested: { value: 1 } };
        const updates = { title: "Updated", nested: { value: 2 } };
        const existingCopy = JSON.parse(JSON.stringify(existing));
        const updatesCopy = JSON.parse(JSON.stringify(updates));

        merger.merge(existing, updates);

        expect(existing).toEqual(existingCopy);
        expect(updates).toEqual(updatesCopy);
      });

      it("should handle deeply nested empty objects", () => {
        const existing = { a: { b: { c: {} } } };
        const updates = { a: { b: { c: { d: "value" } } } };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({ a: { b: { c: { d: "value" } } } });
      });

      it("should handle arrays of objects (replace, not merge)", () => {
        const existing = {
          items: [
            { id: 1, name: "One" },
            { id: 2, name: "Two" },
          ],
        };
        const updates = {
          items: [{ id: 3, name: "Three" }],
        };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({
          items: [{ id: 3, name: "Three" }],
        });
      });

      it("should handle special characters in keys", () => {
        const existing = { "key-with-dash": 1, "key.with.dot": 2 };
        const updates = { "key-with-dash": 3, "new-key": 4 };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({
          "key-with-dash": 3,
          "key.with.dot": 2,
          "new-key": 4,
        });
      });

      it("should handle empty string values", () => {
        const existing = { title: "Title" };
        const updates = { title: "" };
        const result = merger.merge(existing, updates);
        expect(result).toEqual({ title: "" });
      });
    });
  });
});
