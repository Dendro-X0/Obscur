# Feasibility — Nostr as carrier (adapter only)

**ID:** F2  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F0.5 · F1 · F-sources · F-PSE · F-hub · F-groups · F-netconfig · F-discover-methods  
**As-built:** `nostrAdapter` / PAL · `@obscur/protocol-nostr` capabilities · NIP-17 DM publish paths · sealed communities on relays  
**Claim language:** **explored as carrier** ≠ Obscur is a Nostr client · ≠ Soft L3 Fixed · ≠ Tor Verified · ≠ Marmot/MLS shipped

## 1. Scope

- **In:** What Nostr **is and is not** for Obscur; which product needs it can satisfy as a **switchable adapter**; limits that must stay visible in UX and architecture.
- **Out:** Soft L3 contact Pass; rewriting the Nostr module this phase; adopting NIP-EE; claiming Signal-grade security from NIP-17.

## 2. Basics

**Nostr** is a family of signed JSON **events** moved through **relays** (store-and-forward WebSockets). Identity on the wire is a **keypair**. Clients choose which relays to use; relays are not a shared application database with ACLs like Matrix homeservers.

| Nostr is | Nostr is not |
|----------|--------------|
| A **delivery / publication** substrate | A contacts/CRM object model |
| Good at public notes, replaceable lists, gift-wrapped DMs | A guarantee of FS/PCS messaging |
| Useful for discovery beacons & public communities | The Obscur product identity |
| Compatible with private relays / VPS “game servers” | Automatic multiparty social sync |

**Obscur law:** Nostr = **Obscur-Nostr protocol app** under the hub (linked identity). Workspace auth, profile DB, relationship graph, and vault stay carrier-agnostic (F0.5 · F1 · F-hub).

### Crypto honesty (from NIP text + F-sources)

| Layer | Role | Tier (F-PSE) |
|-------|------|--------------|
| NIP-04 | Legacy DM — **unrecommended** | Avoid |
| NIP-44 | Payload AEAD format only | Building block |
| NIP-59 gift wrap | Metadata / envelope hiding | Enables **T2** |
| NIP-17 | Private DM scheme (rumor→seal→wrap) | **T2** — not T3 (no FS/PCS if long-term key leaks) |
| NIP-EE | MLS-on-Nostr — **unrecommended** | Do not build |
| Marmot | MLS + Nostr identity; transport-agnostic | Candidate path to **T3/T4** *above* Nostr delivery — F5 decides |

NIP-44 itself warns: for high-risk situations, use specialized E2EE software; limit Nostr to exchanging contacts.

## 3. Capabilities map

| Need for Obscur | Can Nostr provide? | Notes |
|-----------------|--------------------|-------|
| Deliver 1:1 encrypted messages | **Partial (T2)** | NIP-17 on chosen relays |
| Deliver group chat | **Partial** | NIP-29 / sealed community patterns; crypto tier varies |
| Relationship CRM (TRUSTED / Requests) | **No** | Events ≠ sticky edges (F1 · Soft L3 lesson) |
| Universal auth / profile / DB | **No** | Linked pubkey only |
| Public / discoverable communities | **Yes / partial** | Relays + kinds; spam/moderation weak vs Matrix HS |
| Private invite groups on own relay | **Yes** | Fits F-groups pin + VPS |
| Discovery (friend code, pubkey, beacons) | **Partial** | Works; must not auto-TRUST |
| Cross-device Continuity | **Partial** | Sealed backup blobs *via* relays (M3) — metadata risk; prefer own DC (F-sync) |
| Tor underlay | **Orthogonal** | Clearnet/Tor dial — F6 |
| FS/PCS messaging | **No (native NIP-17)** | Needs Obscur-owned ratchet/MLS (F5) or Marmot-class stack |
| Replace Matrix / private mesh | **No** as sole carrier | One app among many |

## 4. Fit to planes

| Plane | Fit | Notes |
|-------|-----|-------|
| Auth | **Adapter only** | Workspace door ≠ “login to Nostr”; nsec = Advanced recovery / linked identity |
| Profile | **Linked identity** | Display kind:0-like metadata optional; hard isolation stays local |
| Storage / DB | **No** | Relays ephemeral/hostile; SQLite+vault own truth |
| Relationship | **Intent transport only** | May carry signed invite/accept envelopes; never author TRUSTED from lookback |
| Message | **fit-with-adapter** | Encode/decode canonical messages ↔ events; label crypto tier T2 unless upgraded |
| Transport | **Primary Nostr strength** | Relay sets, homes (F-netconfig), public vs private pins (F-groups) |

## 5. Libraries / stacks

| Candidate | Lang | License | Maturity | Desktop/mobile | Notes |
|-----------|------|---------|----------|----------------|-------|
| As-built PAL `nostrAdapter` | TS | — | In tree | Desktop+PWA | Wrap send/list; still Nostr-shaped internals |
| `@obscur/protocol-nostr` | TS | — | In tree | — | Capabilities leaf (`dms/groups/reactions/media`) |
| `nostr` crate | Rust | MIT/Apache | Mature | Via FFI | Aligns F-stack Cut later |
| Marmot / OpenMLS | Rust | — | Emerging | — | Study for T3/T4 over Nostr delivery — F5 |
| NIP-04 stacks | — | — | Legacy | — | **Reject** for new work |

## 6. Feasibility verdict

**`fit-with-adapter`** — Nostr is a **viable first (and ongoing) carrier** for Obscur **if and only if** it stays an adaptation layer: delivery of messages, discovery hints, and optionally public/community traffic on pinned relays — **not** the owner of auth, CRM, vault, or security marketing.

**`reject-for-core`** — “Contacts/strangers/WoT = Nostr follows or DM history”; NIP-17 labeled as Signal-grade; NIP-EE as the group E2EE bet; Obscur marketed as “just another Nostr client.”

**Why:** Protocol physics give replaceable events and weak session security. Soft L3 proved CRM-on-history fails. The hub + sticky graph + honest T2 labels make Nostr useful without lying. Private-trust launch should **prefer** private relays/DC pins; public Nostr pools are optional Balanced/Public profiles (F-alt · F-netconfig).

### Adapter contract (normative intent)

```text
Workspace graph / vault / auth
        │
        ▼
 Canonical DTOs + intent envelopes
        │
        ▼
 Obscur-Nostr adapter
        │  encode NIP-17 / community events
        │  publish/subscribe chosen relays
        ▼
 Relay home(s)  (public pool | user VPS | lab)
```

UI never imports event kinds as relationship law. Crypto badge shows **T2** unless F5 upgrades the conversation.

## 7. Risks / traps

- Rebuilding Soft L3 contact lookback “just for Nostr users.”  
- Hybrid default dialing public + localhost without badges (F-netconfig).  
- Gift-wrap Accept as the only membership/CRM signal.  
- Claiming multi-protocol done because Matrix lab exists beside Nostr.  
- Marmot marketing language without F5 design + proof.  
- Treating relay retention as Continuity (F-sync M9 reject).

## 8. Open questions

1. Default workspace connectivity profile: **Private-trust** (Nostr app on private relay only) vs Balanced with public pool?  
2. For T3 1:1 on a Nostr pin: Obscur-owned Double Ratchet with Nostr as dumb pipe, or wait for Marmot-class groups first? (→ F5)  
3. Public community discoverability: which kinds/indexes are in-scope vs out-of-scope for spam?  
4. Friend-code alias events: keep as discovery-only forever?  
5. When does Obscur-Nostr rename charter fire relative to F9?

## 9. References

- NIPs: 01, 17, 29, 44, 59; EE unrecommended — https://github.com/nostr-protocol/nips  
- `docs/exploration/feasibility/10-external-e2ee-protocol-sources.md`  
- `docs/exploration/feasibility/01-relationship-authority.md`  
- `docs/exploration/feasibility/00-aggregator-adaptation-law.md`  
- `docs/exploration/feasibility/11-performance-security-encryption-standards.md`  
- `apps/pwa/app/features/protocol-adaptation/nostr/nostr-adapter.ts`  
- `packages/obscur-protocol-nostr/src/capabilities.ts`  
- Soft L3 contact evidence: `docs/handoffs/p1-o4b-*`  
