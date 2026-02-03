# CLI Reference

Complete reference for all Cadence CLI commands.

## Installation

```bash
npm install -g @cadence/cli
# or
pnpm add -g @cadence/cli
```

## Global Options

These options are available for all commands:

| Option | Description |
|--------|-------------|
| `--vault <path>` | Override vault path (default: current directory or `CADENCE_VAULT_PATH` env var) |
| `-h, --help` | Display help for command |
| `-V, --version` | Display version number |

## Commands

### `init`

Initialize a new Cadence vault.

```bash
cadence init [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--force` | Overwrite existing configuration |

**Examples:**

```bash
# Initialize in current directory
cadence init

# Force reinitialize
cadence init --force
```

**Behavior:**
- Creates `.cadence/config.json` with default settings
- Creates template directory structure
- Safe by default (won't overwrite existing config)

---

### `daily`

Create or get today's daily note.

```bash
cadence daily [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--date <date>` | Date for the note (default: today) |

**Examples:**

```bash
# Today's note
cadence daily

# Yesterday's note
cadence daily --date yesterday

# Specific date
cadence daily --date 2024-02-15

# Natural language
cadence daily --date "last monday"
```

---

### `weekly`

Create or get this week's note.

```bash
cadence weekly [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--date <date>` | Date within the week (default: this week) |

**Examples:**

```bash
# This week's note
cadence weekly

# Last week's note
cadence weekly --date "last week"

# Week containing a specific date
cadence weekly --date 2024-02-15
```

---

### `monthly`

Create or get this month's note.

```bash
cadence monthly [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--date <date>` | Date within the month (default: this month) |

**Examples:**

```bash
# This month's note
cadence monthly

# Last month's note
cadence monthly --date "last month"

# Specific month
cadence monthly --date 2024-01
```

---

### `quarterly`

Create or get this quarter's note.

```bash
cadence quarterly [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--date <date>` | Date within the quarter (default: this quarter) |

**Examples:**

```bash
# This quarter's note
cadence quarterly

# Q1 2024
cadence quarterly --date 2024-Q1
```

---

### `yearly`

Create or get this year's note.

```bash
cadence yearly [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--date <date>` | Year (default: this year) |

**Examples:**

```bash
# This year's note
cadence yearly

# 2023's note
cadence yearly --date 2023
```

---

### `open`

Open a note in the default editor.

```bash
cadence open <type> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `type` | Note type: `daily`, `weekly`, `monthly`, `quarterly`, `yearly` |

**Options:**

| Option | Description |
|--------|-------------|
| `--date <date>` | Date for the note |

**Examples:**

```bash
# Open today's daily note
cadence open daily

# Open last week's weekly note
cadence open weekly --date "last week"
```

---

### `list`

List notes of a specific type.

```bash
cadence list <type> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `type` | Note type: `daily`, `weekly`, `monthly`, `quarterly`, `yearly` |

**Options:**

| Option | Description |
|--------|-------------|
| `--range <range>` | Date range (e.g., "last 30 days") |

**Examples:**

```bash
# List daily notes
cadence list daily

# List notes from a range
cadence list daily --range "last 30 days"
```

---

### `templates`

Manage templates.

#### `templates list`

List all available templates.

```bash
cadence templates list
```

**Output example:**

```
Available templates:
  daily      - Daily note template
  weekly     - Weekly review template
  monthly    - Monthly review template
  meeting    - Meeting notes template
```

#### `templates show`

Show template details and variables.

```bash
cadence templates show <name>
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `name` | Template name |

**Examples:**

```bash
cadence templates show meeting
```

**Output example:**

```
Template: meeting
Description: Meeting notes template

Variables:
  title (required) - Meeting title
  attendees        - List of attendees (default: TBD)
  agenda           - Meeting agenda
```

---

### `new`

Create a note from a template.

```bash
cadence new <template> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `template` | Template name |

**Options:**

| Option | Description |
|--------|-------------|
| `--title <title>` | Note title (sets the `title` variable) |
| `--date <date>` | Date for the note |
| `--output <path>` | Output file path |
| `--var <key=value>` | Set template variable (repeatable) |
| `--open` | Open note in editor after creation |

**Examples:**

```bash
# Simple creation
cadence new meeting --title "Sprint Planning"

# With multiple variables
cadence new meeting \
  --title "Sprint Planning" \
  --var attendees="Alice, Bob, Carol" \
  --var agenda="Review sprint goals"

# With output path
cadence new project \
  --var name="API Redesign" \
  --output "Projects/api-redesign.md"

# Open after creation
cadence new meeting --title "Standup" --open
```

---

### `tasks`

Task management commands.

#### `tasks` (list)

List open tasks from recent daily notes.

```bash
cadence tasks [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--days <n>` | Days to look back (default: 7) |
| `--overdue` | Show only overdue tasks |
| `--stale` | Show only stale tasks |
| `--priority <level>` | Filter by priority: `high`, `medium`, `low` |
| `--tag <tag>` | Filter by tag |
| `--flat` | Show flat list instead of grouped |

**Examples:**

```bash
# All open tasks from last 7 days
cadence tasks

# Overdue tasks only
cadence tasks --overdue

# High priority tasks
cadence tasks --priority high

# Tasks tagged with #work
cadence tasks --tag work

# Last 14 days, flat list
cadence tasks --days 14 --flat
```

**Output example:**

```
Open Tasks (7 days):

High Priority:
  [ ] Review security audit due:2024-02-10 #work
      Journal/Daily/2024-02-08.md:15 (2 days old)

Medium Priority:
  [ ] Update documentation #docs
      Journal/Daily/2024-02-09.md:12 (1 day old)

No Priority:
  [ ] Call dentist
      Journal/Daily/2024-02-10.md:18 (today)
```

#### `tasks rollover`

Roll incomplete tasks to today's note.

```bash
cadence tasks rollover [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without applying |
| `--days <n>` | Days to scan back |

**Examples:**

```bash
# Roll over tasks
cadence tasks rollover

# Preview what would be rolled over
cadence tasks rollover --dry-run

# Roll from last 14 days
cadence tasks rollover --days 14
```

**Behavior:**
- Finds incomplete tasks from previous daily notes
- Adds them to today's daily note (creates if needed)
- Increments task `age` metadata
- Adds `created` date if missing
- Skips duplicates

#### `tasks toggle`

Toggle a task's completion status.

```bash
cadence tasks toggle <location>
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `location` | Task location in `file:line` format |

**Examples:**

```bash
# Toggle task at line 15 of a daily note
cadence tasks toggle "Journal/Daily/2024-02-10.md:15"
```

#### `tasks add`

Add a new task to today's daily note.

```bash
cadence tasks add <text> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `text` | Task description |

**Options:**

| Option | Description |
|--------|-------------|
| `--due <date>` | Due date |
| `--priority <level>` | Priority: `high`, `medium`, `low` |
| `--tag <tags>` | Comma-separated tags |

**Examples:**

```bash
# Simple task
cadence tasks add "Review pull request"

# Task with due date
cadence tasks add "Submit report" --due tomorrow

# Task with priority and tags
cadence tasks add "Fix critical bug" \
  --priority high \
  --due today \
  --tag "urgent,work"
```

---

### `context`

Get recent context (notes and tasks).

```bash
cadence context [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--days <n>` | Days of daily notes to include (default: 3) |
| `--no-tasks` | Exclude task summary |
| `--no-weekly` | Exclude current weekly note |
| `--no-monthly` | Exclude current monthly note |
| `--quarterly` | Include current quarterly note |
| `--json` | Output as JSON |

**Examples:**

```bash
# Default context (3 days)
cadence context

# Last week of context
cadence context --days 7

# Include quarterly, JSON output
cadence context --quarterly --json

# Just daily notes, no tasks
cadence context --no-tasks --no-weekly --no-monthly
```

**Output includes:**
- Recent daily notes content
- Current weekly/monthly notes
- Open task summary
- Overdue task list

---

### `search`

Search the vault.

```bash
cadence search <query> [options]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `query` | Search query |

**Options:**

| Option | Description |
|--------|-------------|
| `--content` | Search file contents |
| `--frontmatter` | Search frontmatter |
| `--json` | Output as JSON |
| `--limit <n>` | Maximum results |
| `--path <prefix>` | Limit to path prefix |

**Examples:**

```bash
# Fuzzy filename search
cadence search meeting

# Content search
cadence search --content "project alpha"

# Frontmatter search
cadence search --frontmatter status:active

# Limit to folder
cadence search --content "TODO" --path "Projects/"

# JSON output
cadence search meeting --json
```

---

## Date Parsing

Cadence accepts flexible date formats:

### ISO Formats

| Format | Example |
|--------|---------|
| Full date | `2024-02-15` |
| Week | `2024-W07` |
| Month | `2024-02` |
| Quarter | `2024-Q1` |
| Year | `2024` |

### Natural Language

| Input | Meaning |
|-------|---------|
| `today` | Current date |
| `yesterday` | Previous day |
| `tomorrow` | Next day |
| `last week` | Previous week |
| `next month` | Following month |
| `2 days ago` | Two days prior |
| `in 3 weeks` | Three weeks from now |
| `last monday` | Most recent Monday |
| `next friday` | Upcoming Friday |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error (configuration, file system, validation, etc.) |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CADENCE_VAULT_PATH` | Default vault path |

When set, Cadence uses this path as the vault root instead of searching for `.cadence/config.json` in the current directory.

```bash
export CADENCE_VAULT_PATH="/path/to/vault"
cadence daily  # Uses the exported path
```

---

## Task Syntax

Tasks in markdown files follow this syntax:

```markdown
- [ ] Task description [metadata]
- [x] Completed task
```

### Metadata

| Syntax | Description | Example |
|--------|-------------|---------|
| `due:DATE` | Due date | `due:2024-02-15`, `due:tomorrow` |
| `priority:LEVEL` | Priority | `priority:high`, `priority:medium`, `priority:low` |
| `!!!` / `!!` / `!` | Priority shorthand | `!!!` = high, `!!` = medium, `!` = low |
| `#tag` | Tag | `#work`, `#urgent` |
| `scheduled:DATE` | Scheduled date | `scheduled:2024-02-20` |
| `age:N` | Days old | `age:3` (auto-managed) |
| `created:DATE` | Creation date | `created:2024-02-10` (auto-managed) |

### Examples

```markdown
- [ ] Review PR due:tomorrow priority:high #work
- [ ] Call dentist !!! due:2024-02-15
- [ ] Update docs #docs scheduled:next-week
- [x] Completed task
```
