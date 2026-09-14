import { readFileSync } from "node:fs";

export interface ToolDefinition {
  /** The executable to run. */
  command: string;
  /** Args that print the installed version without needing an input file. */
  versionArgs: string[];
  /** Public repository the tool is installed from. Provenance is required: every
   *  tool in this catalog is open source. */
  source: string;
  /** Commands that must resolve alongside `command` for it to work, e.g. kuna's siblings. */
  companions?: string[];
}

export interface ToolchainCatalog {
  schemaVersion: 1;
  tools: Record<string, ToolDefinition>;
}

const catalogUrl = new URL("../../toolchains/catalog.json", import.meta.url);

export function loadCatalog(): ToolchainCatalog {
  const value = JSON.parse(readFileSync(catalogUrl, "utf8")) as Partial<ToolchainCatalog>;

  if (value.schemaVersion !== 1 || !value.tools) {
    throw new Error("Invalid pi-re toolchain catalog");
  }

  for (const [name, tool] of Object.entries(value.tools)) {
    if (typeof tool?.command !== "string" || !Array.isArray(tool.versionArgs) || !tool.source) {
      throw new Error(`Invalid pi-re toolchain entry: ${name}`);
    }
    if (!tool.source.startsWith("https://github.com/")) {
      throw new Error(`Tool ${name} must name an open-source repository (got: ${tool.source})`);
    }
  }

  return value as ToolchainCatalog;
}
