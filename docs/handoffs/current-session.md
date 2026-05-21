# Current Session Handoff

- Last Updated (UTC): 2026-05-20T16:00:00Z
- Session Status: **v1.5.8** — **U3** + **U4 doc** done; **G1/U4 sign-off** pending maintainer
- Active Owner: Shared PWA / desktop shell (**U3**, **G1** / Phase 1 exit, **U4**)

## Active Objective

1. **v1.5.7:** Shipped — tag **v1.5.7** with Full Release artifacts (see GitHub Releases).
2. **v1.5.8:** Execute [v1.5.8-scope.md](../program/v1.5.8-scope.md) — complete **U3**, **G1** manual sign-off, **U4** matrix, Phase 1 exit checkpoint.
3. **Policy:** [mobile-desktop-version-policy.md](../program/mobile-desktop-version-policy.md) — Lane **M** optional.

## Next Atomic Step

1. **Release gate:** `pnpm -C apps/pwa typecheck` → `pnpm test:community-invariants` → `pnpm test:shell-invariants` → `pnpm release:test-pack` (invariants now in test pack). Maintainer: sign [v1.5.8 U4](../assets/demo/v1.5.8/README.md) + [v1.5.7 G1](../assets/demo/v1.5.7/README.md), then tag **v1.5.8**.
2. **Park:** Community roster — [`community-membership-invariants.md`](../program/community-membership-invariants.md); no new features until R2. Cursor rule: `.cursor/rules/obscur-community-membership.mdc`.
3. **After tag:** Next minor scope (Phase 2 governance projection per v1.5.8 non-goals) or Lane M if signing unblocks.

Canonical plans: [community-system-implementation-and-ui-plan.md](../program/community-system-implementation-and-ui-plan.md) · [community-system-overhaul-phased-roadmap.md](../program/community-system-overhaul-phased-roadmap.md) (Phase 1 exit).

## Last shipped (v1.5.7)

- **G2** — 72h governance TTL, tie → rejected, duplicate `RESOLVED` idempotency.
- **U3 (partial)** — Extended `relay-publish-user-copy`.
- **G1 doc** — Manual matrix at `docs/assets/demo/v1.5.7/README.md`.

## Lane M — parked

- **M1** on `main`; emulator/signing matrix deferred — [v1.5.6 demo](../assets/demo/v1.5.6/README.md).

## Continuity references

- [v1.5.8-scope.md](../program/v1.5.8-scope.md) (**active**)
- [v1.5.8-gate.md](../releases/v1.5.8-gate.md)
- [v1.5.7-scope.md](../program/v1.5.7-scope.md) · [v1.5.7-gate.md](../releases/v1.5.7-gate.md)
- [v1.5.x-feature-roadmap.md](../program/v1.5.x-feature-roadmap.md)
