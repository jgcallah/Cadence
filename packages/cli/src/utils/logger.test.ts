import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger, setVerbose, isVerbose } from "./logger.js";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    green: (str: string) => `[green]${str}[/green]`,
    gray: (str: string) => `[gray]${str}[/gray]`,
    red: (str: string) => `[red]${str}[/red]`,
    yellow: (str: string) => `[yellow]${str}[/yellow]`,
  },
}));

describe("logger utility", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setVerbose(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setVerbose(false);
  });

  describe("setVerbose and isVerbose", () => {
    it("should default to non-verbose mode", () => {
      expect(isVerbose()).toBe(false);
    });

    it("should enable verbose mode", () => {
      setVerbose(true);
      expect(isVerbose()).toBe(true);
    });

    it("should disable verbose mode", () => {
      setVerbose(true);
      setVerbose(false);
      expect(isVerbose()).toBe(false);
    });
  });

  describe("info", () => {
    it("should always log info messages", () => {
      logger.info("test message");
      expect(consoleLogSpy).toHaveBeenCalledWith("test message");
    });
  });

  describe("success", () => {
    it("should log success messages with green checkmark", () => {
      logger.success("operation completed");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[green]✓[/green]",
        "operation completed"
      );
    });
  });

  describe("warn", () => {
    it("should log warning messages with yellow indicator", () => {
      logger.warn("warning message");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[yellow]⚠[/yellow]",
        "warning message"
      );
    });
  });

  describe("error", () => {
    it("should log error messages with red indicator", () => {
      logger.error("error message");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[red]✗[/red]",
        "error message"
      );
    });
  });

  describe("debug", () => {
    it("should not log in non-verbose mode", () => {
      setVerbose(false);
      logger.debug("debug message");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log in verbose mode", () => {
      setVerbose(true);
      logger.debug("debug message");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[gray][debug] debug message[/gray]"
      );
    });
  });

  describe("debugLabeled", () => {
    it("should not log in non-verbose mode", () => {
      setVerbose(false);
      logger.debugLabeled("label", "message");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log with label in verbose mode", () => {
      setVerbose(true);
      logger.debugLabeled("config", "loaded successfully");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[gray][config][/gray]",
        "[gray]loaded successfully[/gray]"
      );
    });
  });

  describe("debugVault", () => {
    it("should not log in non-verbose mode", () => {
      setVerbose(false);
      logger.debugVault("/path/to/vault", "explicit");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log vault info in verbose mode", () => {
      setVerbose(true);
      logger.debugVault("/path/to/vault", "auto-resolved");
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        1,
        "[gray][vault] Resolved to: /path/to/vault[/gray]"
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        2,
        "[gray][vault] Source: auto-resolved[/gray]"
      );
    });
  });

  describe("debugConfig", () => {
    it("should not log in non-verbose mode", () => {
      setVerbose(false);
      logger.debugConfig("/path/to/config.json");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log config path in verbose mode", () => {
      setVerbose(true);
      logger.debugConfig("/vault/.cadence/config.json");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[gray][config] Loaded from: /vault/.cadence/config.json[/gray]"
      );
    });
  });

  describe("debugFile", () => {
    it("should not log in non-verbose mode", () => {
      setVerbose(false);
      logger.debugFile("read", "/path/to/file.md");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log file operations in verbose mode", () => {
      setVerbose(true);
      logger.debugFile("write", "/path/to/file.md");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[gray][file] write: /path/to/file.md[/gray]"
      );
    });
  });

  describe("debugTemplate", () => {
    it("should not log in non-verbose mode", () => {
      setVerbose(false);
      logger.debugTemplate("loading", "meeting");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log template operations in verbose mode", () => {
      setVerbose(true);
      logger.debugTemplate("rendering", "daily");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[gray][template] rendering: daily[/gray]"
      );
    });
  });

  describe("debugCommand", () => {
    it("should not log in non-verbose mode", () => {
      setVerbose(false);
      logger.debugCommand("daily");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log command execution in verbose mode", () => {
      setVerbose(true);
      logger.debugCommand("daily");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[gray][command] Executing: daily[/gray]"
      );
    });

    it("should log command options when provided", () => {
      setVerbose(true);
      logger.debugCommand("tasks", { days: 7, overdue: true });
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        1,
        "[gray][command] Executing: tasks[/gray]"
      );
      expect(consoleLogSpy).toHaveBeenNthCalledWith(
        2,
        '[gray][command] Options: {"days":7,"overdue":true}[/gray]'
      );
    });

    it("should not log empty options object", () => {
      setVerbose(true);
      logger.debugCommand("daily", {});
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });
});
