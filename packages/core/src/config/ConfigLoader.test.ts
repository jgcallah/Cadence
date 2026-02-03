import { describe, it, expect, beforeEach } from "vitest";
import { ConfigLoader, getDefaultConfig } from "./ConfigLoader.js";
import { MemoryFileSystem } from "../fs/MemoryFileSystem.js";
import { ConfigNotFoundError, ConfigValidationError } from "../errors/index.js";
import type { CadenceConfig } from "./types.js";

describe("ConfigLoader", () => {
  let fs: MemoryFileSystem;
  let loader: ConfigLoader;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    loader = new ConfigLoader(fs);
  });

  describe("loadConfig", () => {
    it("should load a valid configuration file", async () => {
      const config: CadenceConfig = {
        version: 1,
        paths: {
          daily: "Journal/Daily/{{date:YYYY-MM-DD}}.md",
          weekly: "Journal/Weekly/{{date:YYYY-[W]WW}}.md",
          monthly: "Journal/Monthly/{{date:YYYY-MM}}.md",
          quarterly: "Journal/Quarterly/{{date:YYYY-[Q]Q}}.md",
          yearly: "Journal/Yearly/{{date:YYYY}}.md",
          templates: "Templates",
        },
        templates: {
          daily: "Templates/daily.md",
          weekly: "Templates/weekly.md",
        },
        sections: {
          tasks: "## Tasks",
          notes: "## Notes",
        },
        tasks: {
          rolloverEnabled: true,
          scanDaysBack: 7,
          staleAfterDays: 14,
        },
        hooks: {
          preCreate: null,
          postCreate: null,
        },
        linkFormat: "wikilink",
      };

      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", JSON.stringify(config));

      const loaded = await loader.loadConfig("/vault");

      expect(loaded).toEqual(config);
    });

    it("should throw ConfigNotFoundError when .cadence directory doesn't exist", async () => {
      await fs.mkdir("/vault", true);

      await expect(loader.loadConfig("/vault")).rejects.toThrow(
        ConfigNotFoundError
      );
    });

    it("should throw ConfigNotFoundError when config.json doesn't exist", async () => {
      await fs.mkdir("/vault/.cadence", true);

      await expect(loader.loadConfig("/vault")).rejects.toThrow(
        ConfigNotFoundError
      );
    });

    it("should throw ConfigValidationError for invalid JSON", async () => {
      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", "{ invalid json }");

      await expect(loader.loadConfig("/vault")).rejects.toThrow(
        ConfigValidationError
      );
    });

    it("should throw ConfigValidationError for missing required fields", async () => {
      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", JSON.stringify({}));

      await expect(loader.loadConfig("/vault")).rejects.toThrow(
        ConfigValidationError
      );
    });

    it("should throw ConfigValidationError for invalid version type", async () => {
      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile(
        "/vault/.cadence/config.json",
        JSON.stringify({ version: "1" })
      );

      const error = await loader.loadConfig("/vault").catch((e) => e);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.message).toContain("version");
    });

    it("should throw ConfigValidationError for invalid linkFormat value", async () => {
      const config = {
        version: 1,
        paths: {
          daily: "d",
          weekly: "w",
          monthly: "m",
          quarterly: "q",
          yearly: "y",
          templates: "t",
        },
        templates: {},
        sections: {},
        tasks: {
          rolloverEnabled: true,
          scanDaysBack: 7,
          staleAfterDays: 14,
        },
        hooks: { preCreate: null, postCreate: null },
        linkFormat: "invalid",
      };

      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", JSON.stringify(config));

      const error = await loader.loadConfig("/vault").catch((e) => e);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.message).toContain("linkFormat");
    });

    it("should throw ConfigValidationError for missing paths fields", async () => {
      const config = {
        version: 1,
        paths: {
          daily: "d",
          // missing other paths
        },
        templates: {},
        sections: {},
        tasks: {
          rolloverEnabled: true,
          scanDaysBack: 7,
          staleAfterDays: 14,
        },
        hooks: { preCreate: null, postCreate: null },
        linkFormat: "wikilink",
      };

      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", JSON.stringify(config));

      const error = await loader.loadConfig("/vault").catch((e) => e);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.message).toContain("paths");
    });

    it("should throw ConfigValidationError for invalid tasks.scanDaysBack type", async () => {
      const config = {
        version: 1,
        paths: {
          daily: "d",
          weekly: "w",
          monthly: "m",
          quarterly: "q",
          yearly: "y",
          templates: "t",
        },
        templates: {},
        sections: {},
        tasks: {
          rolloverEnabled: true,
          scanDaysBack: "seven",
          staleAfterDays: 14,
        },
        hooks: { preCreate: null, postCreate: null },
        linkFormat: "wikilink",
      };

      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", JSON.stringify(config));

      const error = await loader.loadConfig("/vault").catch((e) => e);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.message).toContain("scanDaysBack");
    });

    it("should include validation errors in ConfigValidationError", async () => {
      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile(
        "/vault/.cadence/config.json",
        JSON.stringify({ version: "wrong" })
      );

      const error = await loader.loadConfig("/vault").catch((e) => e);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.validationErrors).toBeDefined();
      expect(error.validationErrors.length).toBeGreaterThan(0);
    });

    it("should handle Windows-style paths", async () => {
      const config: CadenceConfig = getDefaultConfig();

      await fs.mkdir("C:\\Users\\Test\\vault\\.cadence", true);
      await fs.writeFile(
        "C:\\Users\\Test\\vault\\.cadence\\config.json",
        JSON.stringify(config)
      );

      const loaded = await loader.loadConfig("C:\\Users\\Test\\vault");
      expect(loaded).toEqual(config);
    });
  });

  describe("validateConfig", () => {
    it("should validate hooks.preCreate can be string or null", async () => {
      const config: CadenceConfig = {
        ...getDefaultConfig(),
        hooks: {
          preCreate: "echo 'pre'",
          postCreate: "echo 'post'",
        },
      };

      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", JSON.stringify(config));

      const loaded = await loader.loadConfig("/vault");
      expect(loaded.hooks.preCreate).toBe("echo 'pre'");
      expect(loaded.hooks.postCreate).toBe("echo 'post'");
    });

    it("should reject hooks with invalid types", async () => {
      const config = {
        ...getDefaultConfig(),
        hooks: {
          preCreate: 123,
          postCreate: null,
        },
      };

      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", JSON.stringify(config));

      const error = await loader.loadConfig("/vault").catch((e) => e);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.message).toContain("preCreate");
    });

    it("should validate templates object has string values", async () => {
      const config = {
        ...getDefaultConfig(),
        templates: {
          daily: 123,
        },
      };

      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", JSON.stringify(config));

      const error = await loader.loadConfig("/vault").catch((e) => e);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.message).toContain("templates");
    });

    it("should validate sections object has string values", async () => {
      const config = {
        ...getDefaultConfig(),
        sections: {
          tasks: 123,
        },
      };

      await fs.mkdir("/vault/.cadence", true);
      await fs.writeFile("/vault/.cadence/config.json", JSON.stringify(config));

      const error = await loader.loadConfig("/vault").catch((e) => e);
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error.message).toContain("sections");
    });
  });
});

describe("getDefaultConfig", () => {
  it("should return a valid default configuration", () => {
    const config = getDefaultConfig();

    expect(config.version).toBe(1);
    expect(config.linkFormat).toBe("wikilink");
    expect(config.tasks.rolloverEnabled).toBe(true);
  });

  it("should have all required paths defined", () => {
    const config = getDefaultConfig();

    expect(config.paths.daily).toBeDefined();
    expect(config.paths.weekly).toBeDefined();
    expect(config.paths.monthly).toBeDefined();
    expect(config.paths.quarterly).toBeDefined();
    expect(config.paths.yearly).toBeDefined();
    expect(config.paths.templates).toBeDefined();
  });

  it("should have sensible default task settings", () => {
    const config = getDefaultConfig();

    expect(config.tasks.scanDaysBack).toBeGreaterThan(0);
    expect(config.tasks.staleAfterDays).toBeGreaterThan(0);
  });

  it("should have null hooks by default", () => {
    const config = getDefaultConfig();

    expect(config.hooks.preCreate).toBeNull();
    expect(config.hooks.postCreate).toBeNull();
  });

  it("should return a new object each time (not shared reference)", () => {
    const config1 = getDefaultConfig();
    const config2 = getDefaultConfig();

    expect(config1).not.toBe(config2);
    expect(config1.paths).not.toBe(config2.paths);

    // Mutating one should not affect the other
    config1.version = 999;
    expect(config2.version).toBe(1);
  });
});

describe("generateDefaultConfigFile", () => {
  let fs: MemoryFileSystem;
  let loader: ConfigLoader;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    loader = new ConfigLoader(fs);
  });

  it("should create .cadence directory and config.json", async () => {
    await fs.mkdir("/vault", true);

    await loader.generateDefaultConfigFile("/vault");

    expect(await fs.exists("/vault/.cadence")).toBe(true);
    expect(await fs.exists("/vault/.cadence/config.json")).toBe(true);
  });

  it("should write valid JSON that can be loaded back", async () => {
    await fs.mkdir("/vault", true);

    await loader.generateDefaultConfigFile("/vault");

    const loaded = await loader.loadConfig("/vault");
    expect(loaded.version).toBe(1);
  });

  it("should write formatted JSON (pretty printed)", async () => {
    await fs.mkdir("/vault", true);

    await loader.generateDefaultConfigFile("/vault");

    const content = await fs.readFile("/vault/.cadence/config.json");
    // Pretty printed JSON has newlines
    expect(content).toContain("\n");
  });

  it("should not overwrite existing config by default", async () => {
    await fs.mkdir("/vault/.cadence", true);
    await fs.writeFile(
      "/vault/.cadence/config.json",
      JSON.stringify({ version: 99 })
    );

    await expect(loader.generateDefaultConfigFile("/vault")).rejects.toThrow();
  });

  it("should overwrite existing config when force option is true", async () => {
    await fs.mkdir("/vault/.cadence", true);
    await fs.writeFile(
      "/vault/.cadence/config.json",
      JSON.stringify({ version: 99 })
    );

    await loader.generateDefaultConfigFile("/vault", { force: true });

    const content = await fs.readFile("/vault/.cadence/config.json");
    const config = JSON.parse(content);
    expect(config.version).toBe(1);
  });

  it("should create parent directories if they don't exist", async () => {
    // vault directory doesn't exist yet
    await loader.generateDefaultConfigFile("/new-vault");

    expect(await fs.exists("/new-vault/.cadence/config.json")).toBe(true);
  });
});
