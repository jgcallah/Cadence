import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VaultResolver, resolveVault } from "./VaultResolver.js";
import { MemoryFileSystem } from "../fs/MemoryFileSystem.js";
import { VaultNotFoundError } from "../errors/index.js";

describe("VaultResolver", () => {
  let fs: MemoryFileSystem;
  let resolver: VaultResolver;
  const originalEnv = process.env;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    resolver = new VaultResolver(fs);
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.CADENCE_VAULT_PATH;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("explicit path resolution", () => {
    it("should return explicit path when provided and valid", async () => {
      // Create a valid vault at the explicit path
      await fs.mkdir("/explicit/vault/.cadence", true);

      const result = await resolver.resolve({
        explicit: "/explicit/vault",
      });

      expect(result).toBe("/explicit/vault");
    });

    it("should throw VaultNotFoundError when explicit path has no .cadence folder", async () => {
      // Create directory but no .cadence folder
      await fs.mkdir("/explicit/vault", true);

      await expect(
        resolver.resolve({ explicit: "/explicit/vault" })
      ).rejects.toThrow(VaultNotFoundError);
    });

    it("should throw VaultNotFoundError when explicit path does not exist", async () => {
      await expect(
        resolver.resolve({ explicit: "/nonexistent/path" })
      ).rejects.toThrow(VaultNotFoundError);
    });

    it("should include explicit path in error message", async () => {
      await fs.mkdir("/explicit/vault", true);

      try {
        await resolver.resolve({ explicit: "/explicit/vault" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(VaultNotFoundError);
        expect((error as VaultNotFoundError).message).toContain(
          "/explicit/vault"
        );
      }
    });
  });

  describe("environment variable resolution", () => {
    it("should use CADENCE_VAULT_PATH when set and valid", async () => {
      process.env.CADENCE_VAULT_PATH = "/env/vault";
      await fs.mkdir("/env/vault/.cadence", true);

      const result = await resolver.resolve();

      expect(result).toBe("/env/vault");
    });

    it("should throw VaultNotFoundError when env path has no .cadence folder", async () => {
      process.env.CADENCE_VAULT_PATH = "/env/vault";
      await fs.mkdir("/env/vault", true);

      await expect(resolver.resolve()).rejects.toThrow(VaultNotFoundError);
    });

    it("should throw VaultNotFoundError when env path does not exist", async () => {
      process.env.CADENCE_VAULT_PATH = "/nonexistent/env/path";

      await expect(resolver.resolve()).rejects.toThrow(VaultNotFoundError);
    });

    it("should include environment variable path in error message", async () => {
      process.env.CADENCE_VAULT_PATH = "/env/vault";
      await fs.mkdir("/env/vault", true);

      try {
        await resolver.resolve();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(VaultNotFoundError);
        expect((error as VaultNotFoundError).message).toContain(
          "CADENCE_VAULT_PATH"
        );
        expect((error as VaultNotFoundError).message).toContain("/env/vault");
      }
    });
  });

  describe("ancestor walk resolution", () => {
    it("should find .cadence in current directory", async () => {
      await fs.mkdir("/project/.cadence", true);

      const result = await resolver.resolve({ cwd: "/project" });

      expect(result).toBe("/project");
    });

    it("should find .cadence in parent directory", async () => {
      await fs.mkdir("/vault/.cadence", true);
      await fs.mkdir("/vault/subdir", true);

      const result = await resolver.resolve({ cwd: "/vault/subdir" });

      expect(result).toBe("/vault");
    });

    it("should find .cadence in grandparent directory", async () => {
      await fs.mkdir("/vault/.cadence", true);
      await fs.mkdir("/vault/a/b", true);

      const result = await resolver.resolve({ cwd: "/vault/a/b" });

      expect(result).toBe("/vault");
    });

    it("should find .cadence in deeply nested ancestor", async () => {
      await fs.mkdir("/vault/.cadence", true);
      await fs.mkdir("/vault/a/b/c/d/e", true);

      const result = await resolver.resolve({ cwd: "/vault/a/b/c/d/e" });

      expect(result).toBe("/vault");
    });

    it("should throw VaultNotFoundError when no .cadence in any ancestor", async () => {
      await fs.mkdir("/no/vault/here", true);

      await expect(
        resolver.resolve({ cwd: "/no/vault/here" })
      ).rejects.toThrow(VaultNotFoundError);
    });

    it("should include searched paths in error message", async () => {
      await fs.mkdir("/no/vault/here", true);

      try {
        await resolver.resolve({ cwd: "/no/vault/here" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(VaultNotFoundError);
        const message = (error as VaultNotFoundError).message;
        expect(message).toContain("ancestor walk");
        expect(message).toContain("/no/vault/here");
      }
    });

    it("should stop at root directory", async () => {
      // Just root directory with no .cadence
      await fs.mkdir("/", true);

      await expect(resolver.resolve({ cwd: "/" })).rejects.toThrow(
        VaultNotFoundError
      );
    });
  });

  describe("resolution priority", () => {
    beforeEach(async () => {
      // Set up all three possible resolution paths
      await fs.mkdir("/explicit/.cadence", true);
      await fs.mkdir("/env/.cadence", true);
      await fs.mkdir("/cwd/.cadence", true);
      process.env.CADENCE_VAULT_PATH = "/env";
    });

    it("should prefer explicit path over environment variable", async () => {
      const result = await resolver.resolve({
        explicit: "/explicit",
        cwd: "/cwd",
      });

      expect(result).toBe("/explicit");
    });

    it("should prefer environment variable over ancestor walk", async () => {
      const result = await resolver.resolve({ cwd: "/cwd" });

      expect(result).toBe("/env");
    });

    it("should use ancestor walk when explicit and env are not provided", async () => {
      delete process.env.CADENCE_VAULT_PATH;

      const result = await resolver.resolve({ cwd: "/cwd" });

      expect(result).toBe("/cwd");
    });

    it("should fall through when explicit path is invalid", async () => {
      // Explicit path exists but has no .cadence folder
      await fs.mkdir("/invalid-explicit", true);

      // Should fall through to environment variable since explicit path is invalid
      const result = await resolver.resolve({
        explicit: "/invalid-explicit",
        cwd: "/cwd",
      });

      // Falls through to env var (which is /env and is valid)
      expect(result).toBe("/env");
    });
  });

  describe("error messages", () => {
    it("should list all strategies tried when all fail", async () => {
      process.env.CADENCE_VAULT_PATH = "/env/path";
      await fs.mkdir("/env/path", true); // exists but no .cadence
      await fs.mkdir("/cwd/path", true);

      try {
        await resolver.resolve({
          explicit: "/explicit/path",
          cwd: "/cwd/path",
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(VaultNotFoundError);
        const message = (error as VaultNotFoundError).message;
        expect(message).toContain("explicit");
        expect(message).toContain("/explicit/path");
        expect(message).toContain("CADENCE_VAULT_PATH");
        expect(message).toContain("/env/path");
        expect(message).toContain("ancestor");
      }
    });

    it("should only mention strategies that were attempted", async () => {
      await fs.mkdir("/cwd/path", true);

      try {
        await resolver.resolve({ cwd: "/cwd/path" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(VaultNotFoundError);
        const message = (error as VaultNotFoundError).message;
        // Should not mention "explicit path:" since none was provided
        expect(message).not.toContain("explicit path:");
        // Should mention ancestor walk since that was the fallback
        expect(message).toContain("ancestor");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle paths with trailing slashes", async () => {
      await fs.mkdir("/vault/.cadence", true);

      const result = await resolver.resolve({ explicit: "/vault/" });

      expect(result).toBe("/vault");
    });

    it("should handle cwd at root with .cadence folder", async () => {
      // First create root directory explicitly (MemoryFileSystem needs this)
      await fs.mkdir("/", true);
      await fs.mkdir("/.cadence", true);

      // When cwd is root and .cadence exists there
      const result = await resolver.resolve({ cwd: "/" });

      expect(result).toBe("/");
    });

    it("should handle Windows-style paths", async () => {
      await fs.mkdir("/C:/Users/test/.cadence", true);

      const result = await resolver.resolve({
        explicit: "/C:/Users/test",
      });

      expect(result).toBe("/C:/Users/test");
    });
  });
});

describe("resolveVault helper function", () => {
  let fs: MemoryFileSystem;
  const originalEnv = process.env;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    process.env = { ...originalEnv };
    delete process.env.CADENCE_VAULT_PATH;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should create VaultResolver internally and resolve", async () => {
    await fs.mkdir("/vault/.cadence", true);

    const result = await resolveVault(fs, { explicit: "/vault" });

    expect(result).toBe("/vault");
  });

  it("should throw VaultNotFoundError when no vault found", async () => {
    await fs.mkdir("/no-vault", true);

    await expect(resolveVault(fs, { cwd: "/no-vault" })).rejects.toThrow(
      VaultNotFoundError
    );
  });
});
