# Charter — Release without Tor gate · transport sovereignty (2026-08)

**Date (UTC):** 2026-08-09  
**Status:** **Accepted (maintainer intent)** — Tor Verified cancelled as release gate · explore other networks under sovereignty + E2EE  
**Parents:** [tor-verified-infeasible-2026-08.md](../../specs/backend/tor-verified-infeasible-2026-08.md) · [obscur-conduit-mesh-concept-2026-06.md](./obscur-conduit-mesh-concept-2026-06.md) · [v1.9.15-scope.md](../archive/program/inactive-2026-08/v1.9.15-scope.md) · [production-tor-opt-in-public-default-design-2026-07.md](../../specs/backend/production-tor-opt-in-public-default-design-2026-07.md)

```text
HANDOFF ATOMIC STEP:  Unblock public release on clearnet Verified path · Tor = optional advanced
INVARIANTS:           User sovereignty · client E2EE · no ambient identity · local ≠ network truth
CANCELLED AS GATE:    Tor-only Verified · Tor bootstrap on blocked LAN
SILO:                 Tor TI code kept · AUTH-SESSION · invent parallel crypto owners
```

## Verdict (one line)

The **project did not fail**. **Tor-as-public-release-gate** failed under solo + blocked-network constraints. Ship the clearnet product you already verified; treat Tor as optional privacy underlay, not the definition of success.

## What is already true (evidence)

| Track | Status |
|-------|--------|
| Website + GIF demos | Ready (maintainer) |
| Narrated demo video | Remaining release polish — **not** blocked by Tor |
| DM / media | L3 Pass |
| Vault / LES | Packaged Pass / Verified |
| Community | CU-P1 Pass / Verified (production relays · Tor OFF) |
| Tor TI lifecycle | Implemented (L1) landed · **Verified INFEASIBLE** here |

Public release was blocked by a **proof requirement that cannot be met**, not by absence of a working messenger.

## Non-negotiables (unchanged)

| Principle | Meaning |
|-----------|---------|
| **User sovereignty** | User chooses relays / operators / offline paths — Obscur does not force a single corporate bus |
| **E2EE** | Ciphertext on device; conduits see opaque blobs + routing metadata only |
| **One owner per transport lifecycle** | Dialects plug into conduit mesh / transport-kernel — no second crypto stack |
| **Honesty** | Never claim Ready / Verified without evidence |

## What changes

| Was (implicit) | Now (explicit) |
|----------------|----------------|
| Public release waits on Tor Verified | Public release proceeds with **Tor OFF / opt-in** honesty |
| Tor = success metric | Tor = **optional** underlay when the network allows |
| “No Tor ⇒ project failed” | “No Tor Verified ⇒ **do not claim Tor**; ship clearnet + other dialects” |

## Positive progress — other communication networks

Explore and strengthen **dialects** already in the architecture (not greenfield rewrites). Ranked for solo maintainer + sovereignty + E2EE:

| Priority | Dialect / path | Role | Next slice class |
|----------|----------------|------|------------------|
| **1** | **Public Nostr pool** (clearnet) | Default average-user bus — already Verified class | Release + demo on this path |
| **2** | **User / operator self-hosted relay** (VPS, LAN, team) | Sovereignty without Tor | Preset + docs honesty · Soft L3 on operator URL |
| **3** | **Private HTTP / team mesh** (conduit mesh) | Org / trusted operator | Keep as advanced pack — not Docker-required |
| **4** | **Offline / sneakernet DTN** (RUST-6) | Air-gap / delayed delivery | Spec-linked · not Tor substitute for chat latency |
| **5** | **VPN / proxy underlay** | User-chosen network privacy without Tor stack | Honesty copy · measure RTT · no fake anonymity |
| **6** | **Tor** (landed TI) | Optional when network allows | Siloed Verified · resume only with capable path |
| **Later** | NIP-65 outbox · Starlink-class budgets | Future dialects per v1.9.15 P15-F | Design only until chartered |

**Forbidden:** a second E2EE implementation, “just use Telegram API,” or UI that implies Tor is required to be secure.

## Public release gate (revised)

| Must | Must not |
|------|----------|
| Clearnet DM + Vault + Community Pass (done) | Tor Verified |
| Website / demos honest about Tor optional / blocked nets | Tor ON in narrated demo if it Warmings forever |
| Tor OFF in default demo path | Claim production Tor-ready |
| Narrated video on clearnet path | Hold release for Tor bootstrap |

## First implementation band (after this charter)

Not code in this doc. Handoff picks **one**:

| Id | Work |
|----|------|
| **RS-1** | Release honesty docs + known-limitations + website/demo script: Tor optional · clearnet ship |
| **RS-2** | Operator / self-hosted relay Soft L3 recipe (sovereignty path without Tor) |
| **RS-3** | Adaptive public Nostr Slice B UX (Advanced packs; default = connected to N relays) |

## Agent rules

| Allowed | Forbidden |
|---------|-----------|
| Release honesty · dialect design specs · one chartered RS-* slice | Tor Verified as release blocker |
| Tor OFF default in demos | Fake Tor Ready · invent onions |
| | Parallel messaging stacks that bypass E2EE owners |

## Resume Tor Verified only if

Capable network **or** external A+B+C evidence — see [tor-verified-infeasible-2026-08.md](../../specs/backend/tor-verified-infeasible-2026-08.md).
