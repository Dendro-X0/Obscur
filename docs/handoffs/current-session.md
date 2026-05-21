# Current Session Handoff

- Last Updated (UTC): 2026-05-21T12:00:00Z
- Session Status: **v1.5.8 shipped** — active line **v1.6.0** (Phase 2 governance projection)
- Active Owner: Shared PWA / desktop — **G2.1** governance projection (`governanceByCommunityId`)

## Active Objective

1. **v1.5.8:** Shipped — tag **v1.5.8** on GitHub Releases (includes Android keychain cfg fix on `bd27f9a2`).
2. **v1.6.0:** Execute [v1.6.0-scope.md](../program/v1.6.0-scope.md) — Phase 2 milestone **2.1** (governance projection owner).
3. **Policy:** [community-membership-invariants.md](../program/community-membership-invariants.md) — membership **park**; no new roster features until R2.

## Next Atomic Step

1. **G2.1 scaffold:** Add `community-governance-projection` read owner (contract 26 shape) and route `group-management` governance panel + home banner to it; shrink `use-sealed-community` to ingest + dispatch only.
2. **Before merge:** `pnpm -C apps/pwa typecheck` → `pnpm test:community-invariants` (if `groups/**` touched).
3. **Optional:** Maintainer sign-off rows in [v1.5.8 U4](../assets/demo/v1.5.8/README.md) / [v1.5.7 G1](../assets/demo/v1.5.7/README.md) (not blocking `1.6.0` dev).

Canonical plans: [community-system-overhaul-phased-roadmap.md](../program/community-system-overhaul-phased-roadmap.md) (Phase 2) · [community-system-implementation-and-ui-plan.md](../program/community-system-implementation-and-ui-plan.md).

## Last shipped (v1.5.8)

- **U3** — Publish failure user copy across community + uploads.
- **Shell** — Theme persistence; startup overlay ready gates.
- **MEM-001 baseline** — Relay steady-state gating; participation evidence; park mode doc + invariant tests.
- **Desktop** — Native keychain session; Android-safe `native_keychain` cfg.

## Lane M — parked

- **M1** on `main`; emulator/signing matrix deferred — [v1.5.6 demo](../assets/demo/v1.5.6/README.md).

## Continuity references

- [v1.6.0-scope.md](../program/v1.6.0-scope.md) (**active**)
- [v1.6.0-gate.md](../releases/v1.6.0-gate.md)
- [v1.5.8-scope.md](../program/v1.5.8-scope.md) · [v1.5.8-gate.md](../releases/v1.5.8-gate.md)
- [v1.5.x-feature-roadmap.md](../program/v1.5.x-feature-roadmap.md)
