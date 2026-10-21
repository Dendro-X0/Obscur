# Investigation — Self T1 local lab not dialed with public remotes

**Date (UTC):** 2026-10-13  
**Status:** Investigation complete · design next  
**Band:** Self T1 local (outside M1–M3 · shell-lag parked · NIM P0 not accepted)  
**Parents:** [CURRENT.md](../../docs/CURRENT.md) · [relay-local-lab-adaptive-demote-design-2026-08.md](./relay-local-lab-adaptive-demote-design-2026-08.md) · [network-infrastructure-module-charter-2026-10.md](../../docs/program/network-infrastructure-module-charter-2026-10.md) § parallel Self T1

```text
HANDOFF ATOMIC STEP: Self T1 local — enable ws://localhost:7000 for Track L
PAUSED / CANCELLED:  Desktop shell lag · M1–M3 · dialects · ASE-2 · SF-B · PB1-B/C/D+SF-A eng honesty · NIM impl until P0
CANONICAL OWNER:     relay-local-lab-adapt · resolveActivePoolRelayUrls
PROOF BEFORE DONE:   L1 adapt + selector tests (no desktop soak)
SURFACE:             Desktop / PWA Settings → Relays · Operator setup
```

---

## Symptom

Operator Track L / Self T1 needs `ws://localhost:7000` dialed for private-trust cells while Default Stable public relays stay enabled (NIM N1 + parallel Self T1 note).

Today: enabling or operator-saving localhost leaves it **out of the active dial pool** whenever any public/VPS remote is enabled. Settings show the row enabled; role stays standby / “Not in the active transport pool.”

## Evidence (code)

| Path | Behavior |
|------|----------|
| `shouldDemoteLocalLabFromActivePool` | Always demotes lab when `remotesEnabled` |
| `filterDemotedLocalLabUrls` → `resolveActivePoolRelayUrls` | Strips localhost from dial set |
| `reconcileLocalDevWorkspaceRelay` | Keeps lab **enabled in list** if it matches `readOperatorWorkspaceRelayUrl()` |
| Operator Setup wizard | Can Save `ws://localhost:7000` as workspace relay |

List-enable exemption exists; **dial-pool exemption does not.**

## Root cause

2026-08 Nostr-first silo (`relay-local-lab-adaptive-demote-design`) correctly protects average users (Docker lab must not own DM transport). Self T1 / operator workspace bind needs a **retain-for-dial** exception that the 2026-08 design did not define.

## Non-goals

- NIM P0 acceptance / diagnostics module reshape  
- Disabling public Default Stable for Soft L3-only as the only Track L path  
- Shell-lag / PostMessage soaks  
- M1–M3 media  

## Next

Design: operator-retained lab stays in dial pool; primary still prefers remotes when remotes are enabled.
