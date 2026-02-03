# Contributing to Cadence

Thank you for your interest in contributing to Cadence! This guide will help you get started with development.

## Development Setup

### Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm 10.28.2+** - Install with `npm install -g pnpm`
- **Git** - [Download](https://git-scm.com/)

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/cadence.git
cd cadence

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Project Structure

Cadence is a monorepo with four packages:

```
cadence/
├── packages/
│   ├── core/          # Core library (notes, tasks, templates, config)
│   ├── cli/           # Command-line interface
│   ├── mcp/           # MCP server for Claude integration
│   └── vscode/        # VS Code extension
├── docs/              # Documentation
├── batch/             # Build scripts
└── package.json       # Root package.json
```

### Package Dependencies

```
@cadence/cli  ──depends on──►  @cadence/core
@cadence/mcp  ──depends on──►  @cadence/core
cadence-vscode ──depends on──►  @cadence/core
```

## Development Workflow

### Running in Development Mode

```bash
# Watch mode for all packages
pnpm dev

# Watch specific package
pnpm --filter @cadence/core dev
pnpm --filter @cadence/cli dev
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @cadence/core build
```

### Testing the CLI Locally

```bash
# Run CLI directly from source
pnpm --filter @cadence/cli start -- daily

# Or after building
node packages/cli/dist/cli.js daily
```

### Testing MCP Server Locally

```bash
# Set vault path and run
CADENCE_VAULT_PATH=/path/to/test/vault node packages/mcp/dist/server.js
```

## Testing

We use [Vitest](https://vitest.dev/) for testing.

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests once (no watch)
pnpm test:run

# Run tests for specific package
pnpm --filter @cadence/core test

# Run specific test file
pnpm --filter @cadence/core test -- src/tasks/parser.test.ts

# Run tests with coverage
pnpm test -- --coverage
```

### Writing Tests

Tests are colocated with source files:

```
src/
├── tasks/
│   ├── parser.ts
│   ├── parser.test.ts    # Tests for parser.ts
│   ├── aggregator.ts
│   └── aggregator.test.ts
```

**Test file template:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyFunction } from './myfile';

describe('MyFunction', () => {
  it('should do something', () => {
    const result = MyFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle edge case', () => {
    expect(() => MyFunction(null)).toThrow();
  });
});
```

### Testing with Mock File System

Core uses a file system abstraction for testability:

```typescript
import { MemoryFileSystem } from '../fs/memory-fs';

describe('NoteService', () => {
  let fs: MemoryFileSystem;

  beforeEach(() => {
    fs = new MemoryFileSystem();
    fs.writeFileSync('/vault/.cadence/config.json', JSON.stringify(defaultConfig));
  });

  it('creates a note', async () => {
    const service = new NoteService(fs, '/vault');
    await service.ensureNote('daily', new Date());
    expect(fs.existsSync('/vault/Journal/Daily/2024-02-15.md')).toBe(true);
  });
});
```

## Code Style

### Linting

We use ESLint with TypeScript support:

```bash
# Check for issues
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

### Formatting

We use Prettier for consistent formatting:

```bash
# Format all files
pnpm format

# Check formatting
pnpm format:check
```

### Type Checking

```bash
# Check all packages
pnpm typecheck

# Check specific package
pnpm --filter @cadence/core typecheck
```

### Code Style Guidelines

- **TypeScript strict mode** - All code uses strict TypeScript
- **ES Modules** - Use `import`/`export`, not `require`
- **Async/await** - Prefer async/await over raw Promises
- **Explicit types** - Add types for function parameters and returns
- **Error handling** - Use custom error classes from `@cadence/core`

## Pull Request Guidelines

### Before Submitting

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** with clear, focused commits

3. **Run all checks**:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test:run
   pnpm build
   ```

4. **Update documentation** if your change affects user-facing features

### PR Title Format

Use conventional commit format:

- `feat: add new template helper`
- `fix: correct task rollover date handling`
- `docs: update CLI reference`
- `refactor: simplify config loading`
- `test: add tests for date parser`
- `chore: update dependencies`

### PR Description

Include:
- **What** - Brief description of the change
- **Why** - Motivation for the change
- **How** - Approach taken (if not obvious)
- **Testing** - How you tested the change

### Review Process

1. All PRs require at least one review
2. CI must pass (tests, lint, typecheck, build)
3. Resolve all review comments
4. Squash merge is preferred

## Adding New Features

### Adding a CLI Command

1. Create command file in `packages/cli/src/commands/`:
   ```typescript
   // packages/cli/src/commands/mycommand.ts
   import { Command } from 'commander';

   export function registerMyCommand(program: Command): void {
     program
       .command('mycommand')
       .description('What this command does')
       .option('--flag <value>', 'Description')
       .action(async (options) => {
         // Implementation
       });
   }
   ```

2. Register in `packages/cli/src/cli.ts`

3. Add documentation to `docs/cli.md`

4. Add tests

### Adding an MCP Tool

1. Add tool definition in `packages/mcp/src/server.ts`:
   ```typescript
   {
     name: 'my_tool',
     description: 'What this tool does',
     inputSchema: {
       type: 'object',
       properties: {
         param: { type: 'string', description: 'Parameter description' }
       },
       required: ['param']
     }
   }
   ```

2. Add handler in the switch statement

3. Update `docs/mcp-setup.md`

4. Add tests

### Adding Core Functionality

1. Add types in `packages/core/src/types.ts` if needed

2. Create module in appropriate directory:
   - `config/` - Configuration related
   - `notes/` - Note operations
   - `tasks/` - Task management
   - `templates/` - Template rendering
   - `dates/` - Date parsing/formatting
   - `search/` - Search functionality

3. Export from `packages/core/src/index.ts`

4. Add comprehensive tests

## Debugging

### VS Code Launch Configurations

The repo includes VS Code launch configurations for debugging:

- **Debug CLI** - Debug CLI commands
- **Debug Tests** - Debug test files
- **Debug MCP** - Debug MCP server

### Logging

Add debug logging with:

```typescript
if (process.env.DEBUG) {
  console.log('[DEBUG]', 'message', data);
}
```

Run with debugging:

```bash
DEBUG=1 cadence daily
```

## Release Process

Releases are managed by maintainers:

1. Update version in all `package.json` files
2. Update CHANGELOG.md
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push --tags`
5. CI publishes to npm

## Getting Help

- **Issues** - Report bugs or request features on GitHub
- **Discussions** - Ask questions in GitHub Discussions
- **Code questions** - Reference the code directly; it's well-typed and documented

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
