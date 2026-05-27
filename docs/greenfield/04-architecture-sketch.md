# Architecture sketch — layers & ownership

**Status:** Draft — concept phase  
**Last updated:** 2026-05-19 (security pass)

**Security:** [05-security-data-classes.md](./05-security-data-classes.md) · **Scope:** [06-scope-of-responsibility.md](./06-scope-of-responsibility.md)

---

## Layer diagram

```text
┌─────────────────────────────────────────────────────────┐
│  Native client (Tauri / mobile)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ SQLite UX   │  │ Crypto + E2EE│  │ Warning engine  │ │
│  │ source of   │  │              │  │ (rule packs +   │ │
│  │ truth       │  │              │  │ local analyzers)│ │
│  └─────────────┘  └──────────────┘  └─────────────────┘ │
└──────────────────────────┬──────────────────────────────┘
                           │ TransportPort v0
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌─────────────────┐     ┌─────────────────────┐
     │ Courier (chosen) │     │ Optional adapters    │
     │ - envelope sync  │     │ Nostr, Matrix, …     │
     │ - signed directory│    │ event bus ONLY       │
     │ - rule pack CDN  │     │ NOT roster authority │
     └─────────────────┘     └─────────────────────┘
```

---

## Data classes (A–D) — placement

| Class | Lives where | Critical function enabled |
|-------|-------------|---------------------------|
| **A** Secrets | Device only | E2EE, decrypt |
| **B** Ciphertext | Courier in transit/at rest | Private messaging, group chat bodies |
| **C** Operational MD | Courier (minimal TTL) | Networking, sync, rate limits |
| **D** Directory MD | Courier (signed) | Group roster, invites, key directory |

**Pragmatic rule:** Never sacrifice DM delivery, sync, or roster convergence to avoid storing C/D — minimize and TTL instead. Search = **local index** on A-derived plaintext, not server FTS.

---

## One owner per fact

| Fact | Owner | Never owner |
|------|-------|-------------|
| Message plaintext | Recipient + sender devices (E2EE) | Courier, relay |
| Message search index | Local SQLite (class A derivative) | Courier plaintext index |
| Thread / read state | Local SQLite | Relay |
| Membership roster | Signed ledger on courier (D) | Public Nostr relay |
| Block list | Local (+ signed export optional) | Global vendor list |
| Warning tier | Client computes from rule pack + events | Opaque server score |
| Trust / WoT edges | User-signed graph | Phone upload graph |

---

## TransportPort (v0 contract)

```typescript
// Conceptual — not shipped code
interface TransportPort {
  publish(envelope: CiphertextEnvelope): Promise<Receipt>;
  subscribe(filter: SubscriptionFilter): AsyncIterable<CiphertextEnvelope>;
  health(): Promise<TransportHealth>;
}
```

- Phase 1: single courier backend.
- Phase 4: Nostr adapter implements `publish/subscribe` only; roster ops go through `DirectoryPort`.

---

## DirectoryPort (Phase 2)

```typescript
interface DirectoryPort {
  postMembershipDelta(delta: SignedDelta): Promise<Seq>;
  getMembershipHead(communityId: string): Promise<SignedHead>;
  getDeltasSince(communityId: string, seq: number): Promise<SignedDelta[]>;
}
```

Same process as courier in v1; split later if needed.

---

## Metadata minimization (courier)

Courier may store for sync:

- Ciphertext blobs, recipient routing ids, timestamps, size hashes.
- Signed membership deltas (no plaintext).
- Aggregated rate counters with **TTL** (e.g. 7 days).

Courier must **not** store:

- Message plaintext.
- Global contact graphs from OS address books.
- Permanent behavioral profiles for ads.

---

## Client modules (expandable, no finance)

Planned module families (post–Phase 1):

| Module | Phase | Notes |
|--------|-------|-------|
| Core DM | 1 | E2EE, block, backup |
| Groups | 2 | Keys, roster, policies |
| Warnings | 3 | Rule packs, local analyzers |
| WoT / invites | 3 | Trust graph UI |
| Attachments | 2+ | Encrypted blobs via courier |
| Search (local) | 2+ | Index local plaintext only |
| Adapters | 4 | Optional |

**Excluded forever (charter):** wallet, swap, escrow, in-app tipping rails, marketplace checkout.

---

## Technology choices (TBD in Phase 0 spike)

Record decision in Phase 0:

| Area | Candidates | Decision factor |
|------|------------|-----------------|
| Shell | Tauri 2, native mobile | Prior Obscur investment vs mobile-first |
| Local DB | SQLite, sqlcipher | Portability |
| E2EE | Double Ratchet, MLS for groups | Group size target |
| Courier | Rust/Workers/self-host Node | Solo ops burden |

Obscur PWA remains **reference UI**, not mandatory stack.

---

## Security review checkpoints

- End of Phase 1: threat model vs implementation.
- End of Phase 2: group key rotation + roster authZ.
- End of Phase 3: rule pack supply chain + warning invariants audit.
