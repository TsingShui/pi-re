# Working on pi-re

Instructions for anyone — human or agent — changing this repository.

## What this repository is

An installable Pi package: one flat catalog of open-source, CLI-native
reverse-engineering tools (`toolchains/catalog.json`), plus commands that start
analysis and install missing tools (`extensions/`). It runs inside an agent.

The browser application that shares the name is a **separate repository**,
[`TsingShui/Repi`](https://github.com/TsingShui/Repi). The two were one repository
until they were split: the application took the name Repi and the package is
`pi-re`. Nothing here should start depending on it, and the reason the split
exists is the first rule below.

The earlier spelling `re-pi` is retired — do not reintroduce it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run check` | `tsc --noEmit` over `extensions/**/*.ts`. Zero type errors is the bar, not a target. |
| `/repi <target or request>` | In Pi: start an analysis through the bundled `pi-re` Skill. |
| `/repi-install` | In Pi: probe the catalog, let the user select missing tools, then ask the agent to install and verify them. |

`npm run check` is the whole of the automated checking here: an entry is verified
against the machine it runs on, and no CI runner has these tools installed. What
can be checked without them is the catalog's shape, and that happens at load time.

## Layout

- `extensions/index.ts` — the extension: registers `/repi` and `/repi-install`.
- `extensions/toolchain/catalog.ts` — loads `toolchains/catalog.json` and refuses a
  catalog that is malformed: right schema version, and every entry with a
  `command`, `versionArgs`, and an `https://github.com/` `source`.
- `extensions/toolchain/probe.ts` — the probes. Version first, then each
  companion, because a tool can be installed and unusable without its sibling
  binaries and `--version` cannot see that.
- `toolchains/catalog.json` — the catalog. Add a tool here, not in code.
- `skills/pi-re/` — the single toolchain Skill; detailed Kuna and angr guidance
  lives under its `references/` directory.

## Rules that are not negotiable

**`pi install` stays cheap.** This package has no runtime dependencies and no
install hooks: it uses Node builtins and what Pi provides. `/repi-install` acts
only when the user selects and confirms missing tools. That is why the browser
application is a separate repository — a web toolchain in this package would be
downloaded by every agent that installs a catalog command.

**Keep Android analysis code-focused.** `pi-re` does not decode resource tables,
layouts, or complete APK resources, and it never rebuilds, resigns, reinstalls, or
redistributes modified APKs or other application packages. Do not add resource-
decoding or repackaging workflows or tools to this repository.

**Provenance is required.** Every entry names a public source repository, and
`catalog.ts` throws rather than serve one without it. A tool whose source nobody
can read does not belong in the catalog.

**Refuse out loud.** `/repi-install` reports `✗ name: not found`, or the exit code it
saw. It never reports a tool as present because an empty result looked like
success, and it never guesses what is installed.

## Conventions

**Commits** explain why, in prose. Say what was wrong, what the change does about
it, and what it costs. Do not list files. Do not describe a plan as though it were
finished.

**Check for stale content before every commit.** Review documentation, skills,
comments, examples, and catalog descriptions touched or made inaccurate by the
change. Remove or update obsolete content, and remind the developer to clean up
anything that cannot be resolved in the current change.

**Checks come with the change.** A new behaviour needs an assertion that would fail
without it. The checks that can run everywhere live in `catalog.ts`: a new required
field belongs in that loader with the reason it is required, so a malformed entry
fails at the extension boundary instead of in the middle of an install check.

**The catalog is data, and one flat list.** No profiles, no download manager, no
version pins, no per-tool code. If a tool needs a different probe, say so in its
`versionArgs`, not in `probe.ts`.

**Write for the reader who arrives next.** Comment the reason, not the mechanism.
Where a choice looks wrong until you know the constraint, say what the constraint
is.
