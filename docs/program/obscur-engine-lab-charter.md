# Obscur Engine Lab — charter

**Status:** **Canonical** — supersedes v1.9.x “restore the product” framing  
**Last updated:** 2026-06-17  
**Band:** `ENGINE-LAB`

This repository is **not** a shippable consumer app as the primary deliverable. It is an **experimental workspace** for a **library and toolkit**: separable engines, kernel contracts, protocol specifications, and aggressive subtraction of legacy integrations.

The original **Obscur App UI** (`apps/pwa`) is a **frozen experiment and test harness** — useful for manual probes and future integration of the self-developed library, not the iteration target.

No dev server or installer is required to work here. Progress = **package-level tests + contract gates**, not “the UI looks fine.”

_Last updated: 2026-06-17_

---

## Backend-first roadmap

**Canonical order:** [obscur-backend-engine-roadmap.md](./obscur-backend-engine-roadmap.md)

Improve core engines across **integration → fault tolerance → performance → maintainability**, then subtract legacy. UI archived: [obscur-ui-archive-manifest.md](./obscur-ui-archive-manifest.md).

**Only additions and subtractions.** No product protection strategies.

---

## Library-first product intent

Obscur is being built as **infrastructure others can deploy and customize** — comparable in integration shape to Better Auth or Stripe SDKs, not a single branded client.

| Goal | How the repo supports it |
|------|---------------------------|
| **Deploy** | Rust core (`libobscur`, headless CLI) + optional coordination/relay services |
| **Scale** | Engine packages with explicit ports; host boundary instead of app singletons |
| **Customize** | Protocol and specs in packages; hosts swap adapters without forking UI |
| **Integrate** | npm `@obscur/*` engines + `HostEnginePort`; apps compose, engines own truth |

**Primary deliverable:** libraries and specifications in `packages/` + `libobscur`.  
**Secondary:** archived UI + ui-kit as reference and manual test surface until a host app adopts the toolkit.

---

## 1. Problem (why product mode failed)

| Failure | Mechanism |
|---------|-----------|
| Multi-owner conflicts | Pool, recovery, supervisor, hydrate, chat-state, sealed-community — same lifecycle, many truths |
| Vibe-coded growth | New paths added; old paths never deleted |
| App-level iteration | Fixing banners/settings while backend owners stayed parallel |
| Frontend/backend soup | `apps/pwa` imports relay pool, SQLite invoke, Nostr, coordination — no host boundary |

**Policy change:** Legacy is **guilty until deleted**. Kernels are **default authority**. Opt into legacy only with `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1`.

---

## 2. Target geometry

```text
┌─────────────────────────────────────────────────────────────┐
│ UI ARCHIVE — apps/pwa (frozen) + packages/ui-kit (reuse)    │
│  No feature iteration · reference layouts · components only │
└────────────────────────────┬────────────────────────────────┘
                             │ @obscur/engine-contracts (future host)
┌────────────────────────────▼────────────────────────────────┐
│ ENGINES (active) — packages + libobscur + service apps      │
│  auth · dm · workspace · transport · persistence            │
└────────────────────────────┬────────────────────────────────┘
                             │ adapters
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  dweb-transport-team-relay  coordination   dweb-transport-nostr
  apps/coordination          apps/relay-gateway
```

**Rule:** Iterate **`packages/` + `libobscur` + engine services** only. [`obscur-backend-engine-roadmap.md`](./obscur-backend-engine-roadmap.md) defines phase order. UI: [`obscur-ui-archive-manifest.md`](./obscur-ui-archive-manifest.md).

---

## 3. Engines (separable units)

| Engine | Package / location | Kernel flag | Verify |
|--------|-------------------|-------------|--------|
| **Auth** | `@dweb/auth`, `auth-kernel`, `libobscur` keystore | `isAuthKernelAuthority()` | `pnpm verify:auth-kernel-contracts` |
| **DM** | `dm-kernel` → move to `@obscur/dm-engine` | `isDmKernelAuthority()` | `pnpm verify:v2-slim` |
| **Workspace** | `workspace-kernel` → `@obscur/workspace-engine` | `isWorkspaceKernelAuthority()` | `pnpm verify:workspace-kernel` |
| **Transport** | **Not landed** — replaces relay stack | `isTransportKernelAuthority()` (TBD) | `verify:transport-engine-w0` (TBD) |
| **Persistence** | `libobscur`, Tauri `db_*` | native SQLite policy | `verify:p3-dm-kernel` |

**Host boundary type:** [`packages/obscur-engine-contracts`](../../packages/obscur-engine-contracts) — `HostEnginePort`.

---

## 4. Decouple frontend from backend

### Today (forbidden end state)

- React hooks open WebSockets (`enhanced-relay-pool`)
- React calls `invoke('db_*')` from scattered features
- Providers compose 10+ owners per route

### Target

| Layer | May import | Must not import |
|-------|------------|-----------------|
| **Host UI** | `@obscur/engine-contracts`, `ui-kit` | `@dweb/nostr`, `enhanced-relay-pool`, hydrate pipeline, `use-sealed-community` |
| **Engine adapters** | `packages/dweb-*`, `libobscur` FFI | `apps/pwa/**` |
| **Runnable services** | `apps/coordination`, `apps/relay-gateway` | React |

### Incremental path (code-level slices)

Each slice = one PR + one `verify:*` — **no app-level “fix relay banner” tasks**.

| Phase | Deliverable | Subtract |
|-------|-------------|----------|
| **L0** | Engine lab charter + strict kernel default + `verify:engine-lab` | Product restore bands frozen |
| **L1** | `HostEnginePort` stub + Tauri `engine_invoke` shim | Direct `invoke` from new host code |
| **L2** | Extract `@obscur/dm-engine` from `dm-kernel` | Hydrate imports in messaging |
| **L3** | `transport-engine` package; one `TransportSnapshot` | `relay-recovery-policy` as truth owner |
| **L4** | Headless engine-host app (no WebView) | Relay pool from React |
| **L5** | Minimal shell app — DM list + thread only | main-shell provider tree |

---

## 5. Legacy quarantine (delete, do not bridge)

When `isEngineLabStrictMode()` (default):

| Owner | Status |
|-------|--------|
| `dm-conversation-hydrate-pipeline` | **Dead** — do not import |
| `use-conversation-messages` hydrate loops | **Dead** on kernel paths |
| `chat-state` as DM message authority | **Dead** on native |
| `use-sealed-community` as send/read owner | **Dead** when workspace kernel on |
| `relay-recovery-policy` as UI truth | **Dead** after transport-engine L3 |
| `features/groups/` new behavior | **Forbidden** — workspace-kernel only |

Manifest: [`apps/pwa/app/legacy/QUARANTINE.md`](../../apps/pwa/app/legacy/QUARANTINE.md)

---

## 6. Execution rules (solo + agents)

1. **No product claims** — no “ship”, “demo”, “installer” tasks.
2. **One engine per task** — ticket names `transport-engine-w0`, not “fix settings”.
3. **Subtraction proof** — PR lists removed call sites, not added flags.
4. **Verify without dev server** — `pnpm verify:engine-lab` minimum.
5. **Legacy opt-in only** — `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1` for archaeology.

---

## 7. Verify commands

```bash
pnpm verify:engine-lab          # meta gate (strict quarantine + kernels)
pnpm verify:auth-kernel-contracts
pnpm verify:v2-slim
pnpm verify:workspace-kernel
pnpm docs:check
```

---

## 8. What success looks like (lab, not launch)

- Engines run headless tests without Next.js boot.
- Host imports only `@obscur/engine-contracts` for backend calls.
- `apps/pwa` shrinks; `packages/*` grows.
- Legacy folder empty or deleted with green `verify:engine-lab`.

**Not required:** working public demo, relay federation, roster sync, or your manual dev-server soak.

---

## References

- Prior kernels: [obscur-v2-slim-kernel-manifest.md](./obscur-v2-slim-kernel-manifest.md), [workspace-kernel-manifest.md](./workspace-kernel-manifest.md), [obscur-auth-kernel-charter-2026-06.md](./obscur-auth-kernel-charter-2026-06.md)
- Product intent (historical): [design-goals-and-constraints.md](./design-goals-and-constraints.md)
- State snapshot: [CURRENT.md](../CURRENT.md)
