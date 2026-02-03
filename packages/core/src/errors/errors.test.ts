import { describe, it, expect } from "vitest";
import {
  CadenceError,
  VaultNotFoundError,
  ConfigNotFoundError,
  ConfigValidationError,
  TemplateNotFoundError,
  TemplateRenderError,
  NoteNotFoundError,
  FileWriteError,
  ErrorCode,
} from "./index.js";

describe("CadenceError", () => {
  describe("base class", () => {
    it("should extend Error", () => {
      const error = new CadenceError(ErrorCode.UNKNOWN, "Test error");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CadenceError);
    });

    it("should have code, message, and name properties", () => {
      const error = new CadenceError(ErrorCode.UNKNOWN, "Test error message");
      expect(error.code).toBe(ErrorCode.UNKNOWN);
      expect(error.message).toBe("Test error message");
      expect(error.name).toBe("CadenceError");
    });

    it("should support optional cause property", () => {
      const cause = new Error("Original error");
      const error = new CadenceError(ErrorCode.UNKNOWN, "Wrapped error", {
        cause,
      });
      expect(error.cause).toBe(cause);
    });

    it("should have a proper stack trace", () => {
      const error = new CadenceError(ErrorCode.UNKNOWN, "Test error");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("CadenceError");
    });

    it("should serialize to JSON for MCP responses", () => {
      const error = new CadenceError(ErrorCode.UNKNOWN, "Test error");
      const json = error.toJSON();
      expect(json).toEqual({
        name: "CadenceError",
        code: ErrorCode.UNKNOWN,
        message: "Test error",
      });
    });

    it("should include cause in JSON when present", () => {
      const cause = new Error("Original error");
      const error = new CadenceError(ErrorCode.UNKNOWN, "Wrapped error", {
        cause,
      });
      const json = error.toJSON();
      expect(json).toEqual({
        name: "CadenceError",
        code: ErrorCode.UNKNOWN,
        message: "Wrapped error",
        cause: {
          name: "Error",
          message: "Original error",
        },
      });
    });

    it("should handle nested CadenceError causes in JSON", () => {
      const innerCause = new CadenceError(
        ErrorCode.VAULT_NOT_FOUND,
        "Inner error"
      );
      const error = new CadenceError(ErrorCode.UNKNOWN, "Outer error", {
        cause: innerCause,
      });
      const json = error.toJSON();
      expect(json.cause).toEqual({
        name: "CadenceError",
        code: ErrorCode.VAULT_NOT_FOUND,
        message: "Inner error",
      });
    });
  });
});

describe("VaultNotFoundError", () => {
  it("should extend CadenceError", () => {
    const error = new VaultNotFoundError();
    expect(error).toBeInstanceOf(CadenceError);
    expect(error).toBeInstanceOf(VaultNotFoundError);
  });

  it("should have correct error code", () => {
    const error = new VaultNotFoundError();
    expect(error.code).toBe(ErrorCode.VAULT_NOT_FOUND);
  });

  it("should have correct name", () => {
    const error = new VaultNotFoundError();
    expect(error.name).toBe("VaultNotFoundError");
  });

  it("should have default message", () => {
    const error = new VaultNotFoundError();
    expect(error.message).toBe("No vault could be located");
  });

  it("should allow custom message", () => {
    const error = new VaultNotFoundError("Custom vault error");
    expect(error.message).toBe("Custom vault error");
  });

  it("should support cause", () => {
    const cause = new Error("underlying error");
    const error = new VaultNotFoundError("Custom message", { cause });
    expect(error.cause).toBe(cause);
  });

  it("should serialize to JSON correctly", () => {
    const error = new VaultNotFoundError();
    const json = error.toJSON();
    expect(json.code).toBe(ErrorCode.VAULT_NOT_FOUND);
    expect(json.name).toBe("VaultNotFoundError");
  });
});

describe("ConfigNotFoundError", () => {
  it("should extend CadenceError", () => {
    const error = new ConfigNotFoundError("/path/to/vault");
    expect(error).toBeInstanceOf(CadenceError);
    expect(error).toBeInstanceOf(ConfigNotFoundError);
  });

  it("should have correct error code", () => {
    const error = new ConfigNotFoundError("/path/to/vault");
    expect(error.code).toBe(ErrorCode.CONFIG_NOT_FOUND);
  });

  it("should have correct name", () => {
    const error = new ConfigNotFoundError("/path/to/vault");
    expect(error.name).toBe("ConfigNotFoundError");
  });

  it("should include vault path in message", () => {
    const error = new ConfigNotFoundError("/path/to/vault");
    expect(error.message).toContain("/path/to/vault");
    expect(error.message).toContain(".cadence/config.json");
  });

  it("should store vault path as property", () => {
    const error = new ConfigNotFoundError("/path/to/vault");
    expect(error.vaultPath).toBe("/path/to/vault");
  });

  it("should include vaultPath in JSON", () => {
    const error = new ConfigNotFoundError("/path/to/vault");
    const json = error.toJSON();
    expect(json["vaultPath"]).toBe("/path/to/vault");
  });
});

describe("ConfigValidationError", () => {
  it("should extend CadenceError", () => {
    const error = new ConfigValidationError("Invalid field: foo");
    expect(error).toBeInstanceOf(CadenceError);
    expect(error).toBeInstanceOf(ConfigValidationError);
  });

  it("should have correct error code", () => {
    const error = new ConfigValidationError("Invalid field");
    expect(error.code).toBe(ErrorCode.CONFIG_VALIDATION);
  });

  it("should have correct name", () => {
    const error = new ConfigValidationError("Invalid field");
    expect(error.name).toBe("ConfigValidationError");
  });

  it("should store validation errors", () => {
    const validationErrors = ["Field 'name' is required", "Field 'type' is invalid"];
    const error = new ConfigValidationError("Config is invalid", {
      validationErrors,
    });
    expect(error.validationErrors).toEqual(validationErrors);
  });

  it("should include validationErrors in JSON", () => {
    const validationErrors = ["error1", "error2"];
    const error = new ConfigValidationError("Config is invalid", {
      validationErrors,
    });
    const json = error.toJSON();
    expect(json["validationErrors"]).toEqual(validationErrors);
  });
});

describe("TemplateNotFoundError", () => {
  it("should extend CadenceError", () => {
    const error = new TemplateNotFoundError("daily-note");
    expect(error).toBeInstanceOf(CadenceError);
    expect(error).toBeInstanceOf(TemplateNotFoundError);
  });

  it("should have correct error code", () => {
    const error = new TemplateNotFoundError("daily-note");
    expect(error.code).toBe(ErrorCode.TEMPLATE_NOT_FOUND);
  });

  it("should have correct name", () => {
    const error = new TemplateNotFoundError("daily-note");
    expect(error.name).toBe("TemplateNotFoundError");
  });

  it("should include template name in message", () => {
    const error = new TemplateNotFoundError("daily-note");
    expect(error.message).toContain("daily-note");
  });

  it("should store template name as property", () => {
    const error = new TemplateNotFoundError("weekly-review");
    expect(error.templateName).toBe("weekly-review");
  });

  it("should include templateName in JSON", () => {
    const error = new TemplateNotFoundError("my-template");
    const json = error.toJSON();
    expect(json["templateName"]).toBe("my-template");
  });
});

describe("TemplateRenderError", () => {
  it("should extend CadenceError", () => {
    const error = new TemplateRenderError("daily-note", "missing variables [date, title]", {
      missingVariables: ["date", "title"],
    });
    expect(error).toBeInstanceOf(CadenceError);
    expect(error).toBeInstanceOf(TemplateRenderError);
  });

  it("should have correct error code", () => {
    const error = new TemplateRenderError("daily-note", "missing variable [date]", {
      missingVariables: ["date"],
    });
    expect(error.code).toBe(ErrorCode.TEMPLATE_RENDER);
  });

  it("should have correct name", () => {
    const error = new TemplateRenderError("daily-note", "missing variable [date]", {
      missingVariables: ["date"],
    });
    expect(error.name).toBe("TemplateRenderError");
  });

  it("should include template name and missing variables in message", () => {
    const error = new TemplateRenderError("daily-note", "missing variables [date, title]", {
      missingVariables: ["date", "title"],
    });
    expect(error.message).toContain("daily-note");
    expect(error.message).toContain("date");
    expect(error.message).toContain("title");
  });

  it("should store template name and missing variables as properties", () => {
    const error = new TemplateRenderError("weekly-review", "missing variables [week, year]", {
      missingVariables: ["week", "year"],
    });
    expect(error.templateName).toBe("weekly-review");
    expect(error.missingVariables).toEqual(["week", "year"]);
  });

  it("should include templateName and missingVariables in JSON", () => {
    const error = new TemplateRenderError("my-template", "missing variables [var1, var2]", {
      missingVariables: ["var1", "var2"],
    });
    const json = error.toJSON();
    expect(json["templateName"]).toBe("my-template");
    expect(json["missingVariables"]).toEqual(["var1", "var2"]);
  });

  it("should work without missingVariables option", () => {
    const error = new TemplateRenderError("my-template", "syntax error at line 5");
    expect(error.templateName).toBe("my-template");
    expect(error.missingVariables).toEqual([]);
    const json = error.toJSON();
    expect(json["missingVariables"]).toBeUndefined();
  });
});

describe("NoteNotFoundError", () => {
  it("should extend CadenceError", () => {
    const error = new NoteNotFoundError("notes/daily/2024-01-01.md");
    expect(error).toBeInstanceOf(CadenceError);
    expect(error).toBeInstanceOf(NoteNotFoundError);
  });

  it("should have correct error code", () => {
    const error = new NoteNotFoundError("path/to/note.md");
    expect(error.code).toBe(ErrorCode.NOTE_NOT_FOUND);
  });

  it("should have correct name", () => {
    const error = new NoteNotFoundError("path/to/note.md");
    expect(error.name).toBe("NoteNotFoundError");
  });

  it("should include note path in message", () => {
    const error = new NoteNotFoundError("notes/daily/2024-01-01.md");
    expect(error.message).toContain("notes/daily/2024-01-01.md");
  });

  it("should store note path as property", () => {
    const error = new NoteNotFoundError("path/to/note.md");
    expect(error.notePath).toBe("path/to/note.md");
  });

  it("should include notePath in JSON", () => {
    const error = new NoteNotFoundError("my/note.md");
    const json = error.toJSON();
    expect(json["notePath"]).toBe("my/note.md");
  });
});

describe("FileWriteError", () => {
  it("should extend CadenceError", () => {
    const error = new FileWriteError("/path/to/file.md", "Permission denied");
    expect(error).toBeInstanceOf(CadenceError);
    expect(error).toBeInstanceOf(FileWriteError);
  });

  it("should have correct error code", () => {
    const error = new FileWriteError("/path/to/file.md", "Disk full");
    expect(error.code).toBe(ErrorCode.FILE_WRITE);
  });

  it("should have correct name", () => {
    const error = new FileWriteError("/path/to/file.md", "reason");
    expect(error.name).toBe("FileWriteError");
  });

  it("should include file path and reason in message", () => {
    const error = new FileWriteError("/path/to/file.md", "Permission denied");
    expect(error.message).toContain("/path/to/file.md");
    expect(error.message).toContain("Permission denied");
  });

  it("should store file path and reason as properties", () => {
    const error = new FileWriteError("/my/file.md", "Disk full");
    expect(error.filePath).toBe("/my/file.md");
    expect(error.reason).toBe("Disk full");
  });

  it("should include filePath and reason in JSON", () => {
    const error = new FileWriteError("/my/file.md", "Disk full");
    const json = error.toJSON();
    expect(json["filePath"]).toBe("/my/file.md");
    expect(json["reason"]).toBe("Disk full");
  });

  it("should support cause for underlying errors", () => {
    const cause = new Error("EACCES: permission denied");
    const error = new FileWriteError("/path/to/file.md", "Permission denied", {
      cause,
    });
    expect(error.cause).toBe(cause);
  });
});

describe("ErrorCode", () => {
  it("should have unique codes for all error types", () => {
    const codes = Object.values(ErrorCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("should have expected error codes", () => {
    expect(ErrorCode.UNKNOWN).toBe("CADENCE_UNKNOWN");
    expect(ErrorCode.VAULT_NOT_FOUND).toBe("CADENCE_VAULT_NOT_FOUND");
    expect(ErrorCode.CONFIG_NOT_FOUND).toBe("CADENCE_CONFIG_NOT_FOUND");
    expect(ErrorCode.CONFIG_VALIDATION).toBe("CADENCE_CONFIG_VALIDATION");
    expect(ErrorCode.TEMPLATE_NOT_FOUND).toBe("CADENCE_TEMPLATE_NOT_FOUND");
    expect(ErrorCode.TEMPLATE_RENDER).toBe("CADENCE_TEMPLATE_RENDER");
    expect(ErrorCode.NOTE_NOT_FOUND).toBe("CADENCE_NOTE_NOT_FOUND");
    expect(ErrorCode.FILE_WRITE).toBe("CADENCE_FILE_WRITE");
  });
});

describe("Error type guards", () => {
  it("should be able to check error types with instanceof", () => {
    const errors = [
      new VaultNotFoundError(),
      new ConfigNotFoundError("/vault"),
      new ConfigValidationError("invalid"),
      new TemplateNotFoundError("template"),
      new TemplateRenderError("template", ["var"]),
      new NoteNotFoundError("note.md"),
      new FileWriteError("/file", "reason"),
    ];

    errors.forEach((error) => {
      expect(error instanceof CadenceError).toBe(true);
    });
  });
});
