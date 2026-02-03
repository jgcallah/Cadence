#!/usr/bin/env node
import { Command, Option } from "commander";
import { VERSION } from "@cadence/core";
import { initCommand } from "./commands/init.js";
import { dailyCommand } from "./commands/daily.js";
import { weeklyCommand } from "./commands/weekly.js";
import { monthlyCommand } from "./commands/monthly.js";
import { quarterlyCommand } from "./commands/quarterly.js";
import { yearlyCommand } from "./commands/yearly.js";
import { openCommand } from "./commands/open.js";
import { listCommand } from "./commands/list.js";
import { templatesCommand } from "./commands/templates.js";
import { newCommand } from "./commands/new.js";
import { tasksCommand } from "./commands/tasks.js";
import { contextCommand } from "./commands/context.js";
import { searchCommand } from "./commands/search.js";
import { completionsCommand } from "./commands/completions.js";
import { doctorCommand } from "./commands/doctor.js";
import { handleError } from "./utils/error-handler.js";
import { setVerbose, logger } from "./utils/logger.js";

// Package versions - keep in sync with package.json versions
const PACKAGE_VERSIONS = {
  "@cadence/cli": VERSION,
  "@cadence/core": VERSION,
};

const program = new Command();

/**
 * Custom version output showing all package versions.
 */
function showVersion(): void {
  console.log(`cadence ${VERSION}`);
  console.log();
  console.log("Package versions:");
  for (const [pkg, ver] of Object.entries(PACKAGE_VERSIONS)) {
    console.log(`  ${pkg}: ${ver}`);
  }
  console.log();
  console.log(`Node.js: ${process.version}`);
  console.log(`Platform: ${process.platform} (${process.arch})`);
}

program
  .name("cadence")
  .description("CLI for managing periodic notes with Cadence")
  .version(VERSION, "-V, --version", "Show version information")
  .option("--vault <path>", "Path to the vault")
  .option("--verbose", "Enable verbose debug output")
  .addOption(
    new Option("--version-all", "Show detailed version information").hideHelp()
  )
  .on("option:version-all", () => {
    showVersion();
    process.exit(0);
  })
  .on("option:version", function () {
    // Override the default version handler
    showVersion();
    process.exit(0);
  })
  .configureOutput({
    outputError: (str, write) => { write(str); },
  })
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts["verbose"]) {
      setVerbose(true);
      logger.debug(`Cadence CLI v${VERSION}`);
      logger.debug(`Node.js ${process.version}`);
      logger.debug(`Platform: ${process.platform}`);
      if (opts["vault"]) {
        logger.debug(`Vault option: ${opts["vault"]}`);
      }
    }
  })
  .addHelpText("after", `
Examples:
  $ cadence init                          Initialize a vault
  $ cadence daily                         Create/get today's daily note
  $ cadence daily --date yesterday        Get yesterday's daily note
  $ cadence weekly                        Create/get this week's note
  $ cadence weekly --date "last week"     Get last week's note
  $ cadence weekly --date 2024-W05        Get week 5 of 2024
  $ cadence monthly                       Create/get this month's note
  $ cadence monthly --date 2024-01        Get January 2024 note
  $ cadence quarterly                     Create/get this quarter's note
  $ cadence quarterly --date "Q1 2024"    Get Q1 2024 note
  $ cadence yearly                        Create/get this year's note
  $ cadence yearly --date 2024            Get 2024 yearly note
  $ cadence open daily                    Open today's daily note in editor
  $ cadence list daily --range "last 7 days"   List recent daily notes
  $ cadence list monthly --range "last 3 months"   List recent monthly notes
  $ cadence templates list                     List available templates
  $ cadence templates show <name>              Show template details
  $ cadence new <template>                     Create note from template
  $ cadence new meeting --title "Sprint Planning"  Create with title
  $ cadence new meeting --var key=value        Create with custom variables
  $ cadence tasks                             List open tasks from last 7 days
  $ cadence tasks --days 14 --overdue         Show overdue tasks from last 14 days
  $ cadence tasks --priority high             Show high priority tasks
  $ cadence tasks --tag project               Show tasks with #project tag
  $ cadence tasks rollover                    Roll over incomplete tasks to today
  $ cadence tasks rollover --dry-run          Preview rollover without changes
  $ cadence tasks toggle 'daily/2024/01/15.md:42'  Toggle task completion
  $ cadence tasks add 'Review PR' --due tomorrow   Add new task to today's note
  $ cadence context                           Output context from recent notes
  $ cadence context --days 5 --no-tasks       Context with 5 days, no tasks
  $ cadence context | clip                    Copy context to clipboard
  $ cadence search meeting                    Fuzzy search for files
  $ cadence search --content "TODO"           Search content for text
  $ cadence search --frontmatter status:active   Search by frontmatter field
  $ cadence search --json --limit 10          JSON output with limit
  $ cadence doctor                            Check vault health and config
  $ cadence completions bash                  Generate bash completions
  $ cadence completions zsh                   Generate zsh completions
  $ cadence completions fish                  Generate fish completions

Global options:
  --verbose                                   Enable verbose debug output
  --vault <path>                              Specify vault path
`);

// Register commands
program.addCommand(initCommand);
program.addCommand(dailyCommand);
program.addCommand(weeklyCommand);
program.addCommand(monthlyCommand);
program.addCommand(quarterlyCommand);
program.addCommand(yearlyCommand);
program.addCommand(openCommand);
program.addCommand(listCommand);
program.addCommand(templatesCommand);
program.addCommand(newCommand);
program.addCommand(tasksCommand);
program.addCommand(contextCommand);
program.addCommand(searchCommand);
program.addCommand(completionsCommand);
program.addCommand(doctorCommand);

// Parse and execute
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

void main();
