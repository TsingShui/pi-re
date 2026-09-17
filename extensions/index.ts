import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadCatalog } from "./toolchain/catalog.js";
import { inspectTools } from "./toolchain/probe.js";

const networkResearchTools = new Set([
  "web_search",
  "source_check",
  "fetch_content",
  "get_search_content",
]);

export default function registerPiRe(pi: ExtensionAPI): void {
  const catalog = loadCatalog();
  let analysisActive = false;

  pi.on("tool_call", async (event, ctx) => {
    if (!analysisActive || !networkResearchTools.has(event.toolName)) return;

    if (!ctx.hasUI) {
      return {
        block: true,
        reason: "pi-re analysis uses local evidence by default; network research requires explicit user approval",
      };
    }

    const approved = await ctx.ui.confirm(
      "Allow network research?",
      `${event.toolName} may introduce external assumptions into this analysis. Continue?`,
    );
    if (!approved) {
      return {
        block: true,
        reason: "Network research declined; continue from the target and local tool output",
      };
    }
  });

  pi.on("agent_settled", () => {
    analysisActive = false;
  });

  pi.registerCommand("repi", {
    description: "Analyze a target with the pi-re toolchain.",
    handler: async (args, ctx) => {
      const request = args.trim();
      if (!request) {
        ctx.ui.notify("Usage: /repi <target or analysis request>", "warning");
        return;
      }

      analysisActive = true;
      try {
        pi.sendUserMessage(`/skill:pi-re ${request}`, { expandPromptTemplates: true });
      } catch (error) {
        analysisActive = false;
        throw error;
      }
    },
  });

  pi.registerCommand("repi-install", {
    description: "Check the reverse-engineering toolchain and choose missing tools to install.",
    handler: async (_args, ctx) => {
      try {
        const { lines, missing } = await inspectTools(pi, catalog);
        if (missing.length === 0) {
          ctx.ui.notify(lines.join("\n"), "info");
          return;
        }

        ctx.ui.notify(lines.join("\n"), "warning");
        if (!ctx.hasUI) {
          ctx.ui.notify(`Missing tools: ${missing.join(", ")}`, "warning");
          return;
        }

        const choices = [...missing];
        const selected: string[] = [];
        while (choices.length > 0) {
          const choice = await ctx.ui.select(
            selected.length === 0
              ? "Choose a missing tool to install"
              : `Selected: ${selected.join(", ")}`,
            [...choices, "Install selected", "Cancel"],
          );

          if (!choice || choice === "Cancel") return;
          if (choice === "Install selected") break;
          selected.push(choice);
          choices.splice(choices.indexOf(choice), 1);
        }

        if (selected.length === 0) return;
        const sources = selected.map((name) => `${name}: ${catalog.tools[name].source}`).join("\n");
        const confirmed = await ctx.ui.confirm(
          "Install selected tools?",
          `${sources}\n\nThe agent will determine and run the appropriate installation commands.`,
        );
        if (!confirmed) return;

        pi.sendUserMessage(
          `Install these missing pi-re tools: ${selected.join(", ")}.\n\nCatalog sources:\n${sources}\n\n` +
            "Determine an appropriate isolated installation method for this machine, ask before privileged or " +
            "system-wide changes, and verify each tool after installation.",
        );
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}
