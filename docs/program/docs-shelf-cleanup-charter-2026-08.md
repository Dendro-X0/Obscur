# Docs shelf cleanup charter — 2026-08

**Status:** Active (execution band)  
**Owner:** `docs/program/` shelf + `scripts/docs-check.mjs`  
**Retention:** archive via `git mv` only — never hard-delete markdown  
**Archive target:** [`docs/archive/program/inactive-2026-08/`](../archive/program/inactive-2026-08/README.md)

## Problem

| Signal | Fact |
|--------|------|
| Shelf drift | `docs/program/README.md` claimed ~28–30 files; disk had ~129 `.md` |
| CI | `pnpm docs:check` failed on stale `dev-lab` / `standalone-publish` / hydrate paths |
| Clutter | Landed transport W* + mesh C* charters, EXIT roadmaps, closed trackers, tombstones |

## Criteria

| Class | Keep in `docs/program/` | Archive → `inactive-2026-08/` |
|-------|-------------------------|-------------------------------|
| Product / operator truth | Current install, limits, VPS/relay ops, release-without-Tor, v1.9.16 scope | Superseded scopes (≤1.9.15), old trains |
| Open / PAUSED policy | Membership redesign, auth-kernel (PAUSED), modular iteration, execution contract | Closed R1–R5 trackers, dogfood dumps |
| Live architecture | Backend roadmap, UI archive manifest, conduit-mesh **concept** (one file), engine-lab charter | Landed C* charters, transport-engine-w*, EXIT subtraction index |
| Tombstones | — | `dev-lab-spec`, studies that only cite deleted code |

## Non-goals

- Encyclopedia / messaging / `specs/backend` mass rewrite or delete
- Full Release / GitHub Releases / license decision
- Product feature code or `release:test-pack` test fixes (sibling band)

## Keep (active shelf)

Front / meta: `README.md`, `PROGRAM.md`, this charter.

Product & ops:

- `obscur-v2-known-limitations.md`
- `obscur-v2-install-build-guide.md`
- `obscur-ecosystem-charter.md`
- `design-goals-and-constraints.md`
- `v1.9.x-execution-contract.md`
- `modular-iteration-contract.md`
- `release-without-tor-transport-sovereignty-charter-2026-08.md`
- `v1.9.16-scope.md`
- `ci-local-fast-loop.md`
- `prod-first-validation-policy-2026-08.md`
- `self-hosted-relay-vps-operator-notes-2026-08.md`
- `relay-pool-auto-correction-operator-notes-2026-08.md`
- `stability-first-delivery.md`
- `production-truth-release-recovery-2026-08.md`
- `concentrated-version-delivery.md`
- `version-roadmap-scope.md`
- `obscur-v2-roadmap-2026-07.md`
- `obscur-v2-phase3-signing-policy.md`
- `obscur-v2-phase4-website-charter.md`
- `obscur-v2-slim-kernel-manifest.md`

Architecture / kernels still cited:

- `obscur-backend-engine-roadmap.md`
- `obscur-ui-archive-manifest.md`
- `ui-effect-stability-policy.md`
- `obscur-conduit-mesh-concept-2026-06.md`
- `obscur-engine-lab-charter.md`
- `workspace-kernel-manifest.md`
- `obscur-product-shell-architecture-2026-05.md`
- `obscur-native-sqlite-policy.md`
- `obscur-data-root-bind-contract.md`
- `antisocial-engineering-contract.md`
- `platform-pivot-private-trust-2026-05.md`
- `community-invite-role-ecosystem-design.md`

PAUSED / open registers (one each):

- `community-membership-redesign-charter-2026-07.md`
- `community-production-unpause-charter-2026-08.md`
- `obscur-auth-kernel-charter-2026-06.md`
- `obscur-subtraction-register-2026-07.md`

**Target count:** ≤ 45 `.md` under `docs/program/` (including README / PROGRAM / this charter).

## Archive (waves → `inactive-2026-08/`)

1. **Transport engine W\*** — all `transport-engine-w*.md` + `transport-engine-standalone-legacy-subtraction-index.md`
2. **Conduit mesh landed C\*** — all `conduit-mesh-c*.md` + `conduit-mesh-l1-band-close-2026-07.md` (keep concept above)
3. **Closed trackers / dogfood** — `obscur-runtime-issue-tracker-2026-07.md`, `codactrl-*`, `obscur-ux-gate-investigation-2026-07.md`, `unified-verification-*`, `runtime-issue-investigation-workflows-2026-06.md`, `community-relay-technical-issues-register-2026-06.md`, `com-run-11-*`, membership-graph study, android barrel trim, auth-kernel manual matrix, kernel UI desktop checklist, community fork/relaunch decisions (historical)
4. **Tombstones / superseded scopes** — `dev-lab-spec.md`, `v1.9.0-kernel-backend-spec.md`, `v1.9.8-*`, `v1.9.10`–`v1.9.15` scopes, `v1.9.14-p14-l3-soak-runbook.md`, `v1.9.x-release-train.md`, `obscur-v2-phase2-docs-charter.md`, `obscur-dev-test-accounts.md` (fixture note → archive; not front-door truth)

## Proof

- `pnpm docs:check` exit 0
- `pnpm ci:local:all-cheap` (T0+T1)
- `docs/program/*.md` count ≤ 45
- `CURRENT.md` / `START-HERE.md` / root `README.md` aligned to **v1.9.16** + website download primary

## Sibling (out of this charter)

| Band | When |
|------|------|
| `release:test-pack` unit drift | After T1 green |
| Full Release / GitHub Releases | After local T0–T2 + pack green |
| License / commercial grant | Maintainer decision |
