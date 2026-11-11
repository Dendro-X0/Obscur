# Feasibility — Ideal stack thought experiment (unconstrained rewrite)

**ID:** F-stack  
**Status:** draft (thought experiment — not an implementation plan)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Product law:** `00-aggregator-adaptation-law.md` · F1 relationship authority

## 1. Scope

- **In:** Envision the **ideal** technology stack and modular architecture **as if starting greenfield**, unconstrained by today’s PWA/Tauri/Nostr-shaped coupling — while keeping the aggregator product law (one profile · switchable carriers · SQLite).
- **Out:** Choosing vendors this week; writing migration scripts; Soft L3 Pass; claiming the rewrite has started.

Analogy (ambition, not literal tech copy): large systems sometimes **replace the foundation** (new language/runtime) rather than endless bridge patches. Obscur’s impasse is architectural; a stack thought experiment is how we break it **on paper first**.

## 2. Basics

### Ideal shape (target mental model)

```text
┌─────────────────────────────────────────────────────────────┐
│  TypeScript UI shell (desktop/mobile webview or native UI)  │
│  thin: screens · view-models · no carrier business rules      │
└──────────────────────────┬──────────────────────────────────┘
                           │ narrow, typed IPC / FFI contract
                           │ (one hop — not bridge towers)
┌──────────────────────────▼──────────────────────────────────┐
│  Rust platform kernel                                        │
│  auth · profiles · SQLite · relationship graph · crypto      │
│  carrier ports (traits) · policy · quarantine storage        │
├────────────┬────────────┬────────────┬──────────────────────┤
│ nostr crate│ matrix     │ private    │ tor/transport opts   │
│ (adapter)  │ (adapter)  │ mesh/server│ (underlay)           │
└────────────┴────────────┴────────────┴──────────────────────┘
```

| Layer | Language | Owns |
|-------|----------|------|
| UI | TypeScript | Presentation, accessibility, local UI state |
| Kernel | Rust | Auth, profiles, DB, relationships, E2EE policy, ports |
| Adapters | Rust (preferred) or isolated workers | Protocol wire only |
| DB | SQLite | Account/profile-scoped durable state |

**Principle:** better code, not more code. Prefer **deletion of parallel owners** and **one hop** UI↔kernel over “compatibility bridges” that tax CPU and cognition.

## 3. Capabilities map

| Need | Ideal stack answer |
|------|-------------------|
| Peak maintainability | Feature = **crate/module with public API**; breakage stays inside the module |
| Extensibility | New carrier = new adapter implementing ports; kernel unchanged |
| Performance / security | Crypto, parsing, sync, SQLite in Rust; UI never holds long-term secrets in JS heaps by default |
| Avoid bridge overhead | **One** stable IPC schema; no JS domain logic mirroring Rust; no multi-hop “adapter of adapters” |
| Refactor one feature at a time | Module boundaries + contract tests; other modules keep compiling against ports |
| SQLite | Remains the durability engine; schema owned by kernel, versioned migrations |

## 4. Fit to planes

| Plane | Ideal home |
|-------|------------|
| Auth | Rust kernel |
| Profile (hard isolation) | Rust kernel + per-profile SQLite paths |
| Storage / DB | SQLite via Rust |
| Relationship | Rust kernel (never carrier lookback) |
| Message / sync | Rust ports + adapter encode/decode |
| Transport | Adapter + optional Tor underlay |
| UI | TypeScript only |

## 5. Libraries / stacks (candidates to research later — not selected)

| Area | Candidates to explore in F5/F8/F-stack follow-ups | Notes |
|------|--------------------------------------------------|-------|
| Desktop shell | Tauri v2 (already in family), or thinner custom | Prefer reuse of proven IPC patterns over novelty |
| Rust async | `tokio` | Standard |
| SQLite | `rusqlite` / `sqlx` (SQLite) | Keep SQL explicit; avoid ORM sprawl |
| Crypto | audited crates (`ed25519`, AEAD) — exact set in F5 | No “roll our own” |
| TS UI | React or lighter — **decision after** ports exist | UI framework ≠ platform |
| Module layout | Cargo workspace + `apps/ui` + `crates/*` | One feature ≈ one crate or strict module |

## 6. Feasibility verdict

**`fit-with-adapter`** as a **rewrite program**, not a weekend swap.

| Verdict detail | Meaning |
|----------------|---------|
| Feasible | Rust kernel + TS UI + SQLite + modular crates matches aggregator law and security goals |
| Not feasible as | One-shot “rewrite 100k+ LOC tomorrow” without F9 + cut designs |
| Reject | Endless JS↔Rust dual ownership of the same domain (bridge towers) |

Thought experiment conclusion: **yes, unconstrained ideal is Rust kernel / TS UI / modular crates / SQLite** — **if and only if** relationship + auth + DB stay out of protocol adapters and IPC stays one hop.

## 7. Risks / traps

- Rebuilding the same Nostr-shaped god-modules in Rust (“rewrite the mess”).
- Dual logic: TS still implements trust/request/lifecycle “for speed.”
- Premature UI framework wars before ports exist.
- Mega-bridge layers “temporarily” for parity soaks — they become permanent.
- Equating “modular folders” with modular **contracts** (without APIs/tests, folders don’t isolate).

## 8. Open questions

1. How thin is the UI — Tauri webview vs more native?
2. Which domains move to Rust first after F9 (auth+DB vs messaging)?
3. How do we prove “no bridge tax” (budget IPC calls per user action)?
4. Monorepo packaging: one binary vs sidecar workers for heavy carriers?

## 9. References

- Aggregator law: `00-aggregator-adaptation-law.md`
- Platform rewrite charter: `specs/backend/platform-rewrite-band-charter-2026-11.md`
- Feasibility charter: `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`
- As-built synthesis (debt map): `docs/exploration/synthesis/as-built-architecture-and-fork-options.md`
