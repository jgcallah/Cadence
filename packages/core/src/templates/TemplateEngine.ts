import Handlebars from "handlebars";
import {
  format,
  addDays,
  subDays,
  getWeek,
  getQuarter,
  parseISO,
} from "date-fns";
import { TemplateRenderError } from "../errors/index.js";

/**
 * Template engine that uses Handlebars in strict mode.
 * Throws errors for missing variables instead of silently producing empty strings.
 * Provides built-in template variables and custom helpers for Obsidian-style templates.
 */
export class TemplateEngine {
  private handlebars: typeof Handlebars;

  constructor() {
    // Create an isolated Handlebars instance
    this.handlebars = Handlebars.create();

    // Register custom helpers
    this.registerHelpers();
  }

  /**
   * Renders a template string with the provided variables.
   * Uses strict mode - throws TemplateRenderError for missing variables.
   *
   * @param template - The Handlebars template string
   * @param variables - Variables to substitute into the template
   * @returns The rendered template string
   * @throws TemplateRenderError if variables are missing or template is invalid
   */
  render(template: string, variables: Record<string, unknown>): string {
    // Merge built-in variables with user-provided variables
    // User variables take precedence
    const mergedVariables = {
      ...this.getBuiltInVariables(),
      ...variables,
    };

    try {
      // Compile the template with strict mode enabled
      const compiledTemplate = this.handlebars.compile(template, {
        strict: true,
      });

      // Render the template
      return compiledTemplate(mergedVariables);
    } catch (error) {
      // Handle Handlebars errors
      if (error instanceof Error) {
        // Try to extract missing variable names from the error message
        const missingVariables = this.extractMissingVariables(error.message);

        throw new TemplateRenderError("inline", error.message, {
          missingVariables,
          cause: error,
        });
      }

      // Re-throw unknown errors wrapped in TemplateRenderError
      throw new TemplateRenderError("inline", String(error));
    }
  }

  /**
   * Extracts missing variable names from Handlebars error messages.
   */
  private extractMissingVariables(errorMessage: string): string[] {
    const variables: string[] = [];

    // Handlebars strict mode error format: '"variableName" not defined in ...'
    const regex = /"([^"]+)" not defined/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(errorMessage)) !== null) {
      if (match[1] !== undefined) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Returns built-in template variables based on the current date/time.
   */
  private getBuiltInVariables(): Record<string, string> {
    const now = new Date();
    const yesterday = subDays(now, 1);
    const tomorrow = addDays(now, 1);

    return {
      date: format(now, "yyyy-MM-dd"),
      time: format(now, "HH:mm"),
      weekNum: String(getWeek(now)),
      yesterday: `[[${format(yesterday, "yyyy-MM-dd")}]]`,
      tomorrow: `[[${format(tomorrow, "yyyy-MM-dd")}]]`,
      year: format(now, "yyyy"),
      month: format(now, "MM"),
      quarter: `Q${getQuarter(now)}`,
    };
  }

  /**
   * Registers custom Handlebars helpers.
   */
  private registerHelpers(): void {
    // wikilink helper - generates [[name]]
    this.handlebars.registerHelper(
      "wikilink",
      function (name: string): Handlebars.SafeString {
        if (typeof name !== "string") {
          return new Handlebars.SafeString(`[[${String(name)}]]`);
        }
        return new Handlebars.SafeString(`[[${name}]]`);
      }
    );

    // formatDate helper - formats a date with a given format string
    this.handlebars.registerHelper(
      "formatDate",
      function (
        date: Date | string | number,
        formatStr: string
      ): Handlebars.SafeString {
        let dateObj: Date;

        if (date instanceof Date) {
          dateObj = date;
        } else if (typeof date === "string") {
          // Try to parse ISO date string
          dateObj = parseISO(date);
        } else if (typeof date === "number") {
          dateObj = new Date(date);
        } else {
          const _exhaustiveCheck: never = date;
          throw new Error(`Invalid date value: ${String(_exhaustiveCheck)}`);
        }

        // Check for invalid date
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Invalid date: ${String(date)}`);
        }

        const formatted = format(dateObj, formatStr);
        return new Handlebars.SafeString(formatted);
      }
    );
  }
}
