# Feasibility — E2EE models (what Obscur owns vs reuses)

**ID:** F5  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-sources · F-PSE · F2 · F4 · F-hub · F-auth-schemes-solution · F-groups  
**Claim language:** **model choice draft** ≠ implemented crypto · ≠ Tor Verified · ≠ “Signal-grade” marketing

## 1. Scope

- **In:** Which end-to-end encryption **models** Obscur should **own** in the kernel vs **reuse** inside carrier adapters; how they map to F-PSE tiers T0–T4; recommendation for private-trust launch.
- **Out:** Implementing ratchets this phase; PQ fashion before T3 basics; NIP-EE.

## 2. Basics

**E2EE** means content keys are held by endpoints (devices/workspaces), not by relays/DCs/homeservers as a matter of product promise. Homes (F4) may store **ciphertext**.

| Model | Unit of protection | FS | PCS | Natural home |
|-------|-------------------|----|-----|--------------|
| **Clear / transport TLS only** | Hop to server | No | No | T0 public rooms |
| **Static conversation key** (NIP-44-class) | Pair of long-term keys | No | No | T1–T2 |
| **Gift-wrap envelope** (NIP-17/59) | Same + metadata reduction | No | No | **T2** |
| **Double Ratchet / Olm** | 1:1 session | Yes | Yes (w/ DH steps) | **T3** |
| **Sender keys / Megolm** | Group sender chain | Partial | Weak | T4-with-caveats |
| **MLS (RFC 9420)** | Group epoch tree | Yes | Yes (epoch) | **T4 preferred** |

**Obscur split:**

```text
Kernel crypto policy (owns tier promise + labels)
  ├── may run Obscur session/MLS engines (preferred for private-trust T3/T4)
  └── or delegate to carrier-native crypto (Matrix vodozemac) when pin = Matrix
Carrier adapter
  └── frames/delivers ciphertext; must not upgrade the advertised tier silently
```

## 3. Capabilities map

| Need for Obscur | Own in kernel? | Reuse carrier? | Notes |
|-----------------|----------------|----------------|-------|
| Honest T2 Nostr DMs | Policy + labels | NIP-17/44/59 in adapter | F2 default today |
| Private-trust 1:1 T3 | **Prefer own DR** | Or Matrix Olm when pin=Matrix | Dumb-pipe over H-relay/H-dc possible |
| Private groups T4 | **Prefer MLS** | Megolm if Matrix pin | Marmot = MLS over Nostr delivery — study, don’t marketing-claim |
| Vault at-rest | Own (PDK/DEK) | — | Auth/storage; not messaging E2EE |
| Continuity backups | Own sealed blobs | Home parks ciphertext | F-sync |
| PQ | Later | PQXDH / MLS-PQ / PQDR | After T3 multi-device clear |

## 4. Fit to planes

| Plane | E2EE role |
|-------|-----------|
| Auth | Unlocks local keystores; not a message ratchet |
| Profile | Per-workspace device keys; hard isolation |
| Storage | Ciphertext in SQLite/vault/DC; keys local |
| Relationship | Intents should be ≥ conversation tier when on hostile relays |
| Message | Applies tier policy per conversation/group pin |
| Transport | TLS/Tor underlay ≠ content E2EE (F6) |

## 5. Libraries / stacks

| Candidate | Lang | Use | Notes |
|-----------|------|-----|-------|
| `nostr` crate NIP-44/17 | Rust | T2 Nostr adapter | Not T3 |
| vodozemac | Rust | Matrix Olm/Megolm | When pin=Matrix (F3) |
| OpenMLS | Rust | Group T4 | Aligns Marmot-class / RFC 9420 |
| libsignal (Rust) | Rust | 1:1 T3 reference | Heavy; prefer slim DR port or audited subset |
| As-built TS crypto | TS | Legacy | Migrate hot path to kernel (F-stack) |

## 6. Feasibility verdict

**`fit-with-adapter`** — Obscur should run a **tiered crypto policy**:

| Surface | Launch recommendation |
|---------|----------------------|
| Public Nostr social / open communities | T0–T2 as labeled |
| Nostr DM adapter (public or private relay) | **T2** honest default |
| Private-trust 1:1 on own home | **Target T3** (Obscur-owned DR; Nostr/DC as delivery) — may ship T2 first with clear badge |
| Private groups on own home | **Target T4 MLS** (or sealed room keys interim) |
| Matrix-pinned rooms | Carrier-native Olm/Megolm; UI shows model + caveats |

**`reject-for-core`** — Single global “we’re E2EE” badge; NIP-17 as T3; NIP-EE; rolling a novel group ratchet without MLS/Signal pedigree.

### Phased crypto cuts (docs → later F9)

| Cut | Deliver |
|-----|---------|
| **E0** | Tier labels in UI + policy table (no silent upgrade) |
| **E1** | Harden T2 paths; kill NIP-04 |
| **E2** | Obscur DR for private-trust 1:1 over H-relay/H-dc |
| **E3** | MLS (or interim sealed) for private groups |
| **E4** | Matrix pin uses vodozemac; optional Marmot study |

## 7. Risks / traps

- Operator DC holding T0 “private family” chat.  
- Multi-device without Sesame-like enroll (F-sync M5) breaking T3.  
- Megolm PCS limits unlabeled.  
- PQ before revoke/device list works.

## 8. Open questions

1. ~~Ship private-trust T2-labeled first, or block launch face on E2 T3?~~ → **T3 required** (F-confirm A4, 2026-11-09).  

2. MLS in-kernel for all private groups vs only Nostr-pinned (Marmot) vs Matrix Megolm forever on Matrix pins?  
3. Sealed community room keys today — map to which interim tier label?  
4. Attachment encryption: same session keys vs separate file DEKs (NIP-17 kind 15 style)?

## 9. References

- `docs/exploration/feasibility/10-external-e2ee-protocol-sources.md`  
- `docs/exploration/feasibility/11-performance-security-encryption-standards.md`  
- `docs/exploration/feasibility/02-nostr-carrier.md`  
- `docs/exploration/feasibility/04-private-relay-server.md`  
- RFC 9420 · Signal Double Ratchet · NIP-44/17/59 · vodozemac · Marmot  
