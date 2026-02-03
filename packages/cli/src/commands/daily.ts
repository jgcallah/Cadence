import { Command } from "commander";
import { DateParser } from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";

export const dailyCommand = new Command("daily")
  .description("Create or get today's daily note")
  .option("--date <date>", "Specify a date (e.g., 'yesterday', '2024-01-15')")
  .action(async function (this: Command, options: { date?: string }) {
    try {
      const { noteService } = await getVaultContext(this);
      const dateParser = new DateParser();

      // Parse the date if provided, otherwise use today
      const targetDate = options.date ? dateParser.parse(options.date) : new Date();

      // Ensure the note exists and get the path
      const notePath = await noteService.ensureNote("daily", targetDate);

      // Output just the path for piping/scripting
      console.log(notePath);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
