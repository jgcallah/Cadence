# Phase 6: Polish & Distribution
# Goal: Production-ready release

$Phase6Tasks = @(
    @{
        Name = "Phase 6.1 - Documentation"
        Prompt = @"
Create comprehensive documentation for Cadence.

Requirements:
1. README.md at repo root:
   - Project overview and philosophy
   - Quick start guide (install, init, first note)
   - Feature highlights
   - Links to detailed docs

2. docs/config.md - Configuration Reference:
   - Full config schema with descriptions
   - Default values
   - Examples for common setups

3. docs/templates.md - Template Authoring Guide:
   - Template syntax (Handlebars)
   - Available variables
   - Creating custom templates
   - Template metadata format

4. docs/mcp-setup.md - MCP Setup Guide:
   - Installing for Claude Desktop
   - Configuration in claude_desktop_config.json
   - Available tools and usage examples
   - Troubleshooting

5. docs/cli.md - CLI Reference:
   - All commands with examples
   - Global flags
   - Exit codes

6. CONTRIBUTING.md:
   - Development setup
   - Testing instructions
   - PR guidelines

When complete, output: <promise>PHASE_6_1_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 6.2 - Developer Experience"
        Prompt = @"
Add developer experience features to the CLI in packages/cli/.

Requirements:
1. Add --verbose flag:
   - Global flag for all commands
   - Shows detailed debug output
   - Log file resolution, config loading, etc.

2. Add --dry-run flag:
   - For destructive operations (rollover, init)
   - Shows what would happen without doing it
   - Colored diff-style output

3. Add --json flag:
   - For all commands that output data
   - Machine-readable JSON output
   - Useful for scripting

4. Add shell completions:
   - cadence completions bash > ~/.bash_completion.d/cadence
   - cadence completions zsh > ~/.zsh/completions/_cadence
   - cadence completions fish > ~/.config/fish/completions/cadence.fish
   - Use Commander.js completion generation or omelette

5. Add version command:
   - cadence --version
   - Shows version of all packages

6. Add doctor command:
   - cadence doctor
   - Checks vault health, config validity, template existence
   - Reports issues with suggestions

7. Write tests for new flags and commands

When complete, output: <promise>PHASE_6_2_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 6.3 - Distribution Setup"
        Prompt = @"
Set up distribution and publishing for all packages.

Requirements:
1. npm publish workflow:
   - GitHub Actions workflow for publishing to npm
   - Trigger on version tags (v*)
   - Publish @cadence/core, @cadence/cli, @cadence/mcp

2. Package configuration:
   - Proper package.json for each package
   - Correct main, module, types fields
   - bin field for CLI
   - files field to include only necessary files

3. VS Code marketplace:
   - vsce package configuration
   - Publisher setup
   - GitHub Actions for marketplace publish

4. GitHub releases:
   - Automated release notes from commits
   - Changelog generation
   - Asset uploads (vsix, etc.)

5. CI/CD pipeline:
   - Test on push to main
   - Build and type-check
   - Coverage reporting

6. Version management:
   - Use changesets or standard-version
   - Synchronized versions across packages

7. Create .github/workflows/:
   - ci.yml - tests on PR
   - publish.yml - npm publish on tag
   - vscode.yml - VS Code marketplace publish

When complete, output: <promise>PHASE_6_3_COMPLETE</promise>
"@
    }
)

return $Phase6Tasks
