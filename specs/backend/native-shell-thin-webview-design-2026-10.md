# Design — Thin WebView shell (stay Tauri, native-owned unlock)

**Date (UTC):** 2026-10-15  
**Status:** Design · Slice 0 accepted by E37 operator proof  
**Evidence:** [desktop-shell-lag-investigation-2026-10.md](./desktop-shell-lag-investigation-2026-10.md) E35–E37  
**Standards:** [obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md)  
**Research:** [native-shell-performance-research-2026-10.md](./native-shell-performance-research-2026-10.md)

---

```text
HANDOFF ATOMIC STEP: Thin-webview Slice 1 — full-plane subtract of E35 hydrate owners
PAUSED / CANCELLED: Soft L3 Fixed · abandon Tauri / Electron rewrite
CANONICAL OWNER: apps/desktop Rust engines · UnlockedAppRuntimeShell (subtract only)
PROOF BEFORE DONE: L2 full-plane unlock soak ≥20m · PostMessage=0 · total flat · no heap
```

---

## 1. Problem (what E35–E37 proved)

| Claim | Verdict |
|-------|---------|
| “Tauri / WebView2 is fundamentally unusable” | **False** — chrome quarantine unlock is smooth (E36/E37) |
| “Web layer is a liability” | **True for ownership** — React providers stampede PostMessage → heap |
| “Need a new desktop stack” | **False for installer/footprint/cross-platform goals** — Tauri still wins those |
| Soft-empty native stubs alone | **Insufficient** under experiment-online (E35) |
| JS quarantine (force offline + unmount owners) | **Necessary** to stop unlock death (E36) |

The freeze class is **webview-scheduled hydrate work crossing the native bridge unbound**, not “HTML cannot draw a settings form.”

### 1.1 Language is not the bottleneck (maintainer framing 2026-10-15)

Obscur began as **TypeScript-first**. That was correct for product UI and E2E crypto UX — Signal’s stack shows TS can feel native when ownership is coherent.

The conflict is **feature fit**, not “TS vs Rust prestige”:

| Better in **modular Rust** | Better in **TypeScript client** |
|----------------------------|----------------------------------|
| SQLite engines, session/keychain, Tor dial, coalesce/budgets, always-on timers | Settings/forms, route chrome, E2E crypto UX, relay protocol orchestration that stays in-process |

**Anti-pattern (current liability):** half-migrate — keep lifecycle logic in TS **and** call thin Rust APIs on every tick. That constant **bridging** is *worse* than a pure-TS path (extra PostMessage/serialization with no ownership win). E35 is that pattern at unlock.

**Rule:** for each feature, pick **one** owner.

- **Rust-owned:** TS only reads snapshots / sends intent; no mount-storm invokes.  
- **TS-owned:** stay in-process; do **not** add a Rust hop “for performance.”  
- **Forbidden:** dual owners across the bridge for the same lifecycle (hydrate, presence, leases, account-sync restore).

Language chart % is not the KPI. KPI = **bridge crossings per unlock/frame** and journal flatness.

## 2. Constraints (maintainer)

1. **Stay Tauri v2** — lightweight installer, << Electron footprint, desktop + mobile shared product surface.  
2. **Feel native** — chrome fluid; local UI never dies because sync/relay/presence woke up.  
3. **No Soft L3 Fixed** from chrome-plane dogfood alone.  
4. **Fix by subtraction** — delete/move JS owners; do not add a third “native UI framework” beside PWA+Tauri.  
5. **No vanity Rust port** — migrate only features that belong native; leave coherent TS backends alone.

## 3. Target architecture

```text
TODAY (bridge tax)                        TARGET (single owner per lifecycle)
──────────────────                        ───────────────────────────────────
TS lifecycle → invoke → Rust stub         Rust owns hydrate/sync timers
  → coalesce miss → again → storm           → snapshot/event to WebView
  → worse than pure TS                      TS paints + E2E; no tick loop over IPC
```

| Layer | Owns | Must not own |
|-------|------|--------------|
| **Rust / engines** | Session restore, tombstone hydrate, account-sync phases, presence publish schedule, lease heartbeats, Tor poll budget | UI layout · features that are already coherent in-process TS |
| **IPC bridge** | Rare intents + snapshot push · hard budgets · coalesce | Per-frame / per-mount chatty reads |
| **WebView (PWA)** | Present snapshots · user input · route chrome · E2E client logic | Unlock stampede · always-on poll loops · dual-owned restore |

Mobile (Capacitor) inherits the same contract: **same engines, thin web**.

## 4. What we will not do

| Option | Why rejected |
|--------|----------------|
| Electron | Exceeds footprint / installer goals |
| Abandon Tauri for Qt/Flutter desktop-only | Splits desktop/mobile codebase; loses current installer path |
| Rewrite UI in egui/iced | Duplicates Settings/chat surface; years of product UI |
| Keep chrome-only gates as “the fix” | Full plane will reintroduce E35 the moment online hydrate remounts |

## 5. Slices

### Slice 0 — Chrome quarantine (landed)

Force offline-stub under `OBSCUR_PERF_PLANE=chrome`; unmount warmup / cold-repair / leases / tombstone+harvest hydrate; reject all `sign_event_native`. **Proof:** E36/E37 unlock smooth · total≈56 flat.

### Slice 1 — Full-plane subtract (accelerated after E39)

E39: full-plane unlock still froze (total=131). **Plane soaks paused.** Desktop now uses chrome-thin unlock shell permanently until Rust remount band.

| Item | Status |
|------|--------|
| 1. Tombstone hydrate — never on provider mount (desktop) | **Landed** |
| 2. Account-sync — **no** auto-rehydrate on unlock (desktop) | **Landed** · `shouldSkipAutoAccountSyncOnUnlock` |
| 3. Presence — desktop uses ExperimentNetworkShell (no 30315) | **Landed** |
| 4. Engine coalesce | **Landed** · insufficient alone |
| 5. Lease / warmup / cold-repair / WorkspaceKernel | **Subtracted** from desktop unlock shell |
| 6. Harvest IPC | **Skipped** on desktop |

### Dual-owned bridge inventory (subtract or pick one owner)

| Feature | Today | Target owner | Action |
|---------|-------|--------------|--------|
| Tombstone hydrate on mount | JS mount → eng listTombstones | Rust/on-demand thread | **Done** skip mount |
| Account-sync restore on unlock | JS rehydrate + sign/publish | Defer off unlock; later Rust phase machine | **Done** defer |
| Presence heartbeat | JS timer → sign (native or in-process) | TS in-process when key in JS; native coalesce if bridged | **Done** coalesce |
| Session leases picker | JS 60s poll → Rust file | Rust coalesce; ideal = emit-on-change | **Done** coalesce |
| Engine hot lists | JS sidebar → eng:* | Rust coalesce | **Done** |
| Harvest web storage | JS unlock/picker → Rust scan | Keep Rust; JS cache already | Monitor |
| Tor status poll | JS → get_tor_status | Stay TS scheduling; local/chrome stub | Monitor |

**Proof:** `OBSCUR_PERF_PLANE=full` `OBSCUR_CDP_MAIN=0` unlock → Settings → scroll ≥20 min · journal tops flat · PostMessage=0 · no `0xc0000374`.

**Language chart note:** ~87% TS is expected for UI. Migration target is **IPC-owning hydrate/sync**, not rewriting Settings forms in Rust. Success = Rust % owns hot paths + journal flat, not “TS < 50%.”

### Slice 2 — Hard bridge budgets (production)

Promote fault-scan budgets to always-on: max in-flight invokes per cmd class; soft-deny with empty ok (not throw); emit coalesce already from shell-lag slices.

### Slice 3 — Content window (10k) — separate band

Per research T3 — virtualizer + capped in-memory pages. Does not block Slice 1.

## 6. Regression armor (why “future iterations” won’t silently revive E35)

| Control | Mechanism |
|---------|-----------|
| Perf planes | Keep `chrome`/`local`/`full` for dogfood bisect |
| Invoke journal | CI/dogfood gate: unlock soak fails if `sign_event_native` or `listTombstones` climb above budget |
| Owner map | Handoff forbids remounting subtracted owners without investigation update |
| Soft L3 claim rule | Full-plane soak only |

## 7. Claim language

| May say | Must not say |
|---------|--------------|
| Chrome quarantine unlock **survives** (E37) | Soft L3 Fixed |
| Crash class = webview hydrate stampede | “Tauri is flawed / project unsalvageable” |
| Next = native-owned unlock (Slice 1) | “Rewrite outside Tauri” without new maintainer decision |

---

_Last updated: 2026-10-15T08:05:00Z_
