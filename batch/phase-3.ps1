# Phase 3: Named Templates
# Goal: Support arbitrary named templates beyond periodic notes

$Phase3Tasks = @(
    @{
        Name = "Phase 3.1 - Core Named Templates"
        Prompt = @"
Implement named template support in packages/core/src/templates/.

Requirements:
1. Implement TemplateRegistry class:
   - register(name: string, templatePath: string): void
   - get(name: string): string (template content)
   - list(): TemplateInfo[] (name, path, description from frontmatter)
   - Load templates from config.templates

2. Implement createFromTemplate function:
   - createFromTemplate(templateName: string, targetPath: string, variables: Record<string, unknown>): Promise<Note>
   - Validates all required variables are provided
   - Uses TemplateEngine for rendering
   - Creates target file with rendered content

3. Support template metadata in frontmatter:
   ---
   template:
     name: Meeting Notes
     description: Template for meeting notes
     variables:
       - name: title
         required: true
       - name: attendees
         required: false
         default: []
   ---

4. Variable validation:
   - Check required variables before rendering
   - Apply defaults for optional variables
   - Throw TemplateRenderError with list of missing variables

5. Write tests for:
   - Template registration and retrieval
   - createFromTemplate with various variable combinations
   - Validation and error cases

When complete, output: <promise>PHASE_3_1_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 3.2 - CLI Template Commands"
        Prompt = @"
Add template commands to the CLI in packages/cli/.

Requirements:
1. Add new command:
   - cadence new <template> [--title '...'] [--output 'path/to/note.md']
   - Example: cadence new meeting --title 'Sprint Planning'

2. Add template listing:
   - cadence templates list
   - Shows: name, description, required variables

3. Add template info:
   - cadence templates show <name>
   - Shows full template details and preview

4. Interactive mode:
   - When required variables not provided via flags, prompt interactively
   - Use inquirer or similar for prompts

5. Variable passing:
   - --var key=value for arbitrary variables
   - Named flags for common variables (--title, --date)

6. Output:
   - Print created file path on success
   - Open in editor with --open flag

7. Write tests for all new commands

When complete, output: <promise>PHASE_3_2_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 3.3 - MCP Template Tools"
        Prompt = @"
Add template tools to the MCP server in packages/mcp/.

Requirements:
1. Add create from template tool:
   - create_from_template:
     Input: {
       template: string,
       targetPath: string,
       variables: Record<string, unknown>
     }
     Output: { path: string, content: string }

2. Add list templates tool:
   - list_templates:
     Input: {}
     Output: {
       templates: Array<{
         name: string,
         description: string,
         variables: Array<{ name: string, required: boolean, default?: unknown }>
       }>
     }

3. Add get template tool:
   - get_template:
     Input: { name: string }
     Output: { name: string, content: string, metadata: object }

4. Helpful tool descriptions explaining:
   - What templates are available
   - How to pass variables
   - Common use cases

5. Write tests for all new tools

When complete, output: <promise>PHASE_3_3_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 3.4 - VS Code Templates"
        Prompt = @"
Add template features to the VS Code extension in packages/vscode/.

Requirements:
1. Add command:
   - cadence.newFromTemplate: 'Cadence: New from Template'
   - Shows quick pick with available templates
   - After selection, shows input boxes for required variables

2. Add template quick pick features:
   - Show template name and description
   - Group by category if metadata supports it

3. Add input UI:
   - Use vscode.window.showInputBox for each required variable
   - Show variable description as placeholder
   - Validate required fields

4. After creation:
   - Open the new note in editor
   - Show success notification

5. Write tests for command flow

When complete, output: <promise>PHASE_3_4_COMPLETE</promise>
"@
    }
)

return $Phase3Tasks
