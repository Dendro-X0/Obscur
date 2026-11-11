# Feasibility — Architecture alternatives (critique of the hub model)

**ID:** F-alt  
**Status:** draft (theoretical comparison — not a product pick)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** `12-hub-workspace-vault-adapters.md` · `11-performance-security-encryption-standards.md` · `00-aggregator-adaptation-law.md` · `09-ideal-stack-thought-experiment.md`  
**Claim language:** **compared** ≠ GO · ≠ implemented · ≠ multi-protocol Pass

## 1. Scope

- **In:** Stress-test F-hub against **other** architectures on **feasibility**, **security**, and **UX**. Ask whether a **better** approach exists than “peer protocol apps under one workspace.”
- **Out:** Coding; Soft L3; final F9 decision (this note **informs** F9).

## 2. Basics — evaluation rubric

| Axis | Good looks like | Bad looks like |
|------|-----------------|----------------|
| **Feasibility** | Cuts ship in months; one owner per plane; proof possible | Boil-the-ocean; every protocol’s full UX day one |
| **Security** | Small trusted computing base; honest crypto tiers; sandbox holds | Many always-on parsers; false E2EE labels; CRM-from-history |
| **UX** | One unlock, one CRM, clear “what am I running”; progressive power | Five inboxes, five mental models, or a fake “universal chat” that lies |

Non-negotiables kept from prior notes: encrypted vault · inbound sandbox · relationship graph local · carriers ≠ kernel · SQLite · Rust/TS ideal stack.

## 3. Capabilities map — candidate architectures

| ID | Model | One-line |
|----|--------|----------|
| **A** | **Peer-app hub** (F-hub as written) | Workspace + equal “Nostr app / Matrix app / …” |
| **B** | **Invisible adapters** | One unified chat UX; protocols hidden behind ports |
| **C** | **Private-trust primary** | Own relays/mesh are the product; public protocols are optional underlays |
| **D** | **Federated products** | Separate apps (or windows) + shared SSO/vault |
| **E** | **Secure-messenger spine** | MLS/Signal-class crypto first; Nostr/Matrix only as delivery pipes |
| **F** | **Staged workspace** (refined) | Same kernel as A, but **one primary surface** first; more apps unlock later |

### Scorecard (1 = weak · 5 = strong; subjective design judgment)

| Model | Feasibility | Security | UX | Notes |
|-------|-------------|----------|-----|-------|
| A Peer-app hub | 2 | 3 | 3 | Direction right; **day-one equality** is the trap |
| B Invisible adapters | 2 | 2 | 2 | UX fantasy; forces false unification of incompatible semantics |
| C Private-trust primary | 4 | 5 | 4 | Matches launch-face decision; narrower protocol surface |
| D Federated products | 3 | 4 | 1 | Isolation easy; aggregator UX dies |
| E Secure-messenger spine | 3 | 5 | 3 | Best crypto story; risk of abandoning platform/hub narrative |
| **F Staged workspace** | **5** | **4** | **5** | Keeps hub end-state; sequences risk |

## 4. Fit to planes — why A alone is not enough

| Plane | Peer-app hub (A) risk | Better pressure |
|-------|----------------------|-----------------|
| Auth | OK if one door | Must stay one door under all models |
| Profile | Linked identities proliferate UX debt | Stage identity linking with each app enable |
| Storage | Vault/sandbox OK | Keep vault platform-owned in all viable models |
| Relationship | Apps may reintroduce lookback CRM | Kernel-only CRM; apps propose intents |
| Message | “Universal thread” across Nostr+Matrix invites semantic lies | Prefer **per-app threads** or explicit multi-carrier send, not magically merged history |
| Transport | All apps always-on → CPU + correlation | Lazy enable; private-trust default |

**Hard UX finding:** Users do not need “Nostr and Matrix feel identical.” They need **one account**, **safe files**, **reliable contacts**, and **honest labels** for whatever pipe is active. Forcing identical chat chrome (model B) recreates Soft L3-class lies at UX scale.

**Hard security finding:** Every enabled parser/sync loop is attack surface. Peer-equal apps (A) encourage enabling everything. Private-trust primary (C) and staging (F) shrink the default blast radius.

**Hard feasibility finding:** Shipping A completely is a multi-year platform. Shipping **F with C’s default** is a cuttable program: kernel + vault/sandbox + CRM + **one** primary carrier, then adapters.

## 5. Libraries / stacks

Unchanged candidates (F-sources / F-stack). Architecture choice constrains **order of integration**, not necessarily the crate list:

| If we choose… | First crypto/transport emphasis |
|---------------|----------------------------------|
| C or F | Private relay/mesh + vault PDK; T2/T3 policy before public Nostr social |
| E | OpenMLS / Signal-class before carrier UI polish |
| A full | Parallel Nostr + Matrix clients — **reject as first cut** |

## 6. Feasibility verdict

**Refined recommendation (theoretical):** prefer **F (staged workspace)** with **C (private-trust primary)** as the **default enabled surface**, and treat F-hub’s peer apps as the **end-state**, not the v1 shape.

| Verdict tag | Meaning here |
|-------------|--------------|
| `fit-with-adapter` | End-state remains hub + vault + sandbox + linked identities |
| **Narrow vs A** | Do **not** build day-one peer-equal Nostr/Matrix “apps” |
| **Reject as core** | Model B (invisible universal chat) · Model D as the *only* product shape |

### Recommended mental model (F∩C)

```text
┌──────────────────────────────────────────────────────┐
│ Workspace kernel                                     │
│ auth · encrypted DB · CRM · vault · sandbox · policy │
└──────────────────────────┬───────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
   Primary surface    Optional app     Optional app
   (private-trust     (Nostr module    (Matrix module
    mesh / relays)     — staged)        — staged)
```

**UX:** One unlock · one Trusted/Requests · one vault. An “Apps / transports” panel reveals modules; disabled = not running.

**Security:** Default attack surface = kernel + one transport. Crypto tier labels (F-PSE T0–T4) on each conversation. Inbound always sandboxed.

**Feasibility:** First rewrite cut = kernel planes + vault/sandbox + CRM + primary private carrier ports. Public protocols are **additive cuts**, each with its own GO.

This is **better than raw F-hub** for the near term because it keeps the aggregator vision without requiring simultaneous multi-protocol product maturity.

## 7. Risks / traps

- Staging forever → never enabling a second app (vision dies); mitigate with explicit F9 carrier roadmap.
- “Primary = Nostr” by inertia (recreates current impasse); primary should be **private-trust**, Nostr as module.
- Secure-messenger spine (E) swallowing the hub (Obscur becomes “yet another Signal-like”).
- Fake staging: UI shows three apps while one kernel still Nostr-shaped underneath.
- Merged cross-protocol history for “simpler UX” (security + correctness hazard).

## 8. Open questions (for maintainer / F9)

1. Confirm **private-trust primary** vs **Nostr-primary** for the first staged surface.
2. Accept **per-app inboxes** (honest) vs invest in constrained multi-carrier send without merged history?
3. How many linked identities before UX requires a persona switcher?
4. Is Marmot/MLS-in-kernel (tilt toward E) a **parallel** cut after private-trust, or a prerequisite?
5. Minimum lovable hub: vault+sandbox+CRM alone without any public carrier — yes/no for a lab milestone?

## 9. References

- `docs/exploration/feasibility/12-hub-workspace-vault-adapters.md` (model A)
- `docs/exploration/feasibility/11-performance-security-encryption-standards.md`
- `docs/exploration/feasibility/00-aggregator-adaptation-law.md`
- `docs/handoffs/current-session.md` — launch face private-trust decision (2026-10-18)
- `specs/backend/obscur-platform-service-vision-2026-10.md`
