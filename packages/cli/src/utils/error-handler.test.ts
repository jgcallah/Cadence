import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  CadenceError,
  VaultNotFoundError,
  ConfigNotFoundError,
  ErrorCode,
} from "@cadence/core";

// Mock chalk
vi.mock("chalk", () => ({
  default: {
    green: (str: string) => `[green]${str}[/green]`,
    gray: (str: string) => `[gray]${str}[/gray]`,
    red: (str: string) => `[red]${str}[/red]`,
    yellow: (str: string) => `[yellow]${str}[/yellow]`,
  },
}));

describe("error-handler", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleError", () => {
    it("should format VaultNotFoundError with helpful tip", async () => {
      const { handleError } = await import("./error-handler.js");
      const error = new VaultNotFoundError("No vault found");

      handleError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[red]Vault not found:[/red]",
        "No vault found"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[yellow]Tip:[/yellow]",
        "Initialize a vault with 'cadence init' or specify --vault"
      );
    });

    it("should format ConfigNotFoundError with helpful tip", async () => {
      const { handleError } = await import("./error-handler.js");
      const error = new ConfigNotFoundError("/path/to/vault");

      handleError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[red]Config not found:[/red]",
        "No .cadence/config.json found in vault at /path/to/vault"
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[yellow]Tip:[/yellow]",
        "Initialize the vault with 'cadence init'"
      );
    });

    it("should format generic CadenceError", async () => {
      const { handleError } = await import("./error-handler.js");
      const error = new CadenceError(ErrorCode.UNKNOWN, "Something went wrong");

      handleError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[red]Error:[/red]",
        "Something went wrong"
      );
    });

    it("should format generic Error", async () => {
      const { handleError } = await import("./error-handler.js");
      const error = new Error("Generic error");

      handleError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[red]Error:[/red]",
        "Generic error"
      );
    });

    it("should format non-Error objects", async () => {
      const { handleError } = await import("./error-handler.js");

      handleError("string error");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[red]Error:[/red]",
        "string error"
      );
    });

    it("should show cause if present", async () => {
      const { handleError } = await import("./error-handler.js");
      const cause = new Error("Underlying cause");
      const error = new CadenceError(ErrorCode.UNKNOWN, "Top level error", {
        cause,
      });

      handleError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[gray]  Caused by: Underlying cause[/gray]"
      );
    });
  });
});
