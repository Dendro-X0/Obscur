# Obscur fault visibility — problems, verification gaps, CodaCtrl requirements

**Date (UTC):** 2026-10-14  
**Status:** Requirements brief · Obscur native-perf **PAUSED** pending CodaCtrl static+dynamic tooling  
**Audience:** Maintainer (CodaCtrl iteration first) · agents resuming Obscur after tooling lands  
**Evidence bases:** [desktop-shell-lag-investigation-2026-10.md](../../specs/backend/desktop-shell-lag-investigation-2026-10.md) E24–E33 · [desktop-local-plane-fault-scan-design-2026-10.md](../../specs/backend/desktop-local-plane-fault-scan-design-2026-10.md) · [obscur-native-performance-standards.md](./obscur-native-performance-standards.md) · this session handoff

---

## 1. Why this doc exists

Pinpointing faults in Obscur today is harder than fixing them. Aggregated meters and “try another subtract” loops behave like surgery without imaging. The maintainer’s RTS-trainer experience is the right analogy:

| Trainer (worked) | Obscur (missing) |
|------------------|------------------|
| Ghidra static: find objects / vtables / call sites | Static: owners, IPC edges, unlock hydrate graph |
| In-game action + capture script: bind address at the moment of use | Dynamic: ring journal / dump / plane A-B at the moment of death |
| Hybrid: static names the structure; dynamic names the instance | Hybrid: static names the owner; dynamic names the last N invokes + crash class |

**Plan:** iterate **CodaCtrl** until it provides that hybrid imaging, then return to Obscur with named lesions — not more speculative IPC spray.

---

## 2. Confirmed Obscur problems (evidence-backed)

### 2.1 Native process death under unlocked desktop (primary)

| ID | Exit | When | Notes |
|----|------|------|-------|
| E24–E31 | `0xc0000374` HEAP | Unlock / scroll, CDP on or off | Survives PostMessage=0; not “just CDP” |
| E32 | `0xc000001d` ILLEGAL_INSTRUCTION | After presence remount cut | Crash **class flipped** without cure |
| E33 Run A | `0xc0000374` again | `OBSCUR_PERF_PLANE=local` | **Tor/relay not required** |

**Product bar violated:** chrome/settings scroll and unlocked chat must stay fluid when network fails ([native performance standards](./obscur-native-performance-standards.md) §2).

### 2.2 Unlock local hydrate stampede (named by journal, not guess)

Under Run A (`local`), journal `recent[]` showed a same-millisecond burst of:

- `eng:dm:insertTombstone` (×14 tops)
- `eng:dm:listTombstones` / `eng:dm:getThread`
- `eng:workspace:listGroupMessages` / `listGroups`
- `desktop_harvest_profile_web_storage`
- `desktop_start_warmup`
- lease touch / `get_tor_status` (rejected under local)

**Conclusion:** fault plane after E33 = **local unlock hydrate**, not Tor Settings.

### 2.3 Presence remount storm (partially fixed, not the whole disease)

- Effect deps followed unstable `publishToAll` identity → `sign_kind:30315` 8→25 in seconds (heartbeat is 25s).
- Ref-stabilize cut that meter (E32 tops lost 30315); **process still died**.
- Lesson: fixing one meter ≠ fixing the exit class.

### 2.4 Host disk saturation (amplifies / freezes whole machine)

- Task Manager: **Disk C:/E: (SATA SSD) Active time 100%** while dogfooding.
- Repo lives on `E:\Web Projects\obscur` — same physical volume as system + pagefile.
- Concurrent AIO stacks (coordination wrangler, cargo `target/`, WebView2, SQLite) thrash that disk → **machine freeze**, not only app stutter.
- NVMe `H:` was idle — cargo/target should not share the dying volume.

### 2.5 Dogfood / packaging mismatch

- Packaged **v1.9.16** felt smooth after months; debug `cargo run` + static `out/` + public-relay/online stack is a different animal.
- Post-tag commits (`v1.9.16..HEAD`) do **not** touch presence/tombstone/row paint — bisect of those 17 commits is the wrong X-ray for this lesion.
- Docker relay often down → WARN continues with public relays → network plane noise when testing local-first.

### 2.6 CDP vs proof tools conflict

- Crash dogfood requires **`OBSCUR_CDP_MAIN=0`** (CDP-on floods PostMessage / taxes heap).
- CodaCtrl Living Proof T1 wants **CDP :9230**.
- Today: attaching the “CT scanner” changes the physiology of the patient.

---

## 3. Verification difficulties (why agents and dogs fail)

| Difficulty | What breaks | What we need instead |
|------------|-------------|----------------------|
| **Aggregate tops only** | `[invoke-pressure]` shows ranks, not last-before-death order | Ordered ring journal (landed) + crash-correlated dump |
| **No durable crash imaging** | `0xc000001d` / heap exit with empty stack for agents | WER LocalDumps / minidump ingest into CodaCtrl |
| **Cannot A/B Features in UI** | Settings dies before Tor toggle is trustworthy | Env planes (`local` / `chrome`) — landed; Studio should drive them |
| **False green CI** | `release:test-pack` green ≠ unlocked desktop soak | Explicit false-green register + runtime proof gates |
| **CodaCtrl MCP down** | Cursor sees Error / no tools; cannot pull digest | Healthy MCP + tools for journal/dump/plane without CDP-only path |
| **Workspace path skew** | Studio bound to `F:/web Project/obscur` vs real `E:/Web Projects/obscur` | Strict workspace = subject repo path |
| **Plane pollution** | Multiple wrangler/desktop terminals left running | One dogfood stack; kill-stack before soak |
| **Claim language** | “Fixed” after one meter drops | Standards claim discipline: implemented ≠ verified ≠ soft-locked |

**Feature-verification pain (examples):**

- Soft-lock L3 blocked indefinitely by heap under unlock.
- Tor honesty UI cannot be validated if process dies before Settings survives.
- “Local-first” product claim cannot be proven without a chrome plane that still paints with network stubbed.

---

## 4. What already exists in Obscur (do not reinvent)

| Tool | Path / env | Role |
|------|------------|------|
| Invoke pressure tops | `invoke_pressure.rs` | Coarse rate meter |
| Invoke journal | `%LOCALAPPDATA%\app.obscur.desktop\diagnostics\invoke-journal-latest.json` | Last 128 cmds + tops + plane |
| Perf planes | `OBSCUR_PERF_PLANE=local\|chrome\|full` | Binary-search network vs hydrate vs chrome |
| CDP gate | `OBSCUR_CDP_MAIN=0` | Reduce WebView IPC tax for soak |
| Standards + lag investigation | docs/program + specs/backend | Budgets and E-series evidence |
| CodaCtrl verify hub | `.codactrl/verify/` | False-green / issue report mirrors (when daemon healthy) |

**Gap:** these are **manual CLI / file** tools. Agents and Studio cannot yet orchestrate them as one “capture after action” workflow.

---

## 5. CodaCtrl requirements (hybrid static–dynamic)

### 5.1 Metaphor → product slices

| Trainer move | CodaCtrl slice | Acceptance |
|--------------|----------------|------------|
| Ghidra: find structures | **Static:** owner map for unlock hydrate (who calls `insertTombstone`, harvest, warmup, leases) + IPC edge graph | One click from crash journal cmd → owner file/symbol |
| Action in game | **Dynamic:** operator scenario “unlock Tester1 → scroll settings 30s” | Scenario records start/end wall clock |
| Capture script on action | **Dynamic:** auto-pull invoke journal + exit code + optional dump at scenario end / process death | Artifact bundle path returned to agent MCP |
| Don’t attach invasive debugger that changes game | **CDP-optional T1** | Digest from journal/dump/planes without forcing `:9230` |

### 5.2 Must-fix for Obscur resume

1. **MCP healthy** — tools list non-empty; Cursor `CallMcpTool` can `scan`, `attach_or_ingest`, `export_fault_bundle`.
2. **Subject path = real repo** — no silent `F:` vs `E:` drift.
3. **Ingest without CDP** — read `invoke-journal-latest.json`, plane label, exit code from last desktop run; optional LocalDumps folder.
4. **Drive planes** — Studio can launch/recommend `OBSCUR_PERF_PLANE=chrome|local|full` + `OBSCUR_CDP_MAIN=0` and label the run in the bundle.
5. **Static hop** — from journal `cmd` string (`eng:dm:insertTombstone`) jump to canonical owner + callers (codegraph / Studio index).
6. **False-green honesty** — T0 catalog green never implies Soft L3 / no-heap (already messaging; keep).
7. **Host health strip** — FreeMB + disk Active% on subject volume before soak (refuse or warn if disk pegged).

### 5.3 Nice-to-have (RE depth)

- Minidump → module+offset → Tauri/WebView2/obscur_desktop_lib frame.
- Timeline UI: journal `recent[]` as a scrubbable strip aligned to scenario markers.
- Diff Run A vs A2 bundles automatically (which reject:* appeared; which eng:* vanished).

### 5.4 Explicit non-goals for CodaCtrl this pass

- Replacing Ghidra for binary RE of closed games.
- Claiming Obscur heap “fixed” from Studio alone.
- Requiring CDP-on for every desktop proof (conflicts with standards).

---

## 6. Obscur resume criteria (after CodaCtrl)

| Criterion | Status (2026-10-15) |
|-----------|---------------------|
| 1. CodaCtrl MCP fault bundle without manual hunting | **met** — Evidence Desk H-ED2 `studio_evidence_desk_export_bundle` · post-mortem E33 journal ingest complete |
| 2. Run **A2** (`chrome`) + cool disk + chrome-vs-hydrate label | **operator next** — host_health refuse if pegged; plane recipe ready |
| 3. One subtract from named class + L3 soak | **coded (unverified)** — `insertTombstones` batch IPC (N→1) on persistence / visibility / tombstone-store paths; Soft L3 Fixed **not** claimed |

**Active now:** production track in [current-session.md](../handoffs/current-session.md) — A2 soak to prove the batch cut · no Soft L3 Fixed vanity · no Run B spray.

**Still allowed:** host hygiene (`CARGO_TARGET_DIR` on NVMe) · Evidence Desk post-death ingest · journal crash durability.

---

## 7. Operator cheat sheet (until Studio owns it)

```bash
# Cool host first — Disk C:/E: Active time must not be pegged
pnpm kill:dev-stack

# Run A (done E33): Tor OUT
OBSCUR_PERF_PLANE=local OBSCUR_CDP_MAIN=0 pnpm dev:desktop:no-coord

# Run A2 (next after CodaCtrl or manual): hydrate stubs
OBSCUR_PERF_PLANE=chrome OBSCUR_CDP_MAIN=0 pnpm dev:desktop:no-coord

# Journal
# %LOCALAPPDATA%\app.obscur.desktop\diagnostics\invoke-journal-latest.json
```

Optional: `CARGO_TARGET_DIR=H:/obscur-target` to keep compile I/O off the system SATA SSD.

---

## 8. One-sentence north star

**CodaCtrl should be the X-ray/CT for Obscur:** static owners + dynamic capture on action, CDP-optional, plane-aware — so returning to Obscur means cutting a named lesion, not guessing in the dark.
