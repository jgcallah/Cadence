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
   Coming Soon. Bring the power of Periodic Notes and Templater directly into VS Code commands and sidebars.

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

**Global CLI**:
```bash
npm install -g @cadence/cli
```

**MCP Server (Claude Desktop Config)**:
```json
{
  "mcpServers": {
    "cadence": {
      "command": "npx",
      "args": ["-y", "@cadence/mcp"]
    }
  }
}
```

## Architecture

This project is a monorepo managed with pnpm:

- `packages/core`: The business logic (Config, Dates, FS, Templates).
- `packages/cli`: Commander.js interface.
- `packages/mcp`: Model Context Protocol server implementation.
- `packages/vscode`: Visual Studio Code extension wrapper.

## Contributing

We are currently in the Pre-Alpha phase. To contribute:

1. Clone the repo: `git clone https://github.com/yourusername/cadence.git`
2. Install dependencies: `pnpm install`
3. Run tests: `pnpm test`

## License

MIT © Justin Callahan
