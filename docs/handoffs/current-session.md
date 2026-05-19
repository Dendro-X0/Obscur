# Current Session Handoff

- Last Updated (UTC): 2026-05-20T00:15:00Z
- Session Status: **v1.5.7** — **G2** landed (72h TTL, tie votes, resolved dedupe); **G1** matrix doc ready; **U3** partial
- Active Owner: Shared PWA / desktop shell (**U3**, community **G1/G2**, **U4**)

## Active Objective

1. **v1.5.6:** Code + tag `v1.5.6` at `1d9f3e0b` on GitHub; **Full Release** workflow may not have published installers (check Actions → *Obscur Full Release*). Skipping retroactive v1.5.6 artifacts is OK — ship **v1.5.7** tag when ready.
2. **v1.5.7:** Packages at **1.5.7** — continue [v1.5.7-scope.md](../program/v1.5.7-scope.md): **U3** (publish copy), **G1/G2**, **U4**.
3. **Policy:** [mobile-desktop-version-policy.md](../program/mobile-desktop-version-policy.md) — distro work resumes only when asked.

## Next Atomic Step

1. **G1:** Execute [v1.5.7 manual matrix](../assets/demo/v1.5.7/README.md) and fill sign-off table.
2. **U3:** Continue auditing relay/publish paths for raw `reasonCode` or missing user strings.
3. **Release:** When scope is ready, tag **`v1.5.7`** at HEAD (not v1.5.6) after `pnpm release:test-pack` on clean tree.

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
