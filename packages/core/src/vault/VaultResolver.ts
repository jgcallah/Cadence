import type { IFileSystem } from "../fs/types.js";
import { VaultNotFoundError } from "../errors/index.js";

/**
 * Options for resolving a vault path.
 */
export interface ResolveVaultOptions {
  /**
   * Explicit path to the vault. Takes highest priority.
   */
  explicit?: string;

  /**
   * Current working directory to start ancestor walk from.
   * Defaults to process.cwd() if not provided.
   */
  cwd?: string;
}

/**
 * Normalizes a path by removing trailing slashes.
 */
function normalizePath(path: string): string {
  // Remove trailing slash, except for root
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  if (path.length > 1 && path.endsWith("\\")) {
    return path.slice(0, -1);
  }
  return path;
}

/**
 * Gets the parent directory of a path.
 * Returns null if already at root.
 */
function getParentPath(path: string): string | null {
  // Normalize first
  const normalized = normalizePath(path);

  // Handle root cases
  if (normalized === "/" || normalized === "\\") {
    return null;
  }

  // Handle Windows drive roots like "C:"
  if (/^[A-Za-z]:$/.test(normalized)) {
    return null;
  }

  // Handle paths like "/C:"
  if (/^\/[A-Za-z]:$/.test(normalized)) {
    return null;
  }

  // Find the last separator
  const lastSlash = Math.max(
    normalized.lastIndexOf("/"),
    normalized.lastIndexOf("\\")
  );

  if (lastSlash === -1) {
    return null;
  }

  if (lastSlash === 0) {
    return "/";
  }

  return normalized.slice(0, lastSlash);
}

/**
 * Resolves vault locations using configurable strategies.
 * Can be instantiated with any IFileSystem implementation for testability.
 */
export class VaultResolver {
  private fs: IFileSystem;

  constructor(fs: IFileSystem) {
    this.fs = fs;
  }

  /**
   * Resolves the vault path using the following priority:
   * 1. Explicit path (if provided in options)
   * 2. CADENCE_VAULT_PATH environment variable
   * 3. Ancestor walk: Search up from cwd for .cadence/ folder
   *
   * @param options - Resolution options
   * @returns The resolved vault path
   * @throws VaultNotFoundError if no valid vault is found
   */
  async resolve(options?: ResolveVaultOptions): Promise<string> {
    const attempts: string[] = [];

    // Strategy 1: Explicit path
    if (options?.explicit) {
      const explicitPath = normalizePath(options.explicit);
      const result = await this.checkVaultPath(explicitPath);
      if (result) {
        return result;
      }
      attempts.push(`explicit path: ${explicitPath}`);
    }

    // Strategy 2: Environment variable
    const envPath = process.env["CADENCE_VAULT_PATH"];
    if (envPath) {
      const normalizedEnvPath = normalizePath(envPath);
      const result = await this.checkVaultPath(normalizedEnvPath);
      if (result) {
        return result;
      }
      attempts.push(`CADENCE_VAULT_PATH: ${normalizedEnvPath}`);
    }

    // Strategy 3: Ancestor walk
    const cwd = options?.cwd ?? process.cwd();
    const ancestorResult = await this.walkAncestors(cwd);
    if (ancestorResult) {
      return ancestorResult;
    }
    attempts.push(`ancestor walk from: ${cwd}`);

    // All strategies failed - throw helpful error
    throw new VaultNotFoundError(this.buildErrorMessage(attempts));
  }

  /**
   * Checks if a path contains a valid .cadence folder.
   * @returns The normalized path if valid, null otherwise.
   */
  private async checkVaultPath(path: string): Promise<string | null> {
    // Handle root path specially to avoid "//.cadence"
    const cadencePath = path === "/" ? "/.cadence" : `${path}/.cadence`;

    try {
      const exists = await this.fs.exists(cadencePath);
      if (exists) {
        const stat = await this.fs.stat(cadencePath);
        if (stat.isDirectory) {
          return path;
        }
      }
    } catch {
      // Path doesn't exist or can't be accessed
    }

    return null;
  }

  /**
   * Walks up the directory tree looking for a .cadence folder.
   * @returns The vault path if found, null otherwise.
   */
  private async walkAncestors(startPath: string): Promise<string | null> {
    let currentPath: string | null = normalizePath(startPath);

    while (currentPath !== null) {
      const result = await this.checkVaultPath(currentPath);
      if (result) {
        return result;
      }
      currentPath = getParentPath(currentPath);
    }

    return null;
  }

  /**
   * Builds a helpful error message listing all strategies that were tried.
   */
  private buildErrorMessage(attempts: string[]): string {
    const lines = ["No vault could be located. Strategies tried:"];
    for (const attempt of attempts) {
      lines.push(`  - ${attempt}`);
    }
    lines.push("");
    lines.push("To fix this, either:");
    lines.push("  1. Create a .cadence/ folder in your vault directory");
    lines.push("  2. Set the CADENCE_VAULT_PATH environment variable");
    lines.push("  3. Pass an explicit vault path to the command");

    return lines.join("\n");
  }
}

/**
 * Convenience function to resolve a vault path.
 * Creates a VaultResolver internally and calls resolve().
 *
 * @param fs - The file system to use
 * @param options - Resolution options
 * @returns The resolved vault path
 * @throws VaultNotFoundError if no valid vault is found
 */
export async function resolveVault(
  fs: IFileSystem,
  options?: ResolveVaultOptions
): Promise<string> {
  const resolver = new VaultResolver(fs);
  return resolver.resolve(options);
}
