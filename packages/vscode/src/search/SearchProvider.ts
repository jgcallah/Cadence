import * as vscode from "vscode";
import type { ContentMatch } from "@cadence/core";

/**
 * Tree item representing a search result.
 */
export class SearchResultItem extends vscode.TreeItem {
  public readonly match: ContentMatch | undefined;
  public readonly filePath: string | undefined;
  public readonly isFile: boolean;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    options?: {
      match?: ContentMatch;
      filePath?: string;
      description?: string;
      isFile?: boolean;
    }
  ) {
    super(label, collapsibleState);
    this.match = options?.match;
    this.filePath = options?.filePath;
    this.isFile = options?.isFile ?? false;

    if (options?.description) {
      this.description = options.description;
    }

    if (this.isFile) {
      this.iconPath = new vscode.ThemeIcon("file");
    } else if (this.match) {
      this.iconPath = new vscode.ThemeIcon("search");

      // Set command to open file at line on click
      this.command = {
        command: "cadence.openSearchResult",
        title: "Open Search Result",
        arguments: [this.match],
      };
    }
  }
}

/**
 * Search result grouped by file.
 */
interface FileSearchResult {
  filePath: string;
  fileName: string;
  matches: ContentMatch[];
}

/**
 * Tree data provider for vault search results.
 * Shows search results grouped by file with ability to navigate to line.
 */
export class SearchTreeProvider implements vscode.TreeDataProvider<SearchResultItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SearchResultItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private results: ContentMatch[] = [];
  private searchQuery = "";
  private vaultPath = "";

  /**
   * Set the vault path for resolving full file paths.
   */
  setVaultPath(vaultPath: string): void {
    this.vaultPath = vaultPath;
  }

  /**
   * Update search results.
   */
  setResults(query: string, results: ContentMatch[]): void {
    this.searchQuery = query;
    this.results = results;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Clear search results.
   */
  clear(): void {
    this.searchQuery = "";
    this.results = [];
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get the current search query.
   */
  getSearchQuery(): string {
    return this.searchQuery;
  }

  getTreeItem(element: SearchResultItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SearchResultItem): SearchResultItem[] {
    // Show placeholder if no results
    if (this.results.length === 0) {
      if (!this.searchQuery) {
        return [
          new SearchResultItem(
            "Enter a search query above",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }
      return [
        new SearchResultItem(
          `No results for "${this.searchQuery}"`,
          vscode.TreeItemCollapsibleState.None
        ),
      ];
    }

    // Root level - show file groups
    if (!element) {
      return this.getFileGroups();
    }

    // File level - show matches
    if (element.isFile && element.filePath) {
      return this.getMatchesForFile(element.filePath);
    }

    return [];
  }

  private getFileGroups(): SearchResultItem[] {
    // Group results by file
    const grouped = new Map<string, FileSearchResult>();

    for (const match of this.results) {
      if (!grouped.has(match.path)) {
        grouped.set(match.path, {
          filePath: match.path,
          fileName: this.getFileName(match.path),
          matches: [],
        });
      }
      grouped.get(match.path)!.matches.push(match);
    }

    // Convert to tree items
    return Array.from(grouped.values()).map((group) => {
      const item = new SearchResultItem(
        group.fileName,
        vscode.TreeItemCollapsibleState.Expanded,
        {
          filePath: group.filePath,
          description: `(${group.matches.length} match${group.matches.length === 1 ? "" : "es"})`,
          isFile: true,
        }
      );
      item.contextValue = "searchFile";
      return item;
    });
  }

  private getMatchesForFile(filePath: string): SearchResultItem[] {
    const matches = this.results.filter((m) => m.path === filePath);

    return matches.map((match) => {
      const item = new SearchResultItem(
        match.content.trim().slice(0, 80) + (match.content.trim().length > 80 ? "..." : ""),
        vscode.TreeItemCollapsibleState.None,
        {
          match: {
            ...match,
            // Convert relative path to absolute for opening
            path: this.vaultPath ? `${this.vaultPath}/${match.path}` : match.path,
          },
          description: `Line ${match.line}`,
        }
      );
      item.contextValue = "searchMatch";
      return item;
    });
  }

  private getFileName(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
  }
}
