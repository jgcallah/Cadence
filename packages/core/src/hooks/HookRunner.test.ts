import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { HookRunner } from "./HookRunner.js";
import type { HookContext, HookResult as _HookResult } from "./types.js";

// Mock child_process.exec
vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

import { exec } from "child_process";

const mockExec = vi.mocked(exec);

describe("HookRunner", () => {
  let hookRunner: HookRunner;
  const defaultContext: HookContext = {
    notePath: "/vault/Journal/Daily/2026-01-15.md",
    noteType: "daily",
    date: "2026-01-15",
    vaultPath: "/vault",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    hookRunner = new HookRunner();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("run", () => {
    it("should execute hook command and return success result", async () => {
      // Mock successful execution
      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (typeof callback === "function") {
          callback(null, "hook output", "");
        }
        return {} as ReturnType<typeof exec>;
      });

      const result = await hookRunner.run(
        "echo 'test'",
        "preCreate",
        defaultContext
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toBe("hook output");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    });

    it("should pass context via environment variables", async () => {
      let capturedEnv: NodeJS.ProcessEnv | undefined;

      mockExec.mockImplementation((_cmd, options, callback) => {
        if (typeof options === "object" && options !== null && "env" in options) {
          capturedEnv = options.env as NodeJS.ProcessEnv;
        }
        if (typeof callback === "function") {
          callback(null, "", "");
        }
        return {} as ReturnType<typeof exec>;
      });

      await hookRunner.run("echo 'test'", "preCreate", defaultContext);

      expect(capturedEnv).toBeDefined();
      expect(capturedEnv?.CADENCE_NOTE_PATH).toBe(defaultContext.notePath);
      expect(capturedEnv?.CADENCE_NOTE_TYPE).toBe(defaultContext.noteType);
      expect(capturedEnv?.CADENCE_DATE).toBe(defaultContext.date);
      expect(capturedEnv?.CADENCE_VAULT_PATH).toBe(defaultContext.vaultPath);
      expect(capturedEnv?.CADENCE_HOOK_NAME).toBe("preCreate");
    });

    it("should handle hook failure gracefully and return failure result", async () => {
      const error = new Error("Command failed") as Error & { code?: number };
      error.code = 1;

      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (typeof callback === "function") {
          callback(error, "", "error output");
        }
        return {} as ReturnType<typeof exec>;
      });

      const result = await hookRunner.run(
        "failing-command",
        "postCreate",
        defaultContext
      );

      expect(result.success).toBe(false);
      expect(result.stderr).toBe("error output");
      expect(result.exitCode).toBe(1);
    });

    it("should handle hook timeout", async () => {
      // Create a hook runner with a short timeout
      const shortTimeoutRunner = new HookRunner({ timeoutMs: 100 });

      mockExec.mockImplementation((_cmd, _options, _callback) => {
        // Simulate a command that never completes
        // The callback is never called to simulate timeout
        return {} as ReturnType<typeof exec>;
      });

      const result = await shortTimeoutRunner.run(
        "sleep 60",
        "preCreate",
        defaultContext
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(-1);
      expect(result.stderr).toContain("timeout");
    });

    it("should use default timeout of 30 seconds", () => {
      const runner = new HookRunner();
      expect(runner.timeoutMs).toBe(30000);
    });

    it("should allow custom timeout configuration", () => {
      const runner = new HookRunner({ timeoutMs: 60000 });
      expect(runner.timeoutMs).toBe(60000);
    });

    it("should return null command result when command is null", async () => {
      const result = await hookRunner.run(null, "preCreate", defaultContext);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
    });

    it("should return empty command result when command is empty string", async () => {
      const result = await hookRunner.run("", "preCreate", defaultContext);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
    });

    it("should handle process exit code in error", async () => {
      const error = new Error("Exit code 127") as Error & { code?: number };
      error.code = 127;

      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (typeof callback === "function") {
          callback(error, "", "command not found");
        }
        return {} as ReturnType<typeof exec>;
      });

      const result = await hookRunner.run(
        "nonexistent-command",
        "preCreate",
        defaultContext
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(127);
    });

    it("should capture both stdout and stderr", async () => {
      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (typeof callback === "function") {
          callback(null, "standard output", "warning message");
        }
        return {} as ReturnType<typeof exec>;
      });

      const result = await hookRunner.run(
        "some-command",
        "postCreate",
        defaultContext
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toBe("standard output");
      expect(result.stderr).toBe("warning message");
      expect(result.exitCode).toBe(0);
    });

    it("should work with preCreate hook type", async () => {
      let capturedEnv: NodeJS.ProcessEnv | undefined;

      mockExec.mockImplementation((_cmd, options, callback) => {
        if (typeof options === "object" && options !== null && "env" in options) {
          capturedEnv = options.env as NodeJS.ProcessEnv;
        }
        if (typeof callback === "function") {
          callback(null, "", "");
        }
        return {} as ReturnType<typeof exec>;
      });

      await hookRunner.run("echo 'test'", "preCreate", defaultContext);

      expect(capturedEnv?.CADENCE_HOOK_NAME).toBe("preCreate");
    });

    it("should work with postCreate hook type", async () => {
      let capturedEnv: NodeJS.ProcessEnv | undefined;

      mockExec.mockImplementation((_cmd, options, callback) => {
        if (typeof options === "object" && options !== null && "env" in options) {
          capturedEnv = options.env as NodeJS.ProcessEnv;
        }
        if (typeof callback === "function") {
          callback(null, "", "");
        }
        return {} as ReturnType<typeof exec>;
      });

      await hookRunner.run("echo 'test'", "postCreate", defaultContext);

      expect(capturedEnv?.CADENCE_HOOK_NAME).toBe("postCreate");
    });
  });

  describe("error handling", () => {
    it("should not throw on hook failure - returns result instead", async () => {
      const error = new Error("Command failed") as Error & { code?: number };
      error.code = 1;

      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (typeof callback === "function") {
          callback(error, "", "error");
        }
        return {} as ReturnType<typeof exec>;
      });

      // Should not throw
      const result = await hookRunner.run(
        "failing-command",
        "preCreate",
        defaultContext
      );

      expect(result.success).toBe(false);
    });

    it("should handle error without code property", async () => {
      const error = new Error("Unknown error");

      mockExec.mockImplementation((_cmd, _options, callback) => {
        if (typeof callback === "function") {
          callback(error, "", "unknown error");
        }
        return {} as ReturnType<typeof exec>;
      });

      const result = await hookRunner.run(
        "some-command",
        "preCreate",
        defaultContext
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1); // Default to 1 when no code
    });
  });

  describe("cross-platform support", () => {
    it("should use exec which runs commands in a shell by default", async () => {
      let capturedCommand: string | undefined;

      mockExec.mockImplementation((cmd, _options, callback) => {
        capturedCommand = cmd as string;
        if (typeof callback === "function") {
          callback(null, "", "");
        }
        return {} as ReturnType<typeof exec>;
      });

      await hookRunner.run("echo test", "preCreate", defaultContext);

      // exec runs commands in a shell by default, which supports shell syntax
      expect(capturedCommand).toBe("echo test");
    });
  });
});
