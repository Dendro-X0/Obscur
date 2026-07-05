# Program docs — active shelf

**~30 files.** For project context read [../CURRENT.md](../CURRENT.md) first.

_Last updated: 2026-07-04 · **Runtime repair band EXIT** (R1–R5 **VERIFIED t4**) · Phases 1–3 EXIT · Phase 4 deploy smoke next_

---

## v2 release (runtime repair band)

| Document | Role |
|----------|------|
| [obscur-v2-roadmap-2026-07.md](./obscur-v2-roadmap-2026-07.md) | **Phase queue** — Phases 1–3 EXIT · runtime repair · Phase 4 deploy PAUSED |
| [obscur-runtime-issue-tracker-2026-07.md](./obscur-runtime-issue-tracker-2026-07.md) | **Active** — R1–R5 repair queue + CodaCtrl protocol |
| [obscur-v2-known-limitations.md](./obscur-v2-known-limitations.md) | **Presenter sheet** — honest limits |
| [obscur-v2-install-build-guide.md](./obscur-v2-install-build-guide.md) | **Install/build** — dev, package, Android |
| [version-roadmap-scope.md](./version-roadmap-scope.md) | Master I/V/A checklist |
| [unified-verification-issues-register.md](./unified-verification-issues-register.md) | Phase C outcomes |
| [obscur-v2-phase2-docs-charter.md](./obscur-v2-phase2-docs-charter.md) | Phase 2 charter (**EXIT**) |

Superseded program docs (~115 files) → [../archive/program/inactive-2026-06/](../archive/program/inactive-2026-06/README.md)

---

## ENGINE LAB (canonical — 2026-06-17)

| Document | Role |
|----------|------|
| [obscur-backend-engine-roadmap.md](./obscur-backend-engine-roadmap.md) | **Phase order** — integration, fault tolerance, performance, maintainability |
| [transport-engine-standalone-legacy-subtraction-index.md](./transport-engine-standalone-legacy-subtraction-index.md) | **PAUSED** — w55–w68 prep complete; maintainer deletion gate |
| [transport-engine-w53-maintainer-smoke-runbook.md](./transport-engine-w53-maintainer-smoke-runbook.md) | W53 desktop smoke → sign-off → deletion execution |
| [obscur-kernel-ui-desktop-test-checklist.md](./obscur-kernel-ui-desktop-test-checklist.md) | **Active** — W53 smoke + kernel UI integration test order |
| [obscur-ui-archive-manifest.md](./obscur-ui-archive-manifest.md) | Frozen UI + preserved ui-kit |
| [obscur-engine-lab-charter.md](./obscur-engine-lab-charter.md) | Lab frame + geometry |
| [obscur-conduit-mesh-concept-2026-06.md](./obscur-conduit-mesh-concept-2026-06.md) | **Active** — post-relay transport concept (experimental) |
| [conduit-mesh-c1-contracts-charter.md](./conduit-mesh-c1-contracts-charter.md) | **Landed** — `@obscur/conduit-mesh-contracts` · `verify:conduit-mesh-c1` |
| [conduit-mesh-c2-runtime-charter.md](./conduit-mesh-c2-runtime-charter.md) | **Landed** — `@obscur/conduit-mesh` · `verify:conduit-mesh-c2` |
| [conduit-mesh-c3-tor-policy-charter.md](./conduit-mesh-c3-tor-policy-charter.md) | **Landed** — Tor policy · `verify:conduit-mesh-c3` |
| [conduit-mesh-c4-adapter-wiring-charter.md](./conduit-mesh-c4-adapter-wiring-charter.md) | **Landed** — real adapter drivers · `verify:conduit-mesh-c4` |
| [conduit-mesh-c5-pool-retirement-charter.md](./conduit-mesh-c5-pool-retirement-charter.md) | **Landed** — pool hook · `verify:conduit-mesh-c5` |
| [conduit-mesh-c6-nostr-ws-charter.md](./conduit-mesh-c6-nostr-ws-charter.md) | **Landed** — optional `nostr_ws` driver · `verify:conduit-mesh-c6` |
| [../CURRENT.md](../CURRENT.md) | State snapshot |

## Execution (reference)

| Document | Role |
|----------|------|
| [design-goals-and-constraints.md](./design-goals-and-constraints.md) | Product + architecture intent |
| [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md) | Daily order; forbidden drift |
| [v1.9.x-release-train.md](./v1.9.x-release-train.md) | Semver train (**1.9.10**) |
| [v1.9.10-scope.md](./v1.9.10-scope.md) | Current concentration unit |
| [obscur-v2-roadmap-2026-07.md](./obscur-v2-roadmap-2026-07.md) | **v2.0.0 phased queue** — consolidated issues + Phase 1A–1D (active) |
| [version-roadmap-scope.md](./version-roadmap-scope.md) | Master I/V/A checklist |
| [modular-iteration-contract.md](./modular-iteration-contract.md) | Silo / re-integration; agent discipline |
| [concentrated-version-delivery.md](./concentrated-version-delivery.md) | Phase A → B → C per unit |
| [stability-first-delivery.md](./stability-first-delivery.md) | Desktop dev commands |

---

## Verification

| Document | Role |
|----------|------|
| [obscur-runtime-issue-tracker-2026-07.md](./obscur-runtime-issue-tracker-2026-07.md) | Runtime issue inventory + verification queue |
| [obscur-dev-test-accounts.md](./obscur-dev-test-accounts.md) | Tester1/Tester2 dev fixture credentials |
| [runtime-issue-investigation-workflows-2026-06.md](./runtime-issue-investigation-workflows-2026-06.md) | RIW-1–8 workflow charter |
| [codactrl-improvement-findings-2026-07.md](./codactrl-improvement-findings-2026-07.md) | CodaCtrl gaps from Obscur dogfood |
| [unified-verification-matrix.md](./unified-verification-matrix.md) | Phase B rows |
| [unified-verification-issues-register.md](./unified-verification-issues-register.md) | Phase C outcomes |

---

## Kernels (canonical geometry)

| Document | Role |
|----------|------|
| [obscur-auth-kernel-charter-2026-06.md](./obscur-auth-kernel-charter-2026-06.md) | Auth planes + boot owner |
| [auth-kernel-kern-manual-matrix.md](./auth-kernel-kern-manual-matrix.md) | Manual steward QA |
| [obscur-v2-slim-kernel-manifest.md](./obscur-v2-slim-kernel-manifest.md) | DM kernel (native) |
| [workspace-kernel-manifest.md](./workspace-kernel-manifest.md) | Managed workspace kernel |
| [v1.9.0-kernel-backend-spec.md](./v1.9.0-kernel-backend-spec.md) | TransportPort + coordination model |

**Gap (not yet chartered):** transport-kernel full snapshot owner beyond publish port — publish subtraction prep **complete** (w55–w68, PAUSED). See [transport-engine-standalone-legacy-subtraction-index.md](./transport-engine-standalone-legacy-subtraction-index.md).

---

## Platform & persistence

| Document | Role |
|----------|------|
| [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md) | Private trust stack vs public Nostr |
| [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) | Native persistence authority |
| [obscur-data-root-bind-contract.md](./obscur-data-root-bind-contract.md) | Desktop data root |
| [v1.9.8-portable-storage-and-encryption-charter.md](./v1.9.8-portable-storage-and-encryption-charter.md) | Portable export/import |
| [obscur-product-shell-architecture-2026-05.md](./obscur-product-shell-architecture-2026-05.md) | App shell contract |
| [ui-effect-stability-policy.md](./ui-effect-stability-policy.md) | Render-loop / effect rules |

---

## Communities (paused band)

| Document | Role |
|----------|------|
| [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md) | Path B vs sovereign fork |
| [community-relaunch-decision-2026-06.md](./community-relaunch-decision-2026-06.md) | Narrow relaunch decision |
| [membership-graph-integration-study-2026-06.md](./membership-graph-integration-study-2026-06.md) | Live roster sync **cancelled** |
| [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md) | Symptom + analysis register |

Detailed R1–R6 specs archived with inactive shelf — resume only via new handoff charter.

---

## Dev & overview

| Document | Role |
|----------|------|
| [dev-lab-spec.md](./dev-lab-spec.md) | Dev Lab scenarios |
| [PROGRAM.md](./PROGRAM.md) | Short program overview |

---

## v2.0 pipeline (reference)

Phase 2–6 details: [obscur-v2-phase2-docs-charter.md](./obscur-v2-phase2-docs-charter.md) · archived [v2.0-release-pipeline.md](../archive/program/inactive-2026-06/v2.0-release-pipeline.md)
