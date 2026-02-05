/**
 * Error codes for all Cadence errors.
 * Each error type has a unique code prefixed with "CADENCE_".
 */
export const ErrorCode = {
  UNKNOWN: "CADENCE_UNKNOWN",
  VAULT_NOT_FOUND: "CADENCE_VAULT_NOT_FOUND",
  CONFIG_NOT_FOUND: "CADENCE_CONFIG_NOT_FOUND",
  CONFIG_VALIDATION: "CADENCE_CONFIG_VALIDATION",
  TEMPLATE_NOT_FOUND: "CADENCE_TEMPLATE_NOT_FOUND",
  TEMPLATE_RENDER: "CADENCE_TEMPLATE_RENDER",
  TEMPLATE_EXISTS: "CADENCE_TEMPLATE_EXISTS",
  TEMPLATE_PROTECTED: "CADENCE_TEMPLATE_PROTECTED",
  TEMPLATE_VALIDATION: "CADENCE_TEMPLATE_VALIDATION",
  NOTE_NOT_FOUND: "CADENCE_NOTE_NOT_FOUND",
  FILE_WRITE: "CADENCE_FILE_WRITE",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * JSON representation of a CadenceError for MCP responses.
 */
export interface CadenceErrorJSON {
  name: string;
  code: ErrorCodeType;
  message: string;
  cause?: { name: string; message: string; code?: ErrorCodeType };
  [key: string]: unknown;
}

/**
 * Options for creating a CadenceError.
 */
export interface CadenceErrorOptions {
  cause?: Error;
}

/**
 * Base error class for all Cadence errors.
 * Extends the built-in Error class with a code property and JSON serialization.
 */
export class CadenceError extends Error {
  public readonly code: ErrorCodeType;
  public override readonly cause: Error | undefined;

  constructor(
    code: ErrorCodeType,
    message: string,
    options?: CadenceErrorOptions
  ) {
    super(message);
    this.code = code;
    this.cause = options?.cause;
    this.name = "CadenceError";

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializes the error to JSON for MCP responses.
   */
  toJSON(): CadenceErrorJSON {
    const json: CadenceErrorJSON = {
      name: this.name,
      code: this.code,
      message: this.message,
    };

    if (this.cause) {
      if (this.cause instanceof CadenceError) {
        json.cause = {
          name: this.cause.name,
          code: this.cause.code,
          message: this.cause.message,
        };
      } else {
        json.cause = {
          name: this.cause.name,
          message: this.cause.message,
        };
      }
    }

    return json;
  }
}

/**
 * Error thrown when no vault could be located.
 */
export class VaultNotFoundError extends CadenceError {
  constructor(message?: string, options?: CadenceErrorOptions) {
    super(
      ErrorCode.VAULT_NOT_FOUND,
      message ?? "No vault could be located",
      options
    );
    this.name = "VaultNotFoundError";
  }
}

/**
 * Error thrown when a vault is found but no .cadence/config.json exists.
 */
export class ConfigNotFoundError extends CadenceError {
  public readonly vaultPath: string;

  constructor(vaultPath: string, options?: CadenceErrorOptions) {
    super(
      ErrorCode.CONFIG_NOT_FOUND,
      `No .cadence/config.json found in vault at ${vaultPath}`,
      options
    );
    this.name = "ConfigNotFoundError";
    this.vaultPath = vaultPath;
  }

  override toJSON(): CadenceErrorJSON {
    return {
      ...super.toJSON(),
      vaultPath: this.vaultPath,
    };
  }
}

/**
 * Options for creating a ConfigValidationError.
 */
export interface ConfigValidationErrorOptions extends CadenceErrorOptions {
  validationErrors?: string[];
}

/**
 * Error thrown when a config exists but is invalid.
 */
export class ConfigValidationError extends CadenceError {
  public readonly validationErrors: string[] | undefined;

  constructor(message: string, options?: ConfigValidationErrorOptions) {
    super(ErrorCode.CONFIG_VALIDATION, message, options);
    this.name = "ConfigValidationError";
    this.validationErrors = options?.validationErrors;
  }

  override toJSON(): CadenceErrorJSON {
    const json = super.toJSON();
    if (this.validationErrors) {
      json["validationErrors"] = this.validationErrors;
    }
    return json;
  }
}

/**
 * Error thrown when a referenced template doesn't exist.
 */
export class TemplateNotFoundError extends CadenceError {
  public readonly templateName: string;

  constructor(templateName: string, options?: CadenceErrorOptions) {
    super(
      ErrorCode.TEMPLATE_NOT_FOUND,
      `Template '${templateName}' not found`,
      options
    );
    this.name = "TemplateNotFoundError";
    this.templateName = templateName;
  }

  override toJSON(): CadenceErrorJSON {
    return {
      ...super.toJSON(),
      templateName: this.templateName,
    };
  }
}

/**
 * Options for creating a TemplateRenderError.
 */
export interface TemplateRenderErrorOptions extends CadenceErrorOptions {
  missingVariables?: string[];
}

/**
 * Error thrown when a template fails to render.
 * Can be due to missing variables or other template syntax/compilation errors.
 */
export class TemplateRenderError extends CadenceError {
  public readonly templateName: string;
  public readonly missingVariables: string[];

  constructor(
    templateName: string,
    message: string,
    options?: TemplateRenderErrorOptions
  ) {
    super(
      ErrorCode.TEMPLATE_RENDER,
      `Template '${templateName}' failed to render: ${message}`,
      options
    );
    this.name = "TemplateRenderError";
    this.templateName = templateName;
    this.missingVariables = options?.missingVariables ?? [];
  }

  override toJSON(): CadenceErrorJSON {
    const json = super.toJSON();
    json["templateName"] = this.templateName;
    if (this.missingVariables.length > 0) {
      json["missingVariables"] = this.missingVariables;
    }
    return json;
  }
}

/**
 * Error thrown when a requested note doesn't exist.
 */
export class NoteNotFoundError extends CadenceError {
  public readonly notePath: string;

  constructor(notePath: string, options?: CadenceErrorOptions) {
    super(ErrorCode.NOTE_NOT_FOUND, `Note not found: ${notePath}`, options);
    this.name = "NoteNotFoundError";
    this.notePath = notePath;
  }

  override toJSON(): CadenceErrorJSON {
    return {
      ...super.toJSON(),
      notePath: this.notePath,
    };
  }
}

/**
 * Error thrown when a file write operation fails.
 */
export class FileWriteError extends CadenceError {
  public readonly filePath: string;
  public readonly reason: string;

  constructor(
    filePath: string,
    reason: string,
    options?: CadenceErrorOptions
  ) {
    super(
      ErrorCode.FILE_WRITE,
      `Failed to write file '${filePath}': ${reason}`,
      options
    );
    this.name = "FileWriteError";
    this.filePath = filePath;
    this.reason = reason;
  }

  override toJSON(): CadenceErrorJSON {
    return {
      ...super.toJSON(),
      filePath: this.filePath,
      reason: this.reason,
    };
  }
}

/**
 * Error thrown when attempting to create a template that already exists.
 */
export class TemplateExistsError extends CadenceError {
  public readonly templateName: string;

  constructor(templateName: string, options?: CadenceErrorOptions) {
    super(
      ErrorCode.TEMPLATE_EXISTS,
      `Template '${templateName}' already exists`,
      options
    );
    this.name = "TemplateExistsError";
    this.templateName = templateName;
  }

  override toJSON(): CadenceErrorJSON {
    return {
      ...super.toJSON(),
      templateName: this.templateName,
    };
  }
}

/**
 * Error thrown when attempting to delete a protected template.
 * Protected templates are: daily, weekly, monthly, quarterly, yearly.
 */
export class TemplateProtectedError extends CadenceError {
  public readonly templateName: string;

  constructor(templateName: string, options?: CadenceErrorOptions) {
    super(
      ErrorCode.TEMPLATE_PROTECTED,
      `Template '${templateName}' is protected and cannot be deleted`,
      options
    );
    this.name = "TemplateProtectedError";
    this.templateName = templateName;
  }

  override toJSON(): CadenceErrorJSON {
    return {
      ...super.toJSON(),
      templateName: this.templateName,
    };
  }
}

/**
 * Options for creating a TemplateValidationError.
 */
export interface TemplateValidationErrorOptions extends CadenceErrorOptions {
  validationErrors?: string[];
}

/**
 * Error thrown when template content is invalid (e.g., invalid Handlebars syntax).
 */
export class TemplateValidationError extends CadenceError {
  public readonly templateName: string;
  public readonly validationErrors: string[];

  constructor(
    templateName: string,
    message: string,
    options?: TemplateValidationErrorOptions
  ) {
    super(
      ErrorCode.TEMPLATE_VALIDATION,
      `Template '${templateName}' validation failed: ${message}`,
      options
    );
    this.name = "TemplateValidationError";
    this.templateName = templateName;
    this.validationErrors = options?.validationErrors ?? [];
  }

  override toJSON(): CadenceErrorJSON {
    const json = super.toJSON();
    json["templateName"] = this.templateName;
    if (this.validationErrors.length > 0) {
      json["validationErrors"] = this.validationErrors;
    }
    return json;
  }
}
