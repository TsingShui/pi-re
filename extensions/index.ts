import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadCatalog } from "./toolchain/catalog.js";
import { inspectTools } from "./toolchain/doctor.js";

export default function registerPiRe(pi: ExtensionAPI): void {
  const catalog = loadCatalog();

  pi.registerCommand("repi-toolchain", {
    description: "List the configured reverse-engineering tools.",
    handler: async (_args, ctx) => {
      const tools = Object.entries(catalog.tools)
        .map(([name, tool]) => `${name}: ${tool.source}`)
        .join("\n");
      ctx.ui.notify(tools, "info");
    },
  });

  pi.registerCommand("repi-doctor", {
    description: "Check installed tools (default: all).",
    handler: async (args, ctx) => {
      try {
        const { lines, ok } = await inspectTools(pi, catalog, args.trim() || undefined);
        ctx.ui.notify(lines.join("\n"), ok ? "info" : "warning");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
