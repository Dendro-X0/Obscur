# Design — DM/CM relay pool strategy (same-relay myth, parallel dial, failover)

- Date (UTC): 2026-08-01
- Trigger: Maintainer — DMs/CMs fail unless peers share a relay; want parallel pool + auto-switch backups; explore other Nostr clients
- Evidence: Relays UI — only `ws://localhost:7000` Quiet/open; public nos/primal/damus DISCONNECTED (PRIMARY offline)
- **v1.9.15 charter:** [v1.9.15-scope.md](../../docs/program/v1.9.15-scope.md) · [latency-underlay-path-design-2026-08.md](./latency-underlay-path-design-2026-08.md)

## Session gate

```text
NEXT ATOMIC STEP: Hold — Relays metrics top-level U7 (L1 Pass)
USER REQUEST: Design relay pool strategy for DM/CM delivery (no COM-RUN code)
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab as validation
CANONICAL OWNERS:
  DM dial/publish — relay-primary-selector · relay-provider · relay-publish-scope
  CM scoped — sealed-community-relay-scope · community workspace relay URL
PROOF (later slices): L1 selector/failover · L3 two-user same-relay vs outbox
OUT OF SCOPE THIS DOC: COM-RUN membership · AUTH-SESSION · Mbps · public SLA · UI chrome
```

**This document is design-only. No implementation in this step.**

---

## 1. Delivery physics (correct the “same single relay” rule)

Nostr relays are independent stores. An event is delivered to a peer only if:

1. The peer **subscribes** on a relay that **has** the event, and  
2. Someone **published** the event to that relay (or it was copied there).

| Myth | Reality |
|------|---------|
| “Everyone must use exactly one identical relay or DMs die” | Peers must share a **non-empty intersection of write→read paths**, not necessarily one shared Settings list. |
| “Connecting to 3 relays always means everyone sees everything” | Publish may fan-out; subscribe may miss if the recipient never dials the relay where the event landed. |

Two working patterns in the ecosystem:

### A) Shared-pool (simple / lab)

All participants configure overlapping public relays (or one operator VPS / localhost in lab). Publish to the open pool; subscribe on the same set. **Intersection ≈ pool.**

### B) Outbox / inbox (NIP-65, modern clients)

- Author publishes to **author write** relays + each tagged user’s **read** (inbox) relays.  
- Readers fetch a user’s posts from that user’s **write** relays.  
- Kind `10002` advertises read/write lists.  
- Clients (Amethyst, many others) **do not** require a shared default list; they **discover** peer relays.  
- Tradeoff: more client complexity, cache of `10002`, fallback when lists missing.

**Obscur today is mostly (A) for DMs** (local Settings pool) and **strict scoped (A) for sealed CMs** (community operator / workspace relay URL). Outbox (B) is **not** the product default yet.

---

## 2. How other Nostr clients typically behave

| Pattern | Who / where | Behavior |
|---------|-------------|----------|
| Hard-coded popular defaults | Older / simple clients | Everyone lands on damus/nos/primal-class relays → accidental intersection. Fragile under outage/censorship. |
| User relay list + broadcast | Many clients | Publish to all enabled; subscribe to all enabled. Failover = “try next open socket.” |
| **Outbox (NIP-65)** | Amethyst, notedeck-class, NIP-65 clients | Publish to author write + recipient read; subscribe to peer write for their notes. Dynamic dial. |
| Gossip / inbox heuristics | Advanced clients | Cap connections; prefer relays that appear in many followees’ lists; retry/backoff. |

None of these magically sync Settings UIs across devices. Delivery works because of **publish targets ∩ peer subscriptions**, not because the Relays settings screen looks identical.

---

## 3. Obscur owners today

### 3.1 DM / profile Nostr transport

| Piece | Owner | Behavior |
|-------|--------|----------|
| Mode | `RelayTransportMode` `basic` \| `redundancy` | Product default **basic** unless `NEXT_PUBLIC_OBSCUR_RELAY_REDUNDANCY=1` |
| Dial set | `resolveActivePoolRelayUrls` | **basic:** prefer primary; pad standby when primary cold; may promote open standby. **redundancy:** up to 3 scored URLs, remotes preferred over local-only (E2c/P6). |
| Primary label | `relaySelection.primaryUrl` | Selection can stay on dead primary while pool has open members (failover only when `writableRelayCount === 0` or mesh owns failover). |
| Publish scope filter | `resolveScopedPublishRelayUrls` | Drops offline **localhost** when publics exist — good for production; lab-only local still traps users if publics never open. |

### 3.2 Sealed community / CM (group)

| Piece | Owner | Behavior |
|-------|--------|----------|
| Scope | `publishSealedEventToCommunityScope` | Publish to **community `relayUrl`** (+ optional broadcast URLs). |
| Ingest | `isScopedRelayEvent` | Events must arrive on the **same scoped URL** the community is bound to. |

For CMs, “same relay node” is **literally true** for the sealed/community binding: the group’s configured workspace/operator relay is the shared store. Backups only help if they are in `communityRelayBroadcastUrls` **and** peers also subscribe there — otherwise fan-out is one-way.

### 3.3 Screenshot gap (runtime)

- PRIMARY `nos.lol` offline; primal/damus standby disconnected.  
- Only `localhost:7000` open as pool member.  
- Any remote peer **not** dialing localhost will not see events published only to localhost.  
- This matches “messages fail” even though the UI shows a healthy Quiet local RTT.

---

## 4. Target strategy (recommended)

Split **dial** (sockets we keep warm) from **publish intent** (where this message must land) from **subscribe intent** (where we listen for peers).

```text
┌─────────────────────────────────────────────────────────┐
│  Dial pool (parallel, ≤N)                               │
│  warm sockets: primary + backups ranked by health       │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
        ┌───────▼───────┐     ┌───────▼────────┐
        │ Publish plan  │     │ Subscribe plan │
        │ DM / CM rules │     │ DM / CM rules  │
        └───────────────┘     └────────────────┘
```

### 4.1 DM transport — “primary write + backup dial + intersection publish”

**Invariant D1 — Intersection publish**  
For a DM to peer P, publish MUST succeed on at least one relay that P is expected to read. Until NIP-65 is implemented:

- **Phase 0 (now / next slice):** Treat the **open remote dial pool** as the shared set. Never publish DM **only** to localhost when any remote is enabled (extend E2c honesty into publish path). Prefer open remotes; local is lab assist only.  
- **Phase 1:** Promote primary to an open remote when primary socket is down even if localhost is writable (today’s writable>0 gate blocks this).  
- **Phase 2 (optional product):** NIP-65 outbox — publish to peer read relays; subscribe to peer write; keep Obscur pool as bootstrap/fallback.

**Invariant D2 — Parallel dial, serial preference**  
Keep up to 3 sockets warm (redundancy). Publish attempts: preferred open remote first, then remaining open pool members (fan-out for durability), with ACK/quorum policy already in pool. Failover = next open remote, not “stay on dead primary label.”

**Invariant D3 — Automatic adaptation**  
When preferred relay closes/errors:  
1. Dial already-warm backup.  
2. Reconcile `primaryUrl` to best open **remote** (emergency switch — already modeled in `reconcilePrimarySelection`, needs wiring when writable>0).  
3. UI: Active transport on open member; offline primary shows Primary (offline) (done U5).

### 4.2 CM / sealed community — “scoped primary + optional broadcast backups”

**Invariant C1 — Shared community store**  
All members MUST publish/subscribe the **bound community relay URL** (operator / workspace). This is the true “same node” requirement for CMs.

**Invariant C2 — Backups are explicit**  
Additional URLs only via `communityRelayBroadcastUrls` (or a future community relay list). Auto-switching the community binding to a random public Nostr relay is **forbidden** (breaks sealed scope). Failover = operator-defined alternate scoped URL, not DM pool promotion.

**Invariant C3 — COM-RUN pause**  
Do not reopen membership/roster reconcile under COM-RUN-*. Relay strategy for CM publish/subscribe paths may still be designed; membership choreography stays paused.

### 4.3 What we will not do

- Claim public Nostr SLA because redundancy=3.  
- Use localhost as the sole publish target for remote DMs.  
- Auto-rewire sealed community relay to whatever public relay happens to be Quiet.  
- Patch COM-RUN / AUTH-SESSION under this charter.

---

## 5. Comparison: requested model vs Obscur

| Request | Obscur today | Gap |
|---------|--------------|-----|
| Parallel pool | Redundancy dials ≤3 | Often only local opens; remotes never become primary |
| One relay for transmission | Primary label | Primary can be offline while local carries traffic |
| Auto switch backups | Failover when writable=0 / mesh owns | No promote while local writable>0 |
| Same relay for all users | DM: implicit Settings overlap; CM: scoped URL | No peer relay discovery; local-only trap |
| Explore NIP-65 | Not product default | Phase 2 optional |

---

## 6. Implementation slices (maintainer-ordered; not started)

| ID | Slice | Proof |
|----|-------|-------|
| **S0** | Investigation closed (this doc) | Design review |
| **S1** | DM publish: never sole-target offline-capable local when remotes enabled + open remotes exist | L1 publish-scope / selector tests |
| **S2** | Primary reconcile when primary !open && remote open, even if local writable | L1 reconcile + switch policy; soft L3 |
| **S3** | Relays UI: show “publish path” = open remotes used for DM (not just primary chip) | L1 UI |
| **S4** | CM: document + enforce scoped URL; optional broadcast list UX | L1 scope tests; no COM-RUN — **fail-closed** (no `publishToAll`); `resolveCommunityScopedPublishRelayUrls` + Relays community hint |
| Soft L3 | Two-profile delivery on agreed path | Recipe + `pnpm verify:s-pool-delivery-l3` — see [l3 soft recipe](./relay-pool-delivery-l3-soft-recipe-2026-08.md) |
| **S5** | Optional: NIP-65 read/write lists for DM outbox | Separate charter |

---

## 7. Claim language

| Claim | When |
|-------|------|
| Strategy **designed** | This doc landed + handoff points here |
| S1/S2 **implemented** | Named L1 green |
| Delivery **fixed** | L3 two-profile: A publishes, B receives on agreed path (remote or scoped CM) |

---

## 8. References

- NIP-65 Relay List Metadata — https://nips.nostr.com/65  
- Outbox overview — Derek Ross / Nostr Compass NIP-65  
- Owners: `relay-primary-selector.ts`, `relay-transport-mode.ts`, `relay-publish-scope.ts`, `sealed-community-relay-scope.ts`  
- Prior: E2c/P6 dial preference, U1–U7 Relays UI honesty  
