# Research — Native-app shell performance (game-grade rigor)

**Date (UTC):** 2026-10-13  
**Status:** Research closed · standards drafted · implementation band not yet opened for soak  
**Trigger:** Client rendered virtually unusable (Not Responding / freeze); maintainer requires native/local-game feel, not “acceptable web lag.”  
**Standards:** [docs/program/obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md)  
**Public inspiration:** [native-perf-public-inspiration-2026-10.md](./native-perf-public-inspiration-2026-10.md)  
**Prior band:** [desktop-shell-lag-investigation-2026-10.md](./desktop-shell-lag-investigation-2026-10.md) · [desktop-shell-lag-postmessage-design-2026-10.md](./desktop-shell-lag-postmessage-design-2026-10.md)

---

```text
HANDOFF ATOMIC STEP:  Research + codify native performance standards (no soak)
PAUSED / CANCELLED:   M1–M3 · dialects · ASE-2 · SF-B · shell-lag L2 soak until standards accepted
CANONICAL OWNER:      apps/desktop shell · apps/pwa main-shell / messaging / runtime IPC
PROOF BEFORE DONE:    This research + standards doc (L0); L1–L4 deferred to implementation slices
SURFACE:              Tauri WebView2 desktop · PWA/mobile WebView · static-dev out/
```

---

## 1. North star

Obscur must feel like a **native local application** (or a local game loop): chrome stays interactive, input is never starved by content or network, and a 10 000+ message thread remains scrollable on low-end desktop and mobile. Network may fail; **local UI logic must not**.

This is **not** “make Next.js feel faster.” It is **frame/IPC/data-window discipline** with the same subtraction bias used in the Oct 12 shell-lag hunt.

## 2. Evidence synthesis (Oct 12–13 shell-lag)

Prior investigation already disproved several popular guesses and walked the failure class through eight revisions (E1–E18). Condensed causal stack:

| Layer | Finding | Evidence |
|-------|---------|----------|
| **L0 Windows queue** | `PostMessage 0x80070718` flood → lag / freeze → often `STATUS_HEAP_CORRUPTION` | E2: 3530 PM → heap |
| **L1 emit fan-in** | Quiet public relay `window.emit("relay-event")` saturates queue | E2–E3; Slice 1 coalesce cut 3530→22 |
| **L2 dial fan-out** | Multi-mount × Quiet hosts; JS claim insufficient | E6; Rust Quiet cap required |
| **L3 Quiet≠sole** | Quiet=0 still PM + heap | E7–E8 |
| **L4 invoke storm** | `engine_invoke` ~92% of IPC under Quiet=0 | E9 |
| **L5 hot methods** | listGroupMessages · tombstones · sign 30315 · leases · listConversations · get_session_nsec · get_tor_status | E10–E18 |
| **L6 heap ≠ PM** | Heap returns with **PM=0** under modest steady IPC | E14, E16 |
| **L7 partial wins** | Debounce/cache/once-per-profile cuts tops; survival improved; **L2 soak never green** | E13–E18 |

**CPU companion (2026-10-11):** ~30% WebView2 with healthy localhost:7000 while ghost public dials / style thrash — see canvas `obscur-cpu-optimization-plan`.

**Class conclusion for standards:** treat **native↔webview IPC pressure**, **always-on background work**, and **unbounded in-memory thread windows** as first-class threats. Webpack HMR and soft-lock DB spam were **disfavored** for the Oct 12 flood window (static shell; zero `desktop_db_ensure_open` in flood log). Soft-lock remains a separate correctness band.

## 3. Architecture map (what must stay fluid)

```text
┌─────────────────────────────────────────────────────────────┐
│ SHELL CHROME (must stay ≤1 frame budget)                    │
│  sidebar · nav · composer chrome · settings shell · lock UI │
└───────────────┬─────────────────────────────────────────────┘
                │ never blocked by ▼
┌───────────────▼─────────────────────────────────────────────┐
│ CONTENT WORKERS (async / coalesced / cancellable)           │
│  thread hydrate · media decode · link preview · search jump │
└───────────────┬─────────────────────────────────────────────┘
                │ never drives ▼ unbounded
┌───────────────▼─────────────────────────────────────────────┐
│ NATIVE BRIDGE (budgeted)                                    │
│  engine_invoke · sign_event_native · connect_relay · emit   │
└───────────────┬─────────────────────────────────────────────┘
                │ network is optional
┌───────────────▼─────────────────────────────────────────────┐
│ LOCAL TRUTH                                                 │
│  SQLite / dm-kernel pages · in-memory window ≠ full history │
└─────────────────────────────────────────────────────────────┘
```

**Invariant:** content or relay failure degrades **content**, never **chrome**. Root error boundary already forces full quit messaging; standards require **per-surface** isolation so a bad thread cannot freeze Relays/Settings.

## 4. Chat / 10k-message gap analysis

### What exists today (positive)

| Control | Location | Note |
|---------|----------|------|
| `@tanstack/react-virtual` | `message-list.tsx` | Viewport windowing present |
| `highLoadMode` (≥100 msgs / pending / fast scroll) | same | Cuts overscan, swipe, transitions |
| `suspendDynamicMeasurement` | same | Reduces measure thrash under load |
| `DM_KERNEL_PAGE_SIZE = 200` | `dm-kernel-thread-port.ts` | Paginated SQLite read |
| `chatPerformanceV2` setting | PrivacySettings | Feature flag for high-load path |
| Invoke / emit pressure meters | `invoke-pressure.ts` · Rust println | Observability from Slice 3 |

### Gaps vs 10k / native feel

| Gap | Risk at 10k | Severity |
|-----|-------------|----------|
| **React state holds full accumulated pages** | 50×200 loads → 10k `Message` objects always in hook state; virtualizer only limits DOM | **Critical** |
| **Render caches rebuilt over full array** | `buildMessageRenderCaches` / parse on large `messages` | **High** |
| **Row props pass `conversationMessages`** | Memoization blast radius on append | **High** |
| **Always-on presence / lease / tor / list** | Background IPC steals frames while scrolling | **Critical** (proven E9–E18) |
| **Public Quiet dial default** | Fan-in even when private relay healthy | **High** (CPU + lag) |
| **No hard IPC budget gate** | Meters exist; no hard deny / coalesce contract | **High** |
| **No frame-budget CI / soak gate** | L2 never closed; regression free | **High** |
| **Framer-motion on rows** | Motion cost under highLoadMode partially gated | **Medium** |
| **Mobile 4GB (MOB-1 deferred)** | Same JS path on low RAM | **High** for goal |

**Important:** virtualization alone **does not** meet the 10k goal if the JS heap and main-thread reconcile still process the full history every event.

## 5. Threat classes (ordered for program)

| ID | Class | Game analogy | Primary owners |
|----|-------|--------------|----------------|
| **T1** | Bridge saturation (invoke/emit/PostMessage) | Too many systems tick per frame | `relay.rs` · `engine_invoke` · adapters |
| **T2** | Always-on ticks (presence, lease, tor poll, list refresh) | Uncapped AI / network tick | presence · leases · warmup · sidebar |
| **T3** | Unbounded content window (10k in RAM/reconcile) | Loading whole level into GPU | dm-kernel · message-list · group thread |
| **T4** | Sync main-thread work (JSON parse, crypto, layout) | Spikes over 16.6 ms | render-meta · media · search |
| **T5** | Failure coupling (one surface blocks shell) | Exception in entity freezes world | error boundaries · suspense · cancel |
| **T6** | Dev/tooling amplifiers (CDP, dual WebView, debug) | Debug overlay tax | desktop boot flags |

## 6. Reuse vs archive

| Artifact | Use |
|----------|-----|
| Shell-lag investigation E1–E18 | **Canonical evidence** for T1/T2 |
| Shell-lag design slices 1–3i | Resume from **E18 + 3i** when soak band opens — do not restart from Quiet-only |
| v2 perf plan (archive inactive-2026-06) | Nav/chrome ideas valid; **superseded** for IPC/10k by this research + new standards |
| Navigation performance contract (archive) | Chrome persistence still required |
| `v2-perf-baseline.md` harness | Keep for nav medians; **insufficient alone** for IPC/heap/10k |
| NIM / Quiet policy | Align public-default with T1/T2 budgets |

## 7. Research conclusions (binding for standards)

1. **Shell freeze is a systems budget problem**, not a single UI widget bug.  
2. **Subtraction and coalesce beat caches** — but caches that cut proven hot methods (E10–E17) are allowed when they prevent IPC storms.  
3. **10k messages require a sliding window + SQLite paging**, not “virtualize a 10k array.”  
4. **Network and content must be best-effort**; chrome and composer input path are **hard real-time-ish** (interactive).  
5. **Claim language:** research ≠ fixed. “Native feel” only after named L2/L3 budgets in the standards doc pass.  
6. **Implementation soak** remains gated until standards are accepted and an atomic slice is opened — no silent re-open of parked L2 hunts without a budget target.

## 8. Recommended program phases (post-standards accept)

| Phase | Goal | Depends |
|-------|------|---------|
| **N0** | Standards accepted · budgets named · meters exportable | this doc |
| **N1** | Close residual T1/T2 from E18 (tor poll, list, heap) under hard IPC budget | shell-lag resume |
| **N2** | Sliding thread window + append-only virtualizer contract (10k L2 fixture) | N1 stable chrome |
| **N3** | Failure isolation + content cancel · low-end desktop soak | N2 |
| **N4** | Mobile low-RAM (MOB-1) under same budgets | N3 |

## Non-goals (this research)

- Implementing N1–N4 in this unit.  
- Claiming shell-lag fixed.  
- M1–M3 / dialects / ASE-2 under perf cover.  
- Accepting “works on my high-end machine” as proof.

_Last updated: 2026-10-13T13:10:00Z_
