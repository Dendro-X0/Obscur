# Design — Desktop local-plane fault scan (stop guessing)

**Date (UTC):** 2026-10-14  
**Status:** Implementing — Slice 1 (journal + `OBSCUR_PERF_PLANE=local`)  
**Owner:** `apps/desktop/src-tauri` invoke/tor/relay · dogfood via env  
**Evidence:** [desktop-shell-lag-investigation-2026-10.md](./desktop-shell-lag-investigation-2026-10.md) E31–E32  
**Standards:** [obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md) §2 Network optional

```text
HANDOFF ATOMIC STEP: Fault-scan method — journal + plane isolation (no IPC spray)
PAUSED / CANCELLED:   Further N2/N3 speculative subtract until a plane run names the plane
CANONICAL OWNER:      invoke_pressure + perf_plane
PROOF BEFORE DONE:    local plane unlock+scroll with journal file; compare full plane
SURFACE:              Tauri static-dev · CDP-off
```

---

## 1. Problem

`[invoke-pressure]` tops are **aggregates**. They cannot answer:

- Which invoke **immediately preceded** death?
- Is Tor / relay / presence **necessary** for the crash?
- Did a prior “fix” change the crash class without fixing the owner?

E31 → E32: presence remount cut `sign_kind:30315` from tops, then exit flipped **`0xc0000374` → `0xc000001d` (ILLEGAL_INSTRUCTION)** while `insertTombstone=14` / `engine_invoke` / `get_tor_status` remained. That is progress on one class, **not** a verified root cause — and Settings UI cannot A/B Tor if the process dies.

**Product invariant (already in standards):** local chrome and SQLite must stay usable when network/Tor/relays fail. Dogfood must be able to **prove** that plane separately.

---

## 2. Method (three layers — run in order)

### L0 — Crash class table (operator, no code)

| Exit | Meaning | Next |
|------|---------|------|
| `0xc0000374` | Heap corruption | IPC / WebView queue / allocator |
| `0xc000001d` | Illegal instruction | Code/jump corruption, bad native binary, or AV that lands in non-code — **need dump** |
| `0xc0000005` | Access violation | Same as heap band — dump |

**Windows LocalDumps (once per machine):**

```powershell
New-Item -Path "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\obscur_desktop_app.exe" -Force
Set-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\obscur_desktop_app.exe" DumpFolder "C:\Users\Administrator\AppData\Local\app.obscur.desktop\diagnostics\dumps" -Type ExpandString
Set-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\obscur_desktop_app.exe" DumpType 2 -Type DWord
Set-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\obscur_desktop_app.exe" DumpCount 5 -Type DWord
```

After crash: open dump under `diagnostics\dumps` (VS / WinDbg). Do **not** invent another IPC gate from tops alone when exit is `0xc000001d`.

### L1 — Invoke journal (Slice 1 — coded)

Always-on in desktop process:

- Ring of last **128** invokes: `{ t_ms, cmd }`
- Flush to `%LOCALAPPDATA%\app.obscur.desktop\diagnostics\invoke-journal-latest.json` every pressure tick (~2s) and every 32 invokes
- Override path: `OBSCUR_INVOKE_JOURNAL=<file>`

**After crash:** open that file — last lines are the scan answer for “what ran last,” not the aggregate top list.

### L2 — Perf plane isolation matrix (binary search)

| Run | Env | Network / hydrate | Expect |
|-----|-----|-------------------|--------|
| **A** | `OBSCUR_PERF_PLANE=local` | Tor/relay/30315 stubbed; **SQLite hydrate ON** | **E33: dies** `0xc0000374` → Tor OUT |
| **A2** | `OBSCUR_PERF_PLANE=chrome` | local stubs + engine dm/workspace/persistence + harvest + warmup stubbed | If lives → hydrate class; if dies → chrome/WebView |
| **B** | `full` | Normal | Skip after A death |
| **C** | full + Tor on | Tor path | Only if A green |

**`local` stubs:** Tor status/start/stop · relay connect/probe · sign 30315. Engine SQLite **allowed**.

**`chrome` stubs (A2):** everything in `local` plus `engine_invoke` for `dm`/`workspace`/`persistence` · `desktop_harvest_profile_web_storage` · `desktop_start_warmup`.

**Decision rule:**

- A dies → fault is **local** (not Tor) — **E33 confirmed**.
- A2 dies → chrome/lease/WebView (not SQLite hydrate storm).
- A2 lives → unlock hydrate owners (`insertTombstone` / getThread / harvest) — subtract that class only.
- Host Disk C:/E: at **100% Active** can freeze the whole machine — cool disk before A2.

---

## 3. Explicit non-goals (this band)

- No more N2/N3 speculative subtract until Run A vs B names the plane.
- No stack rewrite off Tauri.
- No claim “Tor caused it” without Run A green + Run B/C fail with Tor on.

---

## 4. Proof

| Layer | Command / artifact |
|-------|-------------------|
| L1 | Journal file exists after unlock; contains ordered cmds |
| L2 Run A | `OBSCUR_PERF_PLANE=local OBSCUR_CDP_MAIN=0 pnpm dev:desktop:online` · scroll · no exit · journal shows rejects |
| L2 Run B | Same without `local` · compare exit + last journal cmds |
| L0 | Dump present for `0xc000001d` if A or B still dies |

---

## 5. Implementation checklist

- [x] Design accepted (this doc)
- [x] `perf_plane` module + env parse
- [x] Invoke ring journal flush
- [x] Gate tor / connect_relay / sign 30315 under `local`
- [x] Handoff + E32 updated
- [ ] Operator Run A then Run B
