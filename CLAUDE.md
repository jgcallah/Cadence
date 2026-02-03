# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cadence is a headless Markdown vault manager for periodic notes, tasks, and templates. It provides a shared core library (`@cadence/core`) with three interfaces: CLI, MCP server (for AI agents like Claude Desktop), and VS Code extension.

## Common Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build a specific package
pnpm --filter @cadence/core build
pnpm --filter @cadence/cli build
pnpm --filter @cadence/mcp build
pnpm --filter @cadence/vscode build

# Run all tests (uses vitest with watch mode)
pnpm test

# Run tests once without watch
pnpm test:run

# Run tests for a specific file pattern
pnpm test daily        # runs tests matching "daily"
pnpm test TaskParser   # runs tests matching "TaskParser"

# Run tests for a specific package
pnpm --filter @cadence/cli test

# Lint and format
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check

# Type checking
pnpm typecheck

# Package VS Code extension
cd packages/vscode && pnpm vscode:package
```

## Architecture

### Monorepo Structure

```
packages/
├── core/     # @cadence/core - All business logic
├── cli/      # @cadence/cli - Commander.js CLI
├── mcp/      # @cadence/mcp - Model Context Protocol server
└── vscode/   # VS Code extension
```

### Core Package Modules (`packages/core/src/`)

- **config/** - `ConfigLoader`, `CadenceConfig` types. Reads `.cadence/config.json`
- **notes/** - `NoteService`, `NoteType` (daily/weekly/monthly/quarterly/yearly), `PeriodCalculator`
- **tasks/** - `TaskParser`, `TaskAggregator`, `TaskRollover`, `TaskModifier`
- **templates/** - `TemplateEngine` (Handlebars), `TemplateLoader`, `TemplateRegistry`
- **dates/** - `DateParser` (natural language via chrono-node), `PathGenerator`
- **frontmatter/** - `FrontmatterParser`, `FrontmatterMerger`, `FrontmatterSerializer`
- **context/** - `ContextBuilder` for aggregating notes for AI consumption
- **search/** - `VaultSearch` for fuzzy file/content search
- **fs/** - `IFileSystem` interface with `NodeFileSystem` and `MemoryFileSystem` implementations
- **errors/** - Custom error types (`CadenceError`, `VaultNotFoundError`, etc.)

### Key Design Patterns

1. **Filesystem Abstraction**: All file operations use `IFileSystem` interface. Use `MemoryFileSystem` in tests, `NodeFileSystem` in production.

2. **Configuration-Driven**: All behavior configured via `.cadence/config.json`. Use `getDefaultConfig()` for defaults.

3. **Note Hierarchy**: Daily → Weekly → Monthly → Quarterly → Yearly. Each note type has `parentNote` and `childNotes` links.

4. **Template Variables**: Handlebars templates with built-in variables: `{{date}}`, `{{time}}`, `{{weekNum}}`, `{{yesterday}}`, `{{tomorrow}}`, `{{year}}`, `{{month}}`, `{{quarter}}`, `{{periodLabel}}`, `{{parentNote}}`

### Interface Integration

- **CLI** (`packages/cli/src/cli.ts`): Commands like `cadence daily`, `cadence tasks`, `cadence new`
- **MCP** (`packages/mcp/src/server.ts`): Tools for Claude Desktop via `@modelcontextprotocol/sdk`
- **VS Code** (`packages/vscode/src/extension.ts`): Commands, TreeViews for tasks/context/search

### Testing

Tests are colocated with source files (`*.test.ts`). Vitest config defines `unit` and `integration` test projects. Most tests use `MemoryFileSystem` for isolation.
