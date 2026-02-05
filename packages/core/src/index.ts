export const VERSION = "0.0.2";

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Error types and utilities
export {
  ErrorCode,
  type ErrorCodeType,
  type CadenceErrorJSON,
  type CadenceErrorOptions,
  CadenceError,
  VaultNotFoundError,
  ConfigNotFoundError,
  type ConfigValidationErrorOptions,
  ConfigValidationError,
  TemplateNotFoundError,
  type TemplateRenderErrorOptions,
  TemplateRenderError,
  TemplateExistsError,
  TemplateProtectedError,
  type TemplateValidationErrorOptions,
  TemplateValidationError,
  NoteNotFoundError,
  FileWriteError,
} from "./errors/index.js";

// File system abstraction
export {
  type IFileSystem,
  type FileStat,
  NodeFileSystem,
  MemoryFileSystem,
} from "./fs/index.js";

// Vault resolution
export {
  VaultResolver,
  resolveVault,
  type ResolveVaultOptions,
} from "./vault/index.js";

// Configuration
export {
  type CadenceConfig,
  type PathsConfig,
  type TemplatesConfig,
  type SectionsConfig,
  type TasksConfig,
  type HooksConfig,
  type LinkFormat,
  type PartialCadenceConfig,
  type DeepPartial,
  ConfigLoader,
  getDefaultConfig,
  type GenerateConfigOptions,
} from "./config/index.js";

// Date parsing and path generation
export { DateParser, PathGenerator, PathMatcher } from "./dates/index.js";
export type { DateComponents } from "./dates/index.js";

// Frontmatter handling
export {
  FrontmatterParser,
  type ParseResult,
  FrontmatterMerger,
  FrontmatterSerializer,
} from "./frontmatter/index.js";

// Template rendering
export {
  TemplateEngine,
  TemplateLoader,
  TemplateRegistry,
  TemplateManager,
  createFromTemplate,
  validateAndApplyDefaults,
  stripTemplateMetadata,
  type CreateFromTemplateOptions,
  type TemplateInfo,
  type TemplateMetadata,
  type TemplateVariableInfo,
  type TemplateMetadataInput,
  type CreateTemplateOptions,
  type CreateTemplateResult,
  type UpdateTemplateOptions,
  type UpdateTemplateResult,
  type DeleteTemplateOptions,
  type DeleteTemplateResult,
} from "./templates/index.js";

// Note management
export {
  NoteService,
  PeriodCalculator,
  type Note,
  type NotePath,
  type NoteType,
  type PeriodInfo,
  type NoteLinks,
} from "./notes/index.js";

// Hook execution
export {
  HookRunner,
  type HookContext,
  type HookResult,
  type HookName,
  type HookRunnerOptions,
} from "./hooks/index.js";

// Task management
export {
  TaskParser,
  TaskAggregator,
  TaskRollover,
  TaskModifier,
  type AggregateOptions,
  type NewTask,
  type MetadataUpdates,
  type Task,
  type TaskMetadata,
  type TaskWithSource,
  type TaskPriority,
  type TasksByPriority,
  type AggregatedTasks,
  type RolloverOptions,
  type RolloverResult,
} from "./tasks/index.js";

// Context aggregation
export {
  ContextBuilder,
  type Context,
  type ContextOptions,
} from "./context/index.js";

// Vault search
export {
  VaultSearch,
  type SearchOptions,
  type SearchResult,
  type ContentMatch,
} from "./search/index.js";
