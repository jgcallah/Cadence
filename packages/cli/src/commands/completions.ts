import { Command } from "commander";

/**
 * Generate bash completion script.
 */
function generateBashCompletions(): string {
  return `# Cadence bash completion
# Add to ~/.bashrc or ~/.bash_completion.d/cadence

_cadence_completions() {
    local cur prev opts commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    commands="init daily weekly monthly quarterly yearly open list templates new tasks context search completions doctor"

    # Global options
    opts="--help --version --vault --verbose"

    # Handle completion based on previous word
    case "\${prev}" in
        cadence)
            COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
            return 0
            ;;
        init)
            COMPREPLY=( $(compgen -W "--force --dry-run --help" -- "\${cur}") )
            return 0
            ;;
        daily|weekly|monthly|quarterly|yearly)
            COMPREPLY=( $(compgen -W "--date --help" -- "\${cur}") )
            return 0
            ;;
        open)
            COMPREPLY=( $(compgen -W "daily weekly monthly quarterly yearly --date --help" -- "\${cur}") )
            return 0
            ;;
        list)
            COMPREPLY=( $(compgen -W "daily weekly monthly quarterly yearly --range --json --help" -- "\${cur}") )
            return 0
            ;;
        templates)
            COMPREPLY=( $(compgen -W "list show --help" -- "\${cur}") )
            return 0
            ;;
        new)
            COMPREPLY=( $(compgen -W "--title --date --output --var --open --help" -- "\${cur}") )
            return 0
            ;;
        tasks)
            COMPREPLY=( $(compgen -W "rollover toggle add --days --overdue --stale --priority --tag --flat --json --help" -- "\${cur}") )
            return 0
            ;;
        rollover)
            COMPREPLY=( $(compgen -W "--dry-run --days --help" -- "\${cur}") )
            return 0
            ;;
        add)
            COMPREPLY=( $(compgen -W "--due --priority --tag --help" -- "\${cur}") )
            return 0
            ;;
        context)
            COMPREPLY=( $(compgen -W "--days --no-tasks --no-weekly --no-monthly --quarterly --json --help" -- "\${cur}") )
            return 0
            ;;
        search)
            COMPREPLY=( $(compgen -W "--content --frontmatter --json --limit --path --help" -- "\${cur}") )
            return 0
            ;;
        completions)
            COMPREPLY=( $(compgen -W "bash zsh fish --help" -- "\${cur}") )
            return 0
            ;;
        doctor)
            COMPREPLY=( $(compgen -W "--json --help" -- "\${cur}") )
            return 0
            ;;
        --priority)
            COMPREPLY=( $(compgen -W "high medium low" -- "\${cur}") )
            return 0
            ;;
        --vault)
            # Directory completion
            COMPREPLY=( $(compgen -d -- "\${cur}") )
            return 0
            ;;
        *)
            ;;
    esac

    # Default: show options and commands
    if [[ "\${cur}" == -* ]]; then
        COMPREPLY=( $(compgen -W "\${opts}" -- "\${cur}") )
    else
        COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    fi
}

complete -F _cadence_completions cadence
`;
}

/**
 * Generate zsh completion script.
 */
function generateZshCompletions(): string {
  return `#compdef cadence
# Cadence zsh completion
# Add to ~/.zsh/completions/_cadence or /usr/local/share/zsh/site-functions/_cadence

_cadence() {
    local -a commands
    local -a global_opts

    global_opts=(
        '--help[Show help information]'
        '--version[Show version number]'
        '--vault[Path to the vault]:vault path:_directories'
        '--verbose[Enable verbose debug output]'
    )

    commands=(
        'init:Initialize a vault with Cadence configuration'
        'daily:Create or get today'"'"'s daily note'
        'weekly:Create or get this week'"'"'s weekly note'
        'monthly:Create or get this month'"'"'s monthly note'
        'quarterly:Create or get this quarter'"'"'s quarterly note'
        'yearly:Create or get this year'"'"'s yearly note'
        'open:Open a periodic note in the default editor'
        'list:List notes of a specific type'
        'templates:Manage templates'
        'new:Create a new note from a template'
        'tasks:Manage and view tasks from periodic notes'
        'context:Output formatted context from recent notes'
        'search:Search for notes in the vault'
        'completions:Generate shell completion scripts'
        'doctor:Check vault health and configuration'
    )

    _arguments -C \
        $global_opts \
        '1: :->command' \
        '*:: :->args'

    case $state in
        command)
            _describe -t commands 'cadence commands' commands
            ;;
        args)
            case $words[1] in
                init)
                    _arguments \
                        '--force[Overwrite existing configuration]' \
                        '--dry-run[Show what would be created without making changes]' \
                        '--help[Show help information]'
                    ;;
                daily|weekly|monthly|quarterly|yearly)
                    _arguments \
                        '--date[Specify a date]:date:' \
                        '--help[Show help information]'
                    ;;
                open)
                    _arguments \
                        '1:note type:(daily weekly monthly quarterly yearly)' \
                        '--date[Specify a date]:date:' \
                        '--help[Show help information]'
                    ;;
                list)
                    _arguments \
                        '1:note type:(daily weekly monthly quarterly yearly)' \
                        '--range[Date range]:range:' \
                        '--json[Output as JSON]' \
                        '--help[Show help information]'
                    ;;
                templates)
                    local -a template_cmds
                    template_cmds=(
                        'list:List all available templates'
                        'show:Show template details'
                    )
                    _arguments \
                        '1: :->subcmd' \
                        '*:: :->args'
                    case $state in
                        subcmd)
                            _describe -t commands 'template commands' template_cmds
                            ;;
                    esac
                    ;;
                new)
                    _arguments \
                        '1:template name:' \
                        '--title[Title for the new note]:title:' \
                        '--date[Note date]:date:' \
                        '--output[Custom output path]:path:_files' \
                        '*--var[Template variable (key=value)]:variable:' \
                        '--open[Open in editor after creation]' \
                        '--help[Show help information]'
                    ;;
                tasks)
                    local -a task_cmds
                    task_cmds=(
                        'rollover:Roll over incomplete tasks'
                        'toggle:Toggle task completion status'
                        'add:Add a new task'
                    )
                    _arguments \
                        '1: :->subcmd' \
                        '--days[Number of days to look back]:days:' \
                        '--overdue[Show only overdue tasks]' \
                        '--stale[Show only stale tasks]' \
                        '--priority[Filter by priority]:priority:(high medium low)' \
                        '--tag[Filter by tag]:tag:' \
                        '--flat[Show flat list instead of grouped]' \
                        '--json[Output as JSON]' \
                        '--help[Show help information]'
                    case $state in
                        subcmd)
                            _describe -t commands 'task commands' task_cmds
                            ;;
                    esac
                    ;;
                context)
                    _arguments \
                        '--days[Number of daily notes to include]:days:' \
                        '--no-tasks[Exclude tasks from context]' \
                        '--no-weekly[Exclude weekly note]' \
                        '--no-monthly[Exclude monthly note]' \
                        '--quarterly[Include quarterly note]' \
                        '--json[Output as JSON]' \
                        '--help[Show help information]'
                    ;;
                search)
                    _arguments \
                        '1:query:' \
                        '--content[Search within note contents]:query:' \
                        '--frontmatter[Search by frontmatter field]:field\\:value:' \
                        '--json[Output as JSON]' \
                        '--limit[Maximum number of results]:number:' \
                        '--path[Limit search to path prefix]:path:_files' \
                        '--help[Show help information]'
                    ;;
                completions)
                    _arguments \
                        '1:shell:(bash zsh fish)' \
                        '--help[Show help information]'
                    ;;
                doctor)
                    _arguments \
                        '--json[Output as JSON]' \
                        '--help[Show help information]'
                    ;;
            esac
            ;;
    esac
}

_cadence
`;
}

/**
 * Generate fish completion script.
 */
function generateFishCompletions(): string {
  return `# Cadence fish completion
# Add to ~/.config/fish/completions/cadence.fish

# Disable file completion by default
complete -c cadence -f

# Global options
complete -c cadence -l help -d 'Show help information'
complete -c cadence -l version -d 'Show version number'
complete -c cadence -l vault -d 'Path to the vault' -r -F
complete -c cadence -l verbose -d 'Enable verbose debug output'

# Commands
complete -c cadence -n '__fish_use_subcommand' -a init -d 'Initialize a vault with Cadence configuration'
complete -c cadence -n '__fish_use_subcommand' -a daily -d 'Create or get today'"'"'s daily note'
complete -c cadence -n '__fish_use_subcommand' -a weekly -d 'Create or get this week'"'"'s weekly note'
complete -c cadence -n '__fish_use_subcommand' -a monthly -d 'Create or get this month'"'"'s monthly note'
complete -c cadence -n '__fish_use_subcommand' -a quarterly -d 'Create or get this quarter'"'"'s quarterly note'
complete -c cadence -n '__fish_use_subcommand' -a yearly -d 'Create or get this year'"'"'s yearly note'
complete -c cadence -n '__fish_use_subcommand' -a open -d 'Open a periodic note in the default editor'
complete -c cadence -n '__fish_use_subcommand' -a list -d 'List notes of a specific type'
complete -c cadence -n '__fish_use_subcommand' -a templates -d 'Manage templates'
complete -c cadence -n '__fish_use_subcommand' -a new -d 'Create a new note from a template'
complete -c cadence -n '__fish_use_subcommand' -a tasks -d 'Manage and view tasks from periodic notes'
complete -c cadence -n '__fish_use_subcommand' -a context -d 'Output formatted context from recent notes'
complete -c cadence -n '__fish_use_subcommand' -a search -d 'Search for notes in the vault'
complete -c cadence -n '__fish_use_subcommand' -a completions -d 'Generate shell completion scripts'
complete -c cadence -n '__fish_use_subcommand' -a doctor -d 'Check vault health and configuration'

# init command
complete -c cadence -n '__fish_seen_subcommand_from init' -l force -d 'Overwrite existing configuration'
complete -c cadence -n '__fish_seen_subcommand_from init' -l dry-run -d 'Show what would be created without making changes'

# Periodic note commands (daily, weekly, monthly, quarterly, yearly)
complete -c cadence -n '__fish_seen_subcommand_from daily weekly monthly quarterly yearly' -l date -d 'Specify a date' -r

# open command
complete -c cadence -n '__fish_seen_subcommand_from open' -a 'daily weekly monthly quarterly yearly' -d 'Note type'
complete -c cadence -n '__fish_seen_subcommand_from open' -l date -d 'Specify a date' -r

# list command
complete -c cadence -n '__fish_seen_subcommand_from list' -a 'daily weekly monthly quarterly yearly' -d 'Note type'
complete -c cadence -n '__fish_seen_subcommand_from list' -l range -d 'Date range' -r
complete -c cadence -n '__fish_seen_subcommand_from list' -l json -d 'Output as JSON'

# templates command
complete -c cadence -n '__fish_seen_subcommand_from templates' -a 'list show' -d 'Template subcommand'

# new command
complete -c cadence -n '__fish_seen_subcommand_from new' -l title -d 'Title for the new note' -r
complete -c cadence -n '__fish_seen_subcommand_from new' -l date -d 'Note date' -r
complete -c cadence -n '__fish_seen_subcommand_from new' -l output -d 'Custom output path' -r -F
complete -c cadence -n '__fish_seen_subcommand_from new' -l var -d 'Template variable (key=value)' -r
complete -c cadence -n '__fish_seen_subcommand_from new' -l open -d 'Open in editor after creation'

# tasks command
complete -c cadence -n '__fish_seen_subcommand_from tasks' -a 'rollover toggle add' -d 'Task subcommand'
complete -c cadence -n '__fish_seen_subcommand_from tasks' -l days -d 'Number of days to look back' -r
complete -c cadence -n '__fish_seen_subcommand_from tasks' -l overdue -d 'Show only overdue tasks'
complete -c cadence -n '__fish_seen_subcommand_from tasks' -l stale -d 'Show only stale tasks'
complete -c cadence -n '__fish_seen_subcommand_from tasks' -l priority -d 'Filter by priority' -r -a 'high medium low'
complete -c cadence -n '__fish_seen_subcommand_from tasks' -l tag -d 'Filter by tag' -r
complete -c cadence -n '__fish_seen_subcommand_from tasks' -l flat -d 'Show flat list instead of grouped'
complete -c cadence -n '__fish_seen_subcommand_from tasks' -l json -d 'Output as JSON'

# tasks rollover subcommand
complete -c cadence -n '__fish_seen_subcommand_from rollover' -l dry-run -d 'Show what would be rolled over without making changes'
complete -c cadence -n '__fish_seen_subcommand_from rollover' -l days -d 'Number of days to scan back for tasks' -r

# tasks add subcommand
complete -c cadence -n '__fish_seen_subcommand_from add' -l due -d 'Due date' -r
complete -c cadence -n '__fish_seen_subcommand_from add' -l priority -d 'Priority level' -r -a 'high medium low'
complete -c cadence -n '__fish_seen_subcommand_from add' -l tag -d 'Comma-separated tags' -r

# context command
complete -c cadence -n '__fish_seen_subcommand_from context' -l days -d 'Number of daily notes to include' -r
complete -c cadence -n '__fish_seen_subcommand_from context' -l no-tasks -d 'Exclude tasks from context'
complete -c cadence -n '__fish_seen_subcommand_from context' -l no-weekly -d 'Exclude weekly note'
complete -c cadence -n '__fish_seen_subcommand_from context' -l no-monthly -d 'Exclude monthly note'
complete -c cadence -n '__fish_seen_subcommand_from context' -l quarterly -d 'Include quarterly note'
complete -c cadence -n '__fish_seen_subcommand_from context' -l json -d 'Output as JSON'

# search command
complete -c cadence -n '__fish_seen_subcommand_from search' -l content -d 'Search within note contents' -r
complete -c cadence -n '__fish_seen_subcommand_from search' -l frontmatter -d 'Search by frontmatter field' -r
complete -c cadence -n '__fish_seen_subcommand_from search' -l json -d 'Output as JSON'
complete -c cadence -n '__fish_seen_subcommand_from search' -l limit -d 'Maximum number of results' -r
complete -c cadence -n '__fish_seen_subcommand_from search' -l path -d 'Limit search to path prefix' -r -F

# completions command
complete -c cadence -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish' -d 'Shell type'

# doctor command
complete -c cadence -n '__fish_seen_subcommand_from doctor' -l json -d 'Output as JSON'
`;
}

export const completionsCommand = new Command("completions")
  .description("Generate shell completion scripts")
  .argument("<shell>", "Shell type (bash, zsh, fish)")
  .action(async function (shell: string) {
    const shellLower = shell.toLowerCase();

    switch (shellLower) {
      case "bash":
        console.log(generateBashCompletions());
        break;
      case "zsh":
        console.log(generateZshCompletions());
        break;
      case "fish":
        console.log(generateFishCompletions());
        break;
      default:
        console.error(
          `Unknown shell: ${shell}. Supported shells: bash, zsh, fish`
        );
        process.exit(1);
    }
  })
  .addHelpText(
    "after",
    `
Examples:
  $ cadence completions bash > ~/.bash_completion.d/cadence
  $ cadence completions zsh > ~/.zsh/completions/_cadence
  $ cadence completions fish > ~/.config/fish/completions/cadence.fish

After generating completions, restart your shell or source the completion file.
`
  );
