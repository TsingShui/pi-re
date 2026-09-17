import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname } from "node:path";

import type { ToolchainCatalog } from "./catalog.js";

interface UsageEvent {
  schemaVersion: 1;
  tool: string;
  usedAt: string;
}

export interface ToolUsage {
  count: number;
  lastUsedAt?: string;
}

type ShellToken =
  | { kind: "word"; value: string }
  | { kind: "operator"; value: string };

const commandSeparators = new Set([";", "&&", "||", "|", "&", "(", ")", "\n"]);
const commandPrefixes = new Set(["command", "exec", "nohup", "sudo", "env", "time", "!"]);
const commandKeywords = new Set(["if", "elif", "then", "while", "until", "do", "else"]);
const shellHeaders = new Set(["for", "select", "case"]);

function tokenizeShell(command: string): ShellToken[] {
  const tokens: ShellToken[] = [];
  let word = "";
  let quote: "'" | '"' | undefined;

  const flush = () => {
    if (word) tokens.push({ kind: "word", value: word });
    word = "";
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];

    if (quote) {
      if (char === quote) quote = undefined;
      else if (char === "\\" && quote === '"' && index + 1 < command.length) {
        word += command[++index];
      } else word += char;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "\\" && index + 1 < command.length) {
      word += command[++index];
      continue;
    }
    if (char === "#" && word === "") {
      flush();
      while (index + 1 < command.length && command[index + 1] !== "\n") index += 1;
      continue;
    }
    if (/\s/.test(char)) {
      flush();
      if (char === "\n") tokens.push({ kind: "operator", value: "\n" });
      continue;
    }
    if (";|&()".includes(char)) {
      flush();
      const pair = command.slice(index, index + 2);
      if (pair === "&&" || pair === "||") {
        tokens.push({ kind: "operator", value: pair });
        index += 1;
      } else tokens.push({ kind: "operator", value: char });
      continue;
    }

    word += char;
  }

  flush();
  return tokens;
}

function isAssignment(word: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(word);
}

/** Return one entry for every catalog command invoked by a shell command. */
export function detectToolInvocations(command: string, catalog: ToolchainCatalog): string[] {
  const namesByCommand = new Map(
    Object.entries(catalog.tools).map(([name, tool]) => [tool.command, name]),
  );
  const invocations: string[] = [];
  let expectingCommand = true;

  for (const token of tokenizeShell(command)) {
    if (token.kind === "operator") {
      if (commandSeparators.has(token.value)) expectingCommand = true;
      continue;
    }

    if (commandKeywords.has(token.value)) {
      expectingCommand = true;
      continue;
    }

    if (!expectingCommand) continue;
    if (shellHeaders.has(token.value)) {
      expectingCommand = false;
      continue;
    }
    if (isAssignment(token.value) || commandPrefixes.has(token.value) || token.value.startsWith("-")) continue;

    const toolName = namesByCommand.get(basename(token.value));
    if (toolName) invocations.push(toolName);
    expectingCommand = false;
  }

  return invocations;
}

export function recordToolInvocations(path: string, tools: string[], now = new Date()): void {
  if (tools.length === 0) return;
  mkdirSync(dirname(path), { recursive: true });
  const usedAt = now.toISOString();
  const records = tools
    .map((tool): UsageEvent => ({ schemaVersion: 1, tool, usedAt }))
    .map((event) => JSON.stringify(event))
    .join("\n");
  appendFileSync(path, `${records}\n`, "utf8");
}

export function readToolUsage(path: string, catalog: ToolchainCatalog): Record<string, ToolUsage> {
  const usage: Record<string, ToolUsage> = Object.fromEntries(
    Object.keys(catalog.tools).map((name) => [name, { count: 0 }]),
  );

  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return usage;
    throw error;
  }

  for (const line of content.split("\n")) {
    if (!line) continue;
    try {
      const event = JSON.parse(line) as Partial<UsageEvent>;
      if (event.schemaVersion !== 1 || typeof event.tool !== "string" || typeof event.usedAt !== "string") {
        continue;
      }
      const entry = usage[event.tool];
      if (!entry) continue;
      entry.count += 1;
      if (!entry.lastUsedAt || event.usedAt > entry.lastUsedAt) entry.lastUsedAt = event.usedAt;
    } catch {
      // A partial final line must not hide the valid usage records before it.
    }
  }

  return usage;
}

export function formatToolUsage(usage: Record<string, ToolUsage>): string {
  const total = Object.values(usage).reduce((sum, entry) => sum + entry.count, 0);
  const lines = Object.entries(usage).map(([name, entry]) => {
    const share = total === 0 ? "0.0" : ((entry.count / total) * 100).toFixed(1);
    const last = entry.lastUsedAt ? ` · last ${entry.lastUsedAt}` : "";
    return `${name}: ${entry.count} (${share}%)${last}`;
  });
  return [`Toolchain invocations: ${total}`, ...lines].join("\n");
}
