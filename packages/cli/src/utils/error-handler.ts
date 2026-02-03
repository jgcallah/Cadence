import chalk from "chalk";
import { CadenceError, ErrorCode } from "@cadence/core";

/**
 * Format and print an error to stderr
 */
export function handleError(error: unknown): void {
  if (error instanceof CadenceError) {
    formatCadenceError(error);
  } else if (error instanceof Error) {
    formatGenericError(error);
  } else {
    console.error(chalk.red("Error:"), String(error));
  }
}

function formatCadenceError(error: CadenceError): void {
  const prefix = getErrorPrefix(error.code);
  console.error(chalk.red(`${prefix}:`), error.message);

  // Show additional context for specific error types
  if (error.code === ErrorCode.VAULT_NOT_FOUND) {
    console.error();
    console.error(chalk.yellow("Tip:"), "Initialize a vault with 'cadence init' or specify --vault");
  }

  if (error.code === ErrorCode.CONFIG_NOT_FOUND) {
    console.error();
    console.error(chalk.yellow("Tip:"), "Initialize the vault with 'cadence init'");
  }

  if (error.cause) {
    console.error(chalk.gray(`  Caused by: ${error.cause.message}`));
  }
}

function formatGenericError(error: Error): void {
  console.error(chalk.red("Error:"), error.message);
  if (error.cause && error.cause instanceof Error) {
    console.error(chalk.gray(`  Caused by: ${error.cause.message}`));
  }
}

function getErrorPrefix(code: string): string {
  switch (code) {
    case ErrorCode.VAULT_NOT_FOUND:
      return "Vault not found";
    case ErrorCode.CONFIG_NOT_FOUND:
      return "Config not found";
    case ErrorCode.CONFIG_VALIDATION:
      return "Invalid config";
    case ErrorCode.TEMPLATE_NOT_FOUND:
      return "Template not found";
    case ErrorCode.TEMPLATE_RENDER:
      return "Template error";
    case ErrorCode.NOTE_NOT_FOUND:
      return "Note not found";
    case ErrorCode.FILE_WRITE:
      return "Write error";
    default:
      return "Error";
  }
}
