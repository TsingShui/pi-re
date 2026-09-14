# pi-re

**A living reverse-engineering practice for AI agents.**

`pi-re` is an installable Pi package that keeps a reverse-engineering toolchain
discoverable and checkable. It ships a small catalog of open-source, CLI-native
tools plus two commands that list them and confirm each one resolves on this
machine. It describes tools and refuses what it cannot resolve; it does not
install them.

The browser application the practice is named after is a separate repository,
[`TsingShui/Repi`](https://github.com/TsingShui/Repi): a tablet-first workspace
that decompiles a binary locally in the tab.

## Quick start

1. **Agentic.** Ask your agent to install `pi-re`, add the tools you need, and
   check them with the [commands](#commands) below.
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

## Toolchain

The catalog is deliberately small. A tool belongs here only when it is
open-source, CLI-native, and useful without a GUI.

| Tool | Use it for | Platform | Source |
| --- | --- | --- | --- |
| `kuna` | Native-code decompilation | Most desktop systems | [Noelo-Lab/kuna](https://github.com/Noelo-Lab/kuna) |
| `rasc` | APK/DEX class decompilation, reference search, and manifest decoding | Desktop | [MG1937/ASC](https://github.com/MG1937/ASC/tree/rust) |
| `ecapture` | TLS plaintext and network capture; writes PCAPNG or a TLS key log | Linux x86_64/ARM64, Android | [gojue/ecapture](https://github.com/gojue/ecapture) |
| `tshark` | Protocol parsing and structured export from PCAP/PCAPNG | Windows, macOS, Linux | [wireshark/wireshark](https://github.com/wireshark/wireshark) |

## Commands

| Command | Purpose |
| --- | --- |
| `/repi-toolchain` | List configured tools and their upstream sources. |
| `/repi-doctor` | Check every configured tool. |
| `/repi-doctor <tool>` | Check one tool and its required companion commands. |

## License

Apache-2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

This package redistributes no third-party software: it describes tools and checks
that they resolve. The tools it names are separate projects under their own
licences, and the application that redistributes two of them — Kuna and Rasc,
each with its licence and notice beside its artifact — lists them at
[/#/licenses](https://tsingshui.github.io/Repi/#/licenses).
