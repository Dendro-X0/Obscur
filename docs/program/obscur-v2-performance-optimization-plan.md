# Obscur v2 — Performance optimization plan (post-remake)

**Status:** Planned — execute **after** v2 slim kernel proof gate passes  
**Prerequisite:** [obscur-v2-slim-kernel-manifest.md](./obscur-v2-slim-kernel-manifest.md) Tier 0–3 complete  
**Companion:** [navigation-performance-contract.md](./navigation-performance-contract.md)

---

## Why performance work comes after the remake

Pre-remake slowness was largely **structural debt**, not missing micro-optimizations:

| Symptom | Root (not fixed by tuning) |
|---------|----------------------------|
| Dev white-screen / long boot | Next dev inside WebView2 + full workspace stack |
| UI freeze on sidebar nav | AppShell remount + parallel warm-up owners |
| DM “haunted” shrink | Hydrate pipeline replacing SQLite truth |
| High CPU with low disk | Main-thread merge/reconcile loops |

Optimizing those paths would preserve the wrong geometry. **Subtract first, measure second.**

User evidence (2026-06-09): **static startup without relays** shows complete DM history — correct read path, prod-like load. Performance plan assumes static shell + dm-kernel as baseline.

---

## Phase P0 — Baseline (1 session)

**Goal:** Numbers before any perf PRs.

| Surface | Command | Capture |
|---------|---------|---------|
| Desktop static cold open | `pnpm dev:desktop` | Time to interactive shell (stopwatch + DevTools Performance) |
| Desktop static DM open | same | Time from thread click → last message painted |
| Desktop release | `pnpm build:desktop` → run `.exe` | Same metrics on installed build |
| Dev live (optional) | `pnpm dev:desktop:live` | Compare vs static — document delta only |

**Artifacts:** append rows to `docs/handoffs/v2-perf-baseline.md` (create on first run).

**Tools already in repo:** `scripts/obscur-shell-perf-baseline.mjs`, navigation coordinator tests.

---

## Phase P1 — Dev loop (high leverage)

| Item | Action | Owner |
|------|--------|-------|
| Default dev | `pnpm dev:desktop` = static `out/` | `dev-desktop-static.mjs` |
| Live HMR | Opt-in `dev:desktop:live` only | `dev-desktop-fast.mjs` |
| Integration | `dev:desktop:online` explicit; never default | `dev-workspace-stack.mjs` |
| Rebuild UX | `--rebuild` flag documented in AGENTS/handoff | static script |
| Cache | `pnpm cache:clear` doc for stale `out/` | maintainer playbook |

**Exit:** Desktop daily dev never requires coordination, relay, or `:3340` unless explicitly chosen.

---

## Phase P2 — Startup & navigation (prod + dev)

From [navigation-performance-contract.md](./navigation-performance-contract.md):

1. **Persistent chrome** — sidebar/header stay mounted; route swaps content only (`persistent-app-chrome.tsx` path).
2. **Single warm-up owner** — `navigation-performance-coordinator.ts`; delete duplicate pathname effects.
3. **Scope heavy providers** — messaging transport / global dialogs off non-chat routes.
4. **Defer secondary-window work** — relay bootstrap stagger policies; no duplicate warm-up per profile window.

**Exit:** Rapid sidebar switching (10 routes in 30s) without main-thread long tasks >200ms (manual CDP or Performance panel).

---

## Phase P3 — Runtime data path (native)

| Item | Action |
|------|--------|
| DM read | Keep dm-kernel single invoke; no hydrate re-entry |
| DM write | Profile `db_insert_message` latency; batch only at UI boundary if needed |
| Sidebar list | `db_get_conversations` on mount + bus-driven refresh only |
| SQLite | Rust-side indexes already in libobscur; audit N+1 invoke patterns from JS |

**Exit:** Thread open ≤1 `db_get_messages` per conversation per session (plus pagination).

---

## Phase P4 — Bundle & ship

| Item | Action |
|------|--------|
| Static export | Tree-shake legacy hydrate imports from desktop bundle (eslint boundary) |
| Code split | Route-level chunks via existing `create-sidebar-route-page.tsx` authority |
| Release | `build:desktop` perf parity with static dev (same `out/`) |

**Exit:** Release `.exe` metrics within 20% of static dev baseline for shell + DM open.

---

## Phase P5 — Expansion (v2.0.0+)

After proof gate + P1–P4:

- Relay backfill via `dm-kernel-repair` port (background, non-blocking UI)
- Group thread re-attach behind kernel adapter (not parallel hydrate)
- Optional: dedicated perf CI smoke (not vitest mocks) — CDP long-task budget

---

## Non-goals (until v2.0.0)

- Turbopack in Tauri WebView2
- Parallel merge paths “optimized” with memoization
- New warm-up heuristics without deleting an existing owner
- Browser `:3340` as desktop perf proxy

---

## Order of execution

```
Remake proof gate → P0 baseline → P1 dev loop → P2 navigation → P3 data path → P4 bundle → P5 expansion
```

Do not start P2–P4 until dm-kernel proof gate passes on static desktop.
