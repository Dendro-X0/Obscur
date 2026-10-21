# Research — Public GitHub inspiration for native perf + crash resilience

**Date (UTC):** 2026-10-13  
**Status:** Research closed · feeds N0 standards + N1–N4 design  
**Companion:** [native-shell-performance-research-2026-10.md](./native-shell-performance-research-2026-10.md) · [obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md)  
**Method:** Public repos, upstream docs, and landed PRs — mapped to Obscur threat classes **T1–T6**. No code borrowed; patterns only.

---

```text
HANDOFF ATOMIC STEP:  Explore public GitHub perf inspiration (study only)
PAUSED / CANCELLED:   M1–M3 · dialects · ASE-2 · SF-B · shell-lag soak until N0 accept
CANONICAL OWNER:      specs/backend · docs/program (standards)
PROOF BEFORE DONE:    This inspiration map (L0)
SURFACE:              n/a (literature)
```

---

## 1. Why public inspiration

Obscur’s Oct 12–13 evidence already proved **IPC/queue saturation** and **heap under modest bridge traffic**. Chat UIs that “feel native” solve the same classes at scale: **bounded data windows**, **coalesced bridge traffic**, **stable virtualization**, and **WebView process recovery**. This doc extracts **actionable patterns** from mature public work — not star-count tourism.

## 2. Ranked inspiration sources

| Rank | Source | Stars (approx) | Primary gift to Obscur | Threat |
|------|--------|----------------|------------------------|--------|
| 1 | [tauri-apps/tauri](https://github.com/tauri-apps/tauri) docs — [Calling the Frontend](https://v2.tauri.app/develop/calling-frontend/) | 112k | **Events ≠ high throughput**; use **Channels** for ordered streams; emit is JSON/eval — not a game loop | T1 |
| 2 | [matrix-org/matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk) `TimelineWindow` | 2.2k | **Sliding window + unpaginate**; window does **not** auto-grow on sync | T3 |
| 3 | [element-hq/element-web](https://github.com/element-hq/element-web) Timeline MVVM PRs [#34464](https://github.com/element-hq/element-web/pull/34464) [#34683](https://github.com/element-hq/element-web/pull/34683) | 13.6k | View = TanStack Virtual; model = TimelineWindow; **trim far end before prepend**; height-stable rows; hide until settled | T3/T4/T5 |
| 4 | [signalapp/Signal-Desktop](https://github.com/signalapp/Signal-Desktop) Timeline commits | 16.6k | **Discard newest when deep in history**; height measurement cache; virtualizer patches for scroll | T3 |
| 5 | [wailsapp/wails](https://github.com/wailsapp/wails) [PR #6002](https://github.com/wailsapp/wails/pull/6002) | 36.5k | WebView2 **ProcessFailed** recovery; **bounded** attempts; **never rebuild inside** the failure handler; reset on successful nav | T5/T6 |
| 6 | [agentscope-ai/QwenPaw](https://github.com/agentscope-ai/QwenPaw) [PR #7128](https://github.com/agentscope-ai/QwenPaw/pull/7128) | — | Tauri Windows: subscribe `BrowserProcessExited`, **recreate WebView only**, keep host/backend; cap 3; restore bounds | T5 |
| 7 | [777genius/state-sync](https://github.com/777genius/state-sync) | 18 | `refreshInFlight` + `refreshQueued` → **100 invalidations → 2 fetches**; coalesce beats debounce for first paint | T1/T2 |
| 8 | [TanStack/virtual](https://github.com/TanStack/virtual) | 7.1k | Headless virtualizer Obscur already uses; Element chose it **over Virtuoso** for back-pagination stability | T3 |
| 9 | [petyosi/react-virtuoso](https://github.com/petyosi/react-virtuoso) | 6.5k | Strong chat DX; Element reported **scroll jumps on back-paginate** — treat as caution, not default migrate | T3 |
| 10 | [wolfpld/tracy](https://github.com/wolfpld/tracy) | 16.9k | Frame-profiler rigor — measure spikes, don’t guess | T4/T6 |
| 11 | [bevyengine/bevy](https://github.com/bevyengine/bevy) | 49k | Conceptual: fixed budgets / systems discipline — not a UI port | T2/T4 |
| 12 | Microsoft WebView2 docs — [Process-related events](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-related-events) | — | Official recovery matrix: browser exit → recreate; render exit → Reload; unresponsive → policy | T5 |

**Secondary (measured virtualization wins, IPC not addressed):**

| Source | Note |
|--------|------|
| [gptme/gptme](https://github.com/gptme/gptme) virt PRs | 1000 msgs: DOM −99%, heap 1.64 GB→68 MB — proves DOM windowing; **does not** fix Tauri invoke storms |
| [CopilotKit/CopilotKit](https://github.com/CopilotKit/CopilotKit) [#3611](https://github.com/CopilotKit/CopilotKit/pull/3611) | TanStack Virtual @50; warns jsdom never exercises virtualizer — Obscur must keep **browser/L2** proof |
| Stuffbucket skill *tauri-architecture-ipc-internals* | ~**1k JSON invoke/s** ceiling; sync `JSON.stringify` on UI thread; Channel for streams; sidecar for mmap-class data |

## 3. Pattern catalog → Obscur mapping

### P1 — Invalidate-coalesce-pull (not emit-everything)

**Seen in:** state-sync; Tauri docs (Channels for streams); Obscur Slice 1 EVENT coalesce.

**Rule:** Rust/native may signal “dirty” at high rate; JS may run **at most one in-flight refresh + one queued trailing refresh**. Prefer revision tokens over full EVENT payloads on the PostMessage path.

**Obscur gap:** Quiet/relay path partially coalesced; `engine_invoke` hot methods still storm (E9–E18). Apply coalesce to **list/lease/tor/presence** invalidations the same way.

### P2 — Channels for ordered high-rate native→JS

**Seen in:** Tauri official (Channels used internally for WS / download / child process).

**Rule:** Per-frame or per-WS-text `emit("relay-event", …)` is the wrong primitive. Prefer Channel (or batched pull) for relay fan-in.

**Obscur gap:** NativeRelay still event-oriented; design next emit slice against Channel or “revision + pull”.

### P3 — Sliding timeline window with unpaginate

**Seen in:** matrix-js-sdk `TimelineWindow`; Element RoomTimelineViewModel; Signal “discard newest when deep in history”.

**Rule:** In-memory message set is a **window** with max size; loading older **trims** the far end (or newest when reading history). Persistence stays in SQLite.

**Obscur gap:** `DM_KERNEL_PAGE_SIZE=200` pages accumulate without eviction — **blocks 10k bar** even with TanStack Virtual.

### P4 — Virtualizer is view-only; height stability is load-bearing

**Seen in:** Element (height-stable reply previews; don’t anchor to spinner rows); Signal height cache; Obscur `suspendDynamicMeasurement` / `highLoadMode`.

**Rule:** Async content that changes row height after mount causes scroll jumps and extra measure work. Prefer fixed skeletons / sync local resolve for nested previews under virtualization.

**Obscur gap:** Attachment/link/media growth inside rows still risks measure thrash at scale.

### P5 — Prefer TanStack Virtual for Obscur (stay)

**Seen in:** Element explicitly moved **to** TanStack Virtual citing Virtuoso back-pagination pain; Obscur already on `@tanstack/react-virtual`.

**Rule:** Do **not** migrate to Virtuoso for inspiration theater. Invest in window + anchor + measure discipline on the current stack.

### P6 — WebView2 process recovery (crash resilience)

**Seen in:** Wails #6002; QwenPaw #7128; Microsoft process events docs.

**Rule:**

| Failure | Recovery |
|---------|----------|
| Browser process exited | Recreate WebView/controller; keep Tauri host + Rust DB alive |
| Render process exited | Prefer `Reload` / re-navigate |
| Render unresponsive | Bounded reload policy; do not spin forever |
| Any recovery | Cap attempts (≈3); mutex; **post work out of the failure callback**; reset counter after successful navigation |

**Obscur gap:** Oct 12 `STATUS_HEAP_CORRUPTION` / Not Responding left operators killing the process. No documented WebView2 `ProcessFailed` / `BrowserProcessExited` recovery in desktop shell — **N3/N4 crash-resilience slice**.

### P7 — Measure like a game (Tracy mindset)

**Seen in:** Tracy; Bevy systems budgets (conceptual); Obscur invoke-pressure meters.

**Rule:** Named budgets + continuous meters. Long-task / IPC / RSS samples beat “feels better.”

**Obscur gap:** Meters exist; hard deny/coalesce gates and L2 soak not closed.

### P8 — Proof must hit real WebView

**Seen in:** CopilotKit review (jsdom clientHeight=0 never hits virtual path); Obscur nav contract; gptme Chromium CDP before/after.

**Rule:** L1 vitest ≠ native feel. 10k and IPC claims need L2 static-dev / packaged WebView2.

## 4. Explicit non-inspiration

| Temptation | Why reject |
|------------|------------|
| “Just switch to Electron for perf” | Different process model; does not remove JS main-thread or bridge cost; Obscur is Tauri-native |
| Copy Discord closed-source internals | Patterns only via public talk; no code |
| Port Bevy UI | Wrong surface; keep budget *discipline*, not ECS UI |
| Virtuoso migration as silver bullet | Element’s experience + Obscur already on TanStack |
| Virtualize DOM only | gptme numbers are real; Obscur’s freeze class is **also** IPC/heap (E14–E18) |

## 5. Recommended adoption order (after N0 accept)

| Phase | Adopt | Public anchor |
|-------|-------|---------------|
| **N1** | Invalidate-coalesce for remaining hot `engine_invoke` + Channel/batch for relay fan-in | Tauri Channels · state-sync · E18 |
| **N2** | TimelineWindow-style sliding window + Signal discard-far-end | matrix-js-sdk · Signal · Element VM |
| **N2+** | Height-stable row contract under virtualizer | Element MVVM |
| **N3** | WebView2 ProcessFailed / BrowserProcessExited recovery (bounded) | Wails · QwenPaw · MS docs |
| **N4** | Low-end soak + Tracy-class profiling discipline | Tracy mindset · MOB-1 |

## 6. Standards deltas (proposed — apply on N0 revise if accepted)

Add to [obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md):

1. **Bridge primitive:** high-rate native→JS must use Channel or coalesce-pull; raw per-item `emit` is non-compliant above budget.  
2. **Timeline window:** unpaginate/discard required for ≥N pages (N default 3).  
3. **Crash resilience:** desktop must handle WebView2 process failure with bounded recreate/reload; blank forever = fail.  
4. **Recovery proof:** L3 includes intentional WebView kill / render hang recovery smoke when platform allows.

## 7. Citations (canonical URLs)

- https://v2.tauri.app/develop/calling-frontend/  
- https://github.com/matrix-org/matrix-js-sdk (TimelineWindow)  
- https://github.com/element-hq/element-web/pull/34464 · https://github.com/element-hq/element-web/pull/34683  
- https://github.com/signalapp/Signal-Desktop/commit/6b4bea63307073dbe1a4735d22c79195bb15632f  
- https://github.com/wailsapp/wails/pull/6002  
- https://github.com/agentscope-ai/QwenPaw/pull/7128  
- https://github.com/777genius/state-sync  
- https://github.com/TanStack/virtual  
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-related-events  

_Last updated: 2026-10-13T13:25:00Z_
