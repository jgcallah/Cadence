# Configuration Reference

Cadence stores its configuration in `.cadence/config.json` at the root of your vault.

## Configuration Schema

```typescript
interface CadenceConfig {
  version: number;
  paths: PathsConfig;
  templates: TemplatesConfig;
  sections: SectionsConfig;
  tasks: TasksConfig;
  hooks: HooksConfig;
  linkFormat: "wikilink" | "markdown";
}
```

## Full Default Configuration

```json
{
  "version": 1,
  "paths": {
    "daily": "Journal/Daily/{year}-{month}-{date}.md",
    "weekly": "Journal/Weekly/{year}-W{week}.md",
    "monthly": "Journal/Monthly/{year}-{month}.md",
    "quarterly": "Journal/Quarterly/{year}-Q{quarter}.md",
    "yearly": "Journal/Yearly/{year}.md",
    "templates": "Templates"
  },
  "templates": {
    "daily": "Templates/daily.md",
    "weekly": "Templates/weekly.md",
    "monthly": "Templates/monthly.md",
    "quarterly": "Templates/quarterly.md",
    "yearly": "Templates/yearly.md"
  },
  "sections": {
    "tasks": "## Tasks",
    "notes": "## Notes",
    "reflection": "## Reflection"
  },
  "tasks": {
    "rolloverEnabled": true,
    "scanDaysBack": 7,
    "staleAfterDays": 14
  },
  "hooks": {
    "preCreate": null,
    "postCreate": null
  },
  "linkFormat": "wikilink"
}
```

## Configuration Sections

### `version`

**Type:** `number`
**Default:** `1`

Schema version for forward compatibility. Currently always `1`.

---

### `paths`

Defines where periodic notes are stored. Paths are relative to the vault root and support variable interpolation.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `daily` | string | `"Journal/Daily/{year}-{month}-{date}.md"` | Path pattern for daily notes |
| `weekly` | string | `"Journal/Weekly/{year}-W{week}.md"` | Path pattern for weekly notes |
| `monthly` | string | `"Journal/Monthly/{year}-{month}.md"` | Path pattern for monthly notes |
| `quarterly` | string | `"Journal/Quarterly/{year}-Q{quarter}.md"` | Path pattern for quarterly notes |
| `yearly` | string | `"Journal/Yearly/{year}.md"` | Path pattern for yearly notes |
| `templates` | string | `"Templates"` | Directory for custom templates |

#### Path Variables

Use these variables in path patterns:

| Variable | Description | Example |
|----------|-------------|---------|
| `{year}` | 4-digit year | `2024` |
| `{month}` | 2-digit month (01-12) | `02` |
| `{date}` | 2-digit day (01-31) | `15` |
| `{week}` | ISO week number (01-53) | `07` |
| `{quarter}` | Quarter number (1-4) | `1` |

#### Path Examples

**Flat Structure:**
```json
{
  "paths": {
    "daily": "Daily/{year}-{month}-{date}.md",
    "weekly": "Weekly/{year}-W{week}.md",
    "monthly": "Monthly/{year}-{month}.md"
  }
}
```

**Year-Based Folders:**
```json
{
  "paths": {
    "daily": "Journal/{year}/Daily/{month}-{date}.md",
    "weekly": "Journal/{year}/Weekly/W{week}.md",
    "monthly": "Journal/{year}/Monthly/{month}.md"
  }
}
```

**Month-Based Folders:**
```json
{
  "paths": {
    "daily": "Journal/{year}/{month}/{date}.md"
  }
}
```

---

### `templates`

Maps note types to their template files. Paths are relative to the vault root.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `daily` | string | `"Templates/daily.md"` | Template for daily notes |
| `weekly` | string | `"Templates/weekly.md"` | Template for weekly notes |
| `monthly` | string | `"Templates/monthly.md"` | Template for monthly notes |
| `quarterly` | string | `"Templates/quarterly.md"` | Template for quarterly notes |
| `yearly` | string | `"Templates/yearly.md"` | Template for yearly notes |

You can also register additional custom templates:

```json
{
  "templates": {
    "daily": "Templates/daily.md",
    "weekly": "Templates/weekly.md",
    "meeting": "Templates/meeting.md",
    "project": "Templates/project.md",
    "book-notes": "Templates/book-notes.md"
  }
}
```

---

### `sections`

Defines section headers used for task management and content organization.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tasks` | string | `"## Tasks"` | Section header where tasks are placed |
| `notes` | string | `"## Notes"` | Section header for general notes |
| `reflection` | string | `"## Reflection"` | Section header for reflection content |

These section headers are used by:
- Task rollover (inserts tasks under the tasks section)
- The `append_to_section` MCP tool
- Template rendering

---

### `tasks`

Controls task management behavior.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rolloverEnabled` | boolean | `true` | Whether automatic task rollover is enabled |
| `scanDaysBack` | number | `7` | Number of days to look back when aggregating tasks |
| `staleAfterDays` | number | `14` | Number of days after which a task is considered stale |

#### Task Behavior

**Rollover:**
When enabled, the `cadence tasks rollover` command moves incomplete tasks from previous daily notes to today's note. Tasks are marked with an `age` metadata field that increments each day.

**Stale Detection:**
Tasks older than `staleAfterDays` are flagged as stale in the output of `cadence tasks` and related commands. Use `cadence tasks --stale` to filter to only stale tasks.

---

### `hooks`

Lifecycle hooks for custom automation.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `preCreate` | string \| null | `null` | Command to run before creating a note |
| `postCreate` | string \| null | `null` | Command to run after creating a note |

Hooks receive context about the operation as environment variables:
- `CADENCE_NOTE_PATH` - Path to the note
- `CADENCE_NOTE_TYPE` - Type of note (daily, weekly, etc.)
- `CADENCE_NOTE_DATE` - ISO date string

#### Hook Example

```json
{
  "hooks": {
    "postCreate": "git add . && git commit -m 'Add {{type}} note for {{date}}'"
  }
}
```

---

### `linkFormat`

**Type:** `"wikilink" | "markdown"`
**Default:** `"wikilink"`

Controls how internal links are generated in templates and task rollover.

| Value | Output |
|-------|--------|
| `wikilink` | `[[2024-02-15]]` |
| `markdown` | `[2024-02-15](2024-02-15.md)` |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CADENCE_VAULT_PATH` | Override vault path detection |

When `CADENCE_VAULT_PATH` is set, Cadence uses that directory as the vault root instead of searching for a `.cadence` directory.

---

## Configuration Validation

Cadence validates the configuration on load and throws a `ConfigValidationError` if:

- Required sections are missing
- Types don't match the schema
- Path patterns contain invalid variables

Error messages indicate which field failed validation and why.

---

## Migrating Configuration

If the configuration schema changes in future versions, Cadence will handle migrations automatically. The `version` field tracks which schema version the config uses.

---

## Example Configurations

### Minimal Setup

```json
{
  "version": 1,
  "paths": {
    "daily": "Daily/{year}-{month}-{date}.md",
    "weekly": "Weekly/{year}-W{week}.md",
    "monthly": "Monthly/{year}-{month}.md",
    "quarterly": "Quarterly/{year}-Q{quarter}.md",
    "yearly": "Yearly/{year}.md",
    "templates": "Templates"
  },
  "templates": {
    "daily": "Templates/daily.md",
    "weekly": "Templates/weekly.md",
    "monthly": "Templates/monthly.md",
    "quarterly": "Templates/quarterly.md",
    "yearly": "Templates/yearly.md"
  },
  "sections": {
    "tasks": "## Tasks",
    "notes": "## Notes",
    "reflection": "## Reflection"
  },
  "tasks": {
    "rolloverEnabled": true,
    "scanDaysBack": 7,
    "staleAfterDays": 14
  },
  "hooks": {
    "preCreate": null,
    "postCreate": null
  },
  "linkFormat": "wikilink"
}
```

### Obsidian Daily Notes Plugin Compatible

If you're migrating from the Obsidian Daily Notes plugin:

```json
{
  "version": 1,
  "paths": {
    "daily": "Daily Notes/{year}-{month}-{date}.md",
    "weekly": "Weekly Notes/{year}-W{week}.md",
    "monthly": "Monthly Notes/{year}-{month}.md",
    "quarterly": "Quarterly Notes/{year}-Q{quarter}.md",
    "yearly": "Yearly Notes/{year}.md",
    "templates": "Templates"
  },
  "templates": {
    "daily": "Templates/Daily Template.md",
    "weekly": "Templates/Weekly Template.md",
    "monthly": "Templates/Monthly Template.md",
    "quarterly": "Templates/Quarterly Template.md",
    "yearly": "Templates/Yearly Template.md"
  },
  "sections": {
    "tasks": "## Tasks",
    "notes": "## Notes",
    "reflection": "## Reflection"
  },
  "tasks": {
    "rolloverEnabled": true,
    "scanDaysBack": 7,
    "staleAfterDays": 14
  },
  "hooks": {
    "preCreate": null,
    "postCreate": null
  },
  "linkFormat": "wikilink"
}
```

### With Git Hooks

```json
{
  "version": 1,
  "paths": {
    "daily": "Journal/Daily/{year}-{month}-{date}.md",
    "weekly": "Journal/Weekly/{year}-W{week}.md",
    "monthly": "Journal/Monthly/{year}-{month}.md",
    "quarterly": "Journal/Quarterly/{year}-Q{quarter}.md",
    "yearly": "Journal/Yearly/{year}.md",
    "templates": "Templates"
  },
  "templates": {
    "daily": "Templates/daily.md",
    "weekly": "Templates/weekly.md",
    "monthly": "Templates/monthly.md",
    "quarterly": "Templates/quarterly.md",
    "yearly": "Templates/yearly.md"
  },
  "sections": {
    "tasks": "## Tasks",
    "notes": "## Notes",
    "reflection": "## Reflection"
  },
  "tasks": {
    "rolloverEnabled": true,
    "scanDaysBack": 7,
    "staleAfterDays": 14
  },
  "hooks": {
    "preCreate": null,
    "postCreate": "cd \"$CADENCE_VAULT_PATH\" && git add \"$CADENCE_NOTE_PATH\""
  },
  "linkFormat": "wikilink"
}
```
