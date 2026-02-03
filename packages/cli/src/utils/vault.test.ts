import { describe, it, expect } from "vitest";
import { Command } from "commander";

describe("vault utilities", () => {
  describe("getVaultOption", () => {
    it("should return undefined when no vault option is set", async () => {
      const { getVaultOption } = await import("./vault.js");
      const cmd = new Command();
      cmd.option("--vault <path>", "Vault path");
      // Don't parse - just test the raw command
      const result = getVaultOption(cmd);

      expect(result).toBeUndefined();
    });

    it("should return local vault option when set via setOptionValue", async () => {
      const { getVaultOption } = await import("./vault.js");
      const cmd = new Command();
      cmd.option("--vault <path>", "Vault path");
      // Set the option value directly instead of parsing
      cmd.setOptionValue("vault", "/my/vault");

      const result = getVaultOption(cmd);

      expect(result).toBe("/my/vault");
    });

    it("should return parent vault option when local is not set", async () => {
      const { getVaultOption } = await import("./vault.js");
      const parent = new Command("parent");
      parent.option("--vault <path>", "Vault path");
      parent.setOptionValue("vault", "/parent/vault");

      const child = new Command("child");
      parent.addCommand(child);

      const result = getVaultOption(child);

      expect(result).toBe("/parent/vault");
    });
  });
});
