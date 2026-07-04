# Conduit Mesh — post-relay transport concept (2026-06)

**Status:** **Conceptual** — design only; no implementation charter yet  
**Last updated:** 2026-06-26  
**Band:** `ENGINE-LAB` · experimental transport  
**Supersedes as daily queue:** transport-engine w69+ prep waves, W53 legacy-deletion band (until mesh slice 0 lands)  
**Aligns with:** [obscur-engine-lab-charter.md](./obscur-engine-lab-charter.md), [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md), [design-goals-and-constraints.md](./design-goals-and-constraints.md)

---

## 0. Maintainer intent (this document)

Obscur resumes development with an **avant-garde experimental** posture: set aside product-feature bands that do not serve transport truth, and **reinvent the communication network layer from first principles**.

This is **not** “fix the Nostr relay pool again.” It is a greenfield **Conduit Mesh** — a profile-scoped, evidence-driven fabric that carries **Obscur-encrypted envelopes** across **user-chosen infrastructure**. Nostr public relays may ship as a **suggested default** for users who want zero server ops; they are **not** an ecosystem dependency. Users may point the mesh at **their own servers**, **custom relay pools**, or **other conduit dialects** — Obscur owns **encryption, identity, and security semantics** regardless of wire format.

**Scope of this file:** conceptual architecture, invariants, and phased research questions. **No code, no verify gate, no UI work** until slice charters exist.

---

## 1. Product boundary — what Obscur owns vs what users configure

| Obscur owns (non-negotiable) | User configures (pluggable) |
|------------------------------|----------------------------|
| E2EE envelope format, keys, profile isolation | Which servers / pools / URLs to use |
| Auth kernel, unlock, signing, multi-profile | Whether to use Nostr, team relay, coordination, or mix |
| Security modes, trust tiers, fail-closed policy | Tor on/off, hybrid fallback rules |
| Evidence semantics (“did this envelope reach durable proof?”) | Operator of infrastructure they trust |
| Local SQLite truth, import/export of saves | Deployment tier (serverless → private → experimental) |

**One sentence:** Obscur is **transport-agnostic encryption and security**; the mesh is **infrastructure glue**, not a Nostr client.

Users are never required to participate in the public Nostr ecosystem. A user who runs only `wss://relay.myorg.internal` (team dialect) or a self-hosted Obscur relay gateway never touches `damus.io`. Another user who prefers public Nostr pools uses the same envelope API — **Obscur does not change**.

Nostr is **one optional dialect adapter** (`nostr_ws`), not a protocol lock-in. “Relay pool” in product language means **the user’s configured conduit endpoints** (redundancy, failover), not “must speak NIP-01.”

---

## 2. Historical note — why Nostr appeared in early DMs

Obscur is a **local, self-hosted application**. Most users do **not** run a dedicated Obscur communication server on day one. There is no Obscur HQ relay, no mandatory SaaS inbox, no always-on coordination VM bundled with the installer.

Under that constraint, **direct peer messaging still needs a rendezvous layer** — somewhere encrypted envelopes can be posted and fetched asynchronously while both parties are offline. Nostr public relays were adopted for DMs because they provide a **pre-existing, operator-maintained, federated store-and-forward network** without the user deploying anything:

| Property | Why it mattered for Obscur |
|----------|----------------------------|
| **Zero server ops** | Install app → configure relays (or defaults) → DMs possible |
| **Federated pool** | No single point of failure; multiple relays as redundancy |
| **Async delivery** | Recipient need not be online at send time |
| **Censorship resistance (optional)** | Public relays as escape hatch when user has no private infra |

That decision was **rational as a default suggestion** for users without infrastructure — not as a **product dependency**. The drawbacks (retention opacity, metadata leakage, no delivery guarantees, pool health chaos) are why Nostr must stay **optional** and **thin**, with other conduits first-class.

**What went wrong** was not offering Nostr as a bootstrap — it was **treating the product as Nostr-shaped**:

- Using the same pool logic for **workspace membership** (where relay gossip is the wrong authority).
- Treating **socket count** as product health instead of **envelope evidence**.
- Growing a 2k-line pool orchestrator instead of a thin **nostr dialect driver** inside a larger fabric.

- Implying users **must** use public Nostr relays to use Obscur at all.

**Conduit Mesh corrects the boundary:** Obscur encrypts and secures; users pick transport. Nostr may remain a **convenience default** in onboarding — never a **runtime requirement**.

---

## 3. Why “relay” is still the wrong *architecture* name

Nostr relays were designed as **append-only event stores** with REQ/CLOSE/WebSocket semantics. Obscur inherited their failure modes even after pivoting to private trust:

| Inherited flaw | Symptom in Obscur | Why patching the pool failed |
|----------------|-------------------|------------------------------|
| **Relay as membership authority** | Roster drift, monotonic-wrong participants (MEM-001) | Membership is a **graph problem**; relays only store gossip |
| **Implicit publish scope** | “Open socket” ≠ “publish-ready”; 0/4 writable | Scope must be **explicit per envelope**, not pool side-effect |
| **Best-effort fanout** | Missing join/leave on public hosts | No operator SLA on retention or ordering |
| **Single transport dialect** | Everything forced through NIP-shaped WS | Team/coordination paths bolted on as parallel owners |
| **Observable success without evidence** | UI banners contradict journal | Local pending treated as durable |
| **Recovery as socket churn** | Reconnect loops without lane change | Reconnect ≠ **route change** |

The repo already acknowledges the pivot ([platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md)): **Nostr is an optional adapter**, not membership authority and not the product definition. The remaining debt is that **runtime behavior still thinks like a monolithic Nostr relay client** — shared pool, subscription soup, recovery = reconnect.

**Design break:** stop naming the layer “relay.” Name it **Conduit Mesh** — a fabric of **user-configured conduits** (typed lanes + endpoints) selected by **policy**, not by protocol ecosystem.

### 3.1 Deployment tiers (examples, not mandates)

Tiers describe **typical** user setups. Any tier may omit `nostr_ws` entirely.

```text
Tier 0 — Minimal infra (user has not deployed Obscur stack)
  DM  → user-configured conduits (often: suggested public nostr pool OR own URL)
  Workspace → optional; coordination not required for DM-only

Tier 1 — Private trust (user deploys own servers)
  DM  → team_ws / custom relay gateway (primary)
  Workspace → coordination_http + team_ws (membership on coordination)
  nostr_ws → off by default; user may enable as hybrid fallback

Tier 2 — Hardened / experimental
  Any scope → tor_preferred/required, LAN, dead-drop, multi-path, custom dialects
```

The mesh **never requires** Nostr. It **does require** that no single dialect owns orchestration — only conduits the user (or onboarding defaults) registered.

---

## 4. One-sentence definition

**Conduit Mesh** is a profile-scoped transport fabric that accepts **Obscur-encrypted envelopes** from kernel engines, routes them through **user-configured conduits** (any supported dialect), converges on **recipient evidence**, and **automatically shifts lanes** when paths fail — without lying to the UI about readiness.

`nostr_ws` is **one optional dialect** among many — not the architecture, not an ecosystem dependency.

---

## 5. Design goals (optimal target)

| ID | Goal | Success criterion |
|----|------|-------------------|
| G1 | **Media pluralism** | Same envelope API over team HTTP/WS, coordination push/pull, Nostr REQ, future QUIC/datagram |
| G2 | **Explicit scope** | Every outbound envelope declares audience, required evidence class, and allowed conduit set |
| G3 | **Evidence-first state** | Durable transitions only on ACK, accept, stored proof, or coordination head match — never on “sent to socket” |
| G4 | **Lane fault tolerance** | Automatic retry, backoff, circuit break, **lane promotion/demotion** without user intervention |
| G5 | **Tor compatibility** | Conduits declare `network_policy: clearnet \| tor_preferred \| tor_required`; mesh respects SOCKS without breaking evidence |
| G6 | **One owner** | Single mesh runtime per `(profileId, scope)` — no parallel pool + supervisor + recovery truths |
| G7 | **Security honesty** | Operator-visible metadata bounded; no silent clearnet fallback when Tor required |
| G8 | **Experimental surface** | Radical transports (store-and-forward dead drops, mixnet hooks, LAN mDNS) plug in as conduits without kernel fork |
| G9 | **No ecosystem lock-in** | Full DM/workspace function with **zero** Nostr conduits configured |
| G10 | **Convenience defaults** | Onboarding may **suggest** a public pool; user can replace with own servers before first send |

**Non-goals for v0 concept:** global delete guarantees, blockchain anchoring, “works on every public relay,” community UI polish.

---

## 6. Architecture (conceptual)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ KERNEL ENGINES (dm · workspace · auth)                                │
│  emit Envelope { Obscur ciphertext, scope, audience, evidence_class, ... }│
└───────────────────────────────┬──────────────────────────────────────┘
                                │ MeshPort (new — superset of TransportPort)
┌───────────────────────────────▼──────────────────────────────────────┐
│ CONDUIT MESH RUNTIME  (@obscur/conduit-mesh — greenfield package)     │
│  Router · Scheduler · Evidence ledger · Snapshot owner · Tor policy   │
└───┬─────────┬─────────┬─────────┬─────────┬──────────────────────────┘
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
 team_ws   coord_sse  nostr_ws  custom_*  (experimental)
 conduit   conduit    (optional) conduit   conduits…
```

### 6.1 Core types (language-agnostic)

**Envelope** — opaque to mesh except routing metadata:

- `profileId`, `scope` (dm | workspace | control)
- `envelope_id`, `correlation_id`
- `audience` (pubkeys, group_id, coordination_topic)
- `ciphertext` — **always Obscur/kernel E2EE**; conduits see opaque blobs + routing metadata only
- `evidence_class`: `fire_and_forget` | `at_least_one_relay_ok` | `recipient_ack` | `coordination_head`
- `allowed_conduits[]`, `forbidden_conduits[]`
- `deployment_tier`: `serverless` | `private_trust` | `experimental` (derived from configured conduits)

**Conduit** — a lane, not a URL:

- `conduit_id`, `dialect` (`team_relay`, `coordination_http`, `nostr_ws`, `custom`, …)
- `endpoints[]` — **user-supplied** URLs, SOCKS-wrapped URLs, LAN addresses
- `capabilities` (publish, subscribe, pull, push, store_forward)
- `network_policy`, `trust_tier` (operator_attested | user_configured | public_untrusted)
- `health`: derived from probes + recent evidence, not socket state alone

**Evidence** — append-only ledger entries per envelope:

- `published_to_conduit`, `accepted_by_operator`, `stored_proof`, `inbound_at_recipient`, `coordination_head_seq`, `failure_reason`
- UI and engines **subscribe to evidence**, not to WebSocket events

**MeshSnapshot** — single truth (extends today’s `TransportSnapshot`):

- `phase`, `readiness`, `active_conduits`, `degraded_conduits`, `blocked_conduits`
- `publish_ready_count` / `required_ready_count` **per scope**, not global relay count
- `tor_state`, `effective_network_policy`
- `last_evidence_at`, `recovery_generation`

### 6.2 Router behavior (fault tolerance)

The mesh **scheduler** replaces reconnect-all logic:

1. **Classify** outbound envelope → candidate conduit set (policy + trust tier + Tor rules).
2. **Score** conduits: latency EMA, recent publish evidence, circuit breaker state, write-queue depth (native).
3. **Attempt** primary lane; on timeout/failure, **promote** standby lane (different dialect allowed — e.g. `team_ws` → `nostr_ws` when private infra down, or `nostr_ws` → second pool member when one relay fails).
4. **Record** evidence; if `evidence_class` unmet, **requeue** with decaying retry budget (jittered).
5. **Subscribe** side: maintain **interest registry** (what audiences this profile cares about); conduits pull/subscribe independently; mesh dedupes and orders before kernel handoff.
6. **Recovery exhausted** → `phase: offline` or `degraded` with **actionable reason** (`tor_unreachable`, `no_trusted_conduit`, `all_circuits_open`) — never “0/4 publish-ready” without explanation.

This is **route change**, not only socket recycle ([transport-kernel-recovery-port.ts](../../apps/pwa/app/features/transport-kernel/transport-kernel-recovery-port.ts) today mostly reconnects/resubscribes).

### 6.3 Dialect map (Nostr optional, not central)

| Dialect | Carries | Membership authority | Typical evidence |
|---------|---------|----------------------|------------------|
| `team_relay` | E2EE envelopes, sealed control | **No** — coordination | Operator accept + fanout proof |
| `coordination_http` | Membership deltas, directory heads | **Yes** (Path B) | Head sequence match |
| `nostr_ws` | NIP wire for Obscur envelopes (**optional**; convenience default only) | **No** | Relay OK + optional stored id |
| `custom` | User-defined server / gateway speaking mesh envelope contract | **No** | Operator-defined accept proof |
| `coordination_sse` | Push hints (“new head available”) | **No** | Hint + pull verification |
| `store_forward` (experimental) | Delay-tolerant blob drop | **No** | Pickup token + expiry |
| `lan_mdns` (experimental) | Same-LAN peer envelopes | **No** | Direct ACK |

Kernel **semantic events** stay in [dweb-transport-contracts](../../packages/dweb-transport-contracts/src/transport-port.ts); dialect adapters **map wire ↔ envelope**, they do not own roster truth.

**DM routing policy (conceptual — all user-configured):**

| Typical setup | Primary conduits | Fallback (if user enabled) |
|---------------|------------------|----------------------------|
| Own server only | `team_ws` / `custom` | Other endpoints in same pool |
| Suggested public pool | `nostr_ws` (user’s pool list) | Other pool members |
| Private + optional hybrid | `team_ws` | `nostr_ws` only when user opts in |
| Experimental | User-ordered set | Multi-path redundant publish |

---

## 7. Tor overlay

Existing desktop surface ([commands/tor.rs](../../apps/desktop/src-tauri/src/commands/tor.rs)): sidecar, SOCKS proxy, `enable_tor` settings. **Not yet validated for comms performance.**

### 7.1 Design rules

| Rule | Rationale |
|------|-----------|
| Tor is a **network policy on conduits**, not a separate pool | Avoid clearnet/Tor split-brain |
| Each conduit endpoint resolves through **NetRuntime** (SOCKS or direct) | Single injection point in native layer |
| `tor_required` envelopes **fail closed** if Tor not ready | Sovereignty/privacy promise |
| `tor_preferred` tries Tor first, may fall back only if envelope allows | Practical desktop UX |
| Probes measure **end-to-end** (publish probe envelope), not just SOCKS open | Matches G3 |
| Latency expectations documented | Tor is a **lane**, not default for realtime |

### 7.2 Performance research questions (untested)

- Cold-start: sidecar bootstrap vs external Tor on 9050
- WS over SOCKS vs HTTP long-poll over SOCKS for DM throughput
- Multiplexing: one Tor circuit per profile vs per conduit
- Mobile: no sidecar — `tor_required` conduits disabled with explicit snapshot reason

---

## 8. Security model (conceptual)

**Trust tiers**

1. **Operator attested** — team relay + coordination the user configured; optional policy handshake (no plaintext fields).
2. **User configured** — custom URL, fingerprint/pin future.
3. **Public untrusted** — includes optional public Nostr pools; never membership authority; user must explicitly add these endpoints.

**Obscur security invariant:** plaintext never leaves the client except as user-directed export; **transport operators see ciphertext + bounded metadata** regardless of whether the conduit is Nostr, team relay, or custom server.

**Fail-closed matrix**

| Condition | Mesh behavior |
|-----------|---------------|
| No conduit meets trust tier for envelope | Reject publish; evidence `no_viable_conduit` |
| Tor required but Tor down | Reject; snapshot `tor_unreachable` |
| Public relay only for workspace control | Reject unless envelope explicitly allows |
| Decrypt/routing failure on inbound | Evidence + quarantine; no optimistic UI success |

**Metadata honesty:** mesh documents what operators can still see (timing, sizes, pubkey routing). Aligns with [design-goals-and-constraints.md](./design-goals-and-constraints.md) accepted limitations — does not promise magic anonymity.

---

## 9. Relationship to existing code (migration, not rewrite day one)

| Today | Conduit Mesh disposition |
|-------|---------------------------|
| `@obscur/transport-engine` + `TransportSnapshot` | **Evolve** — snapshot becomes mesh snapshot; keep headless tests |
| `enhanced-relay-pool-legacy.ts` (~2.4k LOC) | **Shrink to** optional `nostr_ws` driver; generic **conduit pool** (user URLs) replaces Nostr-centric orchestration |
| `relay-runtime-supervisor` + recovery policy | **Replace** with mesh scheduler + evidence ledger |
| `dweb-transport-nostr` / `team-relay` / `coordination` adapters | **Wrap** as conduits; no duplicate publish APIs |
| `TransportPort` (community control only) | **Subset** of `MeshPort`; extend for DM envelopes |
| `apps/relay-gateway` | **Reference** operator service; may become team conduit test harness |
| W53–W68 legacy deletion prep | **PAUSED** until mesh slice 0 proves headless publish path |

**Subtraction principle:** mesh owns orchestration; dialects own wire format only. One envelope in, one evidence stream out.

---

## 10. Experimental program (“radical thought experiments”)

Once mesh slice 0 proves **headless publish + evidence + lane switch** (no UI), these become **pluggable conduits** without kernel rewrites:

| Experiment | Hypothesis | Risk |
|------------|------------|------|
| **Dead-drop store-and-forward** | Async communities over slow networks | Replay, retention policy |
| **LAN mDNS conduit** | Zero-config LAN rooms | Trust boundary blur |
| **Padding / constant-rate lanes** | Metadata resistance | Bandwidth cost |
| **Multi-path redundant publish** | Same envelope to 2+ dialects; first evidence wins | Dedup complexity |
| **User-run mixnet hook** | Optional fourth lane | Out of scope until spec |
| **Cross-deployment federation** | Coordination heads bridge orgs | Governance, not wire |

Each experiment requires its own **charter + headless gate** — no UI-first probes.

---

## 11. Phased path (concept → code)

| Slice | Deliverable | Proof (conceptual) |
|-------|-------------|-------------------|
| **C0** (this doc) | Conduit Mesh concept + invariants | Maintainer review |
| **C1** | `MeshPort` + envelope/evidence types in `@obscur/conduit-mesh-contracts` | `verify:conduit-mesh-c1` ✓ |
| **C2** | Headless mesh runtime: mock `custom` + `team_relay`, lane switch — **no Nostr required** | `verify:conduit-mesh-c2` ✓ |
| **C3** | Tor policy + probe integration spec; headless `tor_required` fail-closed | `verify:conduit-mesh-c3` ✓ |
| **C4** | `team_relay` + `coordination_http` drivers vs coordination API shapes | `verify:conduit-mesh-c4` ✓ |
| **C5** | Pool orchestrator retirement + W53 headless parity | `verify:conduit-mesh-c5` ✓ |
| **C6** | Optional `nostr_ws` driver for users who want NIP wire compatibility | `verify:conduit-mesh-c6` ✓ |

**Paused until C2:** community member sync UI, legacy standalone deletion, w69+ prep waves.

---

## 12. Open decisions (maintainer)

1. **Package name:** `@obscur/conduit-mesh` vs extend `@obscur/transport-engine`?
2. **Evidence persistence:** SQLite table in libobscur vs in-memory with checkpoint export?
3. **Onboarding defaults:** suggest public Nostr pool, blank slate, or “configure server first”?
4. **Custom conduit contract:** minimum `custom` dialect surface for self-hosted gateways (HTTP POST + SSE pull)?
5. **Hybrid policy:** when user has private server, is public `nostr_ws` fallback **opt-in** (recommended default: yes, off until enabled)?
6. **Tor default:** off | preferred | required for DM?
7. **Coordination push:** SSE/WebSocket hints as first-class conduit vs poll-only?

---

## 13. Document authority

When this concept conflicts with handoff on **implementation order**, [current-session.md](../handoffs/current-session.md) wins until maintainer updates the next atomic step to cite **Conduit Mesh C1+**.

This document **does not** reopen community membership rewrite ([membership-graph-integration-study-2026-06.md](./membership-graph-integration-study-2026-06.md) cancelled) — mesh carries coordination heads; it does not reinvent roster UI.

---

## References

- [rules/04-messaging-and-relay.md](../../rules/04-messaging-and-relay.md)
- [product-layers-and-nostr.md](../architecture/product-layers-and-nostr.md)
- [obscur-backend-engine-roadmap.md](./obscur-backend-engine-roadmap.md)
- [docs/exploration/modules/05-relays-transport.md](../exploration/modules/05-relays-transport.md)
