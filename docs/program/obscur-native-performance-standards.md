# Obscur — Native performance standards

**Status:** **Canonical** — accept before new shell-perf implementation slices  
**Date (UTC):** 2026-10-13  
**Research:** [native-shell-performance-research-2026-10.md](../../specs/backend/native-shell-performance-research-2026-10.md) · [native-hardware-acceleration-research-2026-10.md](../../specs/backend/native-hardware-acceleration-research-2026-10.md) · [native-progressive-loading-research-2026-10.md](../../specs/backend/native-progressive-loading-research-2026-10.md)  
**Evidence band:** [specs/backend/desktop-shell-lag-investigation-2026-10.md](../../specs/backend/desktop-shell-lag-investigation-2026-10.md)  
**Companion (nav only):** archive `navigation-performance-contract.md` — chrome persistence + **single** warm-up owner still required; IPC/10k/progressive budgets live **here**.

---

## 1. Purpose

Codify **game-grade** performance rules so Obscur never again ships a shell that freezes under normal use. Web-stack lag is **not** an acceptable product state. Local logic must stay fluid when network or content fails.

Agents and maintainers: **no performance claim**, and no “lag fixed” language, without the proof layers in §7.

## 2. Product bar

| Bar | Requirement |
|-----|-------------|
| **Native feel** | Chrome (sidebar, nav, composer chrome, lock/settings shell) responds like a local app — not a busy web page |
| **Failure isolation** | Content load failure, relay down, or media error **must not** freeze chrome or input |
| **Large threads** | A conversation with **≥10 000** messages remains scrollable and interactive on **low-end desktop** and **mid/low mobile** |
| **Network optional** | Offline / stalled relays may stall sync; they must not stall the local event loop |
| **Honesty** | Debug CDP, dual-profile, and Quiet public dials are taxed — document when dogfood requires `OBSCUR_CDP_MAIN=0` |

## 3. Hard invariants (must not violate)

1. **Chrome budget first** — Shell chrome work must not wait on thread hydrate, media, link preview, or relay EOSE.  
2. **Subtraction over ornament** — Cut emit/invoke/dial/tick owners before adding memoization layers.  
3. **Bounded windows** — In-memory message arrays for a visible thread are a **sliding window**, not full history. Virtual DOM windowing without a data window is **non-compliant** for the 10k bar.  
4. **Single warm-up / dial owner** — Process-wide caps for Quiet/public dials; multi-mount React must not ×N NativeRelay.  
5. **Budgeted bridge** — Native↔webview IPC (invoke + emit) has **hard rate budgets**; meters alone are insufficient.  
6. **No silent always-on** — Presence, lease heartbeat, tor status, sidebar list refresh, and similar ticks need named intervals + coalesce; no effect that re-signs or re-lists on unstable deps.  
7. **Failure containment** — A faulting content surface degrades that surface; chrome remains usable (per-surface boundary, cancel, or inert stub).  
8. **Responsible GPU** — Keep WebView2 hardware acceleration **on**; accelerate compositor/media carefully; **never** “fix” lag by promoting every row to a layer or forcing discrete GPU by default.  
9. **Progressive ladder** — P1 interactive chrome before P2 content completeness before P4/P5 background/network speculation; later phases idle, sequential, cancelable; **one** navigation warm-up owner.  
10. **Claim discipline** — Design accepted ≠ implemented ≠ verified. Match shell-lag claim language.

## 4. Budgets (initial — revise only with evidence)

Targets assume **static `out/` shell** or release build, **CDP-off** for L2 desktop soak unless a row explicitly tests CDP-on tax.

### 4.1 Frame / input (main thread)

| Signal | Pass | Surface |
|--------|------|---------|
| Input / click → chrome reaction | ≤ **100 ms** p95 perceived | Desktop + mobile |
| Long tasks during idle unlocked | **0** tasks **>50 ms** in 60 s sample | Desktop DevTools / CDP |
| Long tasks during scroll in 10k fixture | **0** tasks **>100 ms**; p95 frame **≤33 ms** (30 FPS floor) | Low-end desktop |
| Preferred steady scroll | p95 frame **≤16.7 ms** (60 FPS) when device allows | Mid+ desktop |

### 4.2 Native bridge (IPC)

| Signal | Pass | Notes |
|--------|------|-------|
| `PostMessage 0x80070718` | **0** sustained; burst **&lt;10** then flat | From Oct 12 L2 bar |
| `engine_invoke` rate (idle unlocked, 1 profile) | **≤30 / min** steady after warm-up | Exclude explicit user actions |
| Any single `eng:*` method idle | **≤10 / min** after warm-up | Hot-method regression gate |
| `sign_event_native` idle | Presence **≤2 / heartbeat window**; no remount thrash | Kind meter required |
| Quiet public `connect_relay` hosts | **≤1** process-wide when Quiet allowed; **0** when private/local preferred | Rust + JS |
| Heap / process death | **No** `STATUS_HEAP_CORRUPTION` in **≥20 min** idle+light nav | Debug static-dev |

### 4.3 Thread data window (10k bar)

| Signal | Pass |
|--------|------|
| Messages held in React state for active thread | **≤ ~2–3 pages** (default page **200** → **≤600** unless design raises page size with proof) |
| DOM rows mounted | Virtualizer only; overscan **≤8** normal, **≤4** high-load, **≤2** when measurement suspended |
| Open thread cold (cached SQLite) | First paint of latest window **≤300 ms** p95 after click (local DB hot) |
| `loadEarlier` | Async; must not block composer; cancel on conversation switch |
| Background non-selected threads | No full array hydrate; at most preview/index |

### 4.4 Memory (guidance)

| Signal | Pass (guidance) |
|--------|-----------------|
| Single-profile idle unlocked RSS climb | No unbounded climb; investigate if **+150 MB / 10 min** with flat IPC |
| 10k fixture after scroll soak | Stable heap; no retained detached message trees from prior conversations |

### 4.5 Low-end / mobile

| Signal | Pass |
|--------|------|
| Low-end desktop (≤4 logical cores, ≤8 GB RAM) | Meets §4.1 30 FPS floor + §4.2 IPC + §4.3 window |
| Mobile WebView mid/low | Same window bounds; disable non-essential motion in high-load (already `highLoadMode` pattern) |
| Dual-profile | Each profile counted separately for IPC; process-wide dial caps still apply |

### 4.6 Hardware acceleration / compositor

Research: [native-hardware-acceleration-research-2026-10.md](../../specs/backend/native-hardware-acceleration-research-2026-10.md).

| Signal | Pass |
|--------|------|
| WebView2 GPU (release) | **Enabled** — no shipped `--disable-gpu` |
| Discrete GPU force (`--force_high_performance_gpu`) | **Off** by default (integrated / OS preference) |
| Permanent `will-change` / `translateZ` on message rows | **Forbidden** |
| Concurrent HW-decoded videos in one thread | **≤1** autoplay; others poster/paused |
| Motion under `highLoadMode` / `prefers-reduced-motion` | Transitions / swipe layers / non-essential blur **off** |
| Dual-profile background window | No continuous media decode; prefer suspend / low memory when unfocused |
| Idle GPU (single profile, chat open, not scrolling) | Investigate sustained **>15%** GPU with flat IPC |

### 4.7 Progressive loading (launch ladder)

Research: [native-progressive-loading-research-2026-10.md](../../specs/backend/native-progressive-loading-research-2026-10.md).  
Phases: **P0** process → **P1** interactive chrome → **P2** critical content window → **P3** context/intent → **P4** background routes/features → **P5** speculative network (Quiet/probes).

| Signal | Pass |
|--------|------|
| P1 input (sidebar / composer chrome / lock) | Usable **before** Quiet public dials and full route graph warm |
| P5 Quiet / standby probes | Only after P1 interactive + navigation **quiescence** (unless user opened Relays) |
| Navigation warm-up | Single owner; **critical → context → background**; idle + cancel on route change |
| Online product shell | Must still **idle-defer** heavy hydrate/list storms — deferral is not offline-stub-only |
| Settings / vault / search heavy panels | Mount-on-visit (or idle warm); not required for P1 |
| P2 thread | Local SQLite window first; relay backfill must not block chrome |
| Cross-shell | Same P1–P5 contract on desktop, mobile, PWA (adapters may differ) |
| Cold unlock → P1 interactive | Target **≤2 s** p95 on mid desktop static shell (revise with baseline evidence) |

## 5. Forbidden patterns

| Pattern | Why |
|---------|-----|
| Full-history array as render source for “virtualized” lists | Heap + reconcile cost scales with N |
| Per-item high-rate `emit` / JSON invoke as a data plane | Tauri docs: events ≠ throughput; ~1k JSON invoke/s ceiling |
| Unstable effect deps that publish/sign/list every render | Proven presence 30315 storm (E12) |
| Persist-on-every-touch lease / disk thrash | E13–E14 |
| Multi-mount independent Quiet dials | E6 |
| Browser fallback after `quiet_dial_cap` reject | Circumvents process cap |
| Polling tor/status on every event | E18 class |
| Treating vitest green as native-feel proof | Nav contract lesson · jsdom cannot prove virtualizers |
| New features that add always-on IPC without a budget row | Regression factory |
| “Optimize” by adding parallel hydrate owners | Violates subtraction |
| Unbounded WebView recovery loops | Wails/QwenPaw: cap attempts or hot-spawn crash loops |
| Migrating virtualizer libraries without L2 scroll-stability proof | Element left Virtuoso for TanStack on back-paginate |
| Shipping `--disable-gpu` in production | MS: GPU compositing is critical; disable only for troubleshooting |
| Forcing discrete GPU for chat chrome | Battery + heat on dual-GPU laptops; no proven need |
| Permanent layer promotion or heavy `backdrop-filter` on every scroll row | GPU memory / bandwidth thrash |
| Blind `translateZ(0)` / `will-change` “acceleration hacks” | Layers ≠ enabling HW accel (Mozilla Gfx) |
| Splash / gate waiting for “fully synced” before chrome input | Apple: first frame + defer; hides jank |
| Second progressive / warm-up owner parallel to navigation coordinator | Navigation contract regression |
| Eager Quiet/public dial to feel connected at unlock | Proven shell unusable (E2–E7) |
| Defer heavy work only in experiment offline stub | Production online path must keep ladder |
| Parallel prefetch of entire route graph on unlock | Must stay sequential + idle |
| Mounting `UnlockedAppRuntimeShell` (Relay/Messaging/DM) on `/profiles*` | E19–E21 · picker freeze + heap |
| Gating light shell on `hasNativeRuntime()` alone (bridge flicker remounts heavy tree) | E20 |
| Unlock→`/`→`/profiles` bounce after the user already picked a profile | E21/N1e · session consume flag required |
| Uncached `desktop_harvest_profile_web_storage` on every isolation snapshot | E20 picker residual |
| Picker lease list poll faster than lease TTL (or without visibility gate) | E19–E22 |
| Claiming “picker fixed” without CDP-off `[invoke-pressure]` sample lacking `engine_invoke`/tombstone/sign | N1 proof honesty |
| Stress/automation that opens profile windows while asserting picker IPC budgets | Leaving picker mounts messaging by design |
| Claiming soft-lock L3 after picker-only proof while unlocked entry still floods PostMessage | E23 · 8157× `0x80070718` after Tester1 entry |
| Parallel unlock hydrate (warmup + cold-start repair + sidebar list/tombstone) before P1 idle | E23 · standards §4.7 |

## 6. Required patterns

| Pattern | Intent |
|---------|--------|
| Sliding window + SQLite page + **unpaginate/discard** far end | 10k compliance (Matrix TimelineWindow / Signal) |
| High-rate native→JS via **Channel or invalidate-coalesce-pull** (≤1 in-flight + 1 queued) | T1 (Tauri Channels · state-sync) |
| Process-wide dial / Quiet gates (Rust sticky) | T1 |
| Coalesce emits; cache/debounce proven hot `engine_invoke` methods | T1/T2 |
| Height-stable rows under virtualization (no late async height growth) | T4 (Element) |
| `highLoadMode` / suspend measurement / motion off under load | T4 |
| WebView2 HW accel **on**; promote **few** animated/sticky layers only; ≤1 active video decode | Compositor budget (§4.6) |
| Progressive P1→P5 ladder; extend `intelligent-navigation-warmup-policy` only | Launch / nav progressive (§4.7) |
| `[invoke-pressure]` / `[emit-pressure]` retained in debug | Observability |
| Persistent chrome; single navigation warm-up owner | T4/T5 |
| Per-surface error/inert boundaries for content | T5 |
| **WebView2 ProcessFailed / BrowserProcessExited** handling with attempt cap (~3), mutex, work posted off the failure callback | T5 crash resilience (Wails · MS docs) |
| Feature work that needs IPC must declare budget impact in design | Process |

**Public inspiration map:** [native-perf-public-inspiration-2026-10.md](../../specs/backend/native-perf-public-inspiration-2026-10.md)

## 7. Proof layers

| Layer | Meaning | Example |
|-------|---------|---------|
| **L0** | Spec / standard accepted | This doc + research |
| **L1** | Automated unit/contract | vitest dial-cap · window math · coalesce · IPC budget helpers |
| **L2** | Desktop static-dev soak | `OBSCUR_CDP_MAIN=0 pnpm dev:desktop:no-coord` · ≥20 min · budgets §4.2 |
| **L3** | Product path | Navigate · open 10k fixture thread · scroll · send · dual-profile optional · **WebView recovery smoke** when platform allows |
| **L4** | Packaged / low-end | Release exe or declared low-end hardware pass |

**Done means:** named slice cites budgets + L1 green + L2 (and L3 when user-visible).  
**Not done:** “feels better on my machine,” meters without budgets, or PM=0 with heap death.

## 8. Slice discipline (when implementation re-opens)

1. Quote **one** threat class (T1–T6 from research) and **one** budget row.  
2. Prefer subtraction of an owner; add cache only against a named hot method.  
3. Keep Quiet=0 / CDP-off honesty until a raise is L2-proven.  
4. Do not combine M1–M3 / dialects / ASE-2 with perf slices.  
5. Update shell-lag investigation evidence table when L2 runs change the causal stack.  
6. Update this standards doc **only** when budgets change with evidence — not aspirationally.

## 9. Relationship to parked shell-lag band

- **Research + standards (this unit):** open.  
- **L2/L3 soak / further Slice 3i+ code:** open only via explicit atomic step after N0 accept.  
- Resume point for IPC hunt: investigation **E18** + design **Slice 3i** (tor/warmup cache).  
- 10k sliding window is **N2** — do not block N1 chrome stability on full 10k work, but do not claim 10k until N2 L2/L3.

## 10. Checklist (agents — before any perf diff)

- [ ] Read research §7 conclusions  
- [ ] Name threat class + budget row  
- [ ] Confirm PAUSED bands (M1–M3 / dialects / ASE-2) untouched  
- [ ] Plan L1 command + L2 soak command  
- [ ] No full-history render source  
- [ ] No new always-on IPC without coalesce/cache and budget note  
- [ ] Run `pnpm verify:native-perf-n1` when touching profiles/shell/runtime/leases/tor adapter  
- [ ] If `/profiles` or unlock routing changes: CDP-off cold start · first `[invoke-pressure]` picker-only · click profile enters app (no bounce)

## 11. N1 regression lock (must not regress)

| Lock | L1 | L2/L3 |
|------|----|-------|
| Light shell on `/profiles*` (desktop shell OR native) | `profile-picker.contract.test.ts` | Cold start stamp · no `desktop-warmup-progress` on picker |
| Startup picker defer + **consume** on profile click | same contract + AuthGateway consume flag | Click Tester1 → home/sign-in stays out of `/profiles` loop |
| Lease TTL 60s / HB ≤ TTL/2 · list cache · harvest cache | contract constants + source | Idle picker · lease ≤ ~1/min · harvest flat |
| Tor status via adapter cache (no raw per-event spam) | relay adapter / auto-lock paths | No `get_tor_status` climb on idle picker |
| Proof command | `pnpm verify:native-perf-n1` | `OBSCUR_CDP_MAIN=0 pnpm dev:desktop:no-coord` · stress: `node scripts/n1c-profiles-stress-cdp.mjs` (**picker-scoped only**) |

Investigation continuity: [desktop-shell-lag-investigation-2026-10.md](../../specs/backend/desktop-shell-lag-investigation-2026-10.md) E19–E22.

_Last updated: 2026-10-13T17:55:00Z_
