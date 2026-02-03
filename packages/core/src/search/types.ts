import type { Note, NoteType } from "../notes/types.js";

/**
 * Options for filtering search results.
 */
export interface SearchOptions {
  /** Limit results to notes under this path prefix */
  path?: string;
  /** Limit results to a specific note type */
  noteType?: NoteType;
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * A search result from fuzzy file search.
 */
export interface SearchResult {
  /** The file path relative to vault root */
  path: string;
  /** The fuzzy match score (lower is better match) */
  score: number;
}

/**
 * A content match from searching within file contents.
 */
export interface ContentMatch {
  /** The file path relative to vault root */
  path: string;
  /** The 1-indexed line number where the match was found */
  line: number;
  /** The matched line content (trimmed) */
  content: string;
  /** Surrounding lines for context (before and after) */
  context: string[];
}

/**
 * Re-export Note for frontmatter search results.
 */
export type { Note };
