# pi-re

**A living reverse-engineering practice for AI agents.**

`pi-re` is an installable Pi package that keeps a reverse-engineering toolchain
discoverable and checkable. It ships a small catalog of open-source, CLI-native
tools plus commands to start analysis, install missing tools, and inspect local
usage counts.

## Quick start

1. **Agentic.** Ask your agent to install `pi-re`, run `/repi-install` to set up
   missing tools, then use `/repi <target or request>` to start an analysis.
2. **Manual.**

   ```bash
   pi install https://github.com/TsingShui/pi-re
   ```

## Design principles

1. **Agent-readable by default.** Prefer self-describing CLIs, structured output,
   composable commands, and workflows that do not depend on a GUI.
2. **CLI before protocol.** Call a tool directly when its CLI can express the job.
   Add MCP only when it provides a capability the CLI cannot.
3. **Open and auditable.** Every catalog entry points to a public source repository.
4. **Thin and current.** Keep one flat catalog—without profiles, download managers,
   or version pins—so tools can evolve without expanding the package surface.
5. **Code-focused Android analysis.** Do not decode resource tables, layouts, or
   complete APK resources, and never rebuild, resign, reinstall, or redistribute
   modified application packages.
6. **Analysis discipline at runtime.** The bundled `pi-re` Skill requires
   artifact-first independent analysis, gates external research, and treats hard
   analysis as normal.

## Toolchain

The catalog is deliberately small. A tool belongs here only when it is
open-source, CLI-native, and useful without a GUI.

| Tool | Use it for | Platform | Source |
| --- | --- | --- | --- |
| `kuna` | Native-code decompilation | Most desktop systems | [Noelo-Lab/kuna](https://github.com/Noelo-Lab/kuna) |
| `angr` | Targeted native-code deobfuscation and control-flow recovery for Kuna | Desktop with Python | [angr/angr](https://github.com/angr/angr) |
| `rasc` | APK/DEX class decompilation, reference search, and manifest decoding | Desktop | [TsingShui/rasc](https://github.com/TsingShui/rasc) |
| `ecapture` | TLS plaintext and network capture; writes PCAPNG or a TLS key log | Linux x86_64/ARM64, Android | [gojue/ecapture](https://github.com/gojue/ecapture) |
| `tshark` | Protocol parsing and structured export from PCAP/PCAPNG | Windows, macOS, Linux | [wireshark/wireshark](https://github.com/wireshark/wireshark) |

## Commands

| Command | Purpose |
| --- | --- |
| `/repi <target or request>` | Start an analysis through the bundled `pi-re` Skill. |
| `/repi-install` | Check the toolchain, select missing tools, and ask the agent to install and verify them. |
| `/repi-stats` | Show local invocation counts and last-use times for every catalog tool. |

The bundled `pi-re` Skill routes reverse-engineering tasks to the right catalog
tool and loads detailed Kuna or angr guidance when needed. Catalog-tool commands
run through Pi's shell tools are counted locally in `.pi/pi-re-usage.jsonl`;
`/repi-stats` reads that file. Nothing is uploaded.

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

This package redistributes no third-party software: it describes tools and checks
that they resolve. The tools it names are separate projects under their own
licences.
