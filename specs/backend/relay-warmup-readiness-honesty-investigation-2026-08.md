# Investigation — Relay warm-up / readiness honesty (Local Dev Mesh)

**Date:** 2026-08-02  
**Status:** Confirmed (code + operator Relays screenshots)  
**Charter:** v1.9.15 PATH+LATENCY · Soft L3 lab path  
**Neighbor:** AUTH-KERN-1 OS restore kept (desktop); AUTH-SESSION-1 not revived

---

## Symptom

With **Local Dev Mesh** (`ws://localhost:7000`) active:

| Surface | Observed |
|---------|----------|
| Metrics card | ACTIVE TRANSPORT · RTT ~1ms |
| Active pool copy | `publish-ready 0` · `subscribable 0` · “Switching relay” |
| Settings banner | “Relay transport is offline…” |
| Scope summary | `DM transport: 0 enabled · Workspace candidates: 1 enabled` |

RTT is not the bottleneck; **readiness signals disagree**.

---

## Owners

| Signal | Owner |
|--------|-------|
| Open WS sockets | `use-conduit-mesh-relay-pool` · `resolveWritableRelayUrls` (open ∪ `publishReadyRelayUrls`) |
| Mesh probe ledger | `map-mesh-snapshot-to-relay-activity` · `publishReadyRelayUrls` / `subscribableRelayCount` |
| Recovery banner | `extractRelayRecoveryAdapterMetrics` → `buildTransportRecoverySnapshot` → `relay-readiness-copy` |
| Settings offline UI | `RelayReadinessSettingsBanner` (no warmup grace; inline banner has grace) |
| Scope counts | `partitionRelayListByTransportScope` (localhost → community) vs `resolveDmTransportRelayUrls` (local-dev joins DM pool) |

---

## Root causes

### H1 — Scope partition vs DM pool (copy) — **Confirmed**

`isCommunityRelayCandidateUrl` classifies localhost as workspace. Partition UI counts `dmEnabled=0` even when `resolveDmTransportRelayUrls` puts enabled Local Dev Mesh into the DM transport pool.

### H2 — Activity snapshot lags open sockets — **Confirmed (code path)**

Recovery metrics use `getWritableRelaySnapshot().writableRelayUrls` (E3 open-socket union) **and** raw `activity.subscribableRelayCount` from mesh. Mesh health/`publishReady` can stay empty while a Nostr WS is already open and RTT-probed → UI can still show `publish-ready 0` / offline if snapshot refresh races or open status is not yet mirrored into activity counts used by Relays chrome.

### H3 — Settings banner lacks warmup suppression — **Confirmed**

`RelayReadinessInlineBanner` hides offline during `startup_warmup` / `booting` (+ grace). `RelayReadinessSettingsBanner` does not — cold start shows offline while reconnecting.

### H4 — Dial order starves local-dev — **Plausible**

When public remotes exist in list, dial/configure order may delay localhost open. Local Dev Mesh–only packs should open local-dev first (priority inside existing mesh configure — no second transport owner).

### H5 — Phase `connecting` stuck over open sockets — **Confirmed (2026-08-02 soak)**

Operator Relays after minutes: `Publish-ready 0 of 1 · Open sockets 1 of 1`, badge **Switching relay**, box **Relay connections starting**, metrics **ACTIVE TRANSPORT**, Advanced **No DM transport endpoints** (localhost only under Workspace).

`deriveRelayRuntimeStatus` returns early on `phase === "connecting"|"recovering"` **before** honoring open/writable evidence. `toPhase` / `resolveLegacyRelayRuntimePhase` map readiness `offline` + enabled>0 → `connecting`. When mesh `writableRelayCount` lags behind open WS, UI stays “starting/switching” forever. Advanced DM list uses `partition.dm` (excludes localhost) so Local Dev Mesh never appears as a DM adapter even though `resolveDmTransportRelayUrls` joins it to the pool.

### H6 — Supervisor frozen pool object — **Confirmed (2026-08-02)**

`relayRuntimeSupervisor.configure` stored `pool: relayPoolRef.current` once. `useConduitMeshRelayPool` returns a **new** pool object each render; connection open updates refresh via `relayConnectionSignature`, but recovery still read the **stale** pool → `writableRelayCount` stayed 0 while Settings open-count used the live pool. Fix: `getPool: () => relayPoolRef.current` rebound on every `refresh()`.

---

## Repair (smallest subtraction)

1. Unify activity + recovery: open in-pool sockets count as writable **and** subscribable for readiness classification.
2. Settings banner: suppress offline copy during `startup_warmup` / `booting` (match inline).
3. Scope summary: report DM pool size via `resolveDmTransportRelayUrls` (or equivalent), not raw partition `dm` count alone when local-dev assist is in the pool.
4. Prefer local-dev URL early in mesh configure when enabled Local Dev Mesh is present.
5. Status derivation: treat `max(writable, open)` as evidence; do not stay on connections-starting / Switching when open sockets exist.
6. Advanced DM adapters list: include DM-pool URLs (local-dev assist), not partition.dm alone.
7. Supervisor: live `getPool` on refresh so open sockets update publish-ready.

---

## Proof

| Layer | Command / check |
|-------|-----------------|
| L1 | vitest: recovery metrics open-socket honesty · scope copy · settings banner warmup |
| L1 | `pnpm verify:session-persistence-policy` (desktop PRODUCT_READY stays true) |
| Soft L3 | Lab `:7000` after rebuild — Pass only with report; dual CDP still required for Row B |

---

## Non-claims

- Not public Nostr SLA  
- Not AUTH-SESSION-1 revival  
- Not COM-RUN  
