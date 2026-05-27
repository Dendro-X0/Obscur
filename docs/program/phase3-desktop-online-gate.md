# Phase 3 — Desktop online modules (G6)

**Status:** Active  
**Last updated:** 2026-05-24  
**Prerequisites:** Phase 1 G1–G5 ([phase1-desktop-shell-gate.md](./phase1-desktop-shell-gate.md)), Phase 2 automated + manual DM restart ([phase2-desktop-dm-persistence-gate.md](./phase2-desktop-dm-persistence-gate.md))  
**Policy:** [obscur-offline-first-policy.md](./obscur-offline-first-policy.md) — online failures = degraded UI, never startup block

---

## What Phase 3 proves

With `NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1` (`pnpm dev:desktop:online`), the desktop shell stays **interactive at unlock** while real subsystems come online **in the background**. Each subsystem is validated **one at a time** before the next.

Community coordination HTTP and full experiment-shell removal remain **later** steps within this phase.

---

## Dev command

```bash
pnpm dev:desktop:online
```

| Mode | Command | Relay / sync |
|------|---------|----------------|
| Phase 1 (offline stubs) | `pnpm dev:desktop` | `ExperimentRelayShell` + synthetic account sync |
| Phase 2 + 3 (DM + online) | `pnpm dev:desktop:online` | `FullRelayProvider` + real account sync/projection |

Default `tauri.conf` keeps `EXPERIMENT_ONLINE=0` for loadability; online is **opt-in**.

---

## Automated evidence

```bash
pnpm verify:phase3
```

Includes `verify:phase2` plus transport classification, relay list policy, coordination health probe, and relay transport mapping tests.

---

## G6 subsystem order (one at a time)

| Step | Subsystem | Pass when |
|------|-----------|-----------|
| **G6-1** | Relay pool | Unlock → shell interactive **without** waiting on `connecting`; Settings → Relays shows enabled `wss://` URLs; background connect; degraded banner only if all relays fail — **no throw / red overlay** |
| **G6-2** | Account sync + projection | After unlock, sync runs idle-deferred; projection reaches ready or degraded — **never blocks** unlock UI |
| **G6-3** | DM transport owner | Two-profile DM send/receive under `dev:desktop:online` (extends Phase 2 P2-2…P2-6) |
| **G6-4** | Coordination HTTP (optional) | Membership port probes `NEXT_PUBLIC_COORDINATION_URL`; failures → transport/degraded chip only. **Manual desktop E2E may defer** when loopback works in `curl` but not in WebView; use automated contract tests + alternate host before release sign-off. |
| **G6-5** | Experiment shell trim | Remove deferrals after G6-1…G6-3 hold; **G6-4 not a hard prerequisite** for trim work (workspace manual matrix still deferred). |

**Still deferred:** groups hydrate / live bus at scale, community manual QA matrix, auth UX overhaul ([auth-ux-redesign-future.md](./auth-ux-redesign-future.md)).

---

## Manual script — G6-1 relay (~10 min)

Prerequisite: Phase 1 G1–G5 signed off.

| Step | Action | Pass when |
|------|--------|-----------|
| P3-1 | `pnpm dev:desktop:online`, unlock | Window interactive within Phase 1 cold-start bar |
| P3-2 | Settings → Relays | At least one default `wss://` relay enabled (damus.io / nos.lol) |
| P3-3 | Wait ~30s | Relay status connected or degraded — not permanent crash overlay |
| P3-4 | Disable all relays, restart + unlock | Degraded/offline banner; app still navigable |
| P3-5 | Re-enable one relay | Connect recovers without full app restart |

---

## Manual script — G6-2 account sync (~10 min)

| Step | Action | Pass when |
|------|--------|-----------|
| P3-6 | Unlock with existing profile | No spinner blocking sidebar past Phase 1 budget |
| P3-7 | Settings → Storage or sync indicator | Account sync phase progresses or shows degraded — not stuck forever |
| P3-8 | Quit + restart + unlock | Same — unlock never requires relay `open` first |

---

## Manual script — G6-3 DM online (~15 min)

Prerequisite: `pnpm dev:desktop:online`, two profiles (see [phase2-desktop-dm-persistence-gate.md](./phase2-desktop-dm-persistence-gate.md)).

| Step | Action | Pass when |
|------|--------|-----------|
| P2-1…P2-6 | Two-profile send/receive + restart + history | Bidirectional thread stable (no flash/disappear) |
| P2-7…P2-8 | Delete-for-me + restart | Tombstone survives restart (optional) |

---

## Manual script — G6-4 coordination HTTP (~10 min)

Prerequisite: G6-3 signed off. Setup: [private-trust-local-setup.md](../assets/demo/private-trust-local-setup.md).

| Step | Action | Pass when |
|------|--------|-----------|
| P3-9 | `pnpm -C apps/coordination dev` + migrate if needed | `curl -s http://127.0.0.1:8787/health` → `{"ok":true,...}` |
| P3-10 | `NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787` in `apps/pwa/.env.example`, restart `dev:desktop:online` | Settings → membership sync shows coordination path (not stuck blocking unlock) |
| P3-11 | Stop coordination worker | App stays navigable; community/membership UI shows **degraded** or probe failure — **no crash overlay** |
| P3-12 | Restart coordination | Health recovers on next probe (≤15s cache) without full app restart |

---

## Code invariants

| Invariant | Owner |
|-----------|--------|
| Offline stub when `EXPERIMENT_ONLINE=0` | `relay-provider.tsx` → `ExperimentRelayShell` |
| Full relay when online flag set | `relay-provider.tsx` → `FullRelayProvider` |
| Experiment fast-ready without relay gate | `runtime-activation-manager.tsx` (offline stub only) |
| Activation timeout → degraded, not crash | `runtime-activation-manager.tsx` (online path) |
| Transport errors classified | `transport-connection-problem.ts` |
| Coordination probe fail-open | `community-coordination-health.ts` |

---

## Sign-off

| Step | Date | Pass |
|------|------|------|
| `pnpm verify:phase3` | 2026-05-22 | ✓ (automated) |
| Phase 2 manual P2-1…P2-8 | | |
| G6-1 P3-1…P3-5 | 2026-05-22 | ✓ (relay + no crash overlay; profile boot loop fixed 2026-05-23) |
| G6-2 P3-6…P3-8 | 2026-05-24 | ✓ (with online DM soak; unlock not blocked) |
| G6-3 (DM online soak) | 2026-05-24 | ✓ (maintainer: bidirectional history stable) |
| G6-4 P3-9 | 2026-05-26 | ✓ (`pnpm coordination:health` OK) |
| G6-4 P3-10…P3-12 | | |
| G6-5 experiment trim | 2026-05-25 | ✓ (`shouldDeferExperimentHeavyWork` — online defers off) |

---

## Out of scope

- Android P1 signing (G7 — after desktop G6)
- Community invite/membership manual matrix
- Auth UX lanes Auth-UX-1+
- Production web / PWA installer
