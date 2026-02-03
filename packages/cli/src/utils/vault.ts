import type { Command } from "commander";
import {
  NodeFileSystem,
  resolveVault,
  ConfigLoader,
  NoteService,
  type IFileSystem,
  type ResolveVaultOptions,
} from "@cadence/core";
import { logger } from "./logger.js";

export interface VaultContext {
  vaultPath: string;
  fs: IFileSystem;
  configLoader: ConfigLoader;
  noteService: NoteService;
}

/**
 * Get the vault path from command options (either local or parent command)
 */
export function getVaultOption(cmd: Command): string | undefined {
  // Check local options first
  const localVault = cmd.opts()["vault"] as string | undefined;
  if (localVault) {
    return localVault;
  }

  // Check parent command options
  const parent = cmd.parent;
  if (parent) {
    return parent.opts()["vault"] as string | undefined;
  }

  return undefined;
}

/**
 * Resolve the vault and create the necessary services
 */
export async function getVaultContext(cmd: Command): Promise<VaultContext> {
  const fs = new NodeFileSystem();
  const explicitVault = getVaultOption(cmd);

  const resolveOptions: ResolveVaultOptions = {};
  if (explicitVault) {
    resolveOptions.explicit = explicitVault;
    logger.debug(`Using explicit vault path: ${explicitVault}`);
  } else {
    logger.debug("No explicit vault path, resolving from environment...");
  }
  const vaultPath = await resolveVault(fs, resolveOptions);
  logger.debugVault(vaultPath, explicitVault ? "explicit --vault option" : "auto-resolved");

  const configLoader = new ConfigLoader(fs);
  logger.debugConfig(`${vaultPath}/.cadence/config.json`);

  const noteService = new NoteService(fs, configLoader, vaultPath);

  return { vaultPath, fs, configLoader, noteService };
}
