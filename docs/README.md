# Obscur Documentation

Use this folder as the canonical engineering contract for architecture, roadmap, release operations, and recovery triage.

## Canonical Entry Set

### Core Architecture (Root)

1. [01 Project Overview](./01-project-overview.md)
2. [02 Repository Map](./02-repository-map.md)
3. [03 Runtime Architecture](./03-runtime-architecture.md)
4. [04 Messaging and Groups](./04-messaging-and-groups.md)
5. [05 Performance and Load Testing](./05-performance-and-load-testing.md)
6. [06 Testing and Quality Gates](./06-testing-and-quality-gates.md)
7. [07 Operations and Release Flow](./07-operations-and-release-flow.md)
8. [08 Maintainer Playbook](./08-maintainer-playbook.md)
9. [09 Mobile Native Parity Matrix](./09-mobile-native-parity-matrix.md)
10. [10 Community and Groups Overhaul](./10-community-and-groups-overhaul.md)
11. [11 Program Milestones and Stability History](./11-program-milestones-and-stability-history.md)
12. [12 Core Architecture Truth Map](./12-core-architecture-truth-map.md)
13. [13 Relay and Startup Failure Atlas](./13-relay-and-startup-failure-atlas.md)
14. [14 Module Owner Index](./14-module-owner-index.md)
15. [15 Relay Foundation Hardening Spec](./15-relay-foundation-hardening-spec.md)
16. [16 Cross-Device Group Visibility Incident](./16-cross-device-group-visibility-incident.md)
17. [17 DM Delete/Restore Divergence Incident](./17-dm-delete-restore-divergence-incident.md)
18. [18 Account-Scope and Discovery Guardrails](./18-account-scope-and-discovery-guardrails.md)

### Roadmap and Release

1. [Current Roadmap](./roadmap/current-roadmap.md)
2. [v1.3.8 Roadmap and Execution Contract](./roadmap/v1.3.8-hybrid-offline-streaming-update-plan.md)
3. [v1.3.8 Offline UI Asset Inventory and Local-First Policy](./roadmap/v1.3.8-offline-ui-asset-inventory.md)
4. [v1.3.8 Streaming Update Contract](./roadmap/v1.3.8-streaming-update-contract.md)
4. [Release Closeout Guide](./releases/release-closeout-guide.md)

### Release and Demo Assets

1. [Release Closeout Guide](./releases/release-closeout-guide.md)
2. Production GIF library: `docs/assets/gifs/`
3. Release evidence bundles: `docs/assets/demo/`

### Continuation and Handoffs

1. [Maintainer Playbook](./08-maintainer-playbook.md)
2. [Current Session Handoff](./handoffs/current-session.md)
3. [Session Handoff Template](./handoffs/session-template.md)

### History and Design

1. [Version Context](./history/version-context.md)
2. [Theme Contrast Guidelines](./design/theme-contrast-guidelines.md)

### Tooling

1. [Playwright MCP Quickstart](./playwright-mcp-quickstart.md)

## Consolidation Policy

Version-specific planning and checkpoint docs were consolidated into general canonical docs. Durable outcomes now live in:

1. `docs/11-program-milestones-and-stability-history.md`
2. `docs/history/version-context.md`
3. `docs/roadmap/current-roadmap.md`
4. `docs/07-operations-and-release-flow.md`
5. `docs/08-maintainer-playbook.md`
6. `docs/handoffs/current-session.md`

Legacy version docs can remain in `docs/archive/versioned/` for audit history, but they are no longer required planning entrypoints.

## Maintenance Rules

1. Keep canonical docs synchronized with owner boundaries and release gates.
2. Keep runtime evidence bundles under `docs/assets/demo/`.
3. Keep curated production GIF captures under `docs/assets/gifs/` so README and website surfaces reuse the same release-facing assets.
4. Keep archive docs read-only unless doing historical correction.
5. When architecture meaningfully changes, update:
: `core doc` + `roadmap/release doc` + `CHANGELOG.md` in the same change set.
6. When work spans multiple Codex threads, update:
: `docs/handoffs/current-session.md` before ending the thread.

## Mandatory Check

```bash
pnpm docs:check
```
