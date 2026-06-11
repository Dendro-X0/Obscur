# Obscur v2 Slim Kernel — manifest

**Status:** Active (2026-06-09)  
**Strategy:** Daraxonrasib bypass — do not bind to the R1 hydrate pipeline; route native DM through a new geometry.

## Problem (why patches fail)

DM thread visibility is split across six+ owners (hydrate pipeline, projection, chat-state, display cache, live overlay, SQLite). First paint can be complete; a background hydrate **replaces** the list with a partial SQLite snapshot (one-sided history). Local merge patches cannot fix this — the binding surface is wrong.

## v2 principle

> **Native desktop/mobile DM = one read port + one write port. No hydrate, no merge, no projection authority.**

Web/PWA dev may keep legacy paths until cutover; native runtime uses **dm-kernel** only.

## Tier order (execution)

| Tier | Action | Status |
|------|--------|--------|
| **0** | Quarantine hydrate pipeline from native DM UI path | **Landed** — `use-thread-messages` bypasses `use-conversation-messages` when kernel active |
| **1** | `dm-kernel` module — SQLite invoke + messageBus append-only | **Landed** — `features/dm-kernel/` |
| **2** | Static desktop shell dev; drop full stack as default | **Landed** — `pnpm dev:desktop` → `dev-desktop-static.mjs` + `OBSCUR_DESKTOP_STATIC_DEV=1` |
| **3** | Infrastructure amputation (coordination/relay not in daily dev) | **Landed** — `dev:desktop:online` integration-only banner |
| **4** | Programmatic gates only (manual soak suspended) | **Landed** — `pnpm verify:v2-slim`; native CDP `pnpm capture:runtime:dm-kernel` (+ bidirectional + transport repair smoke) |

## Manual testing

**Suspended (2026-06-09).** Empty UI on fresh profile or stale `out/` is not a gate failure. Use `pnpm verify:v2-slim` + native CDP gate (`pnpm capture:runtime:dm-kernel` after manual unlock in Tauri).

## dm-kernel contract

### Read

- `db_get_messages(profile_id, conversation_id, limit, before_received_at)` — sole thread authority
- Live session: `messageBus` **append/update/delete only** — never full list replacement after initial load
- One-sided SQLite: log `dm_kernel.one_sided_sqlite` — do not merge projection/chat-state to “fix”

### Write (unchanged interim owner)

- `messageBus` → `MessagePersistenceService` → `db_insert_message`
- Send UI: existing `dmController.sendDm` (single send path)

### Sidebar list

- `db_get_conversations` — sole list authority on native (no chat-state paint)

## Cease to exist (native path)

These must not run when `isDmKernelAuthority()`:

- `runDmConversationHydrateReadModelPipeline`
- `assembleDmHydrateThreadReadModel` direction merge / projection gap-fill
- `use-conversation-messages` hydrate retry loops
- chat-state as DM message source
- account projection as DM timeline authority

Files remain in tree for web legacy; **production native imports are forbidden** (contract test).

## Proof gate (before v2.0.0 claims)

Two desktop profiles; 10 messages each direction; full quit; relaunch; **both see all 20**. No silent shrink after load.

**Passed (2026-06-10):** Two-profile bidirectional restart soak — both see full thread after relaunch; no post-load shrink.

## Performance (post-remake)

Do not tune hydrate/merge paths. Plan: [obscur-v2-performance-optimization-plan.md](./obscur-v2-performance-optimization-plan.md) — baseline after proof gate, then navigation subtraction + bundle diet.

## Feature cuts accepted (v2 slim)

- Groups messaging backend (already stubbed)
- Dev Lab **core/full** until CDP native scenarios green
- `dev:desktop:online` as non-default
- Projection/chat-state DM read on native
- Turbopack in Tauri WebView2

## Expansion path (P5 — active)

| Item | Status |
|------|--------|
| Relay backfill via `dm-kernel-repair` + one-sided detect | **Landed** |
| Cold-start profile repair scan on unlock | **Landed** — `dm-kernel-cold-start-repair` |
| Post-repair SQLite re-read (session cache invalidate) | **Landed** — `use-dm-kernel-thread` |
| Group thread read via `dm-kernel-group-thread-port` | **Landed** |
| v2.0.0 installer static `out/` only | Pending |
| Dev-lab core benchmark (`pnpm verify:tier3`) | **Landed** — 13/13 on online static shell |
| Native in-app gate (`pnpm dev:lab:native-gate`) | **Landed** — replaces CDP for Tier 2 |
