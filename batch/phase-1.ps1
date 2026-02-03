# Phase 1: Foundation + Daily Notes
# Goal: Complete daily notes workflow across ALL interfaces

$Phase1Tasks = @(
    @{
        Name = "Phase 1.1 - Project Scaffolding"
        Prompt = @"
Initialize the Cadence monorepo project with pnpm workspaces.

Requirements:
1. Initialize pnpm monorepo workspace with packages/ directory
2. Create package structure: packages/core, packages/cli, packages/mcp, packages/vscode
3. Set up TypeScript with strict mode and path aliases in tsconfig.base.json
4. Configure Vitest for unit + integration testing with vitest.workspace.ts
5. Set up ESLint + Prettier with appropriate configs
6. Each package should have its own package.json with proper naming (@cadence/core, @cadence/cli, @cadence/mcp, cadence-vscode)
7. Set up tsup as the bundler for each package

Create all necessary config files and ensure 'pnpm install' works.
When complete, output: <promise>PHASE_1_1_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.2 - Error Handling Architecture"
        Prompt = @"
Implement the error handling architecture in packages/core/src/errors/.

Requirements:
1. Create CadenceError base class extending Error with code, message, and optional cause properties
2. Implement typed error hierarchy:
   - VaultNotFoundError - No vault could be located
   - ConfigNotFoundError - Vault found but no .cadence/config.json
   - ConfigValidationError - Config exists but is invalid
   - TemplateNotFoundError - Referenced template doesn't exist
   - TemplateRenderError - Template failed to render (missing variables)
   - NoteNotFoundError - Requested note doesn't exist
   - FileWriteError - Failed to write file (permissions, disk full)
3. Each error should have a unique error code string
4. Errors should serialize properly for MCP JSON responses
5. Write comprehensive tests in packages/core/tests/errors/

Follow TDD - write tests first, then implementation.
When complete, output: <promise>PHASE_1_2_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.3 - File System Abstraction"
        Prompt = @"
Implement the file system abstraction layer in packages/core/src/fs/.

Requirements:
1. Define IFileSystem interface with methods:
   - readFile(path: string): Promise<string>
   - writeFile(path: string, content: string): Promise<void>
   - exists(path: string): Promise<boolean>
   - mkdir(path: string, recursive?: boolean): Promise<void>
   - readdir(path: string): Promise<string[]>
   - stat(path: string): Promise<FileStat>
   - unlink(path: string): Promise<void>
   - rename(oldPath: string, newPath: string): Promise<void>

2. Implement NodeFileSystem (production):
   - Uses fs-extra under the hood
   - Atomic writes: Write to .tmp file, then rename() to prevent corruption

3. Implement MemoryFileSystem (testing):
   - In-memory Map-based implementation
   - Can simulate errors for edge case testing

4. Write tests in packages/core/tests/fs/ that run against BOTH implementations with identical test suite

Follow TDD - write tests first, then implementation.
When complete, output: <promise>PHASE_1_3_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.4 - Vault Discovery Module"
        Prompt = @"
Implement vault discovery in packages/core/src/vault/.

Requirements:
1. Implement resolveVault(options?: { cwd?: string, explicit?: string }): Promise<string>
2. Resolution priority order:
   - Explicit path (if provided in options)
   - CADENCE_VAULT_PATH environment variable
   - Ancestor walk: Recursively search up from CWD for .cadence/ folder
3. Throw VaultNotFoundError with helpful message listing what was tried
4. Export a VaultResolver class that can be instantiated with IFileSystem for testability
5. Write comprehensive tests covering all resolution strategies, precedence, and error cases

Use the IFileSystem abstraction for all file operations.
Follow TDD - write tests first, then implementation.
When complete, output: <promise>PHASE_1_4_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.5 - Config Module"
        Prompt = @"
Implement configuration management in packages/core/src/config/.

Requirements:
1. Define TypeScript interfaces for the config schema matching this structure:
   {
     version: number,
     paths: { daily, weekly, monthly, quarterly, yearly, templates },
     templates: { [name]: path },
     sections: { [name]: header },
     tasks: { rolloverEnabled, scanDaysBack, staleAfterDays },
     hooks: { preCreate, postCreate },
     linkFormat: 'wikilink' | 'markdown'
   }

2. Implement ConfigLoader class:
   - loadConfig(vaultPath: string): Promise<CadenceConfig>
   - Find and parse .cadence/config.json
   - Validate with helpful error messages (throw ConfigValidationError)

3. Implement default config generator for 'cadence init'
4. Use IFileSystem abstraction
5. Write tests for loading, validation, defaults, and error cases

Follow TDD - write tests first, then implementation.
When complete, output: <promise>PHASE_1_5_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.6 - Date Module"
        Prompt = @"
Implement date parsing and path generation in packages/core/src/dates/.

Requirements:
1. Install and integrate chrono-node for natural language parsing:
   - 'today', 'yesterday', 'tomorrow'
   - 'last friday', 'next tuesday'
   - '3 days ago', 'in 2 weeks'

2. Use date-fns for date formatting and manipulation

3. Implement DateParser class:
   - parse(input: string | Date): Date
   - Handle natural language via chrono-node
   - Handle ISO date strings

4. Implement PathGenerator class:
   - generatePath(template: string, date: Date): string
   - Support variables: {year}, {month}, {date}, {week}, {quarter}, {day}
   - Handle edge cases: year boundaries, ISO week numbers

5. Write extensive tests for:
   - Natural language parsing
   - Path variable resolution
   - Edge cases (year boundaries, week numbers, DST transitions)

Follow TDD - write tests first, then implementation.
When complete, output: <promise>PHASE_1_6_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.7 - Frontmatter Module"
        Prompt = @"
Implement frontmatter handling in packages/core/src/frontmatter/.

Requirements:
1. Use the 'yaml' package for YAML parsing/serialization

2. Implement FrontmatterParser class:
   - parse(content: string): { frontmatter: Record<string, unknown>, body: string }
   - Extract YAML between --- delimiters
   - Handle notes without frontmatter

3. Implement FrontmatterMerger:
   - merge(existing: Record<string, unknown>, updates: Record<string, unknown>): Record<string, unknown>
   - Deep merge support
   - Preserve existing fields not in updates

4. Implement FrontmatterSerializer:
   - serialize(frontmatter: Record<string, unknown>, body: string): string
   - Proper YAML formatting with --- delimiters

5. Write tests for:
   - Parsing various frontmatter formats
   - Merging strategies
   - Round-trip integrity (parse -> modify -> serialize -> parse)
   - Edge cases (empty frontmatter, no frontmatter, special characters)

Follow TDD - write tests first, then implementation.
When complete, output: <promise>PHASE_1_7_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.8 - Template Module"
        Prompt = @"
Implement template rendering in packages/core/src/templates/.

Requirements:
1. Configure Handlebars in STRICT MODE (throw on missing variables, don't silently produce empty strings)

2. Implement TemplateEngine class:
   - render(template: string, variables: Record<string, unknown>): string
   - Wrap rendering in try/catch, throw TemplateRenderError with helpful message on failure

3. Implement built-in template variables:
   - {{date}}, {{time}}, {{weekNum}}
   - {{yesterday}}, {{tomorrow}} (as wikilinks like [[2024-01-14]])
   - {{year}}, {{month}}, {{quarter}}

4. Implement TemplateLoader:
   - load(templatePath: string): Promise<string>
   - Uses IFileSystem abstraction
   - Throws TemplateNotFoundError if not found

5. Implement custom Handlebars helpers:
   - {{wikilink name}} - generates [[name]]
   - {{formatDate date format}} - date formatting

6. Write tests for:
   - Variable substitution
   - Missing variable errors (should throw, not produce empty)
   - Custom helpers
   - Template file loading

Follow TDD - write tests first, then implementation.
When complete, output: <promise>PHASE_1_8_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.9 - Notes Module (Daily)"
        Prompt = @"
Implement daily note operations in packages/core/src/notes/.

Requirements:
1. Implement NoteService class with IFileSystem dependency injection:
   - ensureNote(type: 'daily', date: Date): Promise<NotePath> - creates if not exists
   - getNote(type: 'daily', date: Date): Promise<Note> - read with parsed frontmatter
   - noteExists(type: 'daily', date: Date): Promise<boolean>

2. Note interface:
   interface Note {
     path: string;
     content: string;
     frontmatter: Record<string, unknown>;
     body: string;
   }

3. Features:
   - Auto-create parent folders using IFileSystem.mkdir
   - Merge frontmatter on existing notes (don't overwrite)
   - Use template system for new note creation
   - Use config for path patterns

4. Integrate with:
   - ConfigLoader for paths
   - DateParser for date resolution
   - PathGenerator for file paths
   - TemplateEngine for rendering
   - FrontmatterParser for reading/writing

5. Write tests using MemoryFileSystem:
   - Create new note
   - Read existing note
   - Idempotency (ensure twice = same result)
   - Folder auto-creation

Follow TDD - write tests first, then implementation.
When complete, output: <promise>PHASE_1_9_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.10 - Hooks Module"
        Prompt = @"
Implement hook execution in packages/core/src/hooks/.

Requirements:
1. Implement HookRunner class:
   - run(hookName: string, context: HookContext): Promise<HookResult>
   - Execute shell commands defined in config
   - Pass context via environment variables

2. HookContext interface:
   interface HookContext {
     notePath: string;
     noteType: string;
     date: string;
     vaultPath: string;
   }

3. HookResult interface:
   interface HookResult {
     success: boolean;
     stdout?: string;
     stderr?: string;
     exitCode: number;
   }

4. Features:
   - Handle hook failures gracefully (log, continue, don't crash)
   - Support both preCreate and postCreate hooks
   - Cross-platform command execution (use child_process.exec)
   - Timeout support (default 30 seconds)

5. Write tests for:
   - Successful hook execution
   - Hook failure handling
   - Environment variable passing
   - Timeout behavior

Follow TDD - write tests first, then implementation.
When complete, output: <promise>PHASE_1_10_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.11 - CLI Daily Notes"
        Prompt = @"
Implement the CLI package with daily note commands in packages/cli/.

Requirements:
1. Set up Commander.js entry point in src/index.ts
2. Global --vault flag for explicit vault path
3. Error handling: Catch CadenceError types, format for terminal, exit code 1

4. Commands:
   - cadence init: Initialize vault with .cadence/ folder and default config
   - cadence daily: Create/open today's note (print path to stdout)
   - cadence daily --date 'yesterday': Create note for specific date (uses chrono-node)
   - cadence open daily: Open in default editor (use 'open' on mac, 'start' on windows, 'xdg-open' on linux)

5. Output formatting:
   - Success: Print note path
   - Errors: Colored error messages with helpful context
   - Use chalk or similar for colors

6. Write tests for:
   - CLI argument parsing
   - Error output formatting
   - Integration with core (using mocked IFileSystem)

The CLI should be a thin wrapper - all logic lives in @cadence/core.
When complete, output: <promise>PHASE_1_11_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.12 - MCP Daily Notes Tools"
        Prompt = @"
Implement the MCP server package with daily note tools in packages/mcp/.

Requirements:
1. Set up @modelcontextprotocol/sdk server in src/server.ts
2. Read CADENCE_VAULT_PATH from environment for vault resolution
3. Error handling: Catch CadenceError types, return structured JSON errors

4. Tools:
   - ensure_daily_note:
     Input: { date?: string } (optional, defaults to today, supports natural language)
     Output: { path: string, content: string, created: boolean }

   - get_daily_note:
     Input: { date: string }
     Output: { path: string, content: string, frontmatter: object } or error

   - list_daily_notes:
     Input: { limit?: number, startDate?: string, endDate?: string }
     Output: { notes: Array<{ path: string, date: string }> }

5. Each tool should have:
   - Proper JSON schema for inputs
   - Descriptive tool descriptions for Claude
   - Structured error responses

6. Write tests for:
   - Tool input validation
   - Tool output format
   - Error response structure

The MCP server should be a thin wrapper - all logic lives in @cadence/core.
When complete, output: <promise>PHASE_1_12_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 1.13 - VS Code Extension Daily Notes"
        Prompt = @"
Implement the VS Code extension with daily note features in packages/vscode/.

Requirements:
1. Initialize VS Code extension scaffold with proper package.json (publisher, activationEvents, contributes)
2. Vault resolution: Use workspace folder as vault root
3. Error handling: Catch CadenceError types, show VS Code toast notifications (vscode.window.showErrorMessage)

4. Commands (register in package.json contributes.commands):
   - cadence.openTodaysNote: 'Cadence: Open Today's Note'
   - cadence.createDailyNote: 'Cadence: Create Daily Note for Date' (show date picker)

5. Status bar item:
   - Show icon + 'Daily Note' text
   - Click opens today's note
   - Tooltip shows note status (exists/not exists)

6. Extension entry point (src/extension.ts):
   - activate(): Register commands, create status bar
   - deactivate(): Cleanup

7. Write tests for:
   - Command registration
   - Basic command execution (with mocked vscode APIs)

The extension should be a thin wrapper - all logic lives in @cadence/core.
When complete, output: <promise>PHASE_1_13_COMPLETE</promise>
"@
    }
)

return $Phase1Tasks
