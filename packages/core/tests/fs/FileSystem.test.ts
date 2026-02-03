import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "node:path";
import * as fs from "fs-extra";
import * as os from "node:os";
import type { IFileSystem } from "../../src/fs/types.js";
import { NodeFileSystem } from "../../src/fs/NodeFileSystem.js";
import { MemoryFileSystem } from "../../src/fs/MemoryFileSystem.js";

/**
 * Shared test suite that runs against both NodeFileSystem and MemoryFileSystem.
 * This ensures both implementations behave identically.
 */
function createFileSystemTests(
  name: string,
  createFileSystem: () => IFileSystem | Promise<IFileSystem>,
  cleanup?: () => Promise<void>
) {
  describe(name, () => {
    let fileSystem: IFileSystem;
    let testDir: string;

    beforeEach(async () => {
      fileSystem = await createFileSystem();
      // For NodeFileSystem, testDir is set by the factory
      // For MemoryFileSystem, we use a virtual path
      testDir = name === "NodeFileSystem" ? (fileSystem as NodeFileSystem & { testDir: string }).testDir : "/test";

      // Create test directory
      await fileSystem.mkdir(testDir, true);
    });

    afterEach(async () => {
      if (cleanup) {
        await cleanup();
      }
    });

    describe("readFile / writeFile", () => {
      it("should write and read a file", async () => {
        const filePath = path.join(testDir, "test.txt");
        const content = "Hello, World!";

        await fileSystem.writeFile(filePath, content);
        const result = await fileSystem.readFile(filePath);

        expect(result).toBe(content);
      });

      it("should handle UTF-8 content with special characters", async () => {
        const filePath = path.join(testDir, "unicode.txt");
        const content = "Hello 世界! 🎉 Привет мир!";

        await fileSystem.writeFile(filePath, content);
        const result = await fileSystem.readFile(filePath);

        expect(result).toBe(content);
      });

      it("should overwrite existing file content", async () => {
        const filePath = path.join(testDir, "overwrite.txt");

        await fileSystem.writeFile(filePath, "original");
        await fileSystem.writeFile(filePath, "updated");
        const result = await fileSystem.readFile(filePath);

        expect(result).toBe("updated");
      });

      it("should throw when reading non-existent file", async () => {
        const filePath = path.join(testDir, "nonexistent.txt");

        await expect(fileSystem.readFile(filePath)).rejects.toThrow();
      });

      it("should handle empty files", async () => {
        const filePath = path.join(testDir, "empty.txt");

        await fileSystem.writeFile(filePath, "");
        const result = await fileSystem.readFile(filePath);

        expect(result).toBe("");
      });

      it("should handle multiline content", async () => {
        const filePath = path.join(testDir, "multiline.txt");
        const content = "line1\nline2\nline3\n";

        await fileSystem.writeFile(filePath, content);
        const result = await fileSystem.readFile(filePath);

        expect(result).toBe(content);
      });

      it("should create parent directories when writing", async () => {
        const filePath = path.join(testDir, "nested", "deep", "file.txt");
        const content = "nested content";

        await fileSystem.writeFile(filePath, content);
        const result = await fileSystem.readFile(filePath);

        expect(result).toBe(content);
      });
    });

    describe("exists", () => {
      it("should return true for existing file", async () => {
        const filePath = path.join(testDir, "exists.txt");
        await fileSystem.writeFile(filePath, "content");

        const result = await fileSystem.exists(filePath);

        expect(result).toBe(true);
      });

      it("should return true for existing directory", async () => {
        const dirPath = path.join(testDir, "existsDir");
        await fileSystem.mkdir(dirPath);

        const result = await fileSystem.exists(dirPath);

        expect(result).toBe(true);
      });

      it("should return false for non-existent path", async () => {
        const filePath = path.join(testDir, "doesNotExist.txt");

        const result = await fileSystem.exists(filePath);

        expect(result).toBe(false);
      });
    });

    describe("mkdir", () => {
      it("should create a directory", async () => {
        const dirPath = path.join(testDir, "newDir");

        await fileSystem.mkdir(dirPath);
        const exists = await fileSystem.exists(dirPath);

        expect(exists).toBe(true);
      });

      it("should create nested directories with recursive option", async () => {
        const dirPath = path.join(testDir, "a", "b", "c");

        await fileSystem.mkdir(dirPath, true);
        const exists = await fileSystem.exists(dirPath);

        expect(exists).toBe(true);
      });

      it("should throw when creating nested directories without recursive option", async () => {
        const dirPath = path.join(testDir, "x", "y", "z");

        await expect(fileSystem.mkdir(dirPath, false)).rejects.toThrow();
      });

      it("should not throw when directory already exists with recursive option", async () => {
        const dirPath = path.join(testDir, "alreadyExists");
        await fileSystem.mkdir(dirPath, true);

        await expect(fileSystem.mkdir(dirPath, true)).resolves.not.toThrow();
      });
    });

    describe("readdir", () => {
      it("should list files in a directory", async () => {
        await fileSystem.writeFile(path.join(testDir, "file1.txt"), "a");
        await fileSystem.writeFile(path.join(testDir, "file2.txt"), "b");

        const entries = await fileSystem.readdir(testDir);

        expect(entries).toContain("file1.txt");
        expect(entries).toContain("file2.txt");
      });

      it("should list directories in a directory", async () => {
        await fileSystem.mkdir(path.join(testDir, "subdir1"));
        await fileSystem.mkdir(path.join(testDir, "subdir2"));

        const entries = await fileSystem.readdir(testDir);

        expect(entries).toContain("subdir1");
        expect(entries).toContain("subdir2");
      });

      it("should return empty array for empty directory", async () => {
        const emptyDir = path.join(testDir, "emptyDir");
        await fileSystem.mkdir(emptyDir);

        const entries = await fileSystem.readdir(emptyDir);

        expect(entries).toEqual([]);
      });

      it("should throw when reading non-existent directory", async () => {
        const dirPath = path.join(testDir, "nonExistentDir");

        await expect(fileSystem.readdir(dirPath)).rejects.toThrow();
      });
    });

    describe("stat", () => {
      it("should return stats for a file", async () => {
        const filePath = path.join(testDir, "statFile.txt");
        await fileSystem.writeFile(filePath, "content");

        const stats = await fileSystem.stat(filePath);

        expect(stats.isFile).toBe(true);
        expect(stats.isDirectory).toBe(false);
        expect(stats.size).toBe(7); // "content" is 7 bytes
        expect(stats.mtime).toBeInstanceOf(Date);
        expect(stats.ctime).toBeInstanceOf(Date);
      });

      it("should return stats for a directory", async () => {
        const dirPath = path.join(testDir, "statDir");
        await fileSystem.mkdir(dirPath);

        const stats = await fileSystem.stat(dirPath);

        expect(stats.isFile).toBe(false);
        expect(stats.isDirectory).toBe(true);
        expect(stats.mtime).toBeInstanceOf(Date);
        expect(stats.ctime).toBeInstanceOf(Date);
      });

      it("should throw when stat non-existent path", async () => {
        const filePath = path.join(testDir, "nonExistent.txt");

        await expect(fileSystem.stat(filePath)).rejects.toThrow();
      });
    });

    describe("unlink", () => {
      it("should delete a file", async () => {
        const filePath = path.join(testDir, "toDelete.txt");
        await fileSystem.writeFile(filePath, "delete me");

        await fileSystem.unlink(filePath);
        const exists = await fileSystem.exists(filePath);

        expect(exists).toBe(false);
      });

      it("should throw when deleting non-existent file", async () => {
        const filePath = path.join(testDir, "nonExistent.txt");

        await expect(fileSystem.unlink(filePath)).rejects.toThrow();
      });
    });

    describe("rename", () => {
      it("should rename a file", async () => {
        const oldPath = path.join(testDir, "oldName.txt");
        const newPath = path.join(testDir, "newName.txt");
        await fileSystem.writeFile(oldPath, "content");

        await fileSystem.rename(oldPath, newPath);

        expect(await fileSystem.exists(oldPath)).toBe(false);
        expect(await fileSystem.exists(newPath)).toBe(true);
        expect(await fileSystem.readFile(newPath)).toBe("content");
      });

      it("should move a file to a different directory", async () => {
        const oldPath = path.join(testDir, "moveMe.txt");
        const newDir = path.join(testDir, "newLocation");
        const newPath = path.join(newDir, "moved.txt");
        await fileSystem.writeFile(oldPath, "movable");
        await fileSystem.mkdir(newDir);

        await fileSystem.rename(oldPath, newPath);

        expect(await fileSystem.exists(oldPath)).toBe(false);
        expect(await fileSystem.exists(newPath)).toBe(true);
        expect(await fileSystem.readFile(newPath)).toBe("movable");
      });

      it("should rename a directory", async () => {
        const oldPath = path.join(testDir, "oldDir");
        const newPath = path.join(testDir, "newDir");
        await fileSystem.mkdir(oldPath);
        await fileSystem.writeFile(path.join(oldPath, "file.txt"), "inside");

        await fileSystem.rename(oldPath, newPath);

        expect(await fileSystem.exists(oldPath)).toBe(false);
        expect(await fileSystem.exists(newPath)).toBe(true);
        expect(await fileSystem.readFile(path.join(newPath, "file.txt"))).toBe("inside");
      });

      it("should throw when renaming non-existent path", async () => {
        const oldPath = path.join(testDir, "nonExistent.txt");
        const newPath = path.join(testDir, "newName.txt");

        await expect(fileSystem.rename(oldPath, newPath)).rejects.toThrow();
      });
    });
  });
}

// Variables for NodeFileSystem test setup
let nodeFsTestDir: string;
let nodeFsInstance: NodeFileSystem & { testDir: string };

// Create test suites for both implementations
createFileSystemTests(
  "NodeFileSystem",
  async () => {
    nodeFsTestDir = path.join(os.tmpdir(), `cadence-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(nodeFsTestDir);
    nodeFsInstance = new NodeFileSystem() as NodeFileSystem & { testDir: string };
    nodeFsInstance.testDir = nodeFsTestDir;
    return nodeFsInstance;
  },
  async () => {
    if (nodeFsTestDir) {
      await fs.remove(nodeFsTestDir);
    }
  }
);

createFileSystemTests(
  "MemoryFileSystem",
  () => new MemoryFileSystem()
);

// MemoryFileSystem-specific tests for error simulation
describe("MemoryFileSystem - Error Simulation", () => {
  let memFs: MemoryFileSystem;

  beforeEach(() => {
    memFs = new MemoryFileSystem();
  });

  it("should simulate read errors", async () => {
    await memFs.writeFile("/test.txt", "content");
    memFs.simulateError("readFile", new Error("Simulated read error"));

    await expect(memFs.readFile("/test.txt")).rejects.toThrow("Simulated read error");
  });

  it("should simulate write errors", async () => {
    memFs.simulateError("writeFile", new Error("Disk full"));

    await expect(memFs.writeFile("/test.txt", "content")).rejects.toThrow("Disk full");
  });

  it("should simulate stat errors", async () => {
    await memFs.writeFile("/test.txt", "content");
    memFs.simulateError("stat", new Error("Permission denied"));

    await expect(memFs.stat("/test.txt")).rejects.toThrow("Permission denied");
  });

  it("should clear simulated errors", async () => {
    memFs.simulateError("readFile", new Error("Simulated error"));
    memFs.clearSimulatedErrors();

    await memFs.writeFile("/test.txt", "content");
    await expect(memFs.readFile("/test.txt")).resolves.toBe("content");
  });

  it("should simulate error once and then succeed", async () => {
    await memFs.writeFile("/test.txt", "content");
    memFs.simulateErrorOnce("readFile", new Error("Temporary failure"));

    await expect(memFs.readFile("/test.txt")).rejects.toThrow("Temporary failure");
    await expect(memFs.readFile("/test.txt")).resolves.toBe("content");
  });
});
