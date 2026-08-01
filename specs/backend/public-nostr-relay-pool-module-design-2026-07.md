# Design — Public Nostr relay pool module (honesty + dial membership)

**Status:** E1 + E2 (+ E2b/E3-minimal) implemented · L1 Pass · public-only desktop L3 Pass · 2026-08-01  
**Investigation:** [public-nostr-relay-pool-module-investigation-2026-07.md](./public-nostr-relay-pool-module-investigation-2026-07.md) · [unused-pool](./public-nostr-pool-unused-investigation-2026-07.md)  
**Handoff:** Hold — B→C→E1→E2 closed · public-only L3 Pass

---

## Session gate

```text
NEXT ATOMIC STEP:     Hold — B→C→E1→E2 closed (optional public-only desktop L3)
PAUSED / CANCELLED:   COM-RUN-* · AUTH-SESSION · Dev Lab as validation
CANONICAL OWNER:      resolveActivePoolRelayUrls · buildRelayHealthHints · useConduitMeshRelayPool
PROOF:                E2 L1 29 Pass · Wave A L3-lite Pass (prior)
OUT OF SCOPE:         Claiming public Nostr fixed · community un-pause
```

---

## Goal

Make the **public Nostr pack** a first-class, honest module: redundancy membership reaches healthy standbys, default URL order prefers hosts that pass clearnet probes on maintainer paths, and basic mode cannot starve dial of enabled public standbys forever. Local/private mesh remains the reliable soak path (Wave A).

---

## Slices

### E1 — Pack honesty (implement first)

1. **Reorder** `default_stable` / `high_redundancy` public URLs to probe-preferred order:
   - `wss://nos.lol`, `wss://relay.primal.net`, then `wss://relay.damus.io` (demoted, not deleted).
2. Keep `transportMode: "redundancy"` on multi-URL public packs (`default_stable`, `high_redundancy`).
3. `low_latency` may stay `basic` but lead with a probe-healthy host (`primal` or `nos`) — already primal-first; move damus last.
4. Ensure **Apply pack** writes both relay list **and** transport mode from the preset (no silent keep of stale `basic` when applying a redundancy public pack). If apply already does this, add/guard L1 contract test only.
5. Copy: public packs remain “best-effort clearnet Nostr” — do not imply provider SLA.

### E2 — Basic dial pad (only if E1 L3 still cold)

In `resolveActivePoolRelayUrls` for `mode === "basic"`:

- If primary has hints and is **not** live, return `[primary, nextEnabled…]` capped at 2 (primary + one standby) so a cold standby receives a socket.
- Wave A promote-when-open stays; pad is for **dial**, not a second failover owner.
- Skip when `meshSchedulerOwnsFailover` profiles own membership entirely (document gate).

### E3 — Optional probe rank (backlog → P6 L1)

Periodic / runtime probe preference for **dial membership** (not Settings list rewrite):

- Done L1 2026-08-01 — [relay-probe-rank-dial-preference-design-2026-08.md](./relay-probe-rank-dial-preference-design-2026-08.md)
- `rankEnabledRelayUrlsForDial` · remote collect · basic pad · redundancy cold pad
- E3-minimal (writable = open ∪ publishReady) remains as shipped earlier

Desktop L3 that flaky-first lists still dial healthier remotes: optional.

---

## Proof (E1 · 2026-07-31)

```text
pnpm -C apps/pwa exec vitest run \
  app/features/transport-kernel/transport-preset-catalog.test.ts \
  app/features/transport-kernel/transport-preset-settings.contract.test.ts \
  app/features/transport-kernel/transport-preset-match.test.ts \
  app/features/transport-kernel/build-mesh-conduits-from-preset.test.ts \
  app/features/messaging/controllers/v2/dm-send-pipeline.test.ts \
  app/features/messaging/controllers/v2/dm-relay-transport.test.ts
→ 6 files · 41 Pass
```

Apply path already called `setRelayTransportMode(preset.transportMode)` — guarded by settings contract on `buildRelayRowsFromPreset` + redundancy mode.

**Not claimed:** public Nostr fixed (upstream TLS may still fail; re-apply Default Stable on desktop for L3).

---

## Proof (E2 · 2026-07-31)

```text
pnpm -C apps/pwa exec vitest run \
  app/features/relays/services/relay-primary-selector.test.ts \
  app/features/relays/services/relay-health-hints.test.ts \
  app/features/relays/services/relay-transport-scope.test.ts
→ 3 files · 29 Pass
```

Shipped with E2:
- Basic dial-pad: dead primary → `[primary, nextStandby]` (skip circuit-open)
- E2b: health hints match `localhost` ↔ `127.0.0.1`
- E3-minimal: mesh pool writable URLs = publishReady ∪ open WS in pool

**Not claimed:** public Nostr fixed without public-only desktop L3.

---

## Mental simulation

1. Fresh profile applies Default Stable → list nos → primal → damus; mode redundancy; pool pads ≤3.
2. Damus TLS fails; nos/primal dial; writable≥1; primary can promote to live member.
3. User on basic + damus primary + nos enabled → E2 pads nos into dial set when damus dead.
4. Local mesh still merges via custom nodes; Wave A L3 unchanged.
5. Neighbors: private packs untouched; community PAUSED; no UUID/group send changes.

---

## Tests (L1)

| Case | Expect |
|------|--------|
| Catalog `default_stable.relays[0]` | `nos.lol` (not damus) |
| `high_redundancy` leads with nos/primal before damus | Pass |
| Apply public redundancy pack sets mode `redundancy` | Contract test |
| Existing R-RELAY-1 pad + Wave A promote tests | Still Pass |
| E2 (if shipped): basic dead primary + cold standby in ordered list | Active pool includes standby for dial |

## Proof layers

| Layer | Command |
|-------|---------|
| L1 | vitest preset catalog + primary-selector (+ apply contract) |
| L3 (local) | `pnpm verify:e2-public-dial-l3` — writable via local path |
| L3 (public-only) | `pnpm verify:e2-public-only-l3` — Default Stable / public WSS, no local |

### Public-only L3 evidence (2026-08-01)

```text
pnpm verify:e2-public-only-l3
→ Pass · writable=1 · enabled=[wss://nos.lol] · hasLocal=false
→ upstream: nos OPEN · primal OPEN · damus HTTP 503
→ report: test-results/e2-public-only-l3-2026-07-31.json
```

## Claim language

| May say | When |
|---------|------|
| Implemented | Diff matches E1 (and E2 if chartered) |
| Verified | L1 Pass |
| Public Nostr pool dial fixed (desktop L3) | Public-only L3 Pass (`verify:e2-public-only-l3`) |
| Production community ready | **Never** from this band alone — COM-RUN still PAUSED |

---

## Forbidden

- Inventing a parallel pool hook
- Auto-reconcile render-depth loops in primary-selection hook
- Treating Wave A local Pass as public fix
- Production community un-pause
