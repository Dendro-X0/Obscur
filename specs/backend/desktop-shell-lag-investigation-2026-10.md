# Investigation — Desktop shell extreme lag / freeze (S2 verify blocker)

**Date (UTC):** 2026-10-12  
**Status:** Evidence captured · Slice 1 landed · Slice 2 JS/Rust in progress · L2 not green  
**Trigger:** Operator will not run Track L / P5 manual verify while the client is unusable.  
**Related symptoms (prior session):** PostMessage `0x80070718` · heap corruption after Ctrl+C · UI freeze under dual-profile CDP · coordination exit 130

---

```text
HANDOFF ATOMIC STEP:  Unblock operator P5 / EG-LOG group live (when shell usable)
PAUSED / CANCELLED:   M1–M3 · dialects · ASE-2 · SF-B product code
CANONICAL OWNER:      apps/desktop shell · apps/pwa main-shell / transport
PROOF BEFORE DONE:    Investigation conclusions → design → named L1–L3
SURFACE:              Tauri debug static-dev · CDP :9230
```

---

## Symptoms

1. Extreme UI lag during normal Navigate / chat / dual-profile use.
2. Occasional hard freeze requiring process kill.
3. Dev stack (`pnpm dev:desktop:online`) often unhealthy after interrupt.

## Candidate classes (ordered)

| # | Class | Why it fits | Disconfirm |
|---|-------|-------------|------------|
| A | **Dev toolchain** (webpack HMR compile on navigation) | Historical navigation investigation; lag on every new route in `dev` | Measure in stamped `out/` / release exe |
| B | **Dual WebView + CDP** thrash | Track L uses `:9230`/`:9231`; PostMessage failures logged | Reproduce without CDP attach |
| C | **Always-on global work** (transport / relay / metadata hydrate) | Peer-display + relay pool always mounted | Profile main-thread with CodaCtrl / DevTools |
| D | **Native SQLite soft-lock drift loops** | Send path hammers unlock/reopen when `DbState.db=None` | Log `desktop_db_ensure_open` rate during lag |
| E | **Memory / heap** after unclean shutdown | Prior heap corruption reports | Fresh boot cold profile |

## Evidence pack (2026-10-12)

### E1 — Session under test

| Field | Value |
|-------|-------|
| Terminal | `554576` (`pnpm dev:desktop:no-coord`) |
| Started | `2026-10-12T08:34:12Z` |
| Ended | `2026-10-12T08:41:51Z` (~7.6 min) |
| Shell | **static-dev** `out/index.html` · stamp **`shell-2026-10-12T08:01:40Z`** |
| Build | Cargo **debug** `obscur_desktop_app.exe` (unoptimized) |
| CDP | Main `--remote-debugging-port=9230` (debug default) |
| Tor | preference=false · Clearnet dials |
| Coord | `http://127.0.0.1:8787/health` → `{"ok":true}` (sampled later) |
| Relay HTTP | `:7000` → 200 (sampled later) |

### E2 — Smoking gun: HWND message-queue flood

| Metric | Count / note |
|--------|----------------|
| `PostMessage failed … 0x80070718` | **3530** in one session log |
| First PostMessage | line **86** — immediately after public relay `connect_relay` burst + `[WINDOW] Startup visibility guard released` |
| `NativeRelay connect_relay` log lines | **10** URL dials (nos.lol / primal / damus, duplicated) before flood |
| `desktop_db_ensure_open` / locked-DB strings | **0** in this log |
| Exit | **`STATUS_HEAP_CORRUPTION` (`0xc0000374`)** after PostMessage storm |

Earlier dogfood terminal `13.txt` (prior `dev:desktop:online`): **76** PostMessage lines then `STATUS_CONTROL_C_EXIT` — same failure class.

### E3 — Class scoring after evidence

| Class | Verdict | Why |
|-------|---------|-----|
| **A webpack** | **Disfavored** | Session used **static** `out/` shell (`OBSCUR_DESKTOP_STATIC_DEV`), not live webpack HMR |
| **B CDP** | **Contributing / open** | Debug always attaches CDP `:9230`; no-CDP A/B not yet run (needs flag or release build — CDP is `#[cfg(debug_assertions)]` only) |
| **C always-on / relay emit** | **Primary** | Flood starts right after clearnet pool dials; native relay path `window.emit("relay-event", …)` per WS text frame (`relay.rs` read loop) can saturate UI thread + PostMessage quota |
| **D soft-lock spam** | **Disfavored** | Zero ensure_open / locked-DB lines during the flood window |
| **E heap** | **Consequence** | Corruption at process death after queue exhaustion — treat as result of C(+B), not root |

### E4 — Gaps (not yet collected)

1. **No-CDP / release** A/B (≥5 min idle + navigate) — disconfirm B weight.  
2. Main-thread Performance profile during first 30 s after unlock.  
3. Count of `relay-event` emits/sec (native log or JS counter).  
4. Single-profile vs dual-profile under same stamp.

### E5 — Infra note at evidence time

After crash: only `obscur-tor-gateway.exe` remained; CDP `:9230`/`:9231` down. Coordination health still OK when re-probed.

---

## Primary conclusion (investigation)

**Primary class: native→webview event pressure (public relay fan-in) saturating the Windows message queue (`0x80070718`), producing extreme lag/freeze and ending in heap corruption on debug static-dev.**

CDP and dual-profile remain **amplifiers to measure**, not required to explain the flood onset after relay connect.

## Non-goals

- Broad “make everything faster” program.  
- Conference / dialect / ASE-2 under cover of lag.  
- Claiming fixed without L3 dual-profile send after a designed subtraction.

## L2 dogfood (Slice 1)

| Field | Before (554576) | After Slice 1 (5646) |
|-------|-----------------|----------------------|
| Stamp | `shell-2026-10-12T08:01:40Z` | `shell-2026-10-12T09:20:25Z` |
| CDP | `:9230` on | **`OBSCUR_CDP_MAIN=0`** (disabled) |
| Duration | ~7.6 min | ~9.9 min (`elapsed_ms=593024`) |
| PostMessage `0x80070718` | **3530** continuous | **22** (no growth after burst) |
| Exit | `HEAP_CORRUPTION` | **Still `HEAP_CORRUPTION`** at ~10 min (exit `0xc0000374`) |

Storm volume fixed; **crash class not eliminated**. Slice 2 required (cap public REQ / stronger emit bounds).

### E6 — Slice 2 dial-cap runtime (2026-10-12 ~11:37–12:12Z)

| Session | Observation |
|---------|-------------|
| `272611` | Per-client `partitionWarmupDialUrls` **present in minified `out/`** (`deferredPublic`); still dialed nos+primal+damus **×3** (multi-mount pools) → heap |
| After shared client + process claim | Mount stampede cut to **1× per host**, but **3 Quiet hosts** still dial |
| `184854` stamp `shell-2026-10-12T12:06:59Z` | Bundle contains `quiet_dial_cap` + local Quiet host Set; **still** three `NativeRelay connect_relay` lines (nos, primal, damus) |

**Conclusion addendum:** Cap must be enforced on the **native `connect_relay` path** (process-wide Quiet host set). JS-only gates are necessary but were **not sufficient** in observed L2 runs.

### E7 — Quiet dial cap=0 still heaps (2026-10-12T14:13–14:21Z)

| Field | Value |
|-------|--------|
| Terminal | `986505` · stamp `shell-2026-10-12T14:06:54Z` · CDP-off |
| Quiet `connect_relay` / `quiet_dial_cap` logs | **0** |
| PostMessage `0x80070718` | **154** |
| Onset | ~4 min after Startup (not immediate) |
| Exit | `STATUS_HEAP_CORRUPTION` `0xc0000374` · `elapsed_ms=469279` |

**Revised primary class:** native→webview message-queue pressure remains, but **Quiet public NativeRelay fan-in is not the sole source**. Slice 2b Quiet=0 is necessary defense-in-depth; Slice 3 must find/rate-limit the remaining emit channel(s).

Contrast: sticky cap=1 (`645391`) → 846 PostMessage in ~3.5 min (Quiet amplifies heavily). Cap=0 → fewer PM but still fatal.

### E8 — Instrument emits zero during flood (2026-10-12T14:23–14:27Z)

| Field | Value |
|-------|--------|
| Terminal | `545913` · stamp `shell-2026-10-12T14:06:54Z` · CDP-off · Quiet=0 |
| `[emit-pressure]` lines | **0** (instrumented `relay-*` / mesh / warmup never fired) |
| Quiet `connect_relay` | **0** |
| PostMessage `0x80070718` | **957** |
| Exit | `STATUS_HEAP_CORRUPTION` `0xc0000374` · `elapsed_ms≈285650` (~4.8 min) |

**Hypothesis update:** PostMessage flood is **not** explained by instrumented `Emitter::emit` paths. Next suspect: **Tauri invoke IPC** (request/response PostMessage) or uninstrumented/plugin IPC. Slice 3 adds process-wide `[invoke-pressure]` on the invoke handler + remaining emit sites (tor/tray/profiles).

### E9 — `engine_invoke` dominates invoke IPC (2026-10-12T15:10–15:16Z)

| Field | Value |
|-------|--------|
| Terminal | `766295` · stamp `shell-2026-10-12T15:06:23Z` · CDP-off · Quiet=0 |
| `[emit-pressure]` | **1** line early (`profile-isolation-changed` + warmup) — not the flood |
| `[invoke-pressure]` peak | total≈2034 · **`engine_invoke≈1867`** (~92%) |
| Other notables | `sign_event_native≈40` · lease list/touch ~38/36 · harvest=8 |
| PostMessage `0x80070718` | **0** logged this run |
| Exit | `STATUS_HEAP_CORRUPTION` `0xc0000374` |

**Revised primary class:** webview→native **`engine_invoke` storm** (SQLite dispatch fan-in). Emit path disfavored under Quiet=0. Next: method-level `eng:<engine>:<method>` counters → coalesce/cache/subtract hot method.

### E10 — hot methods (`560737`)

| Method | Role |
|--------|------|
| `eng:workspace:listGroupMessages` | Dominant — sidebar stale-preview hydrate re-lists on every group-thread event |
| `eng:workspace:insertGroupTombstone` | Kind-5 / hide re-inserts same event ids |
| `eng:dm:insertTombstone` | Secondary |

Slice 3b subtraction: empty-preview negative cache + 1.5s debounce refresh + tombstone session dedupe.

### E11 — after 3b (`883615`)

| Metric | Value |
|--------|--------|
| `listGroupMessages` | **~20** (was 839+) |
| `insertGroupTombstone` | **8** flat |
| `sign_event_native` | **146** new dominant |
| PostMessage | 0 |
| Exit | heap ~5 min |

Workspace IPC cut worked; heap remains via **sign IPC**. Slice 3c: `sign_kind:` meter → subtract publisher.

### E12 — kind is presence 30315 (`39990`)

| Metric | Value |
|--------|--------|
| `sign_kind:30315` | Tracks `sign_event_native` 1:1 |
| Cause | `useRealtimePresence` effect deps included `publishPresence` → remount/sign thrash |
| Fix (3c) | Ref-stable heartbeat effect + coalesce online signs per heartbeat window |

### E13 — after 3c presence (`610305`, stamp `shell-2026-10-12T15:56:04Z`)

| Metric | ~12–16 min |
|--------|------------|
| `sign_kind:30315` | **~17–18** flat (was 101+) — 3c worked |
| `listGroupMessages` | ~35 flat |
| Top climbers | `list/touch leases` ~94 · `listTombstones`/`deleteMessages` ~40/35 |
| PostMessage | **7845** burst then stalled (not continuously climbing with invoke) |
| Heap | **none** logged · exit **127** at ~19.5 min (past prior 5–8 min heap windows) |
| RSS | 176→353 MB while invoke nearly flat after ~14 min |

**Revised:** presence fixed; remaining IPC = lease disk thrash (list/touch always `persist`) + ensureReady/reconcile re-`deleteMessages` same ids. Slice 3d coded; L2 re-soak pending.

### E14 — after 3d (`304945`, ~4 min, stamp `shell-2026-10-12T16:16:41Z`)

| Metric | Value |
|--------|--------|
| PostMessage | **0** (was 7845) — 3d disk/IPC cut worked for PM |
| `deleteMessages` | **25** flat (dedupe) |
| `listTombstones` | **14** (was ~40) |
| Climbing | `listConversations` 22 · `listGroupMessages` 21 · leases ~22 (IPC still 4s) |
| Exit | **`STATUS_HEAP_CORRUPTION` `0xc0000374`** ~4 min |

**Conclusion:** PostMessage flood ≠ sole heap cause. Heap returns with PM=0 under steady `engine_invoke` + sidebar list storm. Slice 3e: debounce sidebar reload · cache `listConversations` · lease heartbeat 8s.

### E15 — after 3e (`643378`, stamp `shell-2026-10-12T16:22:42Z`)

| Metric | ~10–13 min |
|--------|------------|
| Heap | **none** (past prior 4–8 min windows) |
| PostMessage | burst **8019** early then **plateau** (L2 still fails `<10`) |
| `listConversations` | **~20** flat after early climb (3e debounce/cache) |
| `deleteMessages` | **25** flat |
| Leases | climb at ~8s cadence (expected) · dominate late tops |
| RSS | spiked ~381 MB during PM · recovered ~196 MB by 13 min |
| `sign_kind:30315` | low teens |

**Partial L2:** duration/no-heap improved; PostMessage budget still red. Next cut: eliminate early hydrate PM burst (lease list coalesce / group list residual) without regressing survival.

### E15 close — `643378` ≥21 min

No late heap. Log wedged after PM burst (no new lines); RSS recovered then climbed again. L2 duration/no-heap **improved**; PostMessage budget still red.

### E16 — after 3f (`907115`, ~6 min, stamp `shell-2026-10-12T16:44:42Z`)

| Metric | Value |
|--------|--------|
| PostMessage | **0** (3f killed unlock fan-out flood) |
| `deleteMessages` | absent from tops |
| Climbing | `listGroupMessages` 22 · `listTombstones` 19 · `listConversations` 18 · leases |
| Exit | **`STATUS_HEAP_CORRUPTION`** ~6 min · total invokes only ~288 |

**Conclusion:** PM budget green; heap remains under modest steady list IPC. Root likely duplicate ensureReady/hydrate/list on every thread prepare. Slice 3g: once-per-profile ensureReady · prepare drops re-hydrate/re-list · list caches 30s.

### E17 — after 3g (`234117`, ~15 min)

| Metric | Value |
|--------|--------|
| listTombstones / listConversations | **absent from tops** |
| listGroupMessages | flat ~14–18 |
| PostMessage | **7605** |
| Dominating | leases · `get_session_nsec` · `sign_event_native` |
| Exit | heap ~15 min |

Slice 3h: cache session nsec · slow lease heartbeat/TTL.

### E18 — after 3h (`174815`, ~7.6 min)

| Metric | Value |
|--------|--------|
| PostMessage | **0** |
| `get_session_nsec` | **absent** |
| Climbing | `get_tor_status` · `listGroupMessages` · `getThread` |
| Exit | heap |

Slice 3i: stop per-event tor pulls · warmup 30s + 5 min cap · adapter 15s cache.

### E19 — operator dogfood 2026-10-13 (profiles picker freeze + heap)

| Signal | Value |
|--------|--------|
| UI | Profiles picker ("Who's using Obscur?") frozen / unselectable |
| Task Manager | CPU ~95% · RAM 14.3/16 GB · **commit 31.2/32.9 GB** |
| Host process RSS | Obscur ~20 MB (WebView/IPC thrash, not host RSS) |
| `[invoke-pressure]` | climbing: `engine_invoke` · `desktop_list/touch_active_session_lease` · harvest · `sign_event_native` · `eng:dm:insertTombstone` |
| Exit | **`STATUS_HEAP_CORRUPTION` `0xc0000374`** |

**Root cause (code):** `AppSessionShell` mounts full `UnlockedAppRuntimeShell` (Relay/Messaging/lease touch/presence) whenever `isUnlocked`, **including on `/profiles`**. Keychain rehydrate unlocks the window while the picker route stays mounted → Quiet/P5 work under chrome that should stay light. Compounded by 12s lease list+touch cadence and uncached `listActiveSessionLeasesAsync`.

**N1 slice (this session):**
1. **PL1:** `/profiles` always uses `ProfileManagementShell` (never full messaging tree).
2. Lease TTL 60s / heartbeat 30s (JS+Rust) · list-lease short cache · skip list/touch while `document.hidden`.
3. Auto-lock tor polls go through `relayNativeAdapter.getTorStatus` (Slice 3i cache).

### E19b — L3 early after N1/PL1 (2026-10-13T15:05Z)

| Signal | Value |
|--------|--------|
| Stamp | `shell-2026-10-13T14:50:01Z` |
| CDP | off (`OBSCUR_CDP_MAIN=0`) |
| Session | keychain rehydrate (`profile default`) while on picker |
| invoke-pressure | **29 → 32** (~3 min) · tops: harvest / isolation / list leases / save-library |
| Absent | `sign_event_native` · `insertTombstone` · `listGroup*` · `engine_invoke` storm |
| Host | CPU ~4 · RSS ~53 MB |
| Heap | none yet (soak continues) |

**Verdict:** Light-shell gate disconfirmed the unlocked-picker messaging storm. Remaining risk = OS commit thrash from prior sessions + optional harvest cadence on picker.

### E20 — picker quiet then messaging remount + heap (2026-10-13T15:12Z)

| Signal | Value |
|--------|--------|
| Quiet phase | invoke **29→39** · lease list climbing ~1/30s · harvest flat at 8 |
| Break | `emit-pressure` `profile-isolation-changed=3` · **`desktop-warmup-progress=1`** |
| Storm | invoke **101→131** · `engine_invoke` / tombstone / listGroup / getThread / sign |
| Exit | **`STATUS_HEAP_CORRUPTION` `0xc0000374`** (~8.6 min wall) |

**Causal read:** `DesktopWarmupOwner` only mounts inside `UnlockedAppRuntimeShell` — full messaging tree remounted while picker IPC was still visible in tops (harvest/list leases). Likely `isPublicProfileRoute` gated on `hasNativeRuntime()` flickering false (or navigation), so unlocked + `/profiles` children ran under the heavy shell. Lease list + uncached harvest + focus→isolation refresh were steady residual load before the break.

**N1b slice:**
1. Gate public profile light shell on **desktop shell build OR** native bridge (not bridge alone).
2. Cache `desktop_harvest_profile_web_storage` (≥60s) for picker hints.
3. Key preview reload on profile-id fingerprint; throttle focus isolation refresh; slow lease list poll to TTL.

### E21 — N1b still mounts messaging at keychain unlock (2026-10-13T15:28Z)

| Signal | Value |
|--------|--------|
| Stamp | `shell-2026-10-13T15:17:49Z` |
| First invoke sample | total **84** · `engine_invoke=18` · tombstone/listGroup/sign present |
| Next sample | total **85** · engine/tombstone/sign **flat** · only list leases +1 |
| Read | Cumulative burst from unlocked **`/`** mounting `UnlockedAppRuntimeShell` before picker; then quiet (likely navigated or idle). Locked-only picker redirect never fires when keychain unlocks. |

**N1c:** `resolveUnlockedDesktopStartupPickerRedirect` + AuthGateway holds children (no AppSessionShell) until `/profiles` when startup picker preferred.

### E21b — N1c L3 early (2026-10-13T15:42Z)

| Signal | Value |
|--------|--------|
| Stamp | `shell-2026-10-13T15:30:32Z` · CDP off |
| Session | keychain rehydrate |
| First invoke | **total=27** · harvest / isolation / auth_boot / bind / leases / save-library |
| Absent | `engine_invoke` · `insertTombstone` · `listGroup*` · `sign_event_native` · `desktop-warmup-progress` |
| Follow-up | total **28** then **silent** (no further IPC reports) · CPU~4 · RSS~51 MB |

**Verdict:** N1c removed the unlock-on-`/` messaging burst. Remaining: operator selectable confirm + ≥10 min no-heap soak.

### E22 — N1c/N1d stress (2026-10-13T16:15Z)

| Phase | Result |
|-------|--------|
| **S0** cold start (`shell-2026-10-13T16:08:35Z`, CDP on) | **Pass** · first invoke **27** picker-only (no engine/tombstone/sign) — N1d registry-count gate held |
| **S1** idle 60 s on `/profiles` | **Pass** · harness markers stayed picker · `messagingOnPicker=false` |
| **S2** focus + Advanced clicks | **Pass (product)** · stayed on `/profiles` · no messaging chrome · harness `pass=false` was false-negative (Advanced view lacks "Who's using" copy) |
| **Residual** | `desktop_list_active_session_leases` climbed ~1/2 s under visibility redefine churn · **N1e** throttle visibility lease refresh 30 s · stress harness no longer redefines `visibilityState` |
| **Heap** | none during S0–S2 window |
| Evidence | `docs/handoffs/n1c-profiles-stress-2026-10-13.json` · terminal invoke 27→82 leases-only |

**Prior failed stress:** leaving `/profiles`→`/sign-in` while unlocked mounts chat (expected) · opening profile cards opens second window (expected). Harness now picker-scoped.

### E23 — N1e entry dogfood: picker green, unlocked PostMessage storm (2026-10-13T17:20–~17:55Z)

| Field | Evidence |
|-------|----------|
| Terminal | `305046` · stamp **`shell-2026-10-13T17:17:39Z`** · **`OBSCUR_CDP_MAIN=0`** · public relays (local Docker relay down) |
| Cold picker | First invoke **27** then **28** · tops harvest / isolation / bind / leases / auth_boot / save — **no** `engine_invoke` / tombstone / sign |
| Entry | Shortly after: invoke **95→127** with `engine_invoke` / `eng:dm:insertTombstone` / `listGroupMessages` / `getThread` / `sign_event_native` / `sign_kind:30315` · emit `desktop-warmup-progress=1` |
| Bounce | **No picker return** in tops after messaging mounted (N1e consume held for this window) |
| PostMessage `0x80070718` | **8157** lines · first flood at invoke **~127** (seconds after messaging mount) · continued through soak |
| Quiet / NativeRelay log | **0** `connect_relay` / `quiet_dial` / `NativeRelay` strings in this terminal |
| Presence | `PRESENCE_HEARTBEAT_INTERVAL_MS=25s` · `sign_kind:30315` climbed to **~18** over ~35 min (coalesce held; not the early PM burst) |
| Heap | **No** `STATUS_HEAP_CORRUPTION` before operator kill |
| Host | FreeMB fell to **~1 GB** under soak; kill-dev-stack then force-kill exe; FreeMB still **&lt;2 GB** after kill → **reboot recommended** before next L3 |

**Verdict:** N1/N1e **picker** path remains L3-capable. Soft-lock **full** L3 / diagnostics B **blocked** — unlocked chat hydrate still saturates HWND PostMessage (same class as E2/E9–E16), machine-wide lag returns after Tester1 entry.

**Stress archive:** `docs/handoffs/n1c-profiles-stress-2026-10-13.json` — S0–S2 **Pass** on picker-only (retriaged); does **not** cover unlocked entry.

### E24 — N2a–c CDP-off: PostMessage 0, heap returns (2026-10-14T13:22–13:34Z)

| Field | Evidence |
|-------|----------|
| Terminal | `466341` · stamp **`shell-2026-10-14T13:21:20Z`** · **CDP off** |
| Cold picker | invoke **27→32** · leases topped **6** (coalesce held vs prior +1/2s race) · **no** engine/tombstone/sign |
| Entry | invoke **78→119** · `engine_invoke` plateau **28** · `listGroupMessages` **6** flat · tombstone **7** (entry burst) · `sign_kind:30315` climbed to **5** |
| Warmup | `desktop-warmup-progress=1` after entry (N2a defer held past picker) |
| PostMessage `0x80070718` | **0** (E23 was **8157**) |
| Heap | **`STATUS_HEAP_CORRUPTION` (`0xc0000374`)** ~2 min after entry · process exit |
| Host | FreeMB recovered to ~4.8 GB after death |

**Verdict:** N2a–c **cleared the PostMessage budget** on unlocked entry. Soft-lock L3 still **blocked** — heap returns with flat engine tops (E14/E16 class: PM≠sole heap cause). Next cut: presence/sign thrash + remaining entry tombstone fan-in (N2d) · longer soak only after no-heap candidate.

### E25 — N2d rebuild: ACCESS_VIOLATION + communities scroll stutter (2026-10-14T13:36–~14:00Z)

| Field | Evidence |
|-------|----------|
| Terminal | `578269` · stamp **`shell-2026-10-14T13:36:24Z`** · **CDP off** · N2d in tree |
| Entry | engine plateau ~**28** · `insertTombstone` **7** · `listGroupMessages` **6** · **`desktop-warmup-progress=9`** (per-task emits) |
| Crash | **`STATUS_ACCESS_VIOLATION`** shortly after unlock IPC (same death class as heap; WebView native) |
| Operator UX | Communities list scroll **stutters**; any further interaction → **full freeze** · reports “rewrite from the ground up” |
| Sidebar | `sidebar.tsx` renders via `list.map` (capped 25/50) — **no** virtualizer; `ConversationRow` uses `transition-all` + per-row metadata hooks |
| Rewrite | **Rejected** — handoff **PAUSED**: stack rewrite away from Tauri · stay on N0 IPC/UI subtraction |

**Verdict:** Unusable unlocked chat is still the **native WebView IPC / unlock hydrate** class (E23–E25), not a missing framework rewrite. Warmup progress emit storm (9) correlates with E25 crash window; non-virtualized + expensive row paint explains scroll stutter on the contact list under a contended main thread.

### E26 — N2e/N3 entry (CDP on): warmup emits gone; CDP PostMessage tax (2026-10-14T14:20–~14:35Z)

| Field | Evidence |
|-------|----------|
| Shell stamp | **`shell-2026-10-14T13:54:32Z`** · N2e/N3 in `out/` (`desktop_warmup_skipped_n2e`) |
| Launch | Terminal `457672` · **`OBSCUR_CDP_MAIN=9230`** (note: `=1` was wrongly treated as port **1** — fixed in `profiles.rs`) |
| Unlock | CDP Playwright → Tester1 · composer visible · communities list present |
| Entry invoke | **88→115** · `engine_invoke` plateau **28** · `insertTombstone` **7** · `listGroupMessages` **6** |
| Warmup | **`desktop-warmup-progress` count = 0** (E25 had **9**) · N2e kill held |
| Crash | **0** `STATUS_HEAP_CORRUPTION` / ACCESS_VIOLATION in window before operator kill |
| PostMessage `0x80070718` | **4376** — **CDP tax** (not comparable to E24 CDP-off PM=0) |
| Host | FreeMB fell to **~703** under CDP unlock · recovered **~3591** after `kill:dev-stack` |

**Verdict:** N2e removed the unlock warmup emit storm. Soft-lock L3 still **blocked** — need **CDP-off** soak (PM budget + no heap/AV) with FreeMB ≥2 GB; CDP-on dogfood collapses host RAM and reintroduces PostMessage flood.

### E27 — N2e CDP-off soak: PM0 · warmup0 · heap returns (2026-10-14T14:45–~14:52Z)

| Field | Evidence |
|-------|----------|
| Terminal | `633609` · stamp **`shell-2026-10-14T13:54:32Z`** · **`OBSCUR_CDP_MAIN=0`** · FreeMB start **3203** |
| Entry | invoke **27→111** · `engine_invoke` plateau **29** · `insertTombstone` **7** · `listGroupMessages` **6** · `getThread` **5** · `sign_kind:30315` → **3** |
| Warmup | **0** (N2e held vs E25=9) |
| PostMessage `0x80070718` | **0** (matches E24 CDP-off) |
| Heap | **`STATUS_HEAP_CORRUPTION` (`0xc0000374`)** ~3–4 min after entry · exit |
| Host | FreeMB recovered **~4285** after death |

**Verdict:** N2e cleared warmup emits **and** preserved CDP-off PostMessage **0**, but **heap is independent of warmup** (same class as E24). Next subtraction target: entry `insertTombstone=7` + presence/`get_tor_status` thrash (N2f) — still no stack rewrite.

### E28 — Chat-list scroll freeze under CDP + row paint (2026-10-14T15:45Z)

| Field | Evidence |
|-------|----------|
| Operator | Scroll communities list → client freezes |
| Terminal | stamp `shell-2026-10-14T14:29:27Z` · **CDP `9230` on** · invoke **27→81** · tops `engine_invoke` / `listGroupMessages` / `getThread` / `get_tor_status` |
| Codactrl | Monorepo audit focus on **coordination-worker** (35 yellow) — **not** the chat-list scroll path |
| Row paint | N3 `content-visibility: auto` on `ConversationRow` is a known WebView2 scroll regressor; Radix `DropdownMenu` mounted per row |

**N3b (coded):** remove `content-visibility` · lazy-mount row menu content · pass `viewerPublicKeyHex` from Sidebar once · `overscroll-y-contain` on list.

### E29 — Online stack heap with CDP on (2026-10-14T16:00Z)

| Field | Evidence |
|-------|----------|
| Terminal | operator `pnpm dev:desktop:online` · stamp **`shell-2026-10-14T15:47:38Z`** (N3b in tree) |
| CDP | **`remote-debugging-port=9230`** (online default — PostMessage/heap tax) |
| Entry | invoke **27→109** · `engine_invoke` **14→26** · `getThread` **2→7** · `listGroupMessages` **6→7** · `get_tor_status` **5** · `sign_event_native` **→8** · `sign_kind:30315` **→5** |
| Tombstone | **absent** from tops (N2f held) |
| Crash | **`STATUS_HEAP_CORRUPTION` (`0xc0000374`)** |

**Verdict:** Not a framework rewrite failure — same native WebView heap class (E24/E27) under **CDP-on + presence/tor stampede**. N2g: in-flight coalesce `get_tor_status` · kill presence publish until `OBSCUR_PRESENCE_PUBLISH=1` · dogfood **must** use `OBSCUR_CDP_MAIN=0`.

### E30 — N2 spray paused; working-tree cuts reverted (2026-10-14T16:30Z)

Maintainer PAUSED further N2/N3 spray. Session optimisations reverted to HEAD. Next: bisect vs packaged **v1.9.16**.

### E31 — CDP-off scroll stutter → heap (restored HEAD tree) (2026-10-14T16:45Z)

| Field | Evidence |
|-------|----------|
| Terminal | operator `OBSCUR_CDP_MAIN=0 pnpm dev:desktop:online` · stamp **`shell-2026-10-14T16:35:36Z`** |
| CDP | **off** (`Main window CDP disabled`) |
| Entry | invoke **27→190** · `engine_invoke` **45** · `sign_event_native` **28** · **`sign_kind:30315` 8→25** in seconds · `insertTombstone` **14** · `get_tor_status` **11** |
| Operator | Settings Profile visible · scroll stutter then crash |
| Exit | **`STATUS_HEAP_CORRUPTION` (`0xc0000374`)** |

**Bisect (`v1.9.16..HEAD`, 17 commits):** none touch presence / tombstone / conversation-row / warmup. Post-tag commits are **not** the regressor for this class.

**Named failure class:** `useConduitMeshRelayPool` rebuilds `publishToAll` on every activity snapshot. Presence heartbeat effect depended on that identity → successful publish → snapshot update → effect remount → offline+online → **`sign_kind:30315` storm** (heartbeat interval is **25s**, so 25 signs in seconds cannot be heartbeat). Contends with unlock IPC (`insertTombstone` / `engine_invoke`) under WebView2 scroll → stutter + heap.

**Fix (one class):** ref-stabilize pool methods inside `useRealtimePresence` so heartbeat/subscribe effects do not remount on pool object churn.

### E32 — After presence remount fix: illegal instruction (2026-10-14T16:58Z)

| Field | Evidence |
|-------|----------|
| CDP | **off** |
| Presence | **`sign_kind:30315` absent from tops** (E31 fix held) |
| Entry | invoke **27→142** · `engine_invoke` **45** · `insertTombstone` **14** · `get_tor_status` **9** · `sign_event_native` **5** late |
| Exit | **`STATUS_ILLEGAL_INSTRUCTION` (`0xc000001d`)** — **not** heap |
| Operator | Still cannot A/B Tor from Settings — process dies |

**Verdict:** Aggregated tops are insufficient. Next band is **fault-scan** (invoke journal + `OBSCUR_PERF_PLANE=local` isolation), not another IPC guess. Design: [desktop-local-plane-fault-scan-design-2026-10.md](./desktop-local-plane-fault-scan-design-2026-10.md).

### E33 — Run A local plane: still heap (Tor OUT) (2026-10-14T17:28Z)

| Field | Evidence |
|-------|----------|
| Env | `OBSCUR_PERF_PLANE=local` `OBSCUR_CDP_MAIN=0` · journal path printed |
| Rejects | `perf_plane:reject:get_tor_status=6` · `perf_plane:reject:sign_kind:30315` present |
| Tops | `engine_invoke=45` · `insertTombstone=14` · harvest=8 · listTombstones=8 · getThread=7 |
| Journal `recent[]` | Unlock burst: many `eng:dm:insertTombstone` in same ms · harvest · getThread · listGroupMessages · `desktop_start_warmup` · last before death `desktop_touch_active_session_lease` |
| Exit | **`STATUS_HEAP_CORRUPTION` (`0xc0000374`)** |
| Host | Task Manager: **Disk C:/E: SATA SSD Active time 100%** · project on E: = system volume · machine freeze |

**Verdict:** Tor/relay **not required** for crash. Fault plane = **local unlock hydrate** (tombstone/engine/harvest/warmup) amplified by **host disk saturation**. Skip Run B. Next: Run **A2** `OBSCUR_PERF_PLANE=chrome` (stubs those hydrate owners) only after disk Active time cools.

### E34 — Run A2 chrome: UI error boundary from ok:false stubs (2026-10-15T06:20Z)

| Field | Evidence |
|-------|----------|
| Plane | `OBSCUR_PERF_PLANE=chrome` · CDP off · harvest/listTombstones rejects present |
| Unlock | invoke **40→261** · `perf_plane:reject:eng:dm:listTombstones=14` · `listConversations` rejects · **no insertTombstone tops** |
| UI | Fatal React boundary: “Oops… fatal render loop” — process still logging (not yet native heap exit) |
| Cause | Chrome stubs returned `ok:false` → `listDmTombstones` / peers **throw** → error boundary — **false positive** for “chrome plane dies” |
| Bundle | `.codectx/verify/evidence-desk-bundle-latest.json` |

**Verdict:** Hydrate SQLite was successfully skipped; crash UI was **stub-induced throws**, not proven WebView heap. Fix chrome stubs to soft-empty `ok:true` (`perf_plane:stub:*`), then re-run A2 unlock+scroll.

### E35 — Run A2 soft-empty still dies: online hydrate quarantine gap (2026-10-15T06:40Z)

| Field | Evidence |
|-------|----------|
| Plane | `OBSCUR_PERF_PLANE=chrome` soft-empty · CDP off |
| Unlock | Settings shows **Restoring account data** · pressure **43→255** |
| Tops | `engine_invoke` / `stub:listTombstones` / `sign_event_native` / `get_tor_status` / leases=14 |
| Cause | `dev:desktop:no-coord` sets **experiment online** → full NetworkProvider + account-sync + tombstone hydrate still call soft stubs → PostMessage flood → heap |
| Gap | Native soft stubs alone do not stop JS callers under online |

**Verdict:** Soft stubs proved IPC still storms. Chrome must force **JS offline-stub quarantine** (override online) + unmount warmup/lease/tombstone owners + reject all `sign_event_native`.

### Quarantine slice (landed code)

- Inject `window.__OBSCUR_PERF_PLANE__` from Tauri boot
- `isChromePerfPlaneActive()` → forces `isExperimentOfflineStubEnabled()`
- Skip ProfileRuntime tombstone hydrate; unmount DesktopWarmup / DmColdRepair / ActiveSessionLease / SecondaryRefresh / WorkspaceKernel ingest under chrome
- `sign_event_native` rejects all kinds when `stubs_hydrate()`

### E36 — Chrome JS quarantine unlock lives (2026-10-15T07:25Z)

| Field | Evidence |
|-------|----------|
| Plane | `OBSCUR_PERF_PLANE=chrome` · harvest JS skip · online overridden to offline-stub |
| Unlock | Tester1 · Settings Identity interactive |
| UI | **No** “Restoring account data” · offline banner · **no** Oops · smooth |
| Pressure | **total≈56 flat** over ~7 min (was 43→255 under E35) · soft-stub workspace lists only |
| Absent | `listTombstones` · `sign_event_native` climb · lease storm |
| Bundle | Evidence Desk chrome export |

**Verdict:** Soft-empty native stubs were insufficient under experiment-online. **JS chrome quarantine** stops the unlock PostMessage stampede. Residual soft-stub `listGroupMessages` is small and non-climbing. **Not Soft L3 Fixed** (chrome plane ≠ production full plane).

### E37 — Operator confirms smooth unlock; web layer liability (2026-10-15T07:36Z)

| Field | Evidence |
|-------|----------|
| UI | Settings → Identity (Tester1) interactive; offline banner present |
| Operator | Smooth for now; fears regression; wants stack refactor off web-layer freeze class |
| Constraint | Stay Tauri v2 (installer / footprint / cross-platform); do not abandon for Electron-class |

**Verdict:** Quarantine proved the crash class is **webview-owned hydrate stampede**, not “Tauri is the wrong shell.” Next band = **native-owned unlock path** (subtract JS owners into Rust/engines) so full plane cannot reintroduce E35. Design: [native-shell-thin-webview-design-2026-10.md](./native-shell-thin-webview-design-2026-10.md).

### E38 — Slice 1 thin-webview land (2026-10-15T07:50Z)

| Field | Change |
|-------|--------|
| JS | `unlock-hydrate-policy` — mount tombstone skip on desktop; account-sync deferred off unlock |
| Rust | `invoke_coalesce` — 2.5s cache for listTombstones / listConversations / listGroups / listGroupMessages |
| Intent | Migrate IPC-owning hydrate into native budget; keep TS for UI (language % is not the KPI) |

### E39 — Full-plane unlock freeze again; soak loop discontinued (2026-10-15T08:20Z)

| Field | Evidence |
|-------|----------|
| Plane | `full` · CDP off |
| Unlock | total **131** · tops `engine_invoke=31` `listTombstones` `getThread` `warmup` `sign 30315/30078` `harvest` `get_tor_status` |
| Operator | Frozen again · stop tests that yield same result · accelerate migrate |

**Verdict:** Coalesce alone insufficient while dual-owned owners still mount. **Accel:** desktop unlock = chrome-thin shell (subtract kernel/warmup/cold-repair/leases/presence/auto account-sync/harvest). Plane soaks **PAUSED**.

### E40 — Thin unlock no freeze (2026-10-15T08:54Z)

| Field | Evidence |
|-------|----------|
| Plane | `full` · thin desktop shell |
| Journal | total≈122 · `listGroupMessages:budget` · coalesce on tombstones/getThread |
| Absent vs E39 | No harvest/warmup/30315 tops; operator: **no longer freezes** |
| Residual | Some listTombstones/getThread/30078 still possible from ensureReady/interval — gated in Slice 2 |

**Verdict:** Thin shell + Rust budget sufficient for unlock survival. Migrate features via Settings intent / Rust owners — not soak loops.

### E41 — Slice 2 shell rebuild (2026-10-15T09:31Z)

| Field | Evidence |
|-------|----------|
| Stamp | `shell-2026-10-15T09:31:12Z` |
| Plane | `full` |
| Idle journal | total=25 · tops = leases/profile/boot only |
| Absent | No `sign_kind:30078` · no `listTombstones` · no harvest/warmup |
| Build fix | Manual intent phase `"restoring_account_data"` (not `"restoring"`) |

**Verdict:** Thin unlock + Slice 2 gates hold on rebuilt shell. Manual Settings restore is next operator spot-check (not auto).

### E42 — Slice 2b deferred WorkspaceKernel (2026-10-15T09:47Z)

| Field | Evidence |
|-------|----------|
| Stamp | `shell-2026-10-15T09:47:16Z` |
| Plane | `full` |
| Idle journal | total≈22–23 · leases/profile/boot only |
| Absent | No `30078` · no tombstones · no warmup · no `30315` |
| Shell | `Restore from relays` + `runtime.deferred_workspace_kernel_mounted` present in chunks |

**Verdict:** Idle kernel activation did not reintroduce unlock stampede.

### E43 — Slice 2c lease remount rolled back (2026-10-15T10:06Z)

| Field | Evidence |
|-------|----------|
| Stamp | `shell-2026-10-15T09:54:11Z` (2c live) |
| Failure | `desktop_touch_active_session_lease` climbed ~1/s after deferred lease mount |
| Absent still | No `30078` / `30315`; tombstones residual ≤2 |
| Fix | Remove thin-shell lease remount; JS touch coalesce 25s; owner releases only on unmount/lock |

**Verdict:** Kernel deferred remount (2b) OK. Session lease owner still dual-bridge-tax until coalesce proven — keep off thin unlock.

### E43b — Rollback proof (2026-10-15T10:07Z)

| Field | Evidence |
|-------|----------|
| Stamp | `shell-2026-10-15T10:07:39Z` |
| Idle | total≈26 · list leases only (picker/boot) |
| Touch | **0** `desktop_touch_active_session_lease` |
| Absent | No `30078` · no tombstones · no `30315` |

**Verdict:** Slice 2b (deferred kernel) is the remount ceiling for now. Lease owner stays off thin path.

## Next

1. Settings → **Restore from relays** operator spot-check.  
2. Optional: Rust account-sync phase machine design.  
3. Presence/warmup/ingest/lease stay off. Soft L3 Fixed paused.

_Last updated: 2026-10-15T10:16:00Z_
