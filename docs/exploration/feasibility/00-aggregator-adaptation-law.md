# Feasibility — Aggregator law (protocols as adaptation, one profile)

**ID:** F0.5  
**Status:** draft (maintainer product law)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`

## 1. Scope

- **In:** The intended product shape — Obscur as an **aggregator** of protocol “apps,” with **Nostr / Matrix / private servers / etc. as adaptation layers**, not as the kernel’s identity.
- **Out:** Claiming this shape is already shipped; implementing adapters this phase.

## 2. Basics

**What Obscur is (target):**

- One **profile / account plane** for the human: unlock, identity material, local database, relationship graph, settings.
- Zero or more **carriers** (protocol adapters) the user can enable, switch, or configure for how bytes move.
- The shell behaves like running **multiple communication apps under one account** — the profile is stable; the wire protocol is not the product name.

**What Obscur is not (target):**

- A Nostr client with Matrix bolted on as an afterthought.
- Core business logic (`TRUSTED`, Requests, Remove, vault, auth door) that **imports Nostr event kinds / relay URLs as the only model**.
- “We exchanged messages on carrier X, therefore we are contacts” as platform law.

```text
Profile (auth · DB · relationship · app prefs)
        │
        ▼
 Adaptation ports (canonical DTOs)
        │
   ┌────┼────┬────────────┐
   ▼    ▼    ▼            ▼
 Nostr Matrix Private…   Tor-underlay (optional)
```

## 3. Capabilities map

| Need | Kernel owns? | Adapter owns? |
|------|--------------|---------------|
| Unlock / session | Yes | No |
| Profile isolation | Yes | No |
| Account database | Yes | May sync *through* ports |
| Relationship graph | Yes | May *propose* invite/accept/remove envelopes |
| Message bodies / E2EE policy | Kernel policy + crypto | Carrier framing / delivery |
| Relay / homeserver / Tor path | Prefs in kernel | Dial / publish / subscribe |

## 4. Fit to planes

| Plane | Aggregator rule |
|-------|-----------------|
| Auth | Universal door — not “login to Nostr” |
| Profile | Single management surface for account + data |
| Storage / DB | Carrier-agnostic; adapters map external ids |
| Relationship | First-class; never hard-coded to one protocol |
| Message | Canonical conversation model; adapters encode/decode |
| Transport | Switched per prefs / conversation / app mode |

## 5. Libraries / stacks

Deferred to F2–F8. Constraint from this law: libraries chosen for a carrier must stay **behind** the adaptation ports, not leak into auth/profile/relationship modules.

## 6. Feasibility verdict

**`fit-with-adapter`** as the **only** acceptable core shape for the rewrite concept.

**As-built honesty:** today’s tree is still largely **Nostr-shaped** (see platform vision / rewrite charter). That is evidence of debt, not a reason to abandon the aggregator law — and not a reason to “migrate UI” before ports exist.

## 7. Risks / traps

- Hard-coding Nostr (or Matrix) types into “platform” modules.
- Treating Soft L3 / public relays as the relationship database.
- Shipping a protocol switcher UI while the kernel still speaks only one carrier.
- Calling Obscur an aggregator in marketing before F9 + cut designs.

## 8. Open questions

1. How many carriers must ship for v1 of the rewrite (private mesh only vs Nostr+Matrix)?
2. Is “switch protocol” per conversation, per profile, or per installed “app” module?
3. How does one profile’s DB namespace carrier-specific residues without cross-contaminating trust?

## 9. References

- `specs/backend/platform-rewrite-band-charter-2026-11.md` §1 Product law  
- `specs/backend/obscur-platform-service-vision-2026-10.md`  
- `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
- F1: `docs/exploration/feasibility/01-relationship-authority.md`
