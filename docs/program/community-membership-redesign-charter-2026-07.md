# Community membership & encryption — redesign charter (2026-07)

**Status:** Active — slice **C** selected (2026-07-03); design spec landed  
**Maintainer decision:** 2026-07-03 — **CANCEL** profile-scoped room-key restore band (COM-RUN-02)  
**Implementation spec:** [community-coordination-room-key-wrap-slice-c-2026-07.md](../../specs/backend/community-coordination-room-key-wrap-slice-c-2026-07.md)  
**Trigger:** Room keys stored in profile `localStorage` are lost on EBWebView wipe / re-import; backup round-trip and repair loops block chat, invite, and join with no reliable recovery path.

---

## What is cancelled

| Band | Was | Decision |
|------|-----|----------|
| **COM-RUN-02** room-key restore | Repair from backup, ledger hints, invite DMs, auto-repair on health load | **CANCELLED** — stop iteration on restore/repair/gates |
| Room-key-as-UX-gate | Disable chat / invite / accept when `roomKeyStore` empty | **CANCELLED** — subtract gates; do not reintroduce |
| UNPAUSED exception (membership graph study) | Agents may patch COM-RUN-02 | **Reverted** — community feature churn remains **PAUSED** except this charter |

Investigation artifact (historical): [com-run-02-room-key-restore-2026-07.md](../../specs/backend/com-run-02-room-key-restore-2026-07.md) — status **CANCELLED**.

---

## Why the current design failed

1. **Wrong truth owner** — Encryption material lives in profile-scoped `room-key-store` while membership truth lives in coordination directory + relay events. After device recovery, ledger shows **joined** but crypto layer is empty.
2. **Backup does not round-trip reliably** — `roomKeys` in relay backup may be present in merge stats yet absent at runtime (`room_key_missing` health cascade).
3. **Invite pipeline depends on sender local key** — Inviter without local key cannot `distributeRoomKey`; invitee sees defective invite with no self-service path.
4. **UX gates amplified failure** — Health snapshot + UI policy blocked chat/invite before any async repair could run.

Maintainer sign-off: the room-key restore band is **not** a patch-debug target; it requires **redesign**.

---

## Redesign principles (target)

| Principle | Implication |
|-----------|-------------|
| One owner per lifecycle | Membership crypto material must have a **single** canonical owner aligned with workspace-kernel join/create |
| Recovery without local-only secrets | Re-import / new device must obtain group keys from **membership evidence** (coordination, sealed genesis, steward re-wrap), not ad-hoc localStorage repair |
| No UX gate on local key presence | Send/join flows resolve or fail with **action-time** crypto, not preemptive disable |
| Explicit profile scope | All reads/writes remain `profileId`-scoped — no ambient singleton |
| Subtraction before adapters | Remove parallel restore/repair paths before adding new fetch owners |

---

## Candidate directions (pick one in a follow-on design spec)

**A — Steward re-wrap on demand (interim)**  
When a steward sends invite or group message and local key is missing, fetch/wrap from coordination-held escrow or re-publish genesis wrap (requires server or relay-held ciphertext policy — **needs threat model**).

**B — Membership-bound key derivation**  
Derive group symmetric key from `(communityId, memberPubkey, sealed genesis)` + user private key so re-import restores keys with identity only.

**C — Coordination directory holds encrypted room-key blobs**  
Directory row per member includes E2E-wrapped room key; delta sync materializes `room-key-store` on join/restore (aligns Layer 2 crypto with Path B directory). **Selected 2026-07-03** → [design spec](../../specs/backend/community-coordination-room-key-wrap-slice-c-2026-07.md).

**D — Deprecate sealed group crypto for managed_workspace MVP**  
Document honest scope reduction: managed communities operate without E2E group seal until B or C lands (maintainer must explicitly accept).

---

## Out of scope until charter slice chosen

- COM-RUN-01 roster parity patches  
- New reconcile/self-heal owners in `groups/**`  
- Further COM-RUN-02 restore/repair code  
- COM-RUN-11 invite card lifecycle (separate band; fixture blocked on superseded invites)

---

## Proof plan (when a slice is chosen)

| Layer | Requirement |
|-------|-------------|
| L1 | Unit tests for new key owner + subtraction of old gates |
| L3 | Desktop: EBWebView wipe → key re-import → NewTest 2 chat + invite send without manual localStorage |
| L4 | COM-MEM-2 steps 3–4, 7–8 two-profile soak |

---

## References

- [membership-graph-integration-study-2026-06.md](./membership-graph-integration-study-2026-06.md)  
- [modular-iteration-contract.md](./modular-iteration-contract.md)  
- [obscur-runtime-issue-tracker-2026-07.md](./obscur-runtime-issue-tracker-2026-07.md) — COM-RUN-02 → **CANCELLED**
