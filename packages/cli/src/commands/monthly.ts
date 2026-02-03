import { Command } from "commander";
import { DateParser } from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";

export const monthlyCommand = new Command("monthly")
  .description("Create or get this month's note")
  .option("--date <date>", "Specify a date (e.g., 'last month', '2024-01')")
  .action(async function (this: Command, options: { date?: string }) {
    try {
      const { noteService } = await getVaultContext(this);
      const dateParser = new DateParser();

      // Parse the date if provided, otherwise use today
      const targetDate = options.date
        ? dateParser.parseForType(options.date, "monthly")
        : new Date();

      // Ensure the note exists and get the path
      const notePath = await noteService.ensureNote("monthly", targetDate);

      // Output just the path for piping/scripting
      console.log(notePath);
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });
