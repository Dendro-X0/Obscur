# Research — Progressive loading (Apple-inspired launch ladder)

**Date (UTC):** 2026-10-13  
**Status:** Research closed · standards deltas proposed  
**Companions:** [native-shell-performance-research-2026-10.md](./native-shell-performance-research-2026-10.md) · [native-hardware-acceleration-research-2026-10.md](./native-hardware-acceleration-research-2026-10.md) · [obscur-native-performance-standards.md](../../docs/program/obscur-native-performance-standards.md)  
**Prior (archive):** `navigation-performance-contract.md` · v2 perf plan (single warm-up owner)

---

```text
HANDOFF ATOMIC STEP:  Research progressive loading strategy (study only)
PAUSED / CANCELLED:   M1–M3 · dialects · ASE-2 · SF-B · shell-lag soak until N0 accept
CANONICAL OWNER:      app-shell · navigation warm-up · runtime providers · desktop boot
PROOF BEFORE DONE:    This research + standards § progressive (L0)
SURFACE:              All shells — desktop Tauri · mobile · PWA (same ladder, platform adapters)
```

---

## 1. Goal

Load **what the user needs now** first; defer the rest until idle or intent. Match Apple’s launch discipline: first frame fast, main thread free for input, non-critical work after interactive — so Obscur feels smooth on **low-end and high-end**, Windows/macOS/Linux/mobile.

Progressive loading is **not** a splash screen covering a full warm-up. It is a **priority ladder** with cancelable later phases.

## 2. Apple / OS inspiration (patterns, not ports)

From Apple launch guidance ([Reducing your app’s launch time](https://developer.apple.com/documentation/xcode/reducing-your-app-s-launch-time), UIKit launch docs):

| Apple idea | Obscur translation |
|------------|-------------------|
| First frame before heavy init | Unlock chrome / chat chrome before Quiet dials, settings tabs, vault index |
| Defer features not needed immediately | Settings panels, search index, retention sweeps, ambient probes |
| Main thread free to draw + handle input | No `engine_invoke` storms / sync JSON on launch path |
| Move long work off launch path | Idle `requestIdleCallback` / after quiescence coordinator |
| Extended launch: placeholders + async | Thread skeleton → first page of messages; media posters |
| Measure cold vs warm launch | L2 cold unlock vs resume; don’t optimize only warm |

Perceived speed > absolute “everything ready.” Interactive chrome with incomplete content beats a frozen complete app.

## 3. Obscur launch ladder (canonical phases)

```text
P0  Process / WebView ready
P1  Auth or unlocked chrome skeleton (sidebar + composer chrome)  ← INPUT MUST WORK
P2  Critical surface content (selected chat window / last route)
P3  Context (adjacent nav chunks, peer display for visible rows)
P4  Background (other routes, settings tabs, vault, search, sweeps)
P5  Speculative / optional (Quiet public dials, latency probes, analytics-class)
```

| Phase | Must include | Must **not** block |
|-------|--------------|-------------------|
| **P1** | Persistent chrome, lock UI, nav affordances | Relay fan-in, full history, media decode, settings modules |
| **P2** | Sliding message window (≤1–3 pages), send path ready | Full 10k hydrate, all conversations’ previews |
| **P3** | Intent prefetch of likely next route; visible metadata | Entire sidebar route graph |
| **P4** | Idle warm-up of remaining routes / heavy panels | Competing with scroll/input |
| **P5** | Public Quiet / standby probes only if policy allows | Never before P1 interactive |

**Failure rule:** If P2/P4/P5 fail, P1 stays alive (aligns with chrome-first + failure isolation standards).

## 4. What already exists (build on, don’t duplicate)

| Mechanism | Location | Ladder fit |
|-----------|----------|------------|
| Intelligent nav warm-up **critical → context → special → background** | `intelligent-navigation-warmup-policy.ts` · runner | **P3–P4** (route chunks) |
| Idle-sequential warm-up + stale cancel | `intelligent-navigation-warmup-runner.ts` | Apple “after first frame” |
| Quiescence coordinator (no warm-up during rapid nav) | `navigation-performance-coordinator.ts` | Protects input |
| Shell-only warm-up on prod desktop | `resolveRouteNavigationWarmupMode` | Avoid double-pay with eager sidebar |
| Intent prefetch on hover/focus | `prefetchSidebarRouteClientOnIntent` | P3 |
| Lazy global dialogs | `LazyGlobalDialogManager` | P4 |
| Deferred settings tab panels | `settings-page-shell.tsx` | P4 |
| Messaging domain only on messaging routes | `route-domain-providers.tsx` | Domain gating |
| Experiment idle defer (12s / idle) | `experiment-shell-policy.ts` | P4 — **offline stub only** |
| Relay `startup_warmup` honesty | readiness banners | Prevents false “offline” during P5 |
| `startTransition` sidebar schedule | `schedule-sidebar-navigation.ts` | Keep chrome responsive |
| `highLoadMode` / chatPerformanceV2 | message-list | Content tier under load |

**Single-owner rule (keep):** one navigation warm-up planner. Extend the plan; do not add a parallel progressive system.

## 5. Gaps vs Apple-grade progressive UX

| Gap | Risk | Severity |
|-----|------|----------|
| **Online shell turns deferrals off** (`isExperimentOnlineEnabled` → heavy work same as full shell) | Unlock races Quiet + lists + hydrate | **Critical** (matches Oct lag onset) |
| **No explicit P0–P5 contract** across boot / unlock / relay | Features re-enter early | **High** |
| **P5 Quiet/public dials still early in product path** | GPU/CPU + IPC before chrome stable | **Critical** (E2–E7) |
| **Settings / vault / search not gated by “opened once”** beyond nav warm-up | Memory + IPC on idle | **Medium** |
| **Thread still accumulates pages** (no sliding window) | P2 grows into full history | **Critical** for 10k (N2) |
| **Cross-platform parity undocumented** | Mobile may reintroduce eager stacks | **High** |
| **Progress nav UX disabled** | Fine for honesty; still need skeleton states | **Low** |

## 6. Progressive content strategy (chat)

Aligned with N2 sliding window + HW policy:

1. **P2:** Show chrome + latest window (≤200–600 msgs) from SQLite immediately.  
2. **Skeleton / empty:** Prefer local truth over waiting for relay EOSE.  
3. **P3:** Peer avatars/names for **visible** rows only.  
4. **P4:** `loadEarlier` on scroll-up intent only.  
5. **Media:** Poster first; decode on visible + user intent (≤1 HW decode).  
6. **Groups:** Defer roster/snapshot thrash until community surface focused (roster widen-on-warmup already exists — keep).

## 7. Cross-OS / cross-device bar

Same **ladder and budgets**; adapters differ:

| Surface | Adapter notes |
|---------|----------------|
| Desktop WebView2 | Static `out/` shell; HW accel on; CDP-off for L2 |
| macOS / Linux WebView | Same P1–P5; profile GPU flags per platform |
| Mobile Tauri | Stricter P4/P5; earlier `highLoadMode`; MOB-1 memory |
| Browser PWA | No native invoke; still progressive route/domain gating |

**Do not** ship “desktop-only progressive, mobile eager.” Low-end devices need the ladder most.

## 8. Proposed phases after N0 accept

| Slice | Work | Proof |
|-------|------|-------|
| **L0** | Standards § progressive ladder (this doc) | Spec accept |
| **PL1** | Boot/unlock gate: P5 Quiet + standby probes **after** P1 interactive + quiescence | L2: no Quiet dial before chrome input |
| **PL2** | Keep online product on **idle-deferred** heavy work (don’t only defer in offline stub) | L1 policy tests · L2 unlock timeline |
| **PL3** | Feature modules: settings/vault/search **mount-on-visit**; idle warm optional | Bundle / mount probes |
| **PL4** | Thread P2 sliding window (with N2) | 10k fixture |
| **PL5** | Cross-shell checklist (desktop/mobile/PWA) in L3 | One matrix row each |

## 9. Forbidden progressive anti-patterns

| Anti-pattern | Why |
|--------------|-----|
| Splash that waits for “fully ready” | Hides jank; Apple forbids long launch work |
| Second warm-up owner “for progressive” | Navigation contract violation |
| Eager Quiet dial to feel “connected” | Causes unusable shell (proven) |
| Defer only in experiment offline stub | Production path still floods |
| Progressive = more prefetch in parallel | Must stay sequential + idle + cancelable |
| Claiming cross-device smooth without low-end L4 | Honesty |

## 10. Conclusions

1. Obscur **already has** Apple-like **route** progressive warm-up (critical→context→background).  
2. The missing piece is a **boot/unlock content & network ladder** so P5 never steals P1 — especially with online deferrals currently off.  
3. Progressive loading + sliding windows + IPC budgets + responsible GPU form one program; none substitutes for another.  
4. Cross-OS smoothness comes from **shared phase contracts**, not identical WebView quirks.

_Last updated: 2026-10-13T13:45:00Z_
