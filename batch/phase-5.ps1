# Phase 5: Context & Search
# Goal: "Get me up to speed" and vault search

$Phase5Tasks = @(
    @{
        Name = "Phase 5.1 - Core Context Aggregation"
        Prompt = @"
Implement context aggregation in packages/core/src/context/.

Requirements:
1. Implement ContextBuilder class:
   - getContext(options?: ContextOptions): Promise<Context>

2. ContextOptions:
   interface ContextOptions {
     dailyCount?: number;    // default: 3
     includeWeekly?: boolean;  // default: true
     includeMonthly?: boolean; // default: true
     includeQuarterly?: boolean; // default: false
     includeTasks?: boolean;   // default: true
     maxTokens?: number;      // optional limit
   }

3. Context interface:
   interface Context {
     daily: Note[];
     weekly?: Note;
     monthly?: Note;
     quarterly?: Note;
     tasks: {
       open: TaskWithSource[];
       overdue: TaskWithSource[];
     };
     summary: string;  // Human-readable summary
   }

4. Context building:
   - Last N daily notes (most recent first)
   - Current weekly note
   - Current monthly note
   - Open tasks summary
   - Format as readable markdown

5. Summary generation:
   - 'Context as of [date]'
   - List periods covered
   - Task counts

6. Write tests for:
   - Default context
   - Custom options
   - Missing notes handling
   - Summary formatting

When complete, output: <promise>PHASE_5_1_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 5.2 - Core Search"
        Prompt = @"
Implement vault search in packages/core/src/search/.

Requirements:
1. Implement VaultSearch class:
   - searchFiles(query: string, options?: SearchOptions): Promise<SearchResult[]>
   - searchContent(query: string, options?: SearchOptions): Promise<ContentMatch[]>
   - searchFrontmatter(field: string, value: string): Promise<Note[]>

2. SearchOptions:
   interface SearchOptions {
     path?: string;         // limit to path prefix
     noteType?: NoteType;   // limit to note type
     limit?: number;        // max results
   }

3. File search (fuzzy):
   - Use fuse.js for fuzzy matching
   - Search by filename
   - Return ranked results

4. Content search:
   interface ContentMatch {
     path: string;
     line: number;
     content: string;       // matched line
     context: string[];     // surrounding lines
   }

5. Frontmatter search:
   - Find notes where frontmatter[field] matches value
   - Support nested fields: 'metadata.status'
   - Support array contains: tags contains 'project'

6. Performance:
   - Cache file list for fuzzy search
   - Stream content search for large vaults

7. Write tests for:
   - Fuzzy file search
   - Content search with context
   - Frontmatter queries
   - Edge cases

When complete, output: <promise>PHASE_5_2_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 5.3 - CLI Context/Search Commands"
        Prompt = @"
Add context and search commands to the CLI in packages/cli/.

Requirements:
1. Add context command:
   - cadence context [--days 5] [--no-tasks]
   - Outputs formatted context markdown
   - Can pipe to clipboard: cadence context | clip

2. Add search command:
   - cadence search <query>
   - Default: fuzzy file search
   - Shows ranked results with match highlighting

3. Add content search:
   - cadence search --content <query>
   - Shows file:line matches with context
   - Color-coded matches

4. Add frontmatter search:
   - cadence search --frontmatter 'status:active'
   - cadence search --frontmatter 'tags:project'
   - Lists matching notes

5. Output options:
   - --json for machine-readable output
   - --limit N to cap results
   - --path prefix to limit scope

6. Write tests for all commands

When complete, output: <promise>PHASE_5_3_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 5.4 - MCP Context/Search Tools"
        Prompt = @"
Add context and search tools to the MCP server in packages/mcp/.

Requirements:
1. Add context tool:
   - get_context:
     Input: { dailyCount?: number, includeTasks?: boolean }
     Output: { context: string, notes: NoteSummary[], tasks: TaskSummary }

2. Add search tool:
   - search_vault:
     Input: { query: string, type: 'files' | 'content' | 'frontmatter', limit?: number }
     Output: { results: SearchResult[] }

3. Add append tool:
   - append_to_section:
     Input: { notePath: string, section: string, content: string }
     Output: { success: boolean, notePath: string }
   - Section must be in config.sections (predefined only)

4. Add read note tool:
   - read_note:
     Input: { path: string }
     Output: { content: string, frontmatter: object }

5. Tool descriptions for Claude:
   - get_context: 'Get recent notes and tasks to understand current context'
   - search_vault: 'Search for notes by name, content, or metadata'
   - append_to_section: 'Add content to a predefined section in a note'

6. Write tests for all tools

When complete, output: <promise>PHASE_5_4_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 5.5 - VS Code Context/Search"
        Prompt = @"
Add context and search features to the VS Code extension in packages/vscode/.

Requirements:
1. Add context command:
   - cadence.getContext: 'Cadence: Get Context'
   - Options in quick pick: Copy to clipboard, Open in new editor
   - Shows recent notes and tasks summary

2. Add quick open integration:
   - cadence.quickOpen: 'Cadence: Quick Open Note'
   - Fuzzy search across vault
   - Show note path and preview

3. Add search panel:
   - Register SearchProvider for vault content search
   - Shows results in search viewlet
   - Click opens file at line

4. Add context sidebar section:
   - Tree view showing recent notes hierarchy
   - Daily -> Weekly -> Monthly
   - Expandable to show content preview

5. Keyboard shortcuts:
   - Ctrl+Shift+N: Quick open note
   - Ctrl+Shift+C: Get context

6. Write tests for commands and providers

When complete, output: <promise>PHASE_5_5_COMPLETE</promise>
"@
    }
)

return $Phase5Tasks
