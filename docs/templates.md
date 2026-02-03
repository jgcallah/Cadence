# Template Authoring Guide

Cadence uses [Handlebars](https://handlebarsjs.com/) for template rendering. This guide covers template syntax, available variables, and how to create custom templates.

## Template Basics

Templates are markdown files that can include variable placeholders. When you create a note from a template, Cadence replaces the placeholders with actual values.

### Simple Example

```markdown
# Daily Note - {{date}}

## Tasks

## Notes

## Reflection

---
Yesterday: {{yesterday}}
Tomorrow: {{tomorrow}}
```

When rendered for February 15, 2024, this produces:

```markdown
# Daily Note - 2024-02-15

## Tasks

## Notes

## Reflection

---
Yesterday: [[2024-02-14]]
Tomorrow: [[2024-02-16]]
```

## Template Metadata

Templates can include frontmatter that defines metadata about the template itself. This metadata is separate from the note's frontmatter and is stripped during rendering.

```yaml
---
template:
  name: "Meeting Notes"
  description: "Template for meeting notes with attendees and action items"
  category: "work"
  variables:
    - name: "title"
      required: true
      description: "Meeting title"
    - name: "attendees"
      required: false
      default: "TBD"
      description: "List of attendees"
    - name: "agenda"
      required: false
      description: "Meeting agenda"
---
# {{title}}

**Date:** {{date}}
**Attendees:** {{attendees}}

## Agenda

{{agenda}}

## Discussion

## Action Items

- [ ]
```

### Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name for the template |
| `description` | string | What the template is for |
| `category` | string | Optional grouping category |
| `variables` | array | Variable definitions |

### Variable Definition

Each variable in the `variables` array can have:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Variable name (used as `{{name}}`) |
| `required` | boolean | No | Whether the variable must be provided |
| `default` | any | No | Default value if not provided |
| `description` | string | No | Help text describing the variable |

## Built-in Variables

These variables are automatically available in all templates:

### Date & Time Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{date}}` | Current date (YYYY-MM-DD) | `2024-02-15` |
| `{{time}}` | Current time (HH:mm) | `14:30` |
| `{{year}}` | 4-digit year | `2024` |
| `{{month}}` | 2-digit month | `02` |
| `{{weekNum}}` | ISO week number | `07` |
| `{{quarter}}` | Quarter (Q1-Q4) | `Q1` |

### Navigation Variables

| Variable | Description | Example Output |
|----------|-------------|----------------|
| `{{yesterday}}` | Link to yesterday | `[[2024-02-14]]` |
| `{{tomorrow}}` | Link to tomorrow | `[[2024-02-16]]` |

Link format depends on the `linkFormat` config setting (wikilink or markdown).

## Handlebars Helpers

Cadence provides custom Handlebars helpers for common operations.

### `wikilink`

Wraps text in wiki-style double brackets.

```handlebars
{{wikilink title}}
```

Input: `title = "My Page"`
Output: `[[My Page]]`

### `formatDate`

Formats a date using [date-fns format strings](https://date-fns.org/docs/format).

```handlebars
{{formatDate date "MMMM do, yyyy"}}
```

Input: `date = "2024-02-15"`
Output: `February 15th, 2024`

Common format patterns:

| Pattern | Output |
|---------|--------|
| `yyyy-MM-dd` | `2024-02-15` |
| `MMMM do, yyyy` | `February 15th, 2024` |
| `EEEE` | `Thursday` |
| `MMM d` | `Feb 15` |
| `'Week' w` | `Week 7` |
| `QQQ yyyy` | `Q1 2024` |

## Handlebars Syntax

### Conditionals

```handlebars
{{#if agenda}}
## Agenda
{{agenda}}
{{else}}
## Agenda
_No agenda provided_
{{/if}}
```

### Iteration

```handlebars
{{#each attendees}}
- {{this}}
{{/each}}
```

### Comments

```handlebars
{{! This is a comment and won't appear in output }}
```

### Escaping

By default, Handlebars escapes HTML. Use triple braces to prevent escaping:

```handlebars
{{title}}      → escapes HTML entities
{{{content}}}  → raw output, no escaping
```

## Creating Custom Templates

### Step 1: Create the Template File

Create a markdown file in your templates directory (default: `Templates/`):

```markdown
---
template:
  name: "Project Kickoff"
  description: "Template for starting a new project"
  variables:
    - name: "projectName"
      required: true
      description: "Name of the project"
    - name: "owner"
      required: true
      description: "Project owner"
    - name: "deadline"
      required: false
      description: "Project deadline"
    - name: "tags"
      required: false
      default: "project"
      description: "Tags for the project"
---
# {{projectName}}

**Owner:** {{owner}}
**Created:** {{date}}
{{#if deadline}}
**Deadline:** {{deadline}}
{{/if}}

## Overview



## Goals

- [ ]

## Milestones

| Milestone | Target Date | Status |
|-----------|-------------|--------|
|           |             | 🔴     |

## Resources



## Notes


---
Tags: #{{tags}}
```

### Step 2: Register the Template (Optional)

Add it to your config if you want it to appear in `cadence templates list`:

```json
{
  "templates": {
    "daily": "Templates/daily.md",
    "weekly": "Templates/weekly.md",
    "project": "Templates/project-kickoff.md"
  }
}
```

### Step 3: Use the Template

```bash
# List available templates
cadence templates list

# See template details and required variables
cadence templates show project

# Create a note from the template
cadence new project --var projectName="Website Redesign" --var owner="Alice"

# Create with output path
cadence new project \
  --var projectName="API v2" \
  --var owner="Bob" \
  --var deadline="2024-06-01" \
  --output "Projects/api-v2.md"

# Open in editor after creation
cadence new project --var projectName="Mobile App" --var owner="Carol" --open
```

## Template Examples

### Daily Note Template

```markdown
---
template:
  name: "Daily Note"
  description: "Standard daily note template"
---
# {{date}}

## Tasks

- [ ]

## Notes



## Reflection



---
← {{yesterday}} | {{tomorrow}} →
```

### Weekly Review Template

```markdown
---
template:
  name: "Weekly Review"
  description: "End of week reflection and planning"
---
# Week {{weekNum}} - {{year}}

## Accomplishments

-

## Challenges

-

## Lessons Learned

-

## Next Week Focus

- [ ]

## Metrics

| Metric | This Week | Last Week | Delta |
|--------|-----------|-----------|-------|
|        |           |           |       |
```

### Meeting Notes Template

```markdown
---
template:
  name: "Meeting Notes"
  description: "Capture meeting discussions and action items"
  variables:
    - name: "title"
      required: true
      description: "Meeting title"
    - name: "attendees"
      required: false
      default: ""
      description: "Comma-separated list of attendees"
    - name: "type"
      required: false
      default: "general"
      description: "Meeting type (standup, planning, review, etc.)"
---
# {{title}}

**Date:** {{date}} {{time}}
**Type:** {{type}}
**Attendees:** {{attendees}}

## Agenda

1.

## Discussion



## Decisions

-

## Action Items

- [ ]

---
Tags: #meeting #{{type}}
```

### Book Notes Template

```markdown
---
template:
  name: "Book Notes"
  description: "Template for capturing book notes and highlights"
  variables:
    - name: "title"
      required: true
      description: "Book title"
    - name: "author"
      required: true
      description: "Book author"
    - name: "rating"
      required: false
      description: "Rating out of 5"
---
# {{title}}

**Author:** {{author}}
**Started:** {{date}}
{{#if rating}}
**Rating:** {{rating}}/5
{{/if}}

## Summary



## Key Takeaways

1.

## Favorite Quotes

>

## How This Applies to Me



---
Tags: #book #reading
```

## Periodic Note Templates

The built-in periodic note types (daily, weekly, monthly, quarterly, yearly) use registered templates. Here are recommended patterns for each:

### Daily Template Variables

- `{{date}}` - The note's date
- `{{yesterday}}` - Link to previous day
- `{{tomorrow}}` - Link to next day

### Weekly Template Variables

- `{{weekNum}}` - ISO week number
- `{{year}}` - Year
- Navigation links should use the weekly date pattern

### Monthly Template Variables

- `{{month}}` - 2-digit month
- `{{year}}` - Year

### Quarterly Template Variables

- `{{quarter}}` - Quarter (Q1-Q4)
- `{{year}}` - Year

### Yearly Template Variables

- `{{year}}` - Year

## Best Practices

1. **Keep templates simple** - Start minimal and add complexity as needed
2. **Use sections consistently** - Match section headers to your config for task management
3. **Include navigation** - Add links to related notes (previous/next)
4. **Document required variables** - Use template metadata to make templates self-documenting
5. **Test templates** - Use `cadence templates show <name>` to verify variable definitions

## Troubleshooting

### "Missing required variable" Error

Ensure you're passing all required variables when creating from a template:

```bash
# Check what variables are needed
cadence templates show meeting

# Pass all required variables
cadence new meeting --var title="Sprint Planning"
```

### Variables Not Rendering

- Check spelling matches exactly (case-sensitive)
- Ensure the variable is defined in template metadata or is a built-in
- Verify Handlebars syntax (double braces: `{{variable}}`)

### Template Not Found

- Check the template path in config is correct
- Ensure the file exists at that path
- Try using an absolute path in config
