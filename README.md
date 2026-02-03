# Cadence

The Headless Markdown Vault Manager.
Automate your Periodic Notes, Tasks, and Templates without opening Obsidian.

Cadence is a platform-agnostic "brain" for your Markdown notes. It decouples your workflow logic (Daily Notes, Templates, Task Rollover) from the application interface, allowing you to manage your vault from the Terminal, VS Code, or AI Agents like Claude.

## The Philosophy

Obsidian is an incredible interface for viewing and writing linked notes. However, locking your automation logic (plugins) inside a GUI application creates friction:

- You can't create a daily note from a headless server.
- You can't ask an AI agent to "clean up yesterday's tasks" reliably.
- You can't script your workflow easily from the terminal.

Cadence solves this by moving the logic layer out of the app and into a shared core library.

## Interfaces

Cadence provides a single shared core (@cadence/core) accessible through three distinct interfaces:

1. **The CLI** (@cadence/cli)
   For terminal-centric workflows and automation scripts.
   ```
   # Initialize a new vault
   cadence init

   # Create (or open) today's daily note
   cadence daily

   # Create a meeting note from a template
   cadence new meeting --title "Q3 Roadmap"

   # List open tasks from the last 7 days
   cadence tasks --open
   ```

2. **The MCP Server** (@cadence/mcp)
   Give your AI agent (Claude Desktop, etc.) full agency over your notes.
   ```
   # Get aggregated recent daily/weekly notes
   "Get me up to speed on this week."

   # Execute intelligent task rollover
   "Move yesterday's unfinished tasks to today."

   # Create a daily note for next Monday
   "Create a daily note for next Monday."
   ```

3. **VS Code Extension** (cadence-vscode)
   Bring the power of Periodic Notes and Templater directly into VS Code commands and sidebars.
   ```
   # Open today's daily note
   Ctrl+Shift+P -> "Cadence: Open Today's Note"

   # Toggle task completion
   Ctrl+Shift+X (cursor on task line)

   # Quick open any note
   Ctrl+Shift+N
   ```

## Key Features

- **Periodic Notes Engine**: Robust support for Daily, Weekly, Monthly, Quarterly, and Yearly notes with configurable hierarchies.
- **Task Management**:
  - Rollover: Automatically move incomplete tasks from yesterday to today.
  - Tracking: Preserves metadata (due:, priority:) and creation dates.
  - Aggregation: Query tasks across multiple files.
- **Headless Templates**: Handlebars-based templating engine that works anywhere. Support for variables like `{{yesterday}}`, `{{weekNum}}`, and Wikilinks.
- **Context Awareness**: Intelligent context dumping ("What happened last week?") for AI processing.
- **Per-Vault Config**: All settings live in `.cadence/config.json`, making your vault portable.

## Installation

### Quick Install (From Source)

Clone the repo and use the install script to set up any or all components:

```bash
git clone https://github.com/cadence-notes/cadence.git
cd cadence

# Install all components
./scripts/install.sh --all

# Or install specific components
./scripts/install.sh --cli          # CLI only
./scripts/install.sh --mcp          # MCP server only
./scripts/install.sh --vscode       # VS Code extension only
./scripts/install.sh --cli --mcp    # Multiple components
```

**Windows (PowerShell):**
```powershell
.\scripts\install.ps1 -All          # All components
.\scripts\install.ps1 -Cli          # CLI only
.\scripts\install.ps1 -Mcp          # MCP server only
.\scripts\install.ps1 -Vscode       # VS Code extension only
```

### Manual Installation

#### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)

#### 1. CLI (`@cadence/cli`)

**From npm (when published):**
```bash
npm install -g @cadence/cli
```

**From source:**
```bash
cd cadence
pnpm install && pnpm build
cd packages/cli && npm link
```

**Verify installation:**
```bash
cadence --help
```

**Initialize a vault:**
```bash
cd /path/to/your/vault
cadence init
```

#### 2. MCP Server (`@cadence/mcp`)

The MCP server allows AI agents like Claude to manage your notes.

**From npm (when published):**
```bash
npm install -g @cadence/mcp
```

**From source:**
```bash
cd cadence
pnpm install && pnpm build
cd packages/mcp && npm link
```

**Claude Desktop Configuration:**

Add to your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "cadence": {
      "command": "cadence-mcp",
      "args": [],
      "env": {
        "CADENCE_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

**Using npx (no install required):**
```json
{
  "mcpServers": {
    "cadence": {
      "command": "npx",
      "args": ["-y", "@cadence/mcp"],
      "env": {
        "CADENCE_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

#### 3. VS Code Extension (`cadence-vscode`)

**From source:**
```bash
cd cadence
pnpm install && pnpm build
cd packages/vscode
pnpm vscode:package
```

Then install the generated `.vsix` file:
1. Open VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
3. Run "Extensions: Install from VSIX..."
4. Select the `cadence-vscode-*.vsix` file

**Or via CLI:**
```bash
code --install-extension cadence-vscode-0.0.1.vsix
```

**Features:**
- Sidebar views for Tasks, Context, and Search
- Commands for creating/opening periodic notes
- Task toggle with `Ctrl+Shift+X` / `Cmd+Shift+X`
- Quick open with `Ctrl+Shift+N` / `Cmd+Shift+N`

### Vault Configuration

After installing any interface, initialize your vault:

```bash
cadence init
```

This creates a `.cadence/config.json` file with your vault settings. All three interfaces (CLI, MCP, VS Code) read from this same configuration.

## Architecture

This project is a monorepo managed with pnpm:

- `packages/core`: The business logic (Config, Dates, FS, Templates).
- `packages/cli`: Commander.js interface.
- `packages/mcp`: Model Context Protocol server implementation.
- `packages/vscode`: Visual Studio Code extension wrapper.

## License

MIT 
