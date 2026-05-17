# Version Context

_Last reviewed: 2026-04-14._

This file defines how version history is represented after consolidating version-specific planning docs into canonical, general docs.

## Canonical Context Sources

1. Program history and milestone consolidation:
: `docs/11-program-milestones-and-stability-history.md`
2. Active roadmap:
: `docs/roadmap/current-roadmap.md`
3. Release execution:
: `docs/07-operations-and-release-flow.md`
: `docs/releases/release-closeout-guide.md`
4. Architecture owner truth:
: `docs/12-core-architecture-truth-map.md`
: `docs/14-module-owner-index.md`
5. Failure triage:
: `docs/13-relay-and-startup-failure-atlas.md`

## Historical Version Docs

Historical version and matrix docs (`17-*` through `36-*`) are stored in:

1. `docs/archive/versioned/`

They are retained for audit and forensic traceability only.

## Consolidation Result

After consolidation:
1. maintainers should not need version-specific docs to resume development,
2. milestone and release lessons are now represented in general docs,
3. historical docs can be safely removed from active reading workflows.

## Continuity Rules

When a milestone or release closes:
1. record durable outcomes in canonical docs,
2. keep runtime evidence in `docs/assets/demo/`,
3. move or keep version-specific narrative in archive only when needed for audit detail.

## Current Project State Note

As of 2026-04-14:
1. active release prep is centered on `v1.3.14` owner-path hardening for
   community recovery and fresh-device DM restore integrity,
2. the project remains sensitive to owner-boundary drift, so evidence-first
   workflow is mandatory for all major changes,
3. release claims still require runtime replay for fragile cross-device flows
   even when focused suites are green.
