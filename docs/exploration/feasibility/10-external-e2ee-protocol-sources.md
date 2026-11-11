# Feasibility — External sources: E2EE · Nostr crypto · encrypted messengers

**ID:** F-sources  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Feeds:** F2 (Nostr carrier) · F3 (Matrix carrier) · F5 (E2EE models)  
**Claim language:** **explored sources** ≠ adopted ≠ implemented ≠ Pass

## 1. Scope

- **In:** Curated primary specs, RFCs, official docs, and a few high-signal comparisons found via online search (2026-11-09). Organized by protocol family for later F2/F3/F5 notes.
- **Out:** Adoption decisions; implementation; Tor as product identity; Soft L3 contact CRM; marketing claims (“Signal-grade done”).

## 2. Basics

Obscur needs three distinct ideas kept separate:

| Idea | Meaning |
|------|---------|
| **Payload encryption** | Ciphertext only the parties can read |
| **Session / ratchet E2EE** | Forward secrecy (FS) + usually post-compromise security (PCS) via evolving keys |
| **Metadata / envelope privacy** | Who talks to whom, when, and over which path |

Nostr’s modern DM stack (NIP-44 + NIP-17 + NIP-59) improves payload + some envelope hiding. It **does not** equal Signal/MLS session security. NIP-44’s own text says high-risk users should use specialized E2EE software and limit Nostr to exchanging contacts.

## 3. Capabilities map (what external stacks teach Obscur)

| Need for Obscur | What sources show | Implication |
|-----------------|-------------------|-------------|
| Relationship graph | Not owned by any relay/DM ciphertext history | Keep FIRST-CLASS local (F1) |
| Carrier-agnostic auth/profile/DB | Signal/Matrix/SimpleX all separate identity apps from transport crypto | Aggregator law stands |
| Switchable carriers | Marmot already splits identity / MLS / transport | Matches adapter vision |
| Strong 1:1 E2EE | Signal Double Ratchet (+ PQXDH) is the reference | Candidate for **Obscur-owned** crypto plane, not inferred from Nostr kinds |
| Strong groups | MLS (RFC 9420) or Matrix Megolm (different trade-offs) | Do not invent a third group ratchet casually |
| Nostr as adapter | NIP-17/59 = transport + light privacy; Marmot = MLS-on-Nostr path | Adapter may offer tiers; kernel must not assume NIP-17 = “secure messaging product” |
| Rust kernel fit | `vodozemac`, OpenMLS, `libsignal` Rust, `nostr` crate NIP-17 | Aligns with F-stack thought experiment |

## 4. Fit to planes (source-driven hints only)

| Plane | Hint from sources |
|-------|-------------------|
| Auth | Out-of-band / identity keys ≠ messaging ratchet keys (Signal Sesame, Matrix device keys, SimpleX OOB invite) |
| Profile | Carrier display names (NIP-01, Matrix profiles) ≠ hard isolation profiles |
| Storage / DB | Ciphertext may sit on untrusted servers; session keys stay local (Megolm design explicitly) |
| Relationship | Never infer TRUSTED from decryptable DM history |
| Message | Choose crypto **model** (static conversation key vs ratchet vs MLS) explicitly per product promise |
| Transport | Relays / homeservers / SMP routers are replaceable underlays |

## 5. Libraries / stacks (candidates to study — not chosen)

| Candidate | Lang | Role | Notes |
|-----------|------|------|-------|
| [vodozemac](https://github.com/matrix-org/vodozemac) | Rust | Olm / Megolm | Matrix-recommended; docs.rs; Least Authority audit cited upstream |
| OpenMLS | Rust | MLS (RFC 9420) | Named by NIP-EE / Marmot ecosystem as MLS engine |
| [libsignal](https://github.com/signalapp/libsignal) (Rust) | Rust | Signal Protocol / PQXDH | Industry reference; heavy product coupling if adopted wholesale |
| [nostr](https://docs.rs/nostr) crate | Rust | NIP-17/44/59 | Carrier adapter crypto helpers — not a full E2EE product |
| MDK / White Noise (Marmot) | — | Marmot reference path | Study for MLS-over-Nostr; do not treat blog claims as Obscur Pass |

## 6. Feasibility verdict

`lab-only` **as a source shelf** — this note does **not** select an E2EE model.

Why: External literature confirms Obscur’s hinge: **protocol adaptation ≠ security product**. Nostr gift-wrap DMs, Matrix Olm/Megolm, Signal/MLS, and SimpleX PQDR are different points on the FS/PCS/metadata spectrum. F5 must pick what Obscur **owns**; F2/F3 must map each carrier to that choice without lying.

## 7. Risks / traps

- Treating **NIP-44** as a DM protocol (it is payload format only).
- Treating **NIP-17** as Signal-equivalent (NIP-44/EE docs: **no FS, no PCS** if long-term key leaks).
- Building on **NIP-EE** (official NIPs mark it **unrecommended**; superseded by **Marmot**).
- Confusing **Megolm** (group sender-key style, weaker PCS) with **MLS** (tree-based group AKE).
- Confusing **encrypted content** with **private social graph** / relationship CRM.
- Adopting a full messenger stack (Signal app, Element, SimpleX) instead of a **crypto + adapter** cut.

## 8. Open questions (for F2 / F3 / F5)

1. Does Obscur’s private-trust launch face require FS/PCS day-one, or is NIP-17-class privacy enough for a labeled “Nostr DM adapter” tier?
2. If FS/PCS is required, is the owner **Obscur MLS/Signal-style plane** with carriers as delivery only (Marmot-shaped), or per-carrier native crypto (Matrix vodozemac path)?
3. Multi-device: Sesame / Matrix device lists / Marmot multi-device — which model fits hard profiles?
4. Post-quantum: PQXDH / Signal Triple Ratchet / SimpleX PQDR / MLS PQ extensions — defer or design-gate?
5. What exact user-visible labels prevent “E2EE” marketing when the active carrier is NIP-17-only?

## 9. References (curated)

### 9.1 Nostr — encryption & DMs

| Resource | URL | Why it matters |
|----------|-----|----------------|
| NIP-44 Encrypted Payloads | https://github.com/nostr-protocol/nips/blob/master/44.md | Versioned AEAD payload; **explicit FS/PCS/deniability limits** |
| NIP-17 Private DMs | https://github.com/nostr-protocol/nips/blob/master/17.md | Rumor → seal → gift-wrap; uses NIP-44 + NIP-59 |
| NIP-59 Gift Wrap | https://github.com/nostr-protocol/nips/blob/master/59.md | Metadata / routing isolation layers |
| NIP-04 (legacy) | https://github.com/nostr-protocol/nips (index: unrecommended) | Deprecated DM; metadata leak; do not use for new work |
| NIP-EE (historical) | https://github.com/nostr-protocol/nips/blob/master/EE.md | MLS-on-Nostr attempt; **superseded / unrecommended** |
| NIP index | https://github.com/nostr-protocol/nips | Living status of kinds / unrecommended markers |
| NIP-17 explainer | https://nostr.co.uk/nips/nip-17/ | Clear three-layer walkthrough (secondary) |
| NIP-44 topic note | https://nostrcompass.org/en/topics/nip-44/ | Emphasizes “not a DM protocol” |

### 9.2 Nostr — MLS / Marmot path

| Resource | URL | Why it matters |
|----------|-----|----------------|
| Marmot Protocol | https://github.com/marmot-protocol/marmot | Current MLS + Nostr identity; transport-agnostic stance |
| Marmot intro (Primal) | https://primal.net/jeffg/introducing-marmot-the-future-of-secure-messaging | Product narrative; treat as advocacy, not audit |
| NIP-EE mirror / history | https://nip.guide/nips/ee | Timeline: EE → Marmot |

### 9.3 Signal Protocol family

| Resource | URL | Why it matters |
|----------|-----|----------------|
| Double Ratchet | https://signal.org/docs/specifications/doubleratchet/ | FS + break-in recovery reference |
| X3DH | https://signal.org/docs/specifications/x3dh/ | Async handshake (classical) |
| PQXDH | https://signal.org/docs/specifications/pqxdh/ | Post-quantum extended handshake |
| PQXDH blog | https://signal.org/blog/pqxdh/ | Design intent in plain language |
| Sesame | https://signal.org/docs/specifications/sesame/ | Multi-device / async session management |

### 9.4 MLS (IETF)

| Resource | URL | Why it matters |
|----------|-----|----------------|
| RFC 9420 MLS Protocol | https://www.rfc-editor.org/rfc/rfc9420 | Group AKE with FS/PCS; log-scale membership |
| RFC 9750 MLS Architecture | https://www.rfc-editor.org/rfc/rfc9750.html | Embedding MLS in apps; not a full IM protocol |
| MLS vs Signal (comparison) | https://www.offlineprotocol.com/learning/encryption/mls-vs-the-signal-protocol | Pair vs group unit of protection |
| MLS vs Signal (wire trade-offs) | https://umbrellax.io/blog/signal-protocol-vs-mls/ | Deployment / PQ / group cost table (vendor blog — cross-check) |

### 9.5 Matrix

| Resource | URL | Why it matters |
|----------|-----|----------------|
| Olm & Megolm hub | https://spec.matrix.org/latest/olm-megolm/ | Spec entry |
| Olm | https://spec.matrix.org/latest/olm-megolm/olm/ | Double Ratchet relative; 1:1 / key share |
| Megolm | https://spec.matrix.org/latest/olm-megolm/megolm/ | Group sender-key ratchet; FS with PCS caveats |
| E2EE implementation guide | https://matrix.org/docs/matrix-concepts/end-to-end-encryption/ | Client author checklist; points to vodozemac |
| vodozemac | https://github.com/matrix-org/vodozemac | Pure Rust Olm/Megolm |
| Element E2EE overview | https://element.io/en/features/end-to-end-encryption | Product-level summary (secondary) |

### 9.6 Other encrypted-messenger architectures (contrast)

| Resource | URL | Why it matters |
|----------|-----|----------------|
| SimpleX security | https://github.com/simplex-chat/simplexmq/blob/stable/protocol/security.md | DR + optional PQ; no global user IDs |
| SimpleX PQDR | https://github.com/simplex-chat/simplexmq/blob/stable/protocol/pqdr.md | PQ-augmented double ratchet design |
| SimpleX overview | https://github.com/simplex-chat/simplexmq/blob/stable/protocol/overview-tjr.md | Queue / OOB invite model |
| SimpleX Chat protocol | https://simplex.chat/docs/protocol/simplex-chat.html | App-layer message semantics |

### 9.7 In-repo parents

- `docs/exploration/feasibility/00-aggregator-adaptation-law.md`
- `docs/exploration/feasibility/01-relationship-authority.md`
- `docs/exploration/feasibility/09-ideal-stack-thought-experiment.md`
- `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`

## Search method (reproducibility)

Online search batches (2026-11-09): NIP-44/17/59; Matrix Olm/Megolm; Signal Double Ratchet / X3DH / PQXDH / Sesame; MLS RFC 9420/9750; Marmot / NIP-EE; vodozemac; SimpleX PQDR. Prefer primary specs over blogs; blogs listed only as comparison aids.
