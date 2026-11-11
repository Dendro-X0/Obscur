# Investigation — Multiparty social sync production gate (2026-11-08)

```text
HANDOFF ATOMIC STEP: Soft L3 persist hygiene Pass · maintainer elevates pre-release social sync gate
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity · A4 · invite Fixed without cut
CANONICAL OWNERS (domain):
  DM trust / contact: request-transport + use-peer-trust + incoming-lifecycle
  Block: use-blocklist + connection-block/unblock wire
  Community membership: community-membership-mutation-owner + leave outbox + coordination directory
  DM history: messaging hydrate / native SQLite / projection (existing owners — no new bus)
  Drift observe: relationship-sync experiment (detector only)
PROOF BEFORE DONE: this inventory + design gate · per-plane L1/L2 before Fixed claims
SURFACE: desktop Tauri / static-dev dual CDP (Tester1↔Tester2 Soft L3 preferred)
```

## Product statement (maintainer)

Before the next **public production** release, social interactions must be **fully synchronized** — not one-sided local commits. Decentralization and encryption stay core; that does **not** excuse unilateral relationship or history views.

All involved parties (user A, user B, groups / other entities) must keep **data**, **interaction history**, and **relationship mappings** convergent under the existing transport and write owners.

## What “synced” means here

| Plane | Meaning | Not meaning |
|-------|---------|-------------|
| **P1 Relationship graph** | Mutual trust / block / membership edges converge after wire+apply (or honest outbox) | Global consensus DB · single shared plaintext roster |
| **P2 Interaction history** | Both sides can reconstruct the same ciphertext thread / membership events they are entitled to | Server-side message mirror · plaintext cloud backup |
| **P3 Mapping projections** | UI authorities (peerTrust, blocklist, directory, ledger) do not silently diverge into “A sees B / B does not see A” without outbox honesty | One mega relationship-event-log replacing domain owners |
| **P4 Failure honesty** | Pending/failed wire is visible; hydrate must not resurrect stale edges | Silent drop of peer notify |

Encryption/E2EE and optional private mesh remain non-negotiable. Sync is **ciphertext + sealed membership intents** over existing carriers — not a new central social server.

## Landed baseline (do not re-litigate)

Unified lifecycle charter already defined the mutation contract:

`intent → local sticky → wire best-effort → peer apply → outbox honesty`  
(`specs/backend/2026-11-07-social-relationship-lifecycle-unified-design.md`)

| Slice | Mutation | Status (2026-11-08) |
|-------|----------|---------------------|
| Contact remove / reconnect | DM trust | L1 Pass · L2 Pass (Requests residue Pass) |
| Slice 1 Block/unblock | Block graph | L1+L2 Pass Soft L3 dual CDP |
| Slice 2 Leave peer visibility | Membership | L1+L2 Pass Soft L3 dual CDP |
| Slice 3 Invite create→accept | Membership join | L1 classified · L2 Pass Soft L3 dual CDP |
| Soft L3 persist hygiene | Lab transport stickiness | L1+L2 Pass · **not** Soft L3 Fixed |

These prove **peer-visible relationship mutations** on Soft L3 dual CDP. They do **not** yet prove production-gate **history** convergence or cross-plane mapping completeness under public relays / packaged NSIS / long soak.

## Gap inventory (code-backed classes)

### G1 — Mutation Fixed ≠ production-gate closed

Block / leave / invite L2 Pass used Soft L3 dual CDP. Public-relay and packaged dual-CDP soaks still open (NSIS CDP seam investigation). Production gate needs **named proof per plane** on the release surface, not only lab mesh.

### G2 — Interaction history still one-sided class

Parked / known: native DM SQLite one-sided threads, hydrate vs projection gap-fill, relay backfill repair owner (`native-dm-sqlite-repair`). Group timeline parity across members is not a single Fixed claim.

### G3 — Mapping drift is observe-only

`relationship-sync` experiment detects directory vs ledger vs invite-blocklist drift; it is **not** a mutation owner and does not heal peers.

### G4 — Wire honesty incomplete as a product surface

Outbox / pending UX exists for some membership leave paths; not uniformly required for every relationship mutation under production claim language.

### G5 — “Other entities” underspecified

Charter covers DM contact, block, community membership. Production gate must explicitly list: group kick/expel, invite revoke, contact decline/cancel already-OK paths, and any profile-scoped multi-device residue (same pubkey, two devices) as **in or out**.

## Hypotheses for remaining Fail before public release

| ID | Hypothesis | How to falsify |
|----|------------|----------------|
| H1 | Public-relay dual CDP regresses peer apply that Soft L3 passed | Dual CDP soak on Default Stable after Soft L3 Pass fixtures |
| H2 | DM history remains one-sided after mutual trust + N messages + reload both sides | Dual CDP history assert (counts + ids) post-reload |
| H3 | Directory/ledger drift still yields “A in group / B does not see A” after leave/invite | Extend leave/invite L2 with drift detector assert + peer UI |
| H4 | Packaged NSIS cannot prove dual-party soaks (no CDP) | Seam design or alternate proof (manual scripted L3) before claim |
| H5 | Multi-device same profile diverges relationship graph | Explicit non-goal **or** scoped Continuity sibling — do not sneak into this gate |

## Non-causes / refuse

- Soft L3 Fixed / hung dial as synonym for social sync
- Tor Verified · Matrix promote
- New global relationship event bus replacing peerTrust / membership / messaging owners
- Second relay publish stack under stop-writing modules
- Claiming “all social synced” from Slice 1–3 L2 alone

## Next

Design: production-gate matrix (planes × proof layers × release surface) + sequenced work packages that extend — not replace — the unified lifecycle charter.
