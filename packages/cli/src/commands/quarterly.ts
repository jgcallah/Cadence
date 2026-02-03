import { Command } from "commander";
import { DateParser } from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";

export const quarterlyCommand = new Command("quarterly")
  .description("Create or get this quarter's note")
  .option("--date <date>", "Specify a date (e.g., 'last quarter', 'Q1 2024')")
  .action(async function (this: Command, options: { date?: string }) {
    try {
      const { noteService } = await getVaultContext(this);
      const dateParser = new DateParser();

      // Parse the date if provided, otherwise use today
      const targetDate = options.date
        ? dateParser.parseForType(options.date, "quarterly")
        : new Date();

      // Ensure the note exists and get the path
      const notePath = await noteService.ensureNote("quarterly", targetDate);

      // Output just the path for piping/scripting
      console.log(notePath);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
