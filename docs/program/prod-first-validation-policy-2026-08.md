# Prod-first validation policy (2026-08)

**Status:** Canonical · maintainer mandate  
**Date:** 2026-08-02  
**Design:** [prod-first-multi-transport-mandate-2026-08.md](../../specs/backend/prod-first-multi-transport-mandate-2026-08.md)  
**Supersedes as validation surface:** [dev-lab-spec.md](./dev-lab-spec.md) (Dev Lab is tombstoned; not a pass criterion)

---

## Rule

**Dev and Prod must be identical for feature proof.** A change is not done if it only works in Dev Lab, experiment shell, or with a mandatory Docker / Local Dev Mesh path.

## Pass / fail language

| Claim | Requires |
|-------|----------|
| Implemented | Production-mode (or release-identical) path green for the slice |
| Verified / Fixed | Runtime evidence on that same path — not `pnpm dev:lab:*` |
| Delivery / Soft L3 | Two-profile DM without requiring Docker as the only transport |

## Agents

- Do not freestyle Dev Lab scenarios or Docker bootstrap as the next win.
- Prefer public Nostr Default Stable boot; Tor opt-in with confirmation; private packs explicit.
- Honor handoff **Paused: Dev Lab as validation**.
