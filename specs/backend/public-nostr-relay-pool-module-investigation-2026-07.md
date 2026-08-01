# Investigation — Public Nostr relay pool module (better owner)

**Status:** Investigation complete · 2026-07-31  
**Sequence:** B Done · C Done · **E** (this doc → design)  
**Prior:** [public-relay-connect-fail-investigation-2026-07.md](./public-relay-connect-fail-investigation-2026-07.md) · [r-relay-0-integration-study-2026-07.md](./r-relay-0-integration-study-2026-07.md) · [r-relay-1-failover-pool-design-2026-07.md](./r-relay-1-failover-pool-design-2026-07.md) · Wave A [design](./relay-transport-offline-local-connected-design-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     E — public Nostr relay pool redesign (investigation → design; no impl until design Pass)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION · Dev Lab as validation
CANONICAL OWNER:      resolveActivePoolRelayUrls + mergeNostrPoolWithCustomNodeRelayUrls + useConduitMeshRelayPool + transport-preset-catalog
PROOF THIS DOC:       Owner map · stale assumptions corrected · failure classes · redesign options
OUT OF SCOPE:         Claiming “public Nostr fixed” · production community un-pause · second publish path
```

---

## 1. What “public Nostr pool module” is today

| Layer | Module | Role |
|-------|--------|------|
| Preset catalog | `transport-preset-catalog.ts` | `public_nostr` packs: `default_stable`, `high_redundancy`, `low_latency` |
| List / enable | `use-relay-list` + scope | DM vs `community_candidate`; Wave A appends enabled `ws://localhost:7000` into DM ordered list |
| Active membership | `resolveActivePoolRelayUrls` | **basic** = single primary (+ Wave A promote when another is already open); **redundancy** = pad up to 3 (R-RELAY-1) |
| Socket URLs | `mergeNostrPoolWithCustomNodeRelayUrls` | Active pool + custom/community nodes |
| Runtime sockets | `useRelayPool` → `useConduitMeshRelayPool` | **RUST-4c:** mesh is the only UI pool (legacy browser orchestrator not on hook port) |
| Wire dial | `conduit-mesh-nostr-ws-client` + `createRelayWebSocket` | Localhost uses WebView WS; public uses NativeRelay on Tauri |
| Readiness | `relay-runtime-supervisor` + recovery metrics | `writableRelayCount` from pool snapshot scoped to supervisor URLs |
| Failover role | `attemptPrimaryFailover` / `shouldAttemptPrimaryFailover` | Skipped when `meshSchedulerOwnsFailover` |

**Stale note:** R-RELAY-0 still says conduit-mesh UI harness is archived. **False as of RUST-4c** — `relay-pool-hook-port.ts` routes solely to `useConduitMeshRelayPool`.

---

## 2. Evidence (2026-07-31)

### External probe (not an app fix)

| Host | TCP | TLS / WS |
|------|-----|----------|
| relay.damus.io:443 | OK | FAIL (TLS / early disconnect) |
| nos.lol:443 | OK | OK |
| relay.primal.net:443 | OK | OK |
| localhost:7000 | OK | OPEN |

### Wave A desktop L3-lite (local honesty)

```text
pnpm verify:wave-a-transport-l3
→ pass=true writable=1 readiness=degraded localEnabled=true falseOffline=false
```

Local mesh can carry writable count when public primary is unhealthy. That proves **false-offline for local** — not public pool health.

### Product symptoms still open for public packs

1. **Default Stable** still leads with `wss://relay.damus.io` while that host often fails TLS on this network path.
2. **basic** mode only dials the primary until something else is already open (Wave A promote) or custom-node merge adds private URLs. Public standbys stay cold unless redundancy is on (R-RELAY-1 pad).
3. Soft UX correctly says “couldn’t reach damus” while overall readiness stays `degraded`/`offline` if no other public socket is in the dial set.
4. Dual authority risk: when Rust mesh scheduler owns failover, TS `attemptPrimaryFailover` no-ops — public promote must live in mesh schedule or TS must remain owner for browser/mesh hybrid.

---

## 3. Failure classes

| Class | Owner | Client fix? |
|-------|-------|-------------|
| Upstream TLS / CF / relay down | Provider | No — probe + demote / alternate pack |
| Active pool starves standbys (basic) | `resolveActivePoolRelayUrls` | Yes — public packs must use redundancy, or basic pads 1 cold standby for dial |
| Score>0-only pool (historical) | R-RELAY-1 | Done (pad) |
| Local CONNECTED but DM metrics ignore it | Wave A scope + promote | Done at L1 + L3-lite |
| Mesh hook / NativeRelay path bugs | conduit-mesh + NativeRelay | Yes — separate from “reorder presets” |
| Claim “public Nostr fixed” from probe alone | Claim language | Forbidden |

---

## 4. Parallel paths / subtract candidates

- **Keep:** one pool hook (`useConduitMeshRelayPool`); one membership resolver; one failover trigger owner per profile (TS or mesh, not both).
- **Do not add:** second React pool, publish bridge, or “public health” UI that invents success without sockets.
- **Legacy browser pool** (`relay-browser-pool-runtime.ts`): still in tree for standalone helpers — not product hook; further tombstone is optional RUST follow-on, not E blocker.

---

## 5. Redesign options (ranked)

| Option | Summary | Risk |
|--------|---------|------|
| **A — Pack honesty (smallest)** | Public packs: redundancy mode; reorder defaults to probe-healthy hosts; damus demoted or optional | Low |
| **B — Dial pad for public basic** | If primary not live, include next N enabled public URLs in dial set (like R-RELAY-1 lite for basic public) | Medium — must not dual-own failover |
| **C — Probe-ranked runtime** | Periodic clearnet probe ranks enabled public URLs; supervisor prefers ranked live set | Higher — need single owner + L3 |
| **D — Demote public as default product path** | Continue R-RELAY-RUST private/local-first; public pack explicitly “best effort” | Product framing — already charter-aligned |

**Recommendation:** **A then B** as E design slices. C only if A+B still leave public standbys cold under redundancy. D remains product north-star, not a code excuse to skip A.

---

## 6. Mental simulation (public user, no local mesh)

1. Apply Default Stable (today: damus primary, basic or redundancy depending on pack).
2. Damus TLS fails; nos/primal healthy on path.
3. **Desired:** within seconds, at least one healthy public URL is dialed and writable≥1; primary role promotes; banner not “0 writable” solely from damus.
4. **Today without redundancy:** may stick on damus-only dial → offline/degraded with cold standbys.
5. **With local mesh enabled:** Wave A + custom merge → writable via localhost (C Pass) — orthogonal to public health.

---

## Claim

| May say | |
|---------|---|
| Investigated | Yes |
| Wave A local false-offline fixed (L1+L3-lite) | Yes |
| Public Nostr fixed | **No** |
| Ready to design E | Yes |
