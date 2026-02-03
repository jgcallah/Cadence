import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TaskParser } from "./TaskParser.js";
import type { Task as _Task } from "./types.js";

describe("TaskParser", () => {
  let parser: TaskParser;
  const fixedDate = new Date("2026-02-02T12:00:00.000Z");

  beforeEach(() => {
    parser = new TaskParser();
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("parse", () => {
    describe("basic checkbox parsing", () => {
      it("should parse an incomplete task", () => {
        const content = "- [ ] Buy groceries";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.completed).toBe(false);
        expect(tasks[0]!.text).toBe("Buy groceries");
        expect(tasks[0]!.line).toBe(1);
        expect(tasks[0]!.raw).toBe("- [ ] Buy groceries");
      });

      it("should parse a completed task with lowercase x", () => {
        const content = "- [x] Finish report";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.completed).toBe(true);
        expect(tasks[0]!.text).toBe("Finish report");
      });

      it("should parse a completed task with uppercase X", () => {
        const content = "- [X] Submit PR";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.completed).toBe(true);
        expect(tasks[0]!.text).toBe("Submit PR");
      });

      it("should parse tasks with * as list marker", () => {
        const content = "* [ ] Task with asterisk";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe("Task with asterisk");
      });

      it("should parse tasks with + as list marker", () => {
        const content = "+ [ ] Task with plus";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe("Task with plus");
      });

      it("should parse indented tasks", () => {
        const content = "  - [ ] Indented task";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe("Indented task");
      });

      it("should parse deeply indented tasks", () => {
        const content = "        - [ ] Deeply indented task";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe("Deeply indented task");
      });

      it("should preserve raw line content", () => {
        const content = "  - [x] Task with spaces #tag due:2024-01-15";
        const tasks = parser.parse(content);
        expect(tasks[0]!.raw).toBe("  - [x] Task with spaces #tag due:2024-01-15");
      });
    });

    describe("multiple tasks in content", () => {
      it("should parse multiple tasks", () => {
        const content = `- [ ] First task
- [x] Second task
- [ ] Third task`;
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(3);
        expect(tasks[0]!.text).toBe("First task");
        expect(tasks[0]!.line).toBe(1);
        expect(tasks[1]!.text).toBe("Second task");
        expect(tasks[1]!.line).toBe(2);
        expect(tasks[1]!.completed).toBe(true);
        expect(tasks[2]!.text).toBe("Third task");
        expect(tasks[2]!.line).toBe(3);
      });

      it("should parse tasks mixed with regular content", () => {
        const content = `# My Task List

Here are my tasks:

- [ ] First task
Some notes about first task.

- [x] Completed task

More content here.

- [ ] Final task`;
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(3);
        expect(tasks[0]!.line).toBe(5);
        expect(tasks[1]!.line).toBe(8);
        expect(tasks[2]!.line).toBe(12);
      });

      it("should handle nested task lists", () => {
        const content = `- [ ] Parent task
  - [ ] Child task 1
  - [x] Child task 2
    - [ ] Grandchild task`;
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(4);
        expect(tasks[0]!.text).toBe("Parent task");
        expect(tasks[1]!.text).toBe("Child task 1");
        expect(tasks[2]!.text).toBe("Child task 2");
        expect(tasks[2]!.completed).toBe(true);
        expect(tasks[3]!.text).toBe("Grandchild task");
      });

      it("should return empty array for content with no tasks", () => {
        const content = `# Just a Heading

Some regular content without any tasks.

- Regular list item
- Another regular item`;
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(0);
      });

      it("should handle empty content", () => {
        const tasks = parser.parse("");
        expect(tasks).toHaveLength(0);
      });

      it("should handle Windows-style line endings", () => {
        const content = "- [ ] First task\r\n- [x] Second task\r\n- [ ] Third task";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(3);
        expect(tasks[0]!.line).toBe(1);
        expect(tasks[1]!.line).toBe(2);
        expect(tasks[2]!.line).toBe(3);
      });
    });

    describe("metadata: due date", () => {
      it("should parse due:YYYY-MM-DD format", () => {
        const content = "- [ ] Task due:2024-01-15";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.due).toEqual(new Date(2024, 0, 15));
        expect(tasks[0]!.text).toBe("Task");
      });

      it("should parse due date with natural language 'today'", () => {
        const content = "- [ ] Task due:today";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.due?.getFullYear()).toBe(2026);
        expect(tasks[0]!.metadata.due?.getMonth()).toBe(1); // February
        expect(tasks[0]!.metadata.due?.getDate()).toBe(2);
      });

      it("should parse due date with natural language 'tomorrow'", () => {
        const content = "- [ ] Task due:tomorrow";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.due?.getDate()).toBe(3);
      });

      it("should parse due date case insensitively", () => {
        const content = "- [ ] Task DUE:2024-03-20";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.due).toEqual(new Date(2024, 2, 20));
      });

      it("should handle invalid due date gracefully", () => {
        const content = "- [ ] Task due:invalid-date-xyz";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.due).toBeUndefined();
      });

      it("should remove due date from clean text", () => {
        const content = "- [ ] Complete project due:2024-06-30 with team";
        const tasks = parser.parse(content);
        expect(tasks[0]!.text).toBe("Complete project with team");
      });
    });

    describe("metadata: scheduled date", () => {
      it("should parse scheduled:YYYY-MM-DD format", () => {
        const content = "- [ ] Task scheduled:2024-02-20";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.scheduled).toEqual(new Date(2024, 1, 20));
        expect(tasks[0]!.text).toBe("Task");
      });

      it("should parse scheduled date case insensitively", () => {
        const content = "- [ ] Task SCHEDULED:2024-05-10";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.scheduled).toEqual(new Date(2024, 4, 10));
      });

      it("should handle invalid scheduled date gracefully", () => {
        const content = "- [ ] Task scheduled:not-a-date";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.scheduled).toBeUndefined();
      });

      it("should remove scheduled from clean text", () => {
        const content = "- [ ] Review PR scheduled:2024-01-25 before EOD";
        const tasks = parser.parse(content);
        expect(tasks[0]!.text).toBe("Review PR before EOD");
      });
    });

    describe("metadata: created date", () => {
      it("should parse created:YYYY-MM-DD format", () => {
        const content = "- [ ] Task created:2024-01-10";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.created).toEqual(new Date(2024, 0, 10));
        expect(tasks[0]!.text).toBe("Task");
      });

      it("should parse created date case insensitively", () => {
        const content = "- [ ] Task CREATED:2024-06-01";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.created).toEqual(new Date(2024, 5, 1));
      });

      it("should remove created from clean text", () => {
        const content = "- [ ] Old task created:2023-12-01 still pending";
        const tasks = parser.parse(content);
        expect(tasks[0]!.text).toBe("Old task still pending");
      });
    });

    describe("metadata: age", () => {
      it("should parse age:N format", () => {
        const content = "- [ ] Task age:5";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.age).toBe(5);
        expect(tasks[0]!.text).toBe("Task");
      });

      it("should parse age with larger numbers", () => {
        const content = "- [ ] Old task age:365";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.age).toBe(365);
      });

      it("should parse age case insensitively", () => {
        const content = "- [ ] Task AGE:10";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.age).toBe(10);
      });

      it("should not parse age with non-integer values", () => {
        const content = "- [ ] Task age:abc";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.age).toBeUndefined();
      });

      it("should remove age from clean text", () => {
        const content = "- [ ] Stale task age:30 needs attention";
        const tasks = parser.parse(content);
        expect(tasks[0]!.text).toBe("Stale task needs attention");
      });
    });

    describe("metadata: priority with priority: syntax", () => {
      it("should parse priority:high", () => {
        const content = "- [ ] Urgent task priority:high";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("high");
        expect(tasks[0]!.text).toBe("Urgent task");
      });

      it("should parse priority:medium", () => {
        const content = "- [ ] Normal task priority:medium";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("medium");
      });

      it("should parse priority:low", () => {
        const content = "- [ ] Backlog task priority:low";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("low");
      });

      it("should parse priority case insensitively", () => {
        const content = "- [ ] Task PRIORITY:HIGH";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("high");
      });

      it("should handle mixed case priority value", () => {
        const content = "- [ ] Task priority:Medium";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("medium");
      });

      it("should not set priority for invalid values", () => {
        const content = "- [ ] Task priority:critical";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBeUndefined();
      });

      it("should remove priority from clean text", () => {
        const content = "- [ ] Fix bug priority:high immediately";
        const tasks = parser.parse(content);
        expect(tasks[0]!.text).toBe("Fix bug immediately");
      });
    });

    describe("metadata: priority with exclamation syntax", () => {
      it("should parse !!! as high priority", () => {
        const content = "- [ ] Critical task !!!";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("high");
        expect(tasks[0]!.text).toBe("Critical task");
      });

      it("should parse !! as medium priority", () => {
        const content = "- [ ] Important task !!";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("medium");
      });

      it("should parse ! as low priority", () => {
        const content = "- [ ] Minor task !";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("low");
      });

      it("should parse !!! at start of task text", () => {
        const content = "- [ ] !!! Critical bug fix";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("high");
        expect(tasks[0]!.text).toBe("Critical bug fix");
      });

      it("should parse !!! in middle of task text", () => {
        const content = "- [ ] This is !!! an urgent task";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("high");
        expect(tasks[0]!.text).toBe("This is an urgent task");
      });

      it("should not parse exclamation marks that are part of words", () => {
        const content = "- [ ] Fix the bug!!! today";
        const tasks = parser.parse(content);
        // "bug!!!" is not surrounded by whitespace/boundaries, so not parsed
        expect(tasks[0]!.metadata.priority).toBeUndefined();
      });

      it("should prefer priority: syntax over exclamation marks", () => {
        const content = "- [ ] Task !!! priority:low";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.priority).toBe("low");
      });
    });

    describe("metadata: tags", () => {
      it("should parse a single tag", () => {
        const content = "- [ ] Task #work";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.tags).toEqual(["work"]);
        expect(tasks[0]!.text).toBe("Task");
      });

      it("should parse multiple tags", () => {
        const content = "- [ ] Task #work #urgent #Q1";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.tags).toEqual(["work", "urgent", "Q1"]);
      });

      it("should parse tags with hyphens", () => {
        const content = "- [ ] Task #front-end";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.tags).toEqual(["front-end"]);
      });

      it("should parse tags with underscores", () => {
        const content = "- [ ] Task #code_review";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.tags).toEqual(["code_review"]);
      });

      it("should parse tags with numbers", () => {
        const content = "- [ ] Task #version2 #sprint5";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.tags).toEqual(["version2", "sprint5"]);
      });

      it("should parse tags scattered throughout text", () => {
        const content = "- [ ] Review #code for #team-alpha project #urgent";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.tags).toEqual(["code", "team-alpha", "urgent"]);
        expect(tasks[0]!.text).toBe("Review for project");
      });

      it("should not parse # without following word", () => {
        const content = "- [ ] Task with # standalone";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.tags).toEqual([]);
        expect(tasks[0]!.text).toBe("Task with # standalone");
      });

      it("should return empty tags array when no tags present", () => {
        const content = "- [ ] Task without tags";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.tags).toEqual([]);
      });
    });

    describe("combined metadata", () => {
      it("should parse all metadata types together", () => {
        const content = "- [ ] Complete project #work due:2024-06-30 priority:high scheduled:2024-06-01 created:2024-01-15 age:30 #urgent";
        const tasks = parser.parse(content);
        const task = tasks[0]!;
        expect(task.metadata.due).toEqual(new Date(2024, 5, 30));
        expect(task.metadata.scheduled).toEqual(new Date(2024, 5, 1));
        expect(task.metadata.created).toEqual(new Date(2024, 0, 15));
        expect(task.metadata.age).toBe(30);
        expect(task.metadata.priority).toBe("high");
        expect(task.metadata.tags).toEqual(["work", "urgent"]);
        expect(task.text).toBe("Complete project");
      });

      it("should handle metadata in any order", () => {
        const content = "- [ ] Task #tag1 age:5 due:2024-03-15 #tag2 priority:medium";
        const tasks = parser.parse(content);
        const task = tasks[0]!;
        expect(task.metadata.due).toEqual(new Date(2024, 2, 15));
        expect(task.metadata.age).toBe(5);
        expect(task.metadata.priority).toBe("medium");
        expect(task.metadata.tags).toEqual(["tag1", "tag2"]);
      });

      it("should preserve clean text with multiple metadata removed", () => {
        const content = "- [ ] Start #planning then do #coding due:2024-01-20 and ship priority:high by EOD";
        const tasks = parser.parse(content);
        expect(tasks[0]!.text).toBe("Start then do and ship by EOD");
      });
    });

    describe("edge cases", () => {
      it("should not parse checkbox-like patterns without proper syntax", () => {
        const content = "Here is some text with [x] in it";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(0);
      });

      it("should not parse checkbox without space after list marker", () => {
        const content = "-[ ] Task without space";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(0);
      });

      it("should not parse checkbox without space before text", () => {
        const content = "- [ ]Task without space";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(0);
      });

      it("should not parse checkbox with invalid marker", () => {
        const content = "- [?] Task with invalid marker";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(0);
      });

      it("should handle task with only whitespace after checkbox", () => {
        const content = "- [ ]    ";
        const tasks = parser.parse(content);
        // The regex requires at least one character after the checkbox
        // "- [ ]    " matches with content "   " (trailing spaces)
        // but after trimming, it becomes empty text
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe("");
      });

      it("should handle very long task text", () => {
        const longText = "A".repeat(1000);
        const content = `- [ ] ${longText}`;
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe(longText);
      });

      it("should handle unicode characters in task text", () => {
        const content = "- [ ] 日本語タスク #日本語";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        // Japanese characters in #tag format don't match the tag regex [a-zA-Z0-9_-]+
        // so #日本語 is preserved in the text
        expect(tasks[0]!.text).toBe("日本語タスク #日本語");
        expect(tasks[0]!.metadata.tags).toEqual([]);
      });

      it("should handle emoji in task text", () => {
        const content = "- [ ] Complete task 🎉 with celebration";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe("Complete task 🎉 with celebration");
      });

      it("should handle special characters in task text", () => {
        const content = "- [ ] Fix \"bug\" in code & deploy (ASAP)";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe("Fix \"bug\" in code & deploy (ASAP)");
      });

      it("should handle task with URL containing exclamation marks", () => {
        const content = "- [ ] Check https://example.com/path?q=test!value";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        // URL should be preserved, ! in URL shouldn't be parsed as priority
        expect(tasks[0]!.metadata.priority).toBeUndefined();
      });

      it("should handle partially malformed metadata gracefully", () => {
        const content = "- [ ] Task due: priority:invalid #";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        // due: without value shouldn't crash
        // priority:invalid shouldn't set priority
        // # alone shouldn't add a tag
        expect(tasks[0]!.metadata.due).toBeUndefined();
        expect(tasks[0]!.metadata.priority).toBeUndefined();
        expect(tasks[0]!.metadata.tags).toEqual([]);
      });

      it("should handle colons in task text that are not metadata", () => {
        const content = "- [ ] Meeting at 10:30 AM: discuss project";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe("Meeting at 10:30 AM: discuss project");
      });

      it("should handle task ending with colon", () => {
        const content = "- [ ] Review these files:";
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.text).toBe("Review these files:");
      });

      it("should trim extra whitespace from clean text", () => {
        const content = "- [ ]   Task with   extra   spaces   #tag   due:2024-01-15  ";
        const tasks = parser.parse(content);
        expect(tasks[0]!.text).toBe("Task with extra spaces");
      });
    });

    describe("realistic scenarios", () => {
      it("should parse a typical daily note with tasks", () => {
        const content = `# Daily Note - 2024-01-15

## Tasks

- [ ] Review PR for issue-123 #code-review priority:high
- [x] Standup meeting #meeting
- [ ] Write documentation due:2024-01-20 #docs
- [ ] Fix login bug #bug priority:medium created:2024-01-10

## Notes

- Regular bullet point
- Another note`;
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(4);

        // Note: #123 would be parsed as a tag, so we use issue-123 instead
        expect(tasks[0]!.text).toBe("Review PR for issue-123");
        expect(tasks[0]!.metadata.tags).toEqual(["code-review"]);
        expect(tasks[0]!.metadata.priority).toBe("high");

        expect(tasks[1]!.text).toBe("Standup meeting");
        expect(tasks[1]!.completed).toBe(true);

        expect(tasks[2]!.metadata.due).toEqual(new Date(2024, 0, 20));
        expect(tasks[2]!.metadata.tags).toEqual(["docs"]);

        expect(tasks[3]!.metadata.created).toEqual(new Date(2024, 0, 10));
      });

      it("should parse project task list with nested items", () => {
        const content = `# Project Alpha

## Phase 1
- [ ] Design system #design priority:high due:2024-02-01
  - [ ] Create wireframes #design
  - [x] Gather requirements #planning

## Phase 2
- [ ] Implementation #dev scheduled:2024-02-15
  - [ ] Setup infrastructure #devops !!!
  - [ ] Write core modules #dev !!`;
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(6);

        // Check the high priority exclamation task
        const devopsTask = tasks.find(t => t.metadata.tags.includes("devops"));
        expect(devopsTask!.metadata.priority).toBe("high");

        // Check the medium priority exclamation task
        const coreModulesTask = tasks.find(t => t.text.includes("Write core modules"));
        expect(coreModulesTask!.metadata.priority).toBe("medium");
      });

      it("should handle frontmatter followed by tasks", () => {
        const content = `---
title: Task List
date: 2024-01-15
---

# Tasks

- [ ] First task #important
- [x] Completed task`;
        const tasks = parser.parse(content);
        expect(tasks).toHaveLength(2);
        // Line counts: 1:---, 2:title, 3:date, 4:---, 5:blank, 6:#Tasks, 7:blank, 8:first task, 9:completed
        expect(tasks[0]!.line).toBe(8);
        expect(tasks[1]!.line).toBe(9);
      });
    });

    describe("metadata with natural language dates", () => {
      it("should not parse due:next-week (hyphenated form not supported)", () => {
        const content = "- [ ] Task due:next-week";
        const tasks = parser.parse(content);
        // Chrono doesn't parse "next-week" (hyphenated)
        // Only space-separated "next week" would work, but that requires two words
        expect(tasks[0]!.metadata.due).toBeUndefined();
      });

      it("should parse scheduled with natural language", () => {
        const content = "- [ ] Task scheduled:monday";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.scheduled).toBeDefined();
      });

      it("should handle complex date expressions", () => {
        const content = "- [ ] Task due:2024-12-25";
        const tasks = parser.parse(content);
        expect(tasks[0]!.metadata.due?.getFullYear()).toBe(2024);
        expect(tasks[0]!.metadata.due?.getMonth()).toBe(11); // December
        expect(tasks[0]!.metadata.due?.getDate()).toBe(25);
      });
    });

    describe("line numbers", () => {
      it("should correctly report line numbers starting from 1", () => {
        const content = "- [ ] First task";
        const tasks = parser.parse(content);
        expect(tasks[0]!.line).toBe(1);
      });

      it("should correctly report line numbers with blank lines", () => {
        const content = `

- [ ] Task after blank lines`;
        const tasks = parser.parse(content);
        expect(tasks[0]!.line).toBe(3);
      });

      it("should correctly report line numbers in large documents", () => {
        const lines: string[] = [];
        for (let i = 0; i < 100; i++) {
          lines.push(`Line ${i + 1}`);
        }
        lines[49] = "- [ ] Task at line 50";
        lines[99] = "- [x] Task at line 100";

        const content = lines.join("\n");
        const tasks = parser.parse(content);

        expect(tasks).toHaveLength(2);
        expect(tasks[0]!.line).toBe(50);
        expect(tasks[1]!.line).toBe(100);
      });
    });
  });
});
