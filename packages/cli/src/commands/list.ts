import { Command } from "commander";
import { DateParser, type NoteType } from "@cadence/core";
import { handleError } from "../utils/error-handler.js";
import { getVaultContext } from "../utils/vault.js";
import { parseRange, getNotesInRange } from "../utils/date-range.js";

const validTypes = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;

export const listCommand = new Command("list")
  .description("List notes of a specific type")
  .argument("<type>", `Type of note (${validTypes.join(", ")})`)
  .option("--range <range>", "Date range (e.g., 'last 3 months', 'last week')")
  .option("--json", "Output as JSON")
  .action(async function (
    this: Command,
    type: string,
    options: { range?: string; json?: boolean }
  ) {
    try {
      // Validate the note type
      if (!validTypes.includes(type as NoteType)) {
        throw new Error(
          `Invalid note type: '${type}'. Valid types are: ${validTypes.join(", ")}`
        );
      }

      const noteType = type as NoteType;
      const { vaultPath, noteService } = await getVaultContext(this);
      const dateParser = new DateParser();

      // Parse the range or use a default based on note type
      const { start, end } = options.range
        ? parseRange(options.range, noteType, dateParser)
        : getDefaultRange(noteType);

      // Get all dates in the range for this note type
      const dates = getNotesInRange(noteType, start, end);

      // Check which notes exist and collect results
      const notes: { path: string; relativePath: string; date: string }[] = [];
      for (const date of dates) {
        const exists = await noteService.noteExists(noteType, date);
        if (exists) {
          const notePath = await noteService.ensureNote(noteType, date);
          const relativePath = notePath.startsWith(vaultPath)
            ? notePath.slice(vaultPath.length + 1).replace(/\\/g, "/")
            : notePath;
          const dateStr = date.toISOString().split("T")[0] ?? "";
          notes.push({
            path: notePath,
            relativePath,
            date: dateStr,
          });
        }
      }

      // Output results
      if (options.json) {
        console.log(JSON.stringify({ type: noteType, notes }, null, 2));
      } else {
        for (const note of notes) {
          console.log(note.path);
        }
      }
    } catch (error) {
      handleError(error);
      process.exit(1);
    }
  });

/**
 * Get default range based on note type.
 */
function getDefaultRange(type: NoteType): { start: Date; end: Date } {
  const now = new Date();
  const end = now;

  switch (type) {
    case "daily":
      // Default: last 30 days
      return {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30),
        end,
      };
    case "weekly":
      // Default: last 12 weeks
      return {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 84),
        end,
      };
    case "monthly":
      // Default: last 12 months
      return {
        start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
        end,
      };
    case "quarterly":
      // Default: last 4 quarters
      return {
        start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
        end,
      };
    case "yearly":
      // Default: last 5 years
      return {
        start: new Date(now.getFullYear() - 5, 0, 1),
        end,
      };
  }
}
