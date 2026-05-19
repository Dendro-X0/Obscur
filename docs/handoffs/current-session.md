# Current Session Handoff

- Last Updated (UTC): 2026-05-19T22:00:00Z
- Session Status: **v1.5.7** — next development cycle; **v1.5.6** doc closeout done (Lane **M** still paused)
- Active Owner: Shared PWA / desktop shell (**U3**, community **G1/G2**, **U4**)

## Active Objective

1. **v1.5.6:** Desktop + community Phase 1 slice is on `main`; release **docs/CHANGELOG** aligned. Optional **`v1.5.6` tag** when maintainer runs gates in [v1.5.6-gate.md](../releases/v1.5.6-gate.md) (A1–A4 + D1).
2. **v1.5.7:** Execute [v1.5.7-scope.md](../program/v1.5.7-scope.md) — publish copy (**U3**), governance matrix + hardening (**G1/G2**), manual rows (**U4**).
3. **Policy:** [mobile-desktop-version-policy.md](../program/mobile-desktop-version-policy.md) — distro work resumes only when asked.

## Next Atomic Step

1. **Version line:** When opening v1.5.7 implementation, bump packages to **`1.5.7`** and run `pnpm version:check` (see scope doc).
2. **U3:** Audit remaining relay/publish paths for raw `reasonCode` or missing user strings; map to shared copy helper / tests.
3. **G1:** Run and document **manual verify** — two-member rename approve → descriptor; three-member expel via governance (`docs/assets/demo/` or short addendum).
4. **G2 (optional, product-prioritized):** Dedupe competing `governance.resolved`; tie votes; TTL **72h** vs code default — confirm before changing.

Canonical plans: [community-system-implementation-and-ui-plan.md](../program/community-system-implementation-and-ui-plan.md) · [community-system-overhaul-phased-roadmap.md](../program/community-system-overhaul-phased-roadmap.md) (Phase 1).

Ship slices with **`pnpm release:test-pack`** green.

## Last shipped (v1.5.6 thread — condensed)

- **Phase 1 community (desktop)** — Descriptor + sealed governance MVP, `descriptor_updated` ledger, session governance cache, TTL `expired`, Governance UI, R4/R5/U1/select/MEM fixes — see `CHANGELOG.md` `[v1.5.6]` and [v1.5.6-scope.md](../program/v1.5.6-scope.md).

## Lane M — parked (code on `main`, not gated)

- **M1** merged: mobile shell list ↔ thread; unit tests only.
- **Blocked on:** signing, sideload/install, emulator — no maintainer matrix until resolved.
- Resume checklist: [docs/assets/demo/v1.5.6/README.md](../assets/demo/v1.5.6/README.md).

## Shipped (v1.5.5)

- R1–R3, U2 — relay publish UX, projection recovery, vault cold open, settings relay banner.
- Tag `v1.5.5` on GitHub; Full Release CI green.

## Continuity references

- [v1.5.7-scope.md](../program/v1.5.7-scope.md) (**next**)
- [v1.5.7-gate.md](../releases/v1.5.7-gate.md)
- [v1.5.6-scope.md](../program/v1.5.6-scope.md) · [v1.5.6-gate.md](../releases/v1.5.6-gate.md)
- [v1.5.x-feature-roadmap.md](../program/v1.5.x-feature-roadmap.md)
