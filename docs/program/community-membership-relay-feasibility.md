# Community membership vs relay protocol — feasibility

**Status:** Product/architecture decision record (2026-05-22)  
**Triggers:** Observer still sees leaver in participant modal; re-invite blocked; “must remove the list” vs “list is required for chat/discovery.”  
**Implementation path:** [v1.9.0-kernel-backend-roadmap.md](./v1.9.0-kernel-backend-roadmap.md) (Lane K) — coordination directory + membership kernel port.

---

## Short answer

| Question | Answer |
|----------|--------|
| Can we **bypass NIP-29 / public relay** membership rules? | **No** — relays do not offer authoritative global delete of roster rows. |
| Is leave **only local to A** on public relays? | **Often, in practice** — unless **sealed 10105 leave** reaches B while B is subscribed with the room key. |
| Can users **re-invite** someone who left? | **Yes, in product** — on B once B has applied leave evidence; not “because the relay forgot them globally.” |
| Is “remove the member list entirely” feasible? | **No** without breaking chat, invites, governance, and evidence UX. |
| Is **live roster parity** across all clients on public relays feasible? | **Not guaranteed** — document as best-effort; do not promise. |

**Conclusion:** Decentralization does **not** make “leave” a private preference — but **public relays are weak broadcasters** for membership. Obscur’s cross-client path is **encrypted gossip (10105)**, not “the relay’s member table updates.” When that gossip does not arrive, B is behaving correctly given missing evidence — which feels broken to users accustomed to servers.

---

## Two different truths (the trade-off)

```text
┌─────────────────────────────────────────────────────────────────┐
│  DISCOVERY / HISTORY (widen-only)                                │
│  “Who have we ever seen in this community?”                      │
│  Sources: message authors, directory seeds, relay 39002 hints    │
│  Must NOT shrink on thin relay snapshots (MEM-001)               │
└─────────────────────────────────────────────────────────────────┘
                              ≠
┌─────────────────────────────────────────────────────────────────┐
│  MEMBERSHIP (contractual)                                        │
│  “Who is joined for invite, send, and steward actions?”        │
│  Sources: ledger, sealed leave, explicit terminal cache        │
│  MUST shrink when user leaves or is expelled                     │
└─────────────────────────────────────────────────────────────────┘
```

Patching one combined list forces a false trade-off:

- **Shrink list** → roster collapses after refresh, chat evidence disappears, “1 member” headers.
- **Never shrink** → leavers stay “members,” re-invite stays blocked.

Obscur chose widen-only discovery (MEM-001 park) **and** applied participation filters that **also** stripped membership terminal state — that was the bug class fixed in `bc6fcdfa`, not the whole design.

---

## Product truth (say this to users)

On **sovereign communities over public relays** (e.g. `nos.lol`):

- **Leaving always applies on your device** — you disappear from your group list; chat may stop; ledger records “left.”
- **Other people learn you left only if they receive evidence** — sealed leave event, NIP-29 leave (when the relay supports it), or manual reconcile while online.
- **There is no global “room server”** that removes you from everyone’s UI instantly. That is the same class of limit as **no true delete-for-everyone** on DMs.

Managed workspace on **operator-controlled relays** is the lane where stronger directory semantics are even possible — still not magic, but closer to a shared source of truth.

---

## What the relay actually allows

| Mechanism | What it does | Limit on public relays |
|-----------|--------------|-------------------------|
| **NIP-29 leave (9022)** | Signals leave to relay | Relay may lag, rate-limit, or keep serving older **39002** member lists |
| **Sealed leave (10105)** | Gossip among clients with room key | Only clients subscribed + with key see it; publish can fail if NIP-29 failed first |
| **39002 roster snapshots** | Relay’s view of members | **Monotonic widen** in our stack — we refuse to drop someone without signed removal evidence |
| **Immutable events** | All of the above are events | No server “delete row” — only newer contradicting events |

**Bypass is not feasible** at the protocol layer without **operator-controlled relays** (managed workspace tier) or a **central coordinator** (not Nostr-shaped).

**Feasible product path:** treat relay roster as **hint input**, not **membership authority**. **Cross-client leave** = publish and apply **Kind 10105 `t: leave`** to everyone still holding the room key (implemented; must not be skipped when NIP-29 fails).

### Implementation note (2026-05-22)

Previously, sealed leave was published **only if** NIP-29 leave succeeded. On many public relays, 9022 does nothing useful — so **B never saw 10105**, and the UI looked like “leave is only for A.” That was an app bug, not proof that decentralization forbids shared leave. Sealed leave publish is now **independent** of 9022 success; ingestion of sealed leave no longer waits for relay `steady_state`.

---

## What your screenshot shows (Tester 2)

Tester 1 under **Offline** with **RELAY-CONFIRMED** means:

1. **Membership path:** Tester 1 is still in the **active** participant column (not only in “Excluded from active roster”).
2. **Relay path:** B’s client still has **relay-backed evidence** that T1 is/was a member (39002 / gossip), hence the badge — that can be **honest** even after leave if relay has not applied leave yet.
3. **Terminal section empty:** UI only moves someone to “Excluded…” when they are in `leftMembers` / terminal cache **and** not treated as active — if B never ingested sealed leave, or active roster still includes T1, they stay in Offline.

So the remaining gap may be **(a)** leave event not observed on B, **(b)** build without `bc6fcdfa`, or **(c)** modal still binding Online/Offline to discovery-sized `visibleMembers` instead of membership-eligible set.

---

## Viable product model (no protocol bypass)

### A. Keep discovery list (required)

- Preserve message authors, directory OR-set, warm-up widen rules.
- Used for: history, “who spoke,” reconcile tooling, operator diagnostics.

### B. Membership list (authoritative for actions)

- **Invite / already-member:** `inviteEligibleMemberPubkeys` (active − left − expelled).
- **Send / steward / expel:** same membership projection + relay gates for managed workspace.
- **Participant modal Online/Offline:** must use **membership**, not discovery.

### C. Terminal band (required for honesty)

- **All** pubkeys in `leftMembers` ∪ terminal cache ∪ expelled → **Excluded from active roster**.
- Do not hide leavers because they have old messages.
- Copy: “Left locally; relay may still show historical confirmation until sync.”

### D. Re-invite flow

- Allowed when pubkey ∉ membership set.
- New invite → provisional → join path (existing).
- Optional: `reinstateCommunityMemberTerminalEvidence` when invite accepted (already exists).

This satisfies rejoin **without** erasing the discovery list.

---

## What is explicitly **not feasible** (v2.0 honesty)

1. **Instant global roster** on arbitrary public relays for all observers.
2. **Single UI list** that is simultaneously widen-only history and strict membership.
3. **Deleting** someone from all relay state worldwide from the client.
4. **MEM-001 full fix** without **R2** single read owner (`docs/program/v1.5.0-architecture-refactor-queue.md`).

---

## Recommended program direction

| Band | Work |
|------|------|
| **v1.8.3 (now)** | REL-004 leave durability + MEM-002 membership vs discovery split in UI/gates (in progress) |
| **v1.8.4** | Formalize `CommunityMembershipReadModel` port (membership vs discovery); modal + Network + invite read one projection |
| **R2 (pre-2.0)** | Single roster read owner; retire parallel merges in `group-provider` / page |

**Do not** pursue “relay protocol bypass” as a milestone — charter **managed relay** + sealed gossip + honest copy instead.

---

## Manual acceptance (your A/B scenario)

Pass when **all** hold on B after A leaves (fresh build):

1. A absent from **Online/Offline** participant columns.
2. A appears under **Excluded from active roster** (if B received leave), **or** absent entirely if B never got leave event (with honest “pending sync” copy).
3. **Invite** to A enabled.
4. A can accept and rejoin; membership ledger shows joined again.

Fail → classify: **delivery** (sealed/NIP-29), not **list removal**.
