# Vision — Obscur as a platform service (businesses & communities)

**Date (UTC):** 2026-10-18  
**Status:** Maintainer go-to-market vision · engineering honesty required  
**Related:** [unified-protocol-client-vision-2026-10.md](./unified-protocol-client-vision-2026-10.md) · [obscur-ecosystem-charter.md](../../docs/program/obscur-ecosystem-charter.md)

## Promotion goal

Champion a **service for building decentralized communication apps** — platforms for businesses and online communities that may need more than public Nostr (other protocols, custom features, operator-owned infrastructure).

```text
Obscur today  →  reference client + foundation that currently supports Nostr
Obscur later  →  modular base clients can extend for bespoke protocol / feature work
```

## Names (maintainer, 2026-10-18)

| Name | What it is |
|------|------------|
| **Obscur** | The platform and the client shell. This is the public service name. |
| **Obscur-Nostr** | Working name for the Nostr protocol module on that foundation. |
| **`@obscur/protocol-nostr`** | Workspace package attachment point (S5). Identity + port surfaces live here. Live adapter body still under `apps/pwa/app/features/protocol-adaptation/nostr/` until a later extract. |

A later protocol would follow the same pattern (`Obscur-` + protocol / `@obscur/protocol-*`). No second app until a charter asks for it.

## Ideal engineering shape (target)

- Clear **separation and decoupling** between shell, protocol modules, and transports  
- Nostr as the **first supported protocol**, not the permanent product ceiling  
- When a client needs a bespoke solution, work proceeds **on the Obscur foundation** rather than a throwaway greenfield  

## Engineering honesty (current tree)

| Claim | Today |
|-------|--------|
| Ships a usable Nostr / private-trust reference client | Yes (with known limits) |
| Codebase is already modular enough to drop in a peer protocol | **No** — Nostr-shaped kernel; adapters are thin |
| Safe to promise “any protocol on request” in sales | **No** until modules are actually separated |
| Greenfield / full redesign under maintainer token budget | **Out of scope** |

Promotion may describe the **direction** (platform service, Nostr first, modular ambition). It must not describe the **present** as a finished multi-protocol SDK.

## Safe promotion language

| Say | Do not say |
|-----|------------|
| Reference client for encrypted, operator-sovereign communication; Nostr supported today | “Protocol-agnostic platform shipping now” |
| Building toward modular protocol modules for bespoke client work | “Switch any protocol like plugins today” |
| Private / hybrid / Tor transport paths for communities that run their own infra | “Just another Nostr social client” |
| Custom features possible as project work on this foundation | “Matrix / arbitrary protocols included” |

## Agent rule

Do not open a decoupling mega-refactor or a second app. If work is named, prefer **bounded** foundation improvements that increase separation without rewriting the product. Wait for maintainer charter before any “platform SDK” program.

**Decoupling path (when chartered):** [behavior-preserving-decoupling-design-2026-10.md](./behavior-preserving-decoupling-design-2026-10.md) — strangler extraction; default Nostr behavior must stay identical.

_Last updated: 2026-10-18T10:20:00Z_
