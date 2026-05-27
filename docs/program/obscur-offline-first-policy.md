# Offline-first policy — local shell, transport optional

**Status:** Active (2026-05-22)  
**User requirement:** The app must run locally; relay/network failure is a **transport** problem, not an app failure.

---

## Principles

1. **Local shell always loads** — UI, navigation, SQLite/IDB reads, settings, and conversation list work without any relay connection.
2. **Transport is async** — Relays, coordination HTTP, and backup fetch run in background queues; they never block React render or runtime phase `ready`.
3. **Fail open, report honestly** — Degraded banners and relay status show transport state; no infinite startup overlay on `connecting`.
4. **No network in bootstrap critical path** — Account projection and runtime activation converge on **local** evidence (identity unlock + projection replay), not `writableRelayCount > 0`.

---

## Ownership

| Concern | Owner | Network role |
|---------|--------|----------------|
| UI / navigation | Window runtime `ready` | None |
| DM read (native) | SQLite | None for display |
| DM send / sync | Transport port | Publish/subscribe when available |
| Account projection | Event log + SQLite seals | Optional backup restore (background) |
| Relay pool | `enhanced-relay-pool` | Background connect; offline → phase `offline` |

---

## Bands (O-series)

| Band | Deliverable |
|------|-------------|
| **O1** | Startup overlay + activation: shell ready without relay; native rehydrate skips relay fetch |
| **O2** | Transport supervisor: `navigator.offline` → offline phase; pause auto-recovery, coordination poll, recovery nudges |
| **O3** | Outbound queue UI: compose never blocked on relay; queue hints + pre-queue when offline / no writable relays |
| **O4** | Desktop dev: optional static shell build (no Next dev server required for QA) |

---

## Do not

- Gate `markRuntimeReady` on `accountSync.phase === "ready"` when local projection is ready.
- Gate startup overlay on relay `connecting` without timeout/bypass.
- Fetch relay profile (kind 0) before local restore on native.
