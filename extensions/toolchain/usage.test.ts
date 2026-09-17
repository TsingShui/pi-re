import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ToolchainCatalog } from "./catalog.js";
import {
  detectToolInvocations,
  formatToolUsage,
  readToolUsage,
  recordToolInvocations,
} from "./usage.ts";

const catalog: ToolchainCatalog = {
  schemaVersion: 1,
  tools: {
    kuna: { command: "kuna", versionArgs: ["--version"], source: "https://github.com/Noelo-Lab/kuna" },
    angr: { command: "angr", versionArgs: ["--version"], source: "https://github.com/angr/angr" },
    rasc: { command: "rasc", versionArgs: ["--version"], source: "https://github.com/TsingShui/rasc" },
  },
};

test("detects catalog commands at shell command positions", () => {
  assert.deepEqual(
    detectToolInvocations(
      "KUNA_LOG=debug /opt/bin/kuna decompile sample main && command angr --version; echo rasc | rasc refs app.apk",
      catalog,
    ),
    ["kuna", "angr", "rasc"],
  );
});

test("does not count tool names used as arguments", () => {
  assert.deepEqual(detectToolInvocations("printf '%s' kuna; echo angr; cat rasc", catalog), []);
});

test("counts every invocation in loops and conditionals", () => {
  assert.deepEqual(
    detectToolInvocations("for f in a b; do kuna decompile \"$f\" main; done; if angr --version; then rasc --version; fi", catalog),
    ["kuna", "angr", "rasc"],
  );
});

test("records invocations and summarizes known tools", () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-re-usage-"));
  const path = join(directory, "usage.jsonl");
  try {
    recordToolInvocations(path, ["kuna", "kuna"], new Date("2026-04-01T10:00:00.000Z"));
    recordToolInvocations(path, ["angr"], new Date("2026-04-01T11:00:00.000Z"));

    const usage = readToolUsage(path, catalog);
    assert.deepEqual(usage, {
      kuna: { count: 2, lastUsedAt: "2026-04-01T10:00:00.000Z" },
      angr: { count: 1, lastUsedAt: "2026-04-01T11:00:00.000Z" },
      rasc: { count: 0 },
    });
    assert.equal(
      formatToolUsage(usage),
      "Toolchain invocations: 3\nkuna: 2 (66.7%) · last 2026-04-01T10:00:00.000Z\n" +
        "angr: 1 (33.3%) · last 2026-04-01T11:00:00.000Z\nrasc: 0 (0.0%)",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
