# Phase 2: Full Periodic Notes Hierarchy
# Goal: Extend to weekly, monthly, quarterly, yearly notes

$Phase2Tasks = @(
    @{
        Name = "Phase 2.1 - Core Periodic Notes Extension"
        Prompt = @"
Extend the notes module to support all periodic note types in packages/core/src/notes/.

Requirements:
1. Extend NoteService to handle all periodic types:
   - 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'

2. Implement getCurrentPeriod(type: NoteType): PeriodInfo
   - Returns current week number, month, quarter, year based on type
   - interface PeriodInfo { start: Date, end: Date, label: string }

3. Implement inter-note linking:
   - Daily notes link to their weekly note
   - Weekly notes link to their monthly note
   - Monthly notes link to their quarterly note
   - Add navigation links in templates ({{parentNote}}, {{childNotes}})

4. Path generation for each type using config patterns:
   - weekly: periodic/weekly/{year}/{week}.md
   - monthly: periodic/monthly/{year}/{month}.md
   - quarterly: periodic/quarterly/{year}/Q{quarter}.md
   - yearly: periodic/yearly/{year}.md

5. Write tests for:
   - All note types creation and retrieval
   - Period calculation (especially edge cases like week 52/53, year boundaries)
   - Cross-linking between note types

When complete, output: <promise>PHASE_2_1_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 2.2 - CLI Periodic Commands"
        Prompt = @"
Add periodic note commands to the CLI in packages/cli/.

Requirements:
1. Add commands for all periodic types:
   - cadence weekly [--date 'last week']
   - cadence monthly [--date '2024-01']
   - cadence quarterly [--date 'Q1 2024']
   - cadence yearly [--date '2024']

2. Add generic open command:
   - cadence open <type> [--date '...']
   - type: daily, weekly, monthly, quarterly, yearly

3. Add list command:
   - cadence list <type> [--range 'last 3 months']
   - Output: list of note paths with dates

4. Shared date parsing logic:
   - Use chrono-node for all natural language dates
   - Support period-specific formats (Q1, 2024-W05, etc.)

5. Update --help with examples for each command

6. Write tests for:
   - Each new command
   - Date parsing variations
   - List command with different ranges

When complete, output: <promise>PHASE_2_2_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 2.3 - MCP Periodic Tools"
        Prompt = @"
Add periodic note tools to the MCP server in packages/mcp/.

Requirements:
1. Add generic periodic note tool:
   - ensure_periodic_note:
     Input: { type: 'daily'|'weekly'|'monthly'|'quarterly'|'yearly', date?: string }
     Output: { path: string, content: string, created: boolean, periodInfo: object }

2. Add period info tool:
   - get_current_period:
     Input: { type: 'weekly'|'monthly'|'quarterly'|'yearly' }
     Output: { start: string, end: string, label: string, notePath: string }

3. Add list tool:
   - list_periodic_notes:
     Input: { type: string, limit?: number, startDate?: string, endDate?: string }
     Output: { notes: Array<{ path: string, date: string, periodLabel: string }> }

4. Update tool descriptions to be helpful for Claude

5. Write tests for all new tools

When complete, output: <promise>PHASE_2_3_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 2.4 - VS Code Periodic Commands"
        Prompt = @"
Add periodic note commands to the VS Code extension in packages/vscode/.

Requirements:
1. Add commands for all periodic types:
   - cadence.openWeeklyNote: 'Cadence: Open This Week's Note'
   - cadence.openMonthlyNote: 'Cadence: Open This Month's Note'
   - cadence.openQuarterlyNote: 'Cadence: Open This Quarter's Note'
   - cadence.openYearlyNote: 'Cadence: Open This Year's Note'

2. Add quick pick menu command:
   - cadence.openPeriodicNote: 'Cadence: Open Periodic Note...'
   - Shows quick pick with: Daily, Weekly, Monthly, Quarterly, Yearly
   - After selection, optionally show date picker

3. Add command palette entries for creating notes for specific dates

4. Update status bar to show current period context

5. Write tests for new commands

When complete, output: <promise>PHASE_2_4_COMPLETE</promise>
"@
    }
)

return $Phase2Tasks
