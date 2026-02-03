# MCP Setup Guide

Cadence includes a Model Context Protocol (MCP) server that enables Claude AI to interact directly with your vault. This guide covers installation, configuration, and usage.

## What is MCP?

The Model Context Protocol (MCP) allows AI assistants like Claude to use external tools. With the Cadence MCP server, Claude can:

- Create and read your periodic notes
- Manage tasks (add, complete, rollover)
- Search your vault
- Get context from recent notes
- Create notes from templates

## Installation

### Prerequisites

- Node.js 20+
- Claude Desktop app (or another MCP-compatible client)
- An initialized Cadence vault

### Install the MCP Package

```bash
npm install -g @cadence/mcp
```

Or if using pnpm:

```bash
pnpm add -g @cadence/mcp
```

## Configuration for Claude Desktop

### Locate the Config File

The Claude Desktop configuration file is located at:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Create this file if it doesn't exist.

### Add Cadence Server

Add the Cadence MCP server to your configuration:

```json
{
  "mcpServers": {
    "cadence": {
      "command": "npx",
      "args": ["@cadence/mcp"],
      "env": {
        "CADENCE_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

Replace `/path/to/your/vault` with the absolute path to your Obsidian vault (the directory containing `.cadence/config.json`).

### Windows Example

```json
{
  "mcpServers": {
    "cadence": {
      "command": "npx",
      "args": ["@cadence/mcp"],
      "env": {
        "CADENCE_VAULT_PATH": "C:\\Users\\YourName\\Documents\\ObsidianVault"
      }
    }
  }
}
```

### macOS/Linux Example

```json
{
  "mcpServers": {
    "cadence": {
      "command": "npx",
      "args": ["@cadence/mcp"],
      "env": {
        "CADENCE_VAULT_PATH": "/Users/yourname/Documents/ObsidianVault"
      }
    }
  }
}
```

### Using a Local Build

If you're developing Cadence or using a local build:

```json
{
  "mcpServers": {
    "cadence": {
      "command": "node",
      "args": ["/path/to/cadence/packages/mcp/dist/server.js"],
      "env": {
        "CADENCE_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

### Restart Claude Desktop

After modifying the configuration, restart Claude Desktop for changes to take effect.

## Available Tools

The Cadence MCP server provides 18 tools organized by function.

### Periodic Notes Tools

#### `ensure_daily_note`

Create or retrieve today's daily note.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `date` | string | No | Date string (default: today). Supports ISO format or natural language. |

**Example prompts:**
- "Create today's daily note"
- "Make a daily note for yesterday"
- "Ensure I have a note for 2024-02-15"

#### `get_daily_note`

Retrieve an existing daily note.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `date` | string | No | Date string (default: today) |

#### `list_daily_notes`

List daily notes within a date range.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `startDate` | string | No | Start of range |
| `endDate` | string | No | End of range |
| `limit` | number | No | Maximum results |

#### `ensure_periodic_note`

Create or retrieve any type of periodic note.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | string | Yes | One of: `daily`, `weekly`, `monthly`, `quarterly`, `yearly` |
| `date` | string | No | Date string (default: current period) |

**Example prompts:**
- "Create this week's weekly note"
- "Make a monthly note for January"
- "Create a quarterly review for Q1 2024"

#### `get_current_period`

Get information about a current period.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | string | Yes | Period type |
| `date` | string | No | Reference date |

**Returns:** Period start, end, label, and note path.

#### `list_periodic_notes`

List periodic notes with filtering.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | string | Yes | Note type |
| `limit` | number | No | Maximum results |

### Template Tools

#### `list_templates`

List all available templates with their metadata.

**Example prompts:**
- "What templates do I have?"
- "Show me available note templates"

#### `get_template`

Get template content and metadata.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | string | Yes | Template name |

#### `create_from_template`

Create a new note from a template.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `template` | string | Yes | Template name |
| `variables` | object | No | Variable values |
| `outputPath` | string | No | Output file path |

**Example prompts:**
- "Create a meeting note titled 'Sprint Planning' with attendees Alice and Bob"
- "Make a new project note for the API redesign"

### Task Management Tools

#### `get_open_tasks`

Get incomplete tasks from recent daily notes.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `days` | number | No | Days to look back (default: 7) |
| `priority` | string | No | Filter by priority |
| `tag` | string | No | Filter by tag |

**Example prompts:**
- "What tasks do I have open?"
- "Show me high priority tasks"
- "What tasks are tagged with #work?"

#### `get_overdue_tasks`

Get tasks that are past their due date.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `days` | number | No | Days to look back |

**Example prompts:**
- "Do I have any overdue tasks?"
- "What's past due?"

#### `add_task`

Add a new task to today's daily note.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | string | Yes | Task description |
| `due` | string | No | Due date |
| `priority` | string | No | Priority level |
| `tags` | array | No | Tags to apply |

**Example prompts:**
- "Add a task to review the PR"
- "Add a high priority task to call the client, due tomorrow"
- "Create a task tagged #work to update the documentation"

#### `toggle_task`

Toggle a task's completion status.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `location` | string | Yes | Task location (`file:line` format) |

#### `rollover_tasks`

Roll incomplete tasks from previous days to today.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `days` | number | No | Days to scan back |
| `dryRun` | boolean | No | Preview without making changes |

**Example prompts:**
- "Roll over my incomplete tasks to today"
- "Preview what tasks would be rolled over"

### Context & Search Tools

#### `get_context`

Get recent notes and task summary for context.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `days` | number | No | Days of daily notes to include |
| `includeTasks` | boolean | No | Include task summary |
| `includeWeekly` | boolean | No | Include current weekly note |
| `includeMonthly` | boolean | No | Include current monthly note |
| `includeQuarterly` | boolean | No | Include current quarterly note |

**Example prompts:**
- "What have I been working on recently?"
- "Get context from the last week"
- "Summarize my recent notes and tasks"

#### `search_vault`

Search files and content in the vault.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `searchContent` | boolean | No | Search file contents |
| `searchFrontmatter` | boolean | No | Search frontmatter |
| `limit` | number | No | Maximum results |
| `pathPrefix` | string | No | Limit to path prefix |

**Example prompts:**
- "Search for notes about project alpha"
- "Find notes mentioning the API redesign"
- "Search for files in the Projects folder"

#### `append_to_section`

Append content to a named section in a note.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Note path |
| `section` | string | Yes | Section header to find |
| `content` | string | Yes | Content to append |

**Example prompts:**
- "Add 'Met with client' to today's Notes section"
- "Append a task to the Tasks section of my weekly note"

#### `read_note`

Read a note's content and frontmatter.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | Yes | Note path relative to vault |

## Usage Examples

Here are example conversations with Claude using the Cadence MCP:

### Daily Workflow

**You:** "Create today's daily note and add a task to review the pull request"

**Claude:** *Uses `ensure_daily_note` to create today's note, then `add_task` to add the task*

"I've created today's daily note and added the task 'Review the pull request' to it."

### Weekly Review

**You:** "What have I accomplished this week? Show me my completed and open tasks."

**Claude:** *Uses `get_context` with days=7 and `get_open_tasks`*

"Here's your week in review..."

### Task Management

**You:** "Roll over my incomplete tasks from yesterday and show me what's overdue"

**Claude:** *Uses `rollover_tasks` then `get_overdue_tasks`*

"I've rolled over 3 incomplete tasks to today. You have 2 overdue tasks..."

### Context for Discussion

**You:** "I need to write a status update. What have I been working on?"

**Claude:** *Uses `get_context` to gather recent notes*

"Based on your recent notes, here's what you've been working on..."

## Troubleshooting

### "Vault not found" Error

Ensure `CADENCE_VAULT_PATH` points to a directory with a `.cadence/config.json` file.

```bash
# Verify the config exists
ls /path/to/vault/.cadence/config.json
```

### Server Not Appearing in Claude

1. Check the config file path is correct for your OS
2. Ensure JSON syntax is valid (no trailing commas)
3. Restart Claude Desktop after config changes
4. Check Claude's logs for error messages

### Permission Errors

On macOS/Linux, ensure the MCP server has read/write access to the vault directory.

### "Command not found" Error

Ensure Node.js and npx are in your system PATH:

```bash
which npx
# Should output: /usr/local/bin/npx or similar
```

If npx isn't found, specify the full path in the config:

```json
{
  "mcpServers": {
    "cadence": {
      "command": "/usr/local/bin/npx",
      "args": ["@cadence/mcp"],
      "env": {
        "CADENCE_VAULT_PATH": "/path/to/vault"
      }
    }
  }
}
```

### Debug Mode

Run the MCP server manually to see debug output:

```bash
CADENCE_VAULT_PATH=/path/to/vault npx @cadence/mcp
```

This starts the server in stdio mode. You can test by sending JSON-RPC messages.

## Security Considerations

- The MCP server has read/write access to your vault
- Claude can create, modify, and read any file in the vault
- Don't use with vaults containing sensitive data you don't want AI to access
- The server only operates within the specified vault directory
