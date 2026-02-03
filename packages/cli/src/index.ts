// Re-export core functionality
export { VERSION } from "@cadence/core";

// Export commands for programmatic use
export {
  initCommand,
  dailyCommand,
  openCommand,
  templatesCommand,
  newCommand,
} from "./commands/index.js";

// Export utilities
export { handleError, getVaultContext, type VaultContext } from "./utils/index.js";
