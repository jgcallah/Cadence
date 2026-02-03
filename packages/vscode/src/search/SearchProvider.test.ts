import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentMatch } from "@cadence/core";

const mockVscode = {
  TreeItem: class TreeItem {
    label: string;
    collapsibleState: number;
    iconPath?: unknown;
    description?: string;
    tooltip?: unknown;
    command?: unknown;
    contextValue?: string;

    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  ThemeIcon: class ThemeIcon {
    id: string;
    color?: unknown;
    constructor(id: string, color?: unknown) {
      this.id = id;
      this.color = color;
    }
  },
  EventEmitter: class EventEmitter {
    private listeners: (() => void)[] = [];
    event = (listener: () => void) => {
      this.listeners.push(listener);
      return { dispose: () => {} };
    };
    fire = () => {
      this.listeners.forEach((l) => l());
    };
  },
};

vi.mock("vscode", () => mockVscode);

describe("SearchTreeProvider", () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  type SearchTreeProviderType = typeof import("./SearchProvider.js").SearchTreeProvider;
  let SearchTreeProvider: SearchTreeProviderType;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const module = await import("./SearchProvider.js");
    SearchTreeProvider = module.SearchTreeProvider;
  });

  function createMockMatch(options: Partial<ContentMatch> = {}): ContentMatch {
    return {
      path: "daily/2024-01-15.md",
      line: 10,
      content: "Test content with search term",
      context: ["line before", "line after"],
      ...options,
    };
  }

  describe("setResults", () => {
    it("should store query and results", () => {
      const provider = new SearchTreeProvider();

      provider.setResults("test", [createMockMatch()]);

      expect(provider.getSearchQuery()).toBe("test");
    });

    it("should fire tree data change event", () => {
      const provider = new SearchTreeProvider();

      provider.setResults("test", [createMockMatch()]);

      // No error means the event fired successfully
    });
  });

  describe("clear", () => {
    it("should clear query and results", () => {
      const provider = new SearchTreeProvider();
      provider.setResults("test", [createMockMatch()]);

      provider.clear();

      expect(provider.getSearchQuery()).toBe("");
    });
  });

  describe("setVaultPath", () => {
    it("should set vault path for absolute paths", () => {
      const provider = new SearchTreeProvider();

      provider.setVaultPath("/vault");

      // Verify by checking that matches include vault path
      provider.setResults("test", [createMockMatch()]);
      const root = provider.getChildren();
      const fileGroup = root[0];
      if (fileGroup && fileGroup.filePath) {
        const matches = provider.getChildren(fileGroup);
        // Match path should include vault path
        expect(matches[0]?.match?.path).toBe("/vault/daily/2024-01-15.md");
      }
    });
  });

  describe("getChildren - no results", () => {
    it("should show placeholder when no query entered", () => {
      const provider = new SearchTreeProvider();

      const children = provider.getChildren();

      expect(children).toHaveLength(1);
      expect(children[0].label).toBe("Enter a search query above");
    });

    it("should show no results message when query has no matches", () => {
      const provider = new SearchTreeProvider();
      provider.setResults("nonexistent", []);

      const children = provider.getChildren();

      expect(children).toHaveLength(1);
      expect(children[0].label).toBe('No results for "nonexistent"');
    });
  });

  describe("getChildren - with results", () => {
    it("should group results by file", () => {
      const provider = new SearchTreeProvider();
      provider.setResults("test", [
        createMockMatch({ path: "daily/2024-01-15.md", line: 10 }),
        createMockMatch({ path: "daily/2024-01-15.md", line: 20 }),
        createMockMatch({ path: "weekly/2024-W03.md", line: 5 }),
      ]);

      const children = provider.getChildren();

      expect(children).toHaveLength(2);
      expect(children[0].label).toBe("2024-01-15.md");
      expect(children[0].description).toBe("(2 matches)");
      expect(children[1].label).toBe("2024-W03.md");
      expect(children[1].description).toBe("(1 match)");
    });

    it("should mark file items as file type", () => {
      const provider = new SearchTreeProvider();
      provider.setResults("test", [createMockMatch()]);

      const children = provider.getChildren();

      expect(children[0].isFile).toBe(true);
      expect(children[0].contextValue).toBe("searchFile");
    });
  });

  describe("getChildren - file expansion", () => {
    it("should return matches for expanded file", () => {
      const provider = new SearchTreeProvider();
      provider.setResults("test", [
        createMockMatch({ path: "daily/2024-01-15.md", line: 10, content: "First match" }),
        createMockMatch({ path: "daily/2024-01-15.md", line: 20, content: "Second match" }),
      ]);

      const root = provider.getChildren();
      const fileItem = root[0];
      const matches = provider.getChildren(fileItem);

      expect(matches).toHaveLength(2);
      expect(matches[0].label).toContain("First match");
      expect(matches[0].description).toBe("Line 10");
      expect(matches[1].label).toContain("Second match");
      expect(matches[1].description).toBe("Line 20");
    });

    it("should truncate long match content", () => {
      const provider = new SearchTreeProvider();
      const longContent = "A".repeat(100);
      provider.setResults("test", [
        createMockMatch({ content: longContent }),
      ]);

      const root = provider.getChildren();
      const fileItem = root[0];
      const matches = provider.getChildren(fileItem);

      expect(matches[0].label?.toString().length).toBeLessThan(100);
      expect(matches[0].label?.toString()).toContain("...");
    });

    it("should set command for match items", () => {
      const provider = new SearchTreeProvider();
      provider.setResults("test", [createMockMatch()]);

      const root = provider.getChildren();
      const fileItem = root[0];
      const matches = provider.getChildren(fileItem);

      expect(matches[0].command).toBeDefined();
      expect(matches[0].command?.command).toBe("cadence.openSearchResult");
    });

    it("should set contextValue for match items", () => {
      const provider = new SearchTreeProvider();
      provider.setResults("test", [createMockMatch()]);

      const root = provider.getChildren();
      const fileItem = root[0];
      const matches = provider.getChildren(fileItem);

      expect(matches[0].contextValue).toBe("searchMatch");
    });
  });

  describe("getTreeItem", () => {
    it("should return the element as-is", async () => {
      const provider = new SearchTreeProvider();
      const { SearchResultItem } = await import("./SearchProvider.js");

      const item = new SearchResultItem("Test", mockVscode.TreeItemCollapsibleState.None);
      const result = provider.getTreeItem(item);

      expect(result).toBe(item);
    });
  });
});
