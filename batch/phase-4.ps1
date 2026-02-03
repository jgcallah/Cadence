# Phase 4: Task Management
# Goal: Full task parsing, aggregation, rollover with metadata

$Phase4Tasks = @(
    @{
        Name = "Phase 4.1 - Core Task Parser"
        Prompt = @"
Implement task parsing in packages/core/src/tasks/.

Requirements:
1. Implement TaskParser class:
   - parse(content: string): Task[]
   - Parses markdown checkbox syntax: - [ ] and - [x]

2. Task interface:
   interface Task {
     line: number;
     text: string;
     completed: boolean;
     metadata: TaskMetadata;
     raw: string;
   }

3. TaskMetadata parsing:
   interface TaskMetadata {
     due?: Date;           // due:2024-01-15
     priority?: 'high' | 'medium' | 'low';  // priority:high or !!! !! !
     tags: string[];       // #tag1 #tag2
     scheduled?: Date;     // scheduled:2024-01-20
     age?: number;         // age:3 (days since creation)
     created?: Date;       // created:2024-01-10
   }

4. Regex patterns for metadata:
   - due:YYYY-MM-DD or due:natural-language
   - priority:high|medium|low or !!!|!!|!
   - #tagname (multiple allowed)
   - scheduled:YYYY-MM-DD
   - age:N (integer days)

5. Write extensive tests for:
   - Basic checkbox parsing
   - All metadata formats
   - Multiple tasks in content
   - Edge cases (malformed, partial metadata)

When complete, output: <promise>PHASE_4_1_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 4.2 - Core Task Aggregation"
        Prompt = @"
Implement task aggregation in packages/core/src/tasks/.

Requirements:
1. Implement TaskAggregator class:
   - aggregate(options: AggregateOptions): Promise<AggregatedTasks>

2. AggregateOptions interface:
   interface AggregateOptions {
     vaultPath: string;
     daysBack?: number;      // default: 7
     includeCompleted?: boolean;  // default: false
     noteTypes?: NoteType[]; // default: ['daily']
   }

3. AggregatedTasks interface:
   interface AggregatedTasks {
     open: TaskWithSource[];
     completed: TaskWithSource[];
     overdue: TaskWithSource[];
     stale: TaskWithSource[];    // age > staleAfterDays from config
     byPriority: {
       high: TaskWithSource[];
       medium: TaskWithSource[];
       low: TaskWithSource[];
       none: TaskWithSource[];
     };
   }

4. TaskWithSource:
   interface TaskWithSource extends Task {
     sourcePath: string;
     sourceDate: Date;
   }

5. Features:
   - Scan notes within date range
   - Categorize by status
   - Sort by priority, then due date
   - Use config for staleAfterDays threshold

6. Write tests for:
   - Aggregation across multiple notes
   - Filtering by status
   - Sorting logic
   - Stale detection

When complete, output: <promise>PHASE_4_2_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 4.3 - Core Task Rollover"
        Prompt = @"
Implement task rollover in packages/core/src/tasks/.

Requirements:
1. Implement TaskRollover class:
   - rollover(options: RolloverOptions): Promise<RolloverResult>

2. RolloverOptions:
   interface RolloverOptions {
     vaultPath: string;
     targetDate?: Date;     // default: today
     sourceDaysBack?: number;  // default: config.tasks.scanDaysBack
   }

3. RolloverResult:
   interface RolloverResult {
     rolledOver: TaskWithSource[];
     targetNotePath: string;
     skipped: { task: Task; reason: string }[];
   }

4. Rollover logic:
   - Find incomplete tasks from previous days
   - Increment age metadata (age:N -> age:N+1)
   - Add created date if not present
   - Insert into today's note under configured tasks section
   - Preserve all original metadata
   - Skip tasks already in today's note (prevent duplicates)

5. Age tracking:
   - If task has no age, set age:1
   - If task has age:N, set age:N+1
   - If no created date, add created:original-note-date

6. Write tests for:
   - Basic rollover
   - Age increment
   - Duplicate prevention
   - Multiple source days
   - Stale task handling

When complete, output: <promise>PHASE_4_3_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 4.4 - Core Task Modification"
        Prompt = @"
Implement task modification in packages/core/src/tasks/.

Requirements:
1. Implement TaskModifier class:
   - toggleTask(filePath: string, lineNumber: number): Promise<Task>
   - updateMetadata(filePath: string, lineNumber: number, updates: Partial<TaskMetadata>): Promise<Task>
   - addTask(filePath: string, section: string, task: NewTask): Promise<Task>

2. toggleTask:
   - [ ] text -> - [x] text
   - [x] text -> - [ ] text
   - Preserve all metadata

3. updateMetadata:
   - Update specific metadata fields in-place
   - Add metadata if not present
   - Remove metadata if value is null

4. addTask:
   - Add new task to specified section
   - Auto-add created date
   - Support all metadata fields

5. Atomic file operations:
   - Read file
   - Modify specific line
   - Write back atomically

6. Write tests for:
   - Toggle in both directions
   - Metadata updates
   - Adding new tasks
   - Line number accuracy
   - Concurrent modification safety

When complete, output: <promise>PHASE_4_4_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 4.5 - CLI Task Commands"
        Prompt = @"
Add task commands to the CLI in packages/cli/.

Requirements:
1. Add task listing:
   - cadence tasks [--days 7]
   - Lists open tasks from last N days
   - Groups by source note
   - Shows metadata (due, priority, age)

2. Add filtered views:
   - cadence tasks --overdue
   - cadence tasks --stale
   - cadence tasks --priority high
   - cadence tasks --tag project

3. Add rollover command:
   - cadence tasks rollover [--dry-run]
   - Shows what will be rolled over
   - With --dry-run, don't actually modify files

4. Add toggle command:
   - cadence tasks toggle <file:line>
   - Example: cadence tasks toggle 'daily/2024/01/2024-01-15.md:42'

5. Add task command:
   - cadence tasks add 'Task text' [--due tomorrow] [--priority high]
   - Adds to today's daily note

6. Output formatting:
   - Color-coded by status/priority
   - Clear grouping
   - Actionable line references

7. Write tests for all commands

When complete, output: <promise>PHASE_4_5_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 4.6 - MCP Task Tools"
        Prompt = @"
Add task tools to the MCP server in packages/mcp/.

Requirements:
1. Add get tasks tool:
   - get_open_tasks:
     Input: { daysBack?: number, priority?: string, tag?: string }
     Output: { tasks: TaskWithSource[], summary: { total, overdue, stale } }

2. Add rollover tool:
   - rollover_tasks:
     Input: { dryRun?: boolean }
     Output: { rolledOver: Task[], targetNote: string } or { wouldRollOver: Task[] }

3. Add toggle tool:
   - toggle_task:
     Input: { filePath: string, lineNumber: number }
     Output: { task: Task, newState: 'completed' | 'open' }

4. Add overdue tasks tool:
   - get_overdue_tasks:
     Input: {}
     Output: { tasks: TaskWithSource[] }

5. Add create task tool:
   - add_task:
     Input: { text: string, due?: string, priority?: string, tags?: string[] }
     Output: { task: Task, notePath: string }

6. Tool descriptions should explain:
   - What task metadata means
   - How to reference tasks for toggle
   - Rollover behavior

7. Write tests for all tools

When complete, output: <promise>PHASE_4_6_COMPLETE</promise>
"@
    },
    @{
        Name = "Phase 4.7 - VS Code Tasks"
        Prompt = @"
Add task features to the VS Code extension in packages/vscode/.

Requirements:
1. Add sidebar tree view:
   - Register TreeDataProvider for tasks
   - Group tasks by source note
   - Show task text, metadata icons (priority, due)
   - Collapsible groups

2. Task tree item features:
   - Click navigates to task line in file
   - Checkbox icon reflects status
   - Context menu with toggle, edit metadata

3. Add commands:
   - cadence.toggleTask: Toggle task at cursor
   - cadence.rolloverTasks: Execute rollover
   - cadence.showOverdueTasks: Filter to overdue

4. Add status bar:
   - Show count of open tasks
   - Show overdue count with warning color
   - Click opens task sidebar

5. Add CodeLens (optional):
   - Show 'Toggle' action above tasks
   - Show task metadata inline

6. Write tests for:
   - Tree view data provider
   - Command execution
   - Navigation to task

When complete, output: <promise>PHASE_4_7_COMPLETE</promise>
"@
    }
)

return $Phase4Tasks
