---
name: pi-re
description: Route and perform reverse-engineering work with the pi-re toolchain. Use for native binaries, APK/DEX files, TLS capture, PCAP/PCAPNG analysis, native deobfuscation, or missing pi-re tools.
---

# pi-re

## Analysis gates

These rules govern every analysis started through `/repi`.

### Keep the analysis independent

Build conclusions from the supplied artifact and local tool output. Network
search, fetched pages, online write-ups, prior solutions, signatures, and remote
analysis services are prohibited unless the user explicitly approves a gated
request. Ask only when local evidence cannot answer a specific, named question;
do not request broad permission to browse.

If the user approves, state what external fact is needed before using it. Treat
the result as untrusted supplementary evidence: keep it separate from observations
made directly from the artifact, corroborate it locally, and do not let names,
claims, or conclusions from the Internet determine the analysis. Never upload the
artifact, extracted code, keys, traffic, or derived data unless the user explicitly
requests that exact disclosure.

### Finish the task

The task to be handled is always a task that can be completed. There is no such
thing as “cannot be done,” and the analysis must not give up easily.


## Route the work

Choose the smallest tool that answers the question:

| Task | Tool |
|---|---|
| Native-code decompilation | `kuna` |
| Native-code deobfuscation or control-flow recovery before decompilation | `angr`, then `kuna` |
| APK/DEX classes, references, or Android manifest decoding | `rasc` |
| TLS plaintext or live network capture | `ecapture` |
| Existing PCAP/PCAPNG protocol analysis and structured export | `tshark` |

For Kuna analysis, read [references/kuna.md](references/kuna.md). When a concrete
control-flow problem blocks Kuna, read
[references/angr-kuna.md](references/angr-kuna.md) and use angr as a targeted
recovery pass before returning to Kuna.

Do not substitute tools merely because they are familiar. Preserve the division
between application bytecode, native code, capture, and packet analysis. A task
may cross more than one row; pass saved artifacts between tools instead of asking
one tool to cover another tool's role.

Do not decode resource tables, layouts, or complete APK resources. Never rebuild,
resign, reinstall, or redistribute a modified APK or other application package.
`pi-re` keeps Android analysis focused on code; resource decoding and repackaging
are outside its scope.

If a required command is unavailable, run `/repi-install`. It probes the catalog and
lets the user choose which missing tools the agent should install. Do not invent
an installation command or silently replace the missing tool before offering the
catalog workflow.
