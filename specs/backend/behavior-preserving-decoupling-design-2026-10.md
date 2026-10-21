# Design — Behavior-preserving architecture decoupling

**Date (UTC):** 2026-10-18  
**Status:** Design · D0–D2 + S3–S5 landed (L1) · S6 needs charter + budget  
**Parent vision:** [obscur-platform-service-vision-2026-10.md](./obscur-platform-service-vision-2026-10.md) · [unified-protocol-client-vision-2026-10.md](./unified-protocol-client-vision-2026-10.md)  
**Prior art:** [protocol-adaptation-layer-design-2026-10.md](./protocol-adaptation-layer-design-2026-10.md) (Phase 0–3 landed; façade thin)

```text
HANDOFF ATOMIC STEP: Consider technical challenge — decouple without changing behavior
PAUSED / CANCELLED: Matrix launch · Soft L3 · remount · uncapped Quiet · Tor Verified · greenfield
CANONICAL OWNER (target): ProtocolAdaptationLayer + per-protocol packages (future)
PROOF BEFORE DONE (per slice): characterization L1 + no product-behavior delta
```

## Problem

Promotion wants a modular foundation for bespoke protocol/custom work. The tree today is a **Nostr-shaped kernel** with a thin `ProtocolAdaptationLayer`. A full gateway + per-protocol rewrite is out of budget. The technical challenge is therefore:

> Increase separation so new protocols/features can attach later, while **observable behavior stays identical** to the current shipping client.

## Non-goals

| Out of scope | Why |
|--------------|-----|
| Greenfield / second app | Already failed; discards UI |
| Big-bang “protocol-neutral kernel” | Touches 200+ `Message` call sites; high regression risk |
| Marketing “already modular” | Honesty rule in platform-service vision |
| Matrix Olm / launch promotion | PAUSED |
| TS→Rust campaign as decoupling vehicle | No token/time budget |

## Invariant (hard)

```text
For the default profile path (Protocol = Nostr, existing transports):
  send / list / sidebar / thread / relay Standard paths / lock / profiles
must behave the same before and after each slice.
```

Any slice that cannot prove this invariant does not land.

## Current coupling (honest map)

| Layer | Reality today |
|-------|----------------|
| Shell / UI | Mostly stable chrome; messaging still consumes **rich** Nostr-shaped types (`DmConversation`, `Message` with event/relay fields) |
| `ProtocolAdaptationLayer` | Registry + switch exists; **canonical** `sendMessage` / `listConversations` underused |
| Rich ports on the layer | `listDmConversations` / `listDmMessages` / `sendDm` re-export Nostr pipelines; Matrix branches are shims |
| `NostrAdapter` | Thin wrap over `dm-kernel-*` + `dm-send-pipeline`; `sendMessage` throws (“use sendDm”) |
| Persist / engine | `engine_invoke` DM/workspace keyed by Nostr event ids — private to Nostr spine |
| Transport plane | Orthogonal-ish (`clearnet` / `tor` / `quiet`) — keep separate from protocol |

**Verdict:** Adaptation Phase 0–3 created a **switch and labels**, not a **module boundary**. Decoupling work is extraction behind the existing façade, not inventing a second architecture.

## Strategy: strangler extraction (not redesign)

```text
                    ┌─ Shell (unchanged UX) ─┐
                    │  still talks to layer   │
                    └───────────┬─────────────┘
                                │
              ProtocolAdaptationLayer (sole router)
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
   nostr/ (move code)    matrix/ (lab)         future/
   same behavior         no launch claim       empty until charter
```

Rules:

1. **Move code, do not rewrite behavior** — first slices are package/folder moves + import rewires that preserve call graphs.
2. **Widen the façade only when a second consumer needs it** — do not invent ports “for future Matrix.”
3. **One owner per lifecycle** — no parallel send paths; if UI still imports `dm-send-pipeline` directly, subtract that import (route through layer) before adding new adapters.
4. **Characterization before mutate** — lock today’s behavior with tests that fail on behavior drift, not on file location.

## Target planes (incremental)

| Plane | Owns | Must not own |
|-------|------|--------------|
| **Shell** | Window, lock, profiles, protocol/transport picker, shared settings chrome | Wire formats, event ids, HS sync |
| **Protocol module** | Identity quirks, endpoints/relays, conversation model, send/list for that protocol | Global lock / profile vault |
| **Transport** | Clearnet / Tor / Quiet dial policy | Protocol message schema |
| **Shared foundation** | Profile vault, LES/backup hooks, engine host port shapes that stay protocol-agnostic | Nostr NIPs as public UI types |

Today almost everything productive lives in the Nostr plane; shared foundation and shell are only partially separated. That is fine — slices deepen boundaries where friction is real.

## Safe seam inventory (ordered by risk)

| # | Seam | Behavior risk | Decoupling value |
|---|------|---------------|------------------|
| S0 | Characterization suite for Nostr happy path (sidebar, thread load, send mock, transport id honesty) | None (tests only) | Gate for all later slices |
| S1 | **Import hygiene:** messaging UI → only `ProtocolAdaptationLayer` / public index for send/list (no direct `dm-send-pipeline` / kernel ports) | Low if re-export identical | Makes layer the true choke point |
| S2 | **Folder extract** `features/protocol-adaptation/nostr/*` (adapter + pipeline re-exports) without API change | Low | Physical module boundary |
| S3 | Stop leaking Nostr-only fields through **new** shell APIs; leave existing `Message` alone | Low · **landed L1** | Prevents further lock-in |
| S4 | Narrow rich ports: document `sendDm` as NostrAdapter-private; shell prefers canonical where already used | Medium · **landed L1** | Prepares real second protocol |
| S5 | Optional package `@obscur/protocol-nostr` (workspace package) — only after S1–S2 stable | Medium · **landed L1** | Reuse for bespoke client forks |
| S6 | Gateway-style per-protocol UI modules | **High / out of budget** | Vision only — needs charter |

**Do not start at S6.** S0→S2 is the budget-honest path that still serves the platform-service story.

## Behavior preservation protocol (every slice)

1. **Characterization (L1)** — before mutate: contract/search tests that UI messaging entrypoints resolve through the layer; existing vitest for send/list/transport stay green.
2. **Same inputs → same outputs** — no schema migration; no change to persisted row keys; no Settings default flip.
3. **Diff discipline** — prefer move/rename + thin re-export files; reject “cleanup” that alters status mapping, retry, or relay quorum rules.
4. **Claim language** — after a slice: **implemented** (structure) only; **verified** only if L2/L3 named in the slice proof plan. Never claim “multi-protocol ready.”

## Acceptance criteria (program-level)

- [ ] AC1 — Default Nostr path: no intentional product behavior change across landed slices
- [ ] AC2 — New protocol or bespoke feature work has a **documented attachment point** (register adapter + optional package), even if only Nostr is filled
- [ ] AC3 — Agents cannot “complete” decoupling by rewriting MessagingProvider around Nostr types as the product identity
- [ ] AC4 — Promotion language stays aligned with platform-service vision (direction ≠ present)

## Proof plan (default per slice)

| Criterion | Layer | Command / action | Claim after |
|-----------|-------|------------------|-------------|
| Import / contract | L1 | `pnpm exec vitest run` on protocol-adaptation + messaging contract tests | implemented |
| Typecheck touched packages | L1 | `pnpm exec tsc -p apps/pwa --noEmit` (or repo script) | implemented |
| Desktop online smoke (if send/transport touched) | L2/L3 | existing desktop soak / manual send | verified / fixed |

## Implementation slices (charter one at a time)

1. **Slice D0 — Characterization only** (S0) — **landed L1**  
   `apps/pwa/app/features/protocol-adaptation/decoupling-d0-characterization.test.ts`  
   Freezes default Nostr routing, status map, transport honesty, Matrix gate. No production mutate.

2. **Slice D1 — Choke-point hygiene** (S1) — **landed L1**  
   `nostrAdapter` is the only production value-importer of `dm-send-pipeline` and the kernel list ports. Delete and retry call `nostrAdapter.sendDm` (same function, still Nostr even if Matrix is selected). Thread hook reads page size from `dm-kernel-page-size.ts`.  
   Contract: `decoupling-d1-choke-point.contract.test.ts`.

3. **Slice D2 — Physical Nostr module folder** (S2) — **landed L1**  
   Implementation: `protocol-adaptation/nostr/nostr-adapter.ts`.  
   `protocol-adaptation/nostr-adapter.ts` re-exports the same symbols. Public index and call sites unchanged.

4. **Slice S3 — Canonical boundary** — **landed L1**  
   Comment + contract on `CanonicalMessage` / `CanonicalConversation` / `sendMessage` params.  
   Evidence: `decoupling-s3-canonical-boundary.contract.test.ts`. Rich `Message` unchanged.

5. **Slice S4 — Rich port narrowing** — **landed L1**  
   `port-surfaces.ts` names platform canonical vs Obscur-Nostr rich vs `nostrAdapter.sendDm` private.  
   Index exports `listConversations` / `listMessages` / `sendMessage` + `nostrAdapter`.  
   MessagingProvider still on rich ports (behavior unchanged).  
   Evidence: `decoupling-s4-rich-ports.contract.test.ts`.

6. **Slice S5 — `@obscur/protocol-nostr` package** — **landed L1**  
   Workspace package owns identity + port-surface constants.  
   Live `nostrAdapter` remains under `apps/pwa/.../protocol-adaptation/nostr/`.  
   PWA depends on `workspace:*`. Evidence: `decoupling-s5-package.contract.test.ts` · package `module-identity.test.ts`.

7. **Later (explicit charter)** — never S6 without budget.

## Risks

| Risk | Mitigation |
|------|------------|
| Agent treats this as permission to redesign MessagingProvider | Handoff: one named slice only; S6 forbidden |
| “Decouple” becomes silent behavior change in status/mapping | Characterization first; forbid mapping edits in move slices |
| Second protocol promised via façade widening | Widen only when a real consumer exists |
| Token burn on package extract before choke point | Order: D0 → D1 → D2 |

## Decision for maintainer

This design **accepts** that Obscur remains Nostr-capable and Nostr-shaped internally for the foreseeable future. Decoupling means **clearer boundaries and a real choke point**, not a neutral kernel. That is enough to build bespoke features on the foundation later without a greenfield.

**Demo evidence:** Prior silent captures under `docs/assets/gifs/` remain valid for Gift/guide surfaces covered by those GIFs, because D0–S5 intended no product behavior change. Re-capture is not required solely because of this strangler track.

**Next (when named):** Hitch ask, optional Track L re-soak, or adapter-body move into `@obscur/protocol-nostr`. Do not start S6 without budget.

_Last updated: 2026-10-18T10:35:00Z_
