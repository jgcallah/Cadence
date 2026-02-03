import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TaskModifier, type NewTask } from "./TaskModifier.js";
import { MemoryFileSystem } from "../fs/MemoryFileSystem.js";

describe("TaskModifier", () => {
  let fs: MemoryFileSystem;
  let modifier: TaskModifier;
  const fixedDate = new Date("2026-02-02T12:00:00.000Z");

  beforeEach(() => {
    fs = new MemoryFileSystem();
    modifier = new TaskModifier(fs);
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("toggleTask", () => {
    describe("toggle incomplete to complete", () => {
      it("should toggle incomplete task to complete", async () => {
        await fs.writeFile("/test.md", "- [ ] Buy groceries");

        const result = await modifier.toggleTask("/test.md", 1);

        expect(result.completed).toBe(true);
        expect(result.text).toBe("Buy groceries");
        expect(result.raw).toBe("- [x] Buy groceries");

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [x] Buy groceries");
      });

      it("should preserve metadata when toggling", async () => {
        await fs.writeFile(
          "/test.md",
          "- [ ] Task due:2024-01-15 priority:high #work"
        );

        const result = await modifier.toggleTask("/test.md", 1);

        expect(result.completed).toBe(true);
        expect(result.metadata.due).toEqual(new Date(2024, 0, 15));
        expect(result.metadata.priority).toBe("high");
        expect(result.metadata.tags).toEqual(["work"]);

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [x] Task due:2024-01-15 priority:high #work");
      });

      it("should preserve indentation when toggling", async () => {
        await fs.writeFile("/test.md", "  - [ ] Indented task");

        const result = await modifier.toggleTask("/test.md", 1);

        expect(result.raw).toBe("  - [x] Indented task");

        const content = await fs.readFile("/test.md");
        expect(content).toBe("  - [x] Indented task");
      });

      it("should work with * list marker", async () => {
        await fs.writeFile("/test.md", "* [ ] Asterisk task");

        const result = await modifier.toggleTask("/test.md", 1);

        expect(result.completed).toBe(true);
        expect(result.raw).toBe("* [x] Asterisk task");
      });

      it("should work with + list marker", async () => {
        await fs.writeFile("/test.md", "+ [ ] Plus task");

        const result = await modifier.toggleTask("/test.md", 1);

        expect(result.completed).toBe(true);
        expect(result.raw).toBe("+ [x] Plus task");
      });
    });

    describe("toggle complete to incomplete", () => {
      it("should toggle complete task to incomplete", async () => {
        await fs.writeFile("/test.md", "- [x] Completed task");

        const result = await modifier.toggleTask("/test.md", 1);

        expect(result.completed).toBe(false);
        expect(result.raw).toBe("- [ ] Completed task");

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Completed task");
      });

      it("should toggle uppercase X to incomplete", async () => {
        await fs.writeFile("/test.md", "- [X] Task with uppercase X");

        const result = await modifier.toggleTask("/test.md", 1);

        expect(result.completed).toBe(false);
        expect(result.raw).toBe("- [ ] Task with uppercase X");
      });

      it("should preserve metadata when toggling complete to incomplete", async () => {
        await fs.writeFile(
          "/test.md",
          "- [x] Done task created:2024-01-10 age:5"
        );

        const result = await modifier.toggleTask("/test.md", 1);

        expect(result.completed).toBe(false);
        expect(result.metadata.created).toEqual(new Date(2024, 0, 10));
        expect(result.metadata.age).toBe(5);
      });
    });

    describe("line number accuracy", () => {
      it("should toggle task at correct line in multi-line file", async () => {
        const content = `# Tasks

- [ ] First task
- [x] Second task
- [ ] Third task`;
        await fs.writeFile("/test.md", content);

        const result = await modifier.toggleTask("/test.md", 4);

        expect(result.completed).toBe(false);
        expect(result.text).toBe("Second task");

        const newContent = await fs.readFile("/test.md");
        expect(newContent).toContain("- [ ] Second task");
      });

      it("should handle Windows line endings", async () => {
        const content = "- [ ] First task\r\n- [x] Second task\r\n- [ ] Third task";
        await fs.writeFile("/test.md", content);

        const result = await modifier.toggleTask("/test.md", 2);

        expect(result.completed).toBe(false);

        const newContent = await fs.readFile("/test.md");
        expect(newContent).toBe(
          "- [ ] First task\r\n- [ ] Second task\r\n- [ ] Third task"
        );
      });

      it("should throw error for out-of-range line number", async () => {
        await fs.writeFile("/test.md", "- [ ] Only task");

        await expect(modifier.toggleTask("/test.md", 0)).rejects.toThrow(
          "Line number 0 is out of range"
        );
        await expect(modifier.toggleTask("/test.md", 5)).rejects.toThrow(
          "Line number 5 is out of range"
        );
      });

      it("should throw error if line is not a task", async () => {
        await fs.writeFile("/test.md", "# Just a heading");

        await expect(modifier.toggleTask("/test.md", 1)).rejects.toThrow(
          "Line 1 is not a task"
        );
      });
    });

    describe("error handling", () => {
      it("should throw error if file does not exist", async () => {
        await expect(modifier.toggleTask("/nonexistent.md", 1)).rejects.toThrow(
          /ENOENT/
        );
      });
    });
  });

  describe("updateMetadata", () => {
    describe("updating existing metadata", () => {
      it("should update due date", async () => {
        await fs.writeFile("/test.md", "- [ ] Task due:2024-01-15");

        const result = await modifier.updateMetadata("/test.md", 1, {
          due: new Date(2024, 2, 20),
        });

        expect(result.metadata.due).toEqual(new Date(2024, 2, 20));

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Task due:2024-03-20");
      });

      it("should update priority", async () => {
        await fs.writeFile("/test.md", "- [ ] Task priority:low");

        const result = await modifier.updateMetadata("/test.md", 1, {
          priority: "high",
        });

        expect(result.metadata.priority).toBe("high");

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Task priority:high");
      });

      it("should update priority from exclamation syntax", async () => {
        await fs.writeFile("/test.md", "- [ ] Urgent task !!!");

        const result = await modifier.updateMetadata("/test.md", 1, {
          priority: "low",
        });

        expect(result.metadata.priority).toBe("low");

        const content = await fs.readFile("/test.md");
        expect(content).toContain("priority:low");
        expect(content).not.toContain("!!!");
      });

      it("should update age", async () => {
        await fs.writeFile("/test.md", "- [ ] Old task age:5");

        const result = await modifier.updateMetadata("/test.md", 1, {
          age: 10,
        });

        expect(result.metadata.age).toBe(10);

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Old task age:10");
      });

      it("should update tags", async () => {
        await fs.writeFile("/test.md", "- [ ] Task #work #urgent");

        const result = await modifier.updateMetadata("/test.md", 1, {
          tags: ["personal", "home"],
        });

        expect(result.metadata.tags).toEqual(["personal", "home"]);

        const content = await fs.readFile("/test.md");
        expect(content).toContain("#personal");
        expect(content).toContain("#home");
        expect(content).not.toContain("#work");
        expect(content).not.toContain("#urgent");
      });

      it("should update created date", async () => {
        await fs.writeFile("/test.md", "- [ ] Task created:2024-01-01");

        const result = await modifier.updateMetadata("/test.md", 1, {
          created: new Date(2024, 5, 15),
        });

        expect(result.metadata.created).toEqual(new Date(2024, 5, 15));

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Task created:2024-06-15");
      });

      it("should update scheduled date", async () => {
        await fs.writeFile("/test.md", "- [ ] Task scheduled:2024-01-20");

        const result = await modifier.updateMetadata("/test.md", 1, {
          scheduled: new Date(2024, 3, 1),
        });

        expect(result.metadata.scheduled).toEqual(new Date(2024, 3, 1));

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Task scheduled:2024-04-01");
      });
    });

    describe("adding metadata if not present", () => {
      it("should add due date if not present", async () => {
        await fs.writeFile("/test.md", "- [ ] Simple task");

        const result = await modifier.updateMetadata("/test.md", 1, {
          due: new Date(2024, 5, 30),
        });

        expect(result.metadata.due).toEqual(new Date(2024, 5, 30));

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Simple task due:2024-06-30");
      });

      it("should add priority if not present", async () => {
        await fs.writeFile("/test.md", "- [ ] Simple task");

        const result = await modifier.updateMetadata("/test.md", 1, {
          priority: "medium",
        });

        expect(result.metadata.priority).toBe("medium");

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Simple task priority:medium");
      });

      it("should add age if not present", async () => {
        await fs.writeFile("/test.md", "- [ ] Simple task");

        const result = await modifier.updateMetadata("/test.md", 1, {
          age: 3,
        });

        expect(result.metadata.age).toBe(3);

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Simple task age:3");
      });

      it("should add tags if not present", async () => {
        await fs.writeFile("/test.md", "- [ ] Simple task");

        const result = await modifier.updateMetadata("/test.md", 1, {
          tags: ["work", "urgent"],
        });

        expect(result.metadata.tags).toEqual(["work", "urgent"]);

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Simple task #work #urgent");
      });

      it("should add multiple metadata fields at once", async () => {
        await fs.writeFile("/test.md", "- [ ] Simple task");

        const result = await modifier.updateMetadata("/test.md", 1, {
          due: new Date(2024, 5, 30),
          priority: "high",
          tags: ["urgent"],
        });

        expect(result.metadata.due).toEqual(new Date(2024, 5, 30));
        expect(result.metadata.priority).toBe("high");
        expect(result.metadata.tags).toEqual(["urgent"]);

        const content = await fs.readFile("/test.md");
        expect(content).toContain("due:2024-06-30");
        expect(content).toContain("priority:high");
        expect(content).toContain("#urgent");
      });
    });

    describe("removing metadata if value is null", () => {
      it("should remove due date when null", async () => {
        await fs.writeFile("/test.md", "- [ ] Task due:2024-01-15");

        const result = await modifier.updateMetadata("/test.md", 1, {
          due: null,
        });

        expect(result.metadata.due).toBeUndefined();

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Task");
      });

      it("should remove priority when null", async () => {
        await fs.writeFile("/test.md", "- [ ] Task priority:high");

        const result = await modifier.updateMetadata("/test.md", 1, {
          priority: null,
        });

        expect(result.metadata.priority).toBeUndefined();

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Task");
      });

      it("should remove exclamation priority when null", async () => {
        await fs.writeFile("/test.md", "- [ ] Task !!!");

        const result = await modifier.updateMetadata("/test.md", 1, {
          priority: null,
        });

        expect(result.metadata.priority).toBeUndefined();

        const content = await fs.readFile("/test.md");
        expect(content).not.toContain("!!!");
      });

      it("should remove age when null", async () => {
        await fs.writeFile("/test.md", "- [ ] Task age:5");

        const result = await modifier.updateMetadata("/test.md", 1, {
          age: null,
        });

        expect(result.metadata.age).toBeUndefined();

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Task");
      });

      it("should remove all tags when null", async () => {
        await fs.writeFile("/test.md", "- [ ] Task #work #urgent #todo");

        const result = await modifier.updateMetadata("/test.md", 1, {
          tags: null,
        });

        expect(result.metadata.tags).toEqual([]);

        const content = await fs.readFile("/test.md");
        expect(content).not.toContain("#");
      });

      it("should remove created date when null", async () => {
        await fs.writeFile("/test.md", "- [ ] Task created:2024-01-10");

        const result = await modifier.updateMetadata("/test.md", 1, {
          created: null,
        });

        expect(result.metadata.created).toBeUndefined();

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Task");
      });

      it("should remove scheduled date when null", async () => {
        await fs.writeFile("/test.md", "- [ ] Task scheduled:2024-01-20");

        const result = await modifier.updateMetadata("/test.md", 1, {
          scheduled: null,
        });

        expect(result.metadata.scheduled).toBeUndefined();

        const content = await fs.readFile("/test.md");
        expect(content).toBe("- [ ] Task");
      });
    });

    describe("line number accuracy", () => {
      it("should update metadata at correct line", async () => {
        const content = `# Tasks

- [ ] First task
- [ ] Second task
- [ ] Third task`;
        await fs.writeFile("/test.md", content);

        await modifier.updateMetadata("/test.md", 4, {
          priority: "high",
        });

        const newContent = await fs.readFile("/test.md");
        expect(newContent).toContain("- [ ] First task\n");
        expect(newContent).toContain("- [ ] Second task priority:high\n");
        expect(newContent).toContain("- [ ] Third task");
      });

      it("should throw error for non-task line", async () => {
        await fs.writeFile("/test.md", "# Heading\n\n- [ ] Task");

        await expect(
          modifier.updateMetadata("/test.md", 1, { priority: "high" })
        ).rejects.toThrow("Line 1 is not a task");
      });
    });

    describe("error handling", () => {
      it("should throw error if file does not exist", async () => {
        await expect(
          modifier.updateMetadata("/nonexistent.md", 1, { priority: "high" })
        ).rejects.toThrow(/ENOENT/);
      });

      it("should throw error for out-of-range line number", async () => {
        await fs.writeFile("/test.md", "- [ ] Only task");

        await expect(
          modifier.updateMetadata("/test.md", 10, { priority: "high" })
        ).rejects.toThrow("Line number 10 is out of range");
      });
    });
  });

  describe("addTask", () => {
    describe("adding to existing section", () => {
      it("should add task under existing section", async () => {
        const content = `# Daily Note

## Tasks

- [ ] Existing task`;
        await fs.writeFile("/test.md", content);

        const task: NewTask = {
          text: "New task",
        };

        const result = await modifier.addTask("/test.md", "## Tasks", task);

        expect(result.text).toBe("New task");
        expect(result.completed).toBe(false);

        const newContent = await fs.readFile("/test.md");
        expect(newContent).toContain("- [ ] New task");
        // New task should be after section heading
        expect(newContent.indexOf("## Tasks")).toBeLessThan(
          newContent.indexOf("- [ ] New task")
        );
      });

      it("should auto-add created date", async () => {
        await fs.writeFile("/test.md", "## Tasks\n");

        const task: NewTask = {
          text: "New task",
        };

        const result = await modifier.addTask("/test.md", "## Tasks", task);

        expect(result.metadata.created).toBeDefined();

        const content = await fs.readFile("/test.md");
        expect(content).toContain("created:2026-02-02");
      });

      it("should add completed task when specified", async () => {
        await fs.writeFile("/test.md", "## Tasks\n");

        const task: NewTask = {
          text: "Done task",
          completed: true,
        };

        const result = await modifier.addTask("/test.md", "## Tasks", task);

        expect(result.completed).toBe(true);

        const content = await fs.readFile("/test.md");
        expect(content).toContain("- [x] Done task");
      });

      it("should support all metadata fields", async () => {
        await fs.writeFile("/test.md", "## Tasks\n");

        const task: NewTask = {
          text: "Full task",
          metadata: {
            due: new Date(2024, 5, 30),
            scheduled: new Date(2024, 5, 15),
            priority: "high",
            age: 0,
            tags: ["work", "urgent"],
          },
        };

        const result = await modifier.addTask("/test.md", "## Tasks", task);

        expect(result.metadata.due).toEqual(new Date(2024, 5, 30));
        expect(result.metadata.scheduled).toEqual(new Date(2024, 5, 15));
        expect(result.metadata.priority).toBe("high");
        expect(result.metadata.tags).toEqual(["work", "urgent"]);

        const content = await fs.readFile("/test.md");
        expect(content).toContain("due:2024-06-30");
        expect(content).toContain("scheduled:2024-06-15");
        expect(content).toContain("priority:high");
        expect(content).toContain("age:0");
        expect(content).toContain("#work");
        expect(content).toContain("#urgent");
      });

      it("should use custom created date when provided", async () => {
        await fs.writeFile("/test.md", "## Tasks\n");

        const task: NewTask = {
          text: "Old task",
          metadata: {
            created: new Date(2024, 0, 1),
          },
        };

        await modifier.addTask("/test.md", "## Tasks", task);

        const content = await fs.readFile("/test.md");
        expect(content).toContain("created:2024-01-01");
      });
    });

    describe("adding when section does not exist", () => {
      it("should create section and add task", async () => {
        await fs.writeFile("/test.md", "# Daily Note\n\nSome content");

        const task: NewTask = {
          text: "New task",
        };

        await modifier.addTask("/test.md", "## Tasks", task);

        const content = await fs.readFile("/test.md");
        expect(content).toContain("## Tasks");
        expect(content).toContain("- [ ] New task");
      });

      it("should create section at end of file", async () => {
        await fs.writeFile("/test.md", "# Note\n\nParagraph");

        const task: NewTask = {
          text: "New task",
        };

        await modifier.addTask("/test.md", "## Tasks", task);

        const content = await fs.readFile("/test.md");
        const taskSectionIndex = content.indexOf("## Tasks");
        const paragraphIndex = content.indexOf("Paragraph");
        expect(taskSectionIndex).toBeGreaterThan(paragraphIndex);
      });
    });

    describe("adding to new file", () => {
      it("should create file with section and task", async () => {
        const task: NewTask = {
          text: "First task",
        };

        await modifier.addTask("/new.md", "## Tasks", task);

        const content = await fs.readFile("/new.md");
        expect(content).toContain("## Tasks");
        expect(content).toContain("- [ ] First task");
      });
    });

    describe("line number accuracy", () => {
      it("should return correct line number for added task", async () => {
        const content = `# Note

## Tasks

- [ ] Existing task`;
        await fs.writeFile("/test.md", content);

        const task: NewTask = {
          text: "New task",
        };

        const result = await modifier.addTask("/test.md", "## Tasks", task);

        // Task should be inserted after "## Tasks" heading (line 3)
        // So new task should be at line 4
        expect(result.line).toBe(4);
      });
    });

    describe("section matching", () => {
      it("should match section case-insensitively", async () => {
        await fs.writeFile("/test.md", "## TASKS\n");

        const task: NewTask = {
          text: "New task",
        };

        await modifier.addTask("/test.md", "## Tasks", task);

        const content = await fs.readFile("/test.md");
        // Should add after existing section, not create new one
        const taskCount = (content.match(/## /g) || []).length;
        expect(taskCount).toBe(1);
      });

      it("should match section with extra whitespace", async () => {
        await fs.writeFile("/test.md", "  ## Tasks  \n");

        const task: NewTask = {
          text: "New task",
        };

        await modifier.addTask("/test.md", "## Tasks", task);

        const content = await fs.readFile("/test.md");
        expect(content).toContain("- [ ] New task");
      });
    });
  });

  describe("concurrent modification safety", () => {
    it("should handle rapid sequential modifications", async () => {
      await fs.writeFile("/test.md", "- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3");

      // Toggle all tasks sequentially
      await modifier.toggleTask("/test.md", 1);
      await modifier.toggleTask("/test.md", 2);
      await modifier.toggleTask("/test.md", 3);

      const content = await fs.readFile("/test.md");
      expect(content).toBe("- [x] Task 1\n- [x] Task 2\n- [x] Task 3");
    });

    it("should handle interleaved toggle and metadata updates", async () => {
      await fs.writeFile("/test.md", "- [ ] Task 1\n- [ ] Task 2");

      await modifier.toggleTask("/test.md", 1);
      await modifier.updateMetadata("/test.md", 2, { priority: "high" });
      await modifier.toggleTask("/test.md", 2);

      const content = await fs.readFile("/test.md");
      expect(content).toContain("- [x] Task 1");
      expect(content).toContain("- [x] Task 2");
      expect(content).toContain("priority:high");
    });

    it("should maintain file integrity after multiple operations", async () => {
      const content = `# Daily Note

## Tasks

- [ ] Task A
- [ ] Task B priority:low
- [ ] Task C #tag`;
      await fs.writeFile("/test.md", content);

      // Multiple operations
      await modifier.toggleTask("/test.md", 5); // Toggle Task A
      await modifier.updateMetadata("/test.md", 6, { priority: "high" }); // Update Task B
      await modifier.addTask("/test.md", "## Tasks", { text: "Task D" }); // Add Task D
      await modifier.updateMetadata("/test.md", 7, { tags: ["urgent"] }); // Update Task C

      const finalContent = await fs.readFile("/test.md");

      // Verify structure is maintained
      expect(finalContent).toContain("# Daily Note");
      expect(finalContent).toContain("## Tasks");
      expect(finalContent).toContain("- [x] Task A"); // Toggled
      expect(finalContent).toContain("priority:high"); // Updated
      expect(finalContent).toContain("- [ ] Task D"); // Added
      expect(finalContent).toContain("#urgent"); // Tags updated
    });

    it("should handle file with mixed line endings", async () => {
      // Intentionally mixing line endings (which shouldn't happen but testing robustness)
      await fs.writeFile("/test.md", "- [ ] Task 1\r\n- [ ] Task 2\r\n");

      await modifier.toggleTask("/test.md", 1);
      await modifier.toggleTask("/test.md", 2);

      const content = await fs.readFile("/test.md");
      expect(content).toContain("[x]");
      // Should preserve original line ending style
      expect(content).toContain("\r\n");
    });
  });

  describe("edge cases", () => {
    it("should handle empty file for addTask", async () => {
      await fs.writeFile("/empty.md", "");

      const task: NewTask = {
        text: "First task",
      };

      await modifier.addTask("/empty.md", "## Tasks", task);

      const content = await fs.readFile("/empty.md");
      expect(content).toContain("## Tasks");
      expect(content).toContain("- [ ] First task");
    });

    it("should handle task with special characters", async () => {
      await fs.writeFile("/test.md", '- [ ] Fix "bug" in code & deploy');

      const result = await modifier.toggleTask("/test.md", 1);

      expect(result.text).toBe('Fix "bug" in code & deploy');
      expect(result.completed).toBe(true);
    });

    it("should handle deeply indented tasks", async () => {
      await fs.writeFile("/test.md", "        - [ ] Deep task");

      const result = await modifier.toggleTask("/test.md", 1);

      expect(result.raw).toBe("        - [x] Deep task");
    });

    it("should preserve task text when updating metadata", async () => {
      await fs.writeFile(
        "/test.md",
        "- [ ] Task with lots of text and details"
      );

      await modifier.updateMetadata("/test.md", 1, {
        due: new Date(2024, 5, 30),
        priority: "high",
        tags: ["important"],
      });

      const content = await fs.readFile("/test.md");
      expect(content).toContain("Task with lots of text and details");
    });

    it("should handle task at last line of file without trailing newline", async () => {
      await fs.writeFile("/test.md", "# Note\n\n- [ ] Last task");

      await modifier.toggleTask("/test.md", 3);

      const content = await fs.readFile("/test.md");
      expect(content).toBe("# Note\n\n- [x] Last task");
    });
  });
});
