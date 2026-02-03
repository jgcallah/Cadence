import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TemplateEngine } from "./TemplateEngine.js";
import { TemplateRenderError } from "../errors/index.js";

describe("TemplateEngine", () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe("render", () => {
    describe("variable substitution", () => {
      it("should substitute simple variables", () => {
        const template = "Hello, {{name}}!";
        const result = engine.render(template, { name: "World" });
        expect(result).toBe("Hello, World!");
      });

      it("should substitute multiple variables", () => {
        const template = "{{greeting}}, {{name}}! Today is {{day}}.";
        const result = engine.render(template, {
          greeting: "Hello",
          name: "Alice",
          day: "Monday",
        });
        expect(result).toBe("Hello, Alice! Today is Monday.");
      });

      it("should handle nested object access", () => {
        const template = "User: {{user.name}}, Email: {{user.email}}";
        const result = engine.render(template, {
          user: { name: "Bob", email: "bob@example.com" },
        });
        expect(result).toBe("User: Bob, Email: bob@example.com");
      });

      it("should handle array access", () => {
        const template = "First item: {{items.[0]}}";
        const result = engine.render(template, {
          items: ["apple", "banana", "cherry"],
        });
        expect(result).toBe("First item: apple");
      });

      it("should handle boolean values", () => {
        const template = "Active: {{isActive}}";
        const result = engine.render(template, { isActive: true });
        expect(result).toBe("Active: true");
      });

      it("should handle number values", () => {
        const template = "Count: {{count}}, Price: {{price}}";
        const result = engine.render(template, { count: 42, price: 19.99 });
        expect(result).toBe("Count: 42, Price: 19.99");
      });

      it("should preserve template structure with line breaks", () => {
        const template = `---
title: {{title}}
date: {{date}}
---

# {{heading}}

{{content}}`;
        const result = engine.render(template, {
          title: "My Note",
          date: "2024-01-15",
          heading: "Welcome",
          content: "This is the content.",
        });
        expect(result).toBe(`---
title: My Note
date: 2024-01-15
---

# Welcome

This is the content.`);
      });
    });

    describe("strict mode - missing variables", () => {
      it("should throw TemplateRenderError for single missing variable", () => {
        const template = "Hello, {{name}}!";
        expect(() => engine.render(template, {})).toThrow(TemplateRenderError);
      });

      it("should include missing variable name in error", () => {
        const template = "Hello, {{name}}!";
        try {
          engine.render(template, {});
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(TemplateRenderError);
          expect((error as TemplateRenderError).message).toContain("name");
        }
      });

      it("should throw for missing nested property", () => {
        const template = "Email: {{user.email}}";
        expect(() => engine.render(template, { user: {} })).toThrow(
          TemplateRenderError
        );
      });

      it("should throw for completely missing nested object", () => {
        const template = "Email: {{user.email}}";
        expect(() => engine.render(template, {})).toThrow(TemplateRenderError);
      });

      it("should NOT throw for explicitly provided empty string", () => {
        const template = "Value: {{value}}";
        const result = engine.render(template, { value: "" });
        expect(result).toBe("Value: ");
      });

      it("should NOT throw for explicitly provided zero", () => {
        const template = "Count: {{count}}";
        const result = engine.render(template, { count: 0 });
        expect(result).toBe("Count: 0");
      });

      it("should NOT throw for explicitly provided false", () => {
        const template = "Flag: {{flag}}";
        const result = engine.render(template, { flag: false });
        expect(result).toBe("Flag: false");
      });

      it("should render null value as empty string by default", () => {
        // Note: Handlebars strict mode only throws for missing keys, not null values
        // Null is rendered as empty string
        const template = "Value: {{value}}";
        const result = engine.render(template, { value: null });
        expect(result).toBe("Value: ");
      });

      it("should render undefined value as empty string by default", () => {
        // Note: Handlebars strict mode only throws for missing keys, not undefined values
        // Undefined is rendered as empty string
        const template = "Value: {{value}}";
        const result = engine.render(template, { value: undefined });
        expect(result).toBe("Value: ");
      });

      it("should throw for first missing variable found", () => {
        // Note: Handlebars throws on the first missing variable it encounters
        const template = "{{greeting}}, {{name}}! You have {{count}} messages.";
        try {
          engine.render(template, {});
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(TemplateRenderError);
          const renderError = error as TemplateRenderError;
          // At least one of the missing variables should be identified
          expect(renderError.missingVariables.length).toBeGreaterThan(0);
          // The first missing variable (greeting) should be in the list
          expect(renderError.missingVariables).toContain("greeting");
        }
      });
    });

    describe("custom helpers", () => {
      describe("wikilink helper", () => {
        it("should generate wikilink with simple string", () => {
          const template = "Link: {{wikilink 'My Note'}}";
          const result = engine.render(template, {});
          expect(result).toBe("Link: [[My Note]]");
        });

        it("should generate wikilink from variable", () => {
          const template = "Link: {{wikilink noteName}}";
          const result = engine.render(template, { noteName: "Daily Note" });
          expect(result).toBe("Link: [[Daily Note]]");
        });

        it("should handle wikilink with path", () => {
          const template = "Link: {{wikilink 'Folder/Note Name'}}";
          const result = engine.render(template, {});
          expect(result).toBe("Link: [[Folder/Note Name]]");
        });
      });

      describe("formatDate helper", () => {
        it("should format date with specified format", () => {
          const template = "Date: {{formatDate myDate 'yyyy-MM-dd'}}";
          const testDate = new Date(2024, 0, 15); // Jan 15, 2024
          const result = engine.render(template, { myDate: testDate });
          expect(result).toBe("Date: 2024-01-15");
        });

        it("should format date with complex format", () => {
          const template = "Date: {{formatDate myDate 'EEEE, MMMM do, yyyy'}}";
          const testDate = new Date(2024, 0, 15); // Jan 15, 2024
          const result = engine.render(template, { myDate: testDate });
          expect(result).toBe("Date: Monday, January 15th, 2024");
        });

        it("should format date with week number", () => {
          // In date-fns, literal characters must be wrapped in single quotes
          const template = "Week: {{formatDate myDate \"yyyy-'W'ww\"}}";
          const testDate = new Date(2024, 0, 15); // Jan 15, 2024
          const result = engine.render(template, { myDate: testDate });
          expect(result).toMatch(/2024-W\d{2}/);
        });

        it("should handle date string input", () => {
          const template = "Date: {{formatDate myDate 'yyyy-MM-dd'}}";
          const result = engine.render(template, { myDate: "2024-01-15" });
          expect(result).toBe("Date: 2024-01-15");
        });

        it("should handle ISO date string input", () => {
          const template = "Date: {{formatDate myDate 'yyyy-MM-dd'}}";
          const result = engine.render(template, {
            myDate: "2024-01-15T10:30:00Z",
          });
          expect(result).toBe("Date: 2024-01-15");
        });
      });
    });

    describe("built-in template variables", () => {
      let mockDate: Date;

      beforeEach(() => {
        // Mock date: Monday, January 15, 2024, 14:30:45
        mockDate = new Date(2024, 0, 15, 14, 30, 45);
        vi.useFakeTimers();
        vi.setSystemTime(mockDate);
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it("should provide {{date}} as current date", () => {
        const template = "Today: {{date}}";
        const result = engine.render(template, {});
        expect(result).toBe("Today: 2024-01-15");
      });

      it("should provide {{time}} as current time", () => {
        const template = "Time: {{time}}";
        const result = engine.render(template, {});
        expect(result).toBe("Time: 14:30");
      });

      it("should provide {{weekNum}} as current week number", () => {
        const template = "Week: {{weekNum}}";
        const result = engine.render(template, {});
        // Week 3 of 2024
        expect(result).toBe("Week: 3");
      });

      it("should provide {{yesterday}} as wikilink to yesterday", () => {
        const template = "Previous: {{yesterday}}";
        const result = engine.render(template, {});
        expect(result).toBe("Previous: [[2024-01-14]]");
      });

      it("should provide {{tomorrow}} as wikilink to tomorrow", () => {
        const template = "Next: {{tomorrow}}";
        const result = engine.render(template, {});
        expect(result).toBe("Next: [[2024-01-16]]");
      });

      it("should provide {{year}} as current year", () => {
        const template = "Year: {{year}}";
        const result = engine.render(template, {});
        expect(result).toBe("Year: 2024");
      });

      it("should provide {{month}} as current month (zero-padded)", () => {
        const template = "Month: {{month}}";
        const result = engine.render(template, {});
        expect(result).toBe("Month: 01");
      });

      it("should provide {{quarter}} as current quarter", () => {
        const template = "Quarter: {{quarter}}";
        const result = engine.render(template, {});
        expect(result).toBe("Quarter: Q1");
      });

      it("should allow user variables to override built-in variables", () => {
        const template = "Date: {{date}}";
        const result = engine.render(template, { date: "custom-date" });
        expect(result).toBe("Date: custom-date");
      });

      it("should work with multiple built-in variables", () => {
        // Note: yesterday and tomorrow already include [[]] brackets
        const template = `---
date: {{date}}
week: {{weekNum}}
quarter: {{quarter}}
---

# Daily Note for {{date}}

{{{yesterday}}} | {{{tomorrow}}}`;
        const result = engine.render(template, {});
        expect(result).toBe(`---
date: 2024-01-15
week: 3
quarter: Q1
---

# Daily Note for 2024-01-15

[[2024-01-14]] | [[2024-01-16]]`);
      });
    });

    describe("edge cases", () => {
      it("should handle empty template", () => {
        const result = engine.render("", {});
        expect(result).toBe("");
      });

      it("should handle template with no variables", () => {
        const template = "Just plain text.";
        const result = engine.render(template, {});
        expect(result).toBe("Just plain text.");
      });

      it("should handle special characters in values", () => {
        const template = "Code: {{code}}";
        const result = engine.render(template, {
          code: "function() { return '<div>'; }",
        });
        // Handlebars escapes HTML by default
        expect(result).toBe(
          "Code: function() { return &#x27;&lt;div&gt;&#x27;; }"
        );
      });

      it("should handle raw HTML with triple braces", () => {
        const template = "HTML: {{{html}}}";
        const result = engine.render(template, { html: "<b>bold</b>" });
        expect(result).toBe("HTML: <b>bold</b>");
      });

      it("should handle unicode in template and variables", () => {
        const template = "名前: {{name}}, 日付: {{date}}";
        const result = engine.render(template, {
          name: "田中",
          date: "2024年1月15日",
        });
        expect(result).toBe("名前: 田中, 日付: 2024年1月15日");
      });

      it("should handle whitespace in variable names correctly", () => {
        // Handlebars trims whitespace in variable names
        const template = "Value: {{ value }}";
        const result = engine.render(template, { value: "test" });
        expect(result).toBe("Value: test");
      });
    });

    describe("error handling", () => {
      it("should wrap Handlebars errors in TemplateRenderError", () => {
        // Invalid Handlebars syntax
        const template = "{{#each items}}{{/if}}";
        expect(() => engine.render(template, { items: [] })).toThrow(
          TemplateRenderError
        );
      });

      it("should include helpful message for template errors", () => {
        const template = "{{#each items}}{{/if}}";
        try {
          engine.render(template, { items: [] });
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(TemplateRenderError);
          expect((error as TemplateRenderError).message).toBeTruthy();
        }
      });
    });
  });
});
