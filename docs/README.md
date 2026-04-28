# Obscur Documentation

Use this folder as the canonical engineering encyclopedia for architecture,
protocols, runtime ownership, roadmap execution, release truth, and recovery
triage.

## Reading Paths

### Fast Start

Read these first when resuming work:

1. [Project Overview](./01-project-overview.md)
2. [Maintainer Playbook](./08-maintainer-playbook.md)
3. [Current Session Handoff](./handoffs/current-session.md)
4. [Core Architecture Truth Map](./12-core-architecture-truth-map.md)
5. [Module Owner Index](./14-module-owner-index.md)

### Encyclopedia Path

Read in this order when you need the whole system picture:

1. [Repository Map](./02-repository-map.md)
2. [Runtime Architecture](./03-runtime-architecture.md)
3. [Messaging and Groups](./04-messaging-and-groups.md)
4. [Trust Shelf](./trust/README.md)
5. [Protocols Shelf](./protocols/README.md)
6. [Rewrite Shelf](./rewrite/README.md)

## Shelves

### Root Canonical Docs

These stay at the root because other repo contracts and startup instructions
refer to them directly.

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

### Trust

1. [Trust Shelf Index](./trust/README.md)
2. [19 Pre-Public Reliability and Trust Contract](./trust/19-pre-public-reliability-and-trust-contract.md)
3. [20 Core Function Verification Matrix](./trust/20-core-function-verification-matrix.md)

### Protocols

1. [Protocols Shelf Index](./protocols/README.md)
2. [21 Relay Transport Fault-Tolerance Spec](./protocols/21-relay-transport-fault-tolerance-spec.md)
3. [22 Local-First Decentralized Protocol Architecture](./protocols/22-local-first-decentralized-protocol-architecture.md)
4. [23 Private Direct Envelope and Community Room-Key Contract](./protocols/23-private-direct-envelope-and-community-room-key-contract.md)
5. [24 DM History Sync Stabilization Plan](./protocols/24-dm-history-sync-stabilization-plan.md)
6. [25 Community Ledger and Projection Architecture Spec](./protocols/25-community-ledger-and-projection-architecture-spec.md)
7. [26 Community Projection Contract](./protocols/26-community-projection-contract.md)
8. [27 Community Control and Governance Event Family](./protocols/27-community-control-and-governance-event-family.md)

### Rewrite

1. [Rewrite Shelf Index](./rewrite/README.md)
2. [28 In-Place Architecture Rewrite Plan](./rewrite/28-in-place-architecture-rewrite-plan.md)
3. [29 In-Place Modularization and Test Contract](./rewrite/29-in-place-modularization-and-test-contract.md)
4. [30 Fragility Analysis and Safe Iteration Contract](./rewrite/30-fragility-analysis-and-safe-iteration-contract.md)
5. [31 Long-Term Resilience and Context-Limits Playbook](./rewrite/31-long-term-resilience-and-context-limits-playbook.md)
6. [32 Community System Reset and Alternative Solutions](./rewrite/32-community-system-reset-and-alternative-solutions.md)
7. [33 Community Modes and Relay Guarantees](./rewrite/33-community-modes-and-relay-guarantees.md)
8. [34 Codebase Cartography and Black-Box Atlas](./rewrite/34-codebase-cartography-and-black-box-atlas.md)
9. [35 Data Sovereignty and Unified Backend Rewrite Target](./rewrite/35-data-sovereignty-and-unified-backend-rewrite-target.md)
10. [36 Resilient Infrastructure and Technical Protocols](./rewrite/36-resilient-infrastructure-and-technical-protocols.md)
11. [37 Owner-Aligned Extraction Workstreams](./rewrite/37-owner-aligned-extraction-workstreams.md)

### Roadmap

1. [Current Roadmap](./roadmap/current-roadmap.md)
2. [v1.4.0 In-Place Rewrite and Resilience Plan](./roadmap/v1.4.0-in-place-rewrite-and-resilience-plan.md)
3. [v1.4.0 Specification and Test Matrix](./roadmap/v1.4.0-specification-and-test-matrix.md)
4. [v1.4.0 Closeout and Documentation Consolidation Contract](./roadmap/v1.4.0-closeout-and-doc-consolidation.md)
5. [v1.3.8 Roadmap and Execution Contract](./roadmap/v1.3.8-hybrid-offline-streaming-update-plan.md)
6. [v1.3.8 Offline UI Asset Inventory and Local-First Policy](./roadmap/v1.3.8-offline-ui-asset-inventory.md)
7. [v1.3.8 Streaming Update Contract](./roadmap/v1.3.8-streaming-update-contract.md)

### Release and Verification

1. [Release Closeout Guide](./releases/release-closeout-guide.md)
2. [Identity and Session Ownership](./releases/core-verification-identity-session.md)
3. [E2EE Direct Messaging](./releases/core-verification-e2ee-direct-messaging.md)
4. [Cross-Device Restore, Sync, and Non-Resurrection](./releases/core-verification-cross-device-restore-and-non-resurrection.md)
5. [Same-Device Account Isolation](./releases/core-verification-same-device-account-isolation.md)
6. [Contacts, Trust, and Request Flows](./releases/core-verification-contacts-trust-and-request-flows.md)
7. [Communities and Membership Integrity](./releases/core-verification-communities-and-membership-integrity.md)
8. [Media and Vault Durability](./releases/core-verification-media-and-vault-durability.md)
9. [Updater and Download Distribution](./releases/core-verification-updater-and-download-distribution.md)

### Continuity

1. [Current Session Handoff](./handoffs/current-session.md)
2. [Session Handoff Template](./handoffs/session-template.md)

### History, Design, and Tooling

1. [Version Context](./history/version-context.md)
2. [Theme Contrast Guidelines](./design/theme-contrast-guidelines.md)
3. [Playwright MCP Quickstart](./playwright-mcp-quickstart.md)

## Assets and Archives

1. release evidence bundles live under `docs/assets/demo/`
2. production GIF library lives under `docs/assets/gifs/`
3. archive and historical version docs live under `docs/archive/`

## Maintenance Rules

1. Keep canonical docs synchronized with owner boundaries and release gates.
2. Prefer rewriting and consolidating existing docs before adding new numbered
   files.
3. Keep runtime evidence bundles under `docs/assets/demo/`.
4. Keep archive docs read-only unless doing historical correction.
5. When architecture meaningfully changes, update:
   `core doc` + `roadmap or release doc` + `CHANGELOG.md` in the same change set.
6. When work spans multiple Codex threads, update:
   `docs/handoffs/current-session.md` before ending the thread.

## Mandatory Check

```bash
pnpm docs:check
```
