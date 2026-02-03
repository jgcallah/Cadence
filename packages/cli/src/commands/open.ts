import { Command } from "commander";
import { exec } from "child_process";
import { promisify } from "util";
import { DateParser } from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";

const execAsync = promisify(exec);

/**
 * Get the platform-specific command to open a file in the default editor/application
 */
function getOpenCommand(filePath: string): string {
  const quotedPath = `"${filePath}"`;

  switch (process.platform) {
    case "darwin":
      return `open ${quotedPath}`;
    case "win32":
      return `start "" ${quotedPath}`;
    case "linux":
    default:
      return `xdg-open ${quotedPath}`;
  }
}

export const openCommand = new Command("open")
  .description("Open a note in the default editor")
  .argument("<type>", "Type of note to open (e.g., 'daily')")
  .option("--date <date>", "Specify a date (e.g., 'yesterday', '2024-01-15')")
  .action(async function (
    this: Command,
    type: string,
    options: { date?: string }
  ) {
    try {
      // Validate the note type
      const validTypes = ["daily", "weekly", "monthly", "quarterly", "yearly"];
      if (!validTypes.includes(type)) {
        throw new Error(
          `Invalid note type: '${type}'. Valid types are: ${validTypes.join(", ")}`
        );
      }

      const { noteService } = await getVaultContext(this);
      const dateParser = new DateParser();

      // Parse the date if provided, otherwise use today
      const targetDate = options.date
        ? dateParser.parse(options.date)
        : new Date();

      // Ensure the note exists and get the path
      const notePath = await noteService.ensureNote(
        type as "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
        targetDate
      );

      // Open the file in the default application
      const openCmd = getOpenCommand(notePath);
      await execAsync(openCmd);

      // Output the path
      console.log(notePath);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
