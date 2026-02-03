/**
 * Types of periodic notes supported by Cadence.
 */
export type NoteType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

/**
 * Represents a parsed note with its content and metadata.
 */
export interface Note {
  /** The full path to the note file */
  path: string;
  /** The raw content of the note file */
  content: string;
  /** The parsed frontmatter as a key-value object */
  frontmatter: Record<string, unknown>;
  /** The body content of the note (everything after the frontmatter) */
  body: string;
}

/**
 * The path to a note file (type alias for clarity).
 */
export type NotePath = string;

/**
 * Information about a time period for a specific note type.
 */
export interface PeriodInfo {
  /** The start date of the period (inclusive) */
  start: Date;
  /** The end date of the period (inclusive) */
  end: Date;
  /** A human-readable label for the period (e.g., "Week 11, 2026", "Q1 2026") */
  label: string;
}

/**
 * Links to related notes in the hierarchy.
 */
export interface NoteLinks {
  /** Link to the parent note (e.g., weekly for daily, monthly for weekly) */
  parentNote: string | null;
  /** Links to child notes (e.g., daily notes for a weekly note) */
  childNotes: string[];
}
