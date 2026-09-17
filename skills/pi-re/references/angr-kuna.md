# angr as a Kuna recovery pass

Use angr as a **targeted upstream analysis pass** for Kuna. The goal is not to
replace Kuna's decompiler: angr recovers native-code facts or a carefully
validated byte overlay, then Kuna performs the readable C/assembly export.

This skill applies to native object files. It does not analyze managed bytecode or
an application runtime.

## Scope and safety

Preserve the original sample. Never patch it in place and never treat an angr
candidate edge as a proven fact without evidence. Work in a separate directory:

```bash
mkdir -p ./recovery
cp ./sample ./recovery/sample.original
sha256sum ./recovery/sample.original
```

Record the input hash, architecture, image base, entry points, angr version, and
whether the analysis is complete. Symbolic execution can be path-limited and
native libraries can depend on unresolved Android or libc calls.

Prefer this escalation order:

1. Run Kuna normally and identify the concrete failure.
2. Ask angr for CFG and target evidence around that failure.
3. Generate a Kuna byte-assertion file only for patches supported by evidence.
4. Re-run Kuna with `--assert @FILE`.
5. Compare the recovered output with the original output and the angr evidence.
6. If the result is incomplete or contradictory, keep the facts as findings and
   do not materialize a patch.

## First pass with Kuna

Start with Kuna because it is the final consumer and its diagnostics define the
problem to solve:

```bash
kuna functions ./sample --json > ./recovery/kuna-functions.json
kuna decompile-project ./sample --stream -o ./recovery/kuna.initial
```

For one suspected function:

```bash
kuna decompile ./sample 0x401000 --addr --json
kuna disassemble ./sample 0x401000 --addr --bytes 256 --json
```

Escalate when there is a specific symptom such as a decode failure, a missing
function, an unresolved indirect branch, an implausible function boundary, a
large junk region, or a dispatcher that prevents useful decompilation. Do not
run whole-program symbolic execution just because a binary is large.

## Check angr before using it

Both the `angr` command and the Python package must resolve:

```bash
angr --version
python3 -c 'import angr; print(angr.__version__)'
```

If either check fails, report it and stop the angr pass. Do not silently switch
to another decompiler or install packages as part of this Skill.

The CLI is useful for a quick baseline:

```bash
angr --help
angr decompile ./sample --functions main --nopbar
angr disassemble ./sample --functions main --nopbar
```

For CFG recovery, indirect-branch inspection, state exploration, and patch
justification, use a small Python driver. Keep the driver and its JSON output in
`./recovery`, not inside Kuna's generated project directory.

## Load the right native image

For ELF/PE/Mach-O with usable metadata:

```python
import angr

project = angr.Project("./sample", auto_load_libs=False)
```

`auto_load_libs=False` is the default starting point for a local control-flow
question. Loading every host library makes the graph larger and does not recreate
Android's runtime.

For an Android APK, extract the ABI-specific native library first:

```bash
unzip app.apk 'lib/arm64-v8a/*.so' -d ./recovery/apk
```

Then analyze the extracted `.so`, not the APK:

```python
project = angr.Project(
    "./recovery/apk/lib/arm64-v8a/libfoo.so",
    auto_load_libs=False,
)
```

Check the ABI and loader base before comparing addresses. ARM Thumb addresses may
carry the low-bit mode marker; preserve the representation expected by the tool
and document any normalization.

For a headerless runtime dump, provide the correct architecture and base address:

```python
project = angr.Project(
    "./recovery/decrypted.bin",
    main_opts={
        "backend": "blob",
        "arch": "AMD64",
        "base_addr": 0x400000,
        "entry_point": 0x401000,
    },
    auto_load_libs=False,
)
```

Do not infer the base or entry from a damaged header. Obtain them from the dump,
loader configuration, debugger, or an explicit analysis assumption.

## Recover control flow in stages

Start with the cheap static graph:

```python
cfg = project.analyses.CFGFast(
    normalize=True,
    data_references=True,
)
```

Inspect the target function and its transition edges before using symbolic
execution:

```python
addr = 0x401000
function = cfg.kb.functions.get(addr)
if function is None:
    raise RuntimeError(f"angr did not recover {addr:#x}")

for block in function.blocks:
    print(f"block {block.addr:#x} size={block.size}")
    for successor in block.vex.constant_jump_targets:
        print(f"  constant target {successor:#x}")
```

For a bounded unresolved branch, use `CFGEmulated` with explicit seeds and a
finite exploration budget. The exact options depend on the binary and angr
version; keep the invocation in a script so it is reproducible. Do not claim that
an emulated graph is complete merely because angr returned successfully.

Use symbolic execution only for a bounded question, such as:

- Which targets can this indirect jump reach?
- Is this conditional branch satisfiable on either side?
- Does the dispatcher reach the suspected real block?
- Which bytes are present after a local unpack/decrypt routine?

Set explicit limits for states, steps, loop trips, and time. Record discarded,
unsatisfiable, and unconstrained states separately.

## What counts as evidence

A proposed control-flow fact should include:

```json
{
  "source": "0x401234",
  "targets": ["0x401240", "0x401260"],
  "complete": false,
  "method": "CFGFast",
  "confidence": "candidate",
  "evidence": {
    "states": 48,
    "steps": 5000,
    "unconstrained": 0,
    "errors": []
  }
}
```

Use these confidence levels:

- `observed`: repeated concrete/emulated execution reached the target and the
  bytes decode consistently;
- `proved-local`: bounded symbolic reasoning proved the local condition under
  stated assumptions;
- `candidate`: static recovery suggests the edge but does not prove it;
- `unknown`: analysis was cut off, unconstrained, or dependent on an unresolved
  external call.

Only `observed` or a clearly documented `proved-local` result should normally
produce a byte patch. A `candidate` edge can be reported to the agent but should
not silently rewrite the input.

## Generate Kuna byte assertions

Kuna does not currently consume an external angr CFG package. Its practical
interchange for a byte overlay is an assertion file with one `bytes` directive per
patch:

```text
# recovery/angr-patches.assert
# bytes <virtual-address> <replacement-hex>
bytes 0x401234 eb05
bytes 0x401240 9090
```

Use it without changing the original binary:

```bash
kuna decompile-project ./sample \
  -o ./recovery/kuna.angr \
  --assert @./recovery/angr-patches.assert
```

Before writing a directive, verify that the bytes being replaced match the
original image exactly. Store the old bytes and the reason in a sidecar record:

```json
[
  {
    "address": "0x401234",
    "before": "7505",
    "after": "eb05",
    "kind": "opaque-predicate",
    "confidence": "proved-local",
    "preservesLength": true
  }
]
```

Prefer equal-length substitutions such as a conditional branch to an
unconditional branch or junk instructions to same-length NOPs. Do not change
addresses, section sizes, relocation tables, exception metadata, or instruction
lengths unless producing a separately validated normalized image is explicitly
required.

Do not emit a patch merely because angr lists a possible target. If the real
operation is only a CFG fact, report it in JSON and use Kuna's existing directives
such as `--define-function` or a manual entry address where appropriate.

## Android native libraries

For an Android `.so`, angr analyzes the native ELF only:

```text
APK
├── classes.dex              -> DEX/Android tooling
└── lib/arm64-v8a/libfoo.so  -> angr + Kuna
```

Unresolved JNI and Android calls are normal. Use stubs or hooks only when they are
needed for the bounded question, and record the assumption. A successful import
of `libfoo.so` does not mean that the Java/native interaction was modeled.

If the native code decrypts itself at runtime, static angr may not see the useful
bytes. Use a controlled emulator/device dump or debugger to obtain a memory image,
then pass that image to Kuna as a raw image:

```bash
kuna decompile-project ./recovery/libfoo.decrypted \
  -o ./recovery/kuna.decrypted \
  --raw-image \
  --target 'AARCH64:LE:64:v8A' \
  --base 0x7000000000 \
  --entry 0x7000001234
```

Use the actual SLEIGH target, base, and entry for the dump. The example values are
not universal. Keep a map of which memory ranges were dumped and which remain
unknown.

## Validation gate

After generating assertions or a normalized image, check all of the following:

```bash
sha256sum ./sample
kuna functions ./sample --json > ./recovery/kuna-recovered-functions.json
kuna decompile-project ./sample \
  -o ./recovery/kuna.recovered \
  --assert @./recovery/angr-patches.assert
```

Then compare:

- original and recovered function counts;
- target function boundaries;
- indirect-branch targets;
- new decode failures or lost functions;
- Kuna assembly against the patched bytes;
- recovered C against the angr evidence;
- whether the patch changed any bytes outside its declared ranges.

A patch is rejected if the assertion file fails to apply, the old bytes do not
match, the patch crosses an unmapped range, the recovered result introduces more
failures, or the result depends on an undocumented runtime assumption.

Report limitations explicitly. “angr recovered two feasible targets under a
bounded exploration” is valid; “the complete CFG is recovered” is not valid
unless completeness was independently established.

## Failure modes

- **`angr` missing:** report the missing executable/package; do not install it.
- **Unsupported architecture:** confirm angr and Kuna architecture names and use
  the correct native library or raw-image metadata.
- **Android import noise:** disable automatic library loading and stub only the
  external calls needed by the bounded analysis.
- **Too many states:** narrow to one function/branch, add explicit limits, and
  label the result incomplete.
- **Unconstrained indirect jump:** report candidate targets; do not patch it as a
  direct jump without stronger evidence.
- **Self-modifying/decrypted code:** obtain a controlled runtime memory dump and
  analyze it as a raw image with a documented base and entry.
- **Kuna still fails:** inspect the patched bytes and Kuna diagnostics first; do
  not keep adding speculative patches.
