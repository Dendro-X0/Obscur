# Obscur Documentation

Use this folder as the single source of truth for both human contributors and language-model agents.

The goal is high signal, low token waste: enough context to resume work quickly, without historical roadmap noise.

## Canonical Docs

1. [01 Project Overview](./01-project-overview.md)
2. [02 Repository Map](./02-repository-map.md)
3. [03 Runtime Architecture](./03-runtime-architecture.md)
4. [04 Feature Modules](./04-messaging-and-groups.md)
5. [05 Data, State, and Sync Flows](./05-performance-and-load-testing.md)
6. [06 Testing and Quality Gates](./06-testing-and-quality-gates.md)
7. [07 Operations and Release Flow](./07-operations-and-release-flow.md)
8. [08 Maintainer Playbook and Continuation Handoff](./08-maintainer-playbook.md)
9. [09 Mobile Native Parity Matrix](./09-mobile-native-parity-matrix.md)
10. [10 Community and Groups Overhaul Roadmap](./10-community-and-groups-overhaul.md)
11. [12 Core Architecture Truth Map](./12-core-architecture-truth-map.md)
12. [13 Relay and Startup Failure Atlas](./13-relay-and-startup-failure-atlas.md)
13. [14 Module Owner Index](./14-module-owner-index.md)
14. [15 Relay Foundation Hardening Spec](./15-relay-foundation-hardening-spec.md)
15. [16 Cross-Device Group Visibility Incident](./16-cross-device-group-visibility-incident.md)
16. [17 v0.9.2 Expansion Context](./17-v0.9.2-expansion-context.md)
17. [18 v0.9.3 Execution Plan](./18-v0.9.3-execution-plan.md)
19. [19 v1 Readiness Stability Plan](./19-v1-readiness-stability-plan.md)
20. [20 v1 Official Release Execution](./20-v1-official-release-execution.md)

## Scope Rules

- `/docs` should describe current architecture, canonical owners, key workflows, and known risks.
- Historical roadmaps and superseded plans are intentionally removed.
- Root planning artifacts (`PHASE0_SPECS.md` .. `PHASE4_SPECS.md`, `ROADMAP_v0.9.0-beta.md`, `ROADMAP_v0.9.2.md`) were retired on 2026-03-20.
- v0.9.5 execution details are consolidated into:
  - `docs/07-operations-and-release-flow.md`,
  - `docs/08-maintainer-playbook.md`,
  - `ISSUES.md` and `CHANGELOG.md`.
- v1 pre-release hardening milestones are tracked in:
  - `docs/19-v1-readiness-stability-plan.md`.
- v1 launch execution steps are tracked in:
  - `docs/20-v1-official-release-execution.md`.
- Keep docs aligned with code paths under `apps/`, `packages/`, and `scripts/`.
- For runtime or relay regressions, consult `12 -> 13 -> 08 -> 07 -> 19 -> 17 -> 18` in that order before implementation work.
- Warm-up supervisor docs from earlier iterations are superseded by the active fail-open startup model (`DesktopProfileBootstrap` + `ProfileBoundAuthShell` + runtime activation gates).

## Mandatory Checks

```bash
pnpm docs:check
```

## Release Prep Shortlist

```bash
pnpm version:sync
pnpm version:check
pnpm release:integrity-check
pnpm docs:check
pnpm release:test-pack -- --skip-preflight
pnpm ci:scan:pwa:head
pnpm release:artifact-version-contract-check
pnpm release:preflight -- --allow-dirty 1
```

For strict preflight, run without `--allow-dirty` on a clean `main` working tree.

Release workflow policy:
- tag pushes run build and verification lanes,
- GitHub Release publish now runs automatically on `v*` tag pushes (manual `workflow_dispatch` with `publish_release=true` remains available as fallback),
- Android lane result/signing state is surfaced explicitly and no longer blocks desktop/web release publication.
