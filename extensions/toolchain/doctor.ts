import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ToolchainCatalog, ToolDefinition } from "./catalog.js";

export interface DoctorReport {
  lines: string[];
  /** True when every configured tool resolved. */
  ok: boolean;
}

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/, 1)[0] || "available";
}

async function inspectTool(
  pi: ExtensionAPI,
  name: string,
  tool: ToolDefinition,
  lines: string[],
): Promise<boolean> {
  try {
    const result = await pi.exec(tool.command, tool.versionArgs, { timeout: 5000 });
    const output = result.stdout || result.stderr;
    if (result.code !== 0) {
      lines.push(`✗ ${name}: exited with ${result.code}`);
      return false;
    }
    lines.push(`✓ ${name}: ${firstLine(output)}`);
  } catch {
    lines.push(`✗ ${name}: not found`);
    return false;
  }

  // A tool can be installed yet unusable without its sibling binaries; the
  // version probe above cannot see them, so probe each one for presence.
  let ok = true;
  for (const companion of tool.companions ?? []) {
    try {
      await pi.exec(companion, ["--help"], { timeout: 5000 });
    } catch {
      lines.push(`✗ ${name}: companion ${companion} not found`);
      ok = false;
    }
  }

  return ok;
}

export async function inspectTools(
  pi: ExtensionAPI,
  catalog: ToolchainCatalog,
  only?: string,
): Promise<DoctorReport> {
  if (only && !catalog.tools[only]) {
    throw new Error(`Unknown tool: ${only} (see /repi-toolchain)`);
  }

  const names = only ? [only] : Object.keys(catalog.tools);
  const lines: string[] = [];
  let ok = true;

  for (const name of names) {
    if (!(await inspectTool(pi, name, catalog.tools[name], lines))) ok = false;
  }

  return { lines, ok };
}
