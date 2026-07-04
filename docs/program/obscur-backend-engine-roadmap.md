# Obscur backend engine roadmap

**Status:** **Canonical execution order** for ENGINE-LAB  
**Last updated:** 2026-06-26  
**Supersedes:** v1.9.x feature restore as daily queue

Work happens on **engines and functional modules** in `packages/` + `libobscur` + service apps. The archived UI (`apps/pwa`) is not protected and not iterated.

**Policy:** Only **additions** (new engine code, tests, contracts) and **subtractions** (deleted legacy paths). No “keep the app working” guardrails.

---

## Priority dimensions (all backend work)

Every engine slice must state which dimension(s) it improves:

| Dimension | Meaning | Examples |
|-----------|---------|----------|
| **Integration** | Clean ports between engines and adapters | `HostEnginePort`, `TransportPort`, coordination HTTP/WS |
| **Fault tolerance** | One owner, explicit degrade/offline — not contradictory UI state | Transport snapshot, auth boot lease, SQLite transaction boundaries |
| **Performance** | Hot paths in Rust/packages; no React hydrate on read | libobscur message scan, headless bench scripts |
| **Maintainability** | Package boundaries, forbidden imports, verify gates | `verify:engine-lab`, engine package per domain |

---

## Active vs archived

```text
ACTIVE (iterate here)
  packages/libobscur          persistence, crypto, net (Rust core)
  packages/dweb-auth          auth engine contracts
  packages/dweb-*             transport, crypto, storage adapters
  packages/obscur-engine-contracts   host boundary
  packages/obscur-*-engine    (extract targets — see phases)
  apps/coordination           membership / directory service
  apps/relay-gateway          relay adapter service
  apps/desktop/src-tauri      native invoke surface (shrink to engine_invoke)

ARCHIVED (reference only)
  apps/pwa                    full UI — see obscur-ui-archive-manifest.md
  packages/ui-kit             preserved components for future host

SUBTRACT (delete when gate allows)
  apps/pwa/app/features/*     legacy integrations — QUARANTINE.md
```

---

## Phase order

### B0 — Lab frame (landed)

- [x] Engine lab charter, strict kernel default
- [x] `@obscur/engine-contracts`
- [x] UI archive manifest
- [x] `pnpm verify:engine-lab`

### B1 — Integration: host ↔ engine boundary (landed)

| Deliver | Subtract |
|---------|----------|
| Tauri `engine_invoke` + typed request envelope | Scattered `invoke('db_*')` from new engine code |
| `@obscur/dm-engine` package scaffold (ports from dm-kernel) | New imports of hydrate pipeline in packages |
| Document engine method catalog in `obscur-engine-contracts` | — |

**Gate:** `verify:engine-lab` + `verify:dm-engine-w0` ✓

### B2 — Fault tolerance: transport engine (landed w0)

| Deliver | Subtract |
|---------|----------|
| `@obscur/transport-engine` — single `TransportSnapshot` | `relay-recovery-policy` as parallel truth |
| Adapters: team-relay, nostr, coordination only inside package | `enhanced-relay-pool` imports from archived UI paths |
| Headless connectivity tests (no WebSocket in React) | — |

**Gate:** `verify:transport-engine-w0` ✓

### B3 — Performance + persistence hardening (landed w0)

| Deliver | Subtract |
|---------|----------|
| libobscur: canonical DM read path benchmarks | chat-state as message authority |
| SQLite migration owner in Rust only | Duplicate TS persist owners |
| Cold-start / repair in engine package | dm-kernel repair scattered in features |

**Gate:** `verify:dm-engine-b3` + `verify:p3-dm-kernel` ✓

### B4 — Workspace + auth engine packages (landed w0)

| Deliver | Subtract |
|---------|----------|
| `@obscur/workspace-engine` extract from workspace-kernel | `use-sealed-community` authority |
| `@obscur/auth-engine` wrap `@dweb/auth` + Tauri boot | Parallel auth-gateway restore paths |

**Gate:** `verify:engine-b4-w0` + `verify:workspace-kernel` + `verify:auth-kernel-contracts` ✓

### B5 — Maintainability: legacy amputation (landed w0)

| Deliver | Subtract |
|---------|----------|
| Grep gate: zero `apps/pwa` imports from `packages/obscur-*` | Delete quarantine files with zero importers |
| `verify:legacy-subtraction` | Dead drift/reconciliation/voice-visibility modules |

**Gate:** `verify:engine-lab` + `verify:legacy-subtraction` ✓

### Post-B5 — Headless host + incremental subtraction (landed w0–w1)

| Deliver | Subtract |
|---------|----------|
| `createMemoryEngineHost` in `@obscur/engine-host` | `use-conversation-messages-fixed.ts` (diagnostic orphan) |
| `libobscur::engine_invoke` + `engine-lab-headless` CLI | Duplicate dispatch in Tauri `engine.rs` |
| `createSubprocessEngineHost` | — |

**Gate:** `verify:engine-host-headless-w0` ✓ (libobscur tests + CLI smoke + TS contracts; included in `verify:engine-lab`)

### Post-B5 — Transport publish + standalone legacy subtraction prep (w7–w68)

| Deliver | Status |
|---------|--------|
| Host publish shim, Rust network lab gate, parity harnesses (w19–w48) | ✓ |
| Standalone owner quarantine to `-legacy.ts` (w51–w52) | ✓ |
| Deletion gate + dry-run + subtracted/thin port prep (w55–w64) | ✓ |
| Mechanical commit + B5 exit + prep band closure (w65–w68) | ✓ |
| Physical deletion of `-legacy.ts` + facade | **PAUSED** — W53 smoke `PASS` required |

**Gate:** `pnpm verify:transport-engine-w68` · `pnpm verify:standalone-legacy-subtraction-prep`  
**Index:** [transport-engine-standalone-legacy-subtraction-index.md](./transport-engine-standalone-legacy-subtraction-index.md)

---

## Execution rules

1. **One phase slice per task** — name tickets `B2-transport-snapshot`, not “fix relay banner”.
2. **Subtraction proof required** — PR lists deleted symbols/paths.
3. **No UI tasks** unless moving a component into `ui-kit` for future host.
4. **Verify without dev server** — package tests + contract tests only.
5. **Legacy opt-in:** `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1` for archaeology only.

---

## Verify matrix

| Command | When |
|---------|------|
| `pnpm verify:engine-lab` | Every backend change |
| `pnpm verify:auth-kernel-contracts` | Auth engine touch |
| `pnpm verify:v2-slim` | DM engine touch |
| `pnpm verify:workspace-kernel` | Workspace engine touch |
| `pnpm verify:ui-archive` | ui-kit or archive boundary touch |
| `pnpm verify:legacy-subtraction` | After B5 / subtraction touch |
| `pnpm verify:engine-host-headless-w0` | After memory host touch |
| `pnpm verify:transport-engine-w68` | Transport engine / standalone legacy prep touch |
| `pnpm verify:standalone-legacy-subtraction-prep` | Read-only prep band report (maintainer) |

---

## References

- [obscur-engine-lab-charter.md](./obscur-engine-lab-charter.md)
- [obscur-ui-archive-manifest.md](./obscur-ui-archive-manifest.md)
- [CURRENT.md](../CURRENT.md)
