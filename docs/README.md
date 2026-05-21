# Obscur Documentation

**Navigation hub only.** All content lives in module folders below. Start here; do not expect canonical guides at the `/docs` root.

_Last reviewed: 2026-05-15 (v1.5.0 doc restructure)_

---

## Start here (humans and agents)

| Priority | Document | Purpose |
|----------|----------|---------|
| 1 | [Strategic direction](./program/strategic-direction.md) | Goals, sequence, decent Nostr client bar |
| 2 | [Product layers & Nostr](./architecture/product-layers-and-nostr.md) | App / kernel / adapter framing |
| 3 | [Maintainer playbook](./encyclopedia/08-maintainer-playbook.md) | How to run, test, triage, and ship |
| 4 | [Current session handoff](./handoffs/current-session.md) | Live continuity — read before coding |
| 5 | [Architecture truth map](./encyclopedia/12-core-architecture-truth-map.md) | Who owns what (single source) |
| 6 | [v1.5.3 scope](./program/v1.5.3-scope.md) | **Current** release workstreams |
| 7 | [Mobile UI stack](./program/mobile-ui-stack-evaluation.md) | Tauri mobile + shell decision |
| 8 | [v1.5.2 release](./releases/v1.5.2-release.md) | Shipped — feel fast |

**Agent rules:** [`AGENTS.md`](../AGENTS.md) (bootstrap) → modular [`rules/`](../rules/README.md) (canonical; copy into local `.cursor/rules/` for Cursor IDE).

---

## Encyclopedia (numbered guides)

Canonical long-form guides — read in order when onboarding:

| # | Guide |
|---|--------|
| 01 | [Project overview](./encyclopedia/01-project-overview.md) |
| 02 | [Repository map](./encyclopedia/02-repository-map.md) |
| 03 | [Runtime architecture](./encyclopedia/03-runtime-architecture.md) |
| 04 | [Messaging and groups](./encyclopedia/04-messaging-and-groups.md) |
| 05 | [Performance and load testing](./encyclopedia/05-performance-and-load-testing.md) |
| 06 | [Testing and quality gates](./encyclopedia/06-testing-and-quality-gates.md) |
| 07 | [Operations and release flow](./encyclopedia/07-operations-and-release-flow.md) |
| 08 | [Maintainer playbook](./encyclopedia/08-maintainer-playbook.md) |
| 09 | [Mobile / native parity](./encyclopedia/09-mobile-native-parity-matrix.md) |
| 10 | [Community and groups overhaul](./encyclopedia/10-community-and-groups-overhaul.md) |
| 11 | [Program milestones and stability history](./encyclopedia/11-program-milestones-and-stability-history.md) |
| 12 | [Core architecture truth map](./encyclopedia/12-core-architecture-truth-map.md) |
| 13 | [Relay and startup failure atlas](./encyclopedia/13-relay-and-startup-failure-atlas.md) |
| 14 | [Module owner index](./encyclopedia/14-module-owner-index.md) |
| 15 | [Relay foundation hardening](./encyclopedia/15-relay-foundation-hardening-spec.md) |
| 16 | [Cross-device group visibility incident](./encyclopedia/16-cross-device-group-visibility-incident.md) |
| 17 | [DM delete / restore divergence](./encyclopedia/17-dm-delete-restore-divergence-incident.md) |
| 18 | [Account scope and discovery guardrails](./encyclopedia/18-account-scope-and-discovery-guardrails.md) |
| 19 | [Community data integrity spec](./encyclopedia/19-community-data-integrity-spec.md) |
| 20 | [Community verification guide](./encyclopedia/20-community-verification-guide.md) |

**Community system (in flight):** [Version phased roadmap](./program/community-system-overhaul-phased-roadmap.md) · [Implementation and UI plan](./program/community-system-implementation-and-ui-plan.md) — modes, governance, tabbed create/manage.

---

## Module shelves

### Future kernel & protocol (concept shelf)

| Document | Purpose |
|----------|---------|
| [**future/ — index**](./future/README.md) | Long-term kernel ideas; does not gate v1.5.x |
| [Charter & vision](./future/00-charter-vision.md) | Trust model, Nostr as adapter |
| [Kernel sketch](./future/01-kernel-transport-sketch.md) | Gradual path, transport ports |
| [Assets from Obscur](./future/02-assets-from-obscur.md) | Harvest map from monorepo |

### Program and releases

| Document | Purpose |
|----------|---------|
| [**Program overview**](./program/PROGRAM.md) | Active v1.5.1 + milestones |
| [**Strategic direction**](./program/strategic-direction.md) | Implementation sequence |
| [**2.0.0 milestone roadmap**](./program/obscur-2.0-milestone-roadmap.md) | v1.7.x → v1.8.x patch bands; four lanes through v2.0.0 |
| [**Manual verification environment**](./program/manual-verification-environment.md) | Tester 1/2, dark/light, desktop A/B |
| [**Community overhaul — phased roadmap (by version)**](./program/community-system-overhaul-phased-roadmap.md) | Phases 1–4 ↔ v1.5.x–v2.0 milestones |
| [**Community system — implementation & UI**](./program/community-system-implementation-and-ui-plan.md) | Modes, governance, create/manage backlog (P0–P4) |
| [Current roadmap (detail)](./program/current-roadmap.md) | Active lanes and policies |
| [v1.5.0 release](./releases/v1.5.0-release.md) | Release scope and known limitations |
| [Release closeout guide](./releases/release-closeout-guide.md) | How to close a version |
| [Version history context](./history/version-context.md) | Historical version narrative |

v1.5 execution artifacts: [`program/`](./program/) (phase scope, refactor queue, checkpoints, known issues).

Archived version plans: [`archive/consolidated/`](./archive/consolidated/).

### Architecture and gateway

| Document | Purpose |
|----------|---------|
| [Client unified gateway](./gateway/client-unified-gateway.md) | R0/R1/R2 ClientGateway contract |
| [Architecture refactor queue](./program/v1.5.0-architecture-refactor-queue.md) | Slice order and exit gates |
| [Radical overhaul v2 target](./architecture/roadmap-v2-draft.md) | Long-term v2.0 direction (draft) |

### Messaging (DM)

| Document | Purpose |
|----------|---------|
| [Cooperative redaction — future design](./messaging/cooperative-redaction-future.md) | Feasible “hide for everyone” under this stack |
| [Deletion roster limitations](./messaging/deletion-roster-limitations.md) | Why true delete is not possible on Nostr |
| [Redaction v1.5 — deferred](./messaging/redaction-v1.5-deferred.md) | Why UI “delete for everyone” is off in v1.5.0 |
| [DM redaction release gate](./releases/v1.5.0-dm-sender-redaction-scope-and-gate.md) | v1.5.0 scope checklist (UI off, verify bundle) |
| [Delete-for-everyone investigation](./messaging/investigation-delete-for-everyone.md) | Historical root-cause analysis |

### Communities

| Document | Purpose |
|----------|---------|
| [Membership sync architecture](./communities/membership-sync-architecture.md) | Relay-first membership model |
| Encyclopedia **10**, **19**, **20** | Operating model, integrity, verification |

### Protocols

| Index | [protocols/README.md](./protocols/README.md) |
|-------|---------------------------------------------|
| Specs | Relay transport, envelopes, DM history, community ledger/projection |

### Trust and verification

| Index | [trust/README.md](./trust/README.md) |
|-------|--------------------------------------|
| Matrices | Pre-public contract, core function verification |

### Operations

| Document | Purpose |
|----------|---------|
| Encyclopedia **05–08** | Performance, testing, release flow, maintainer |
| [Playwright MCP quickstart](./operations/playwright-mcp-quickstart.md) | Browser automation setup |

### Continuity

| Document | Purpose |
|----------|---------|
| [Current session](./handoffs/current-session.md) | Active handoff |
| [Session template](./handoffs/session-template.md) | Handoff format |

### Research, design, security, assets

| Shelf | Path |
|-------|------|
| Research | [`research/`](./research/) |
| Design | [`design/`](./design/) |
| Security | [`security/`](./security/) |
| Demo / GIF assets | [`assets/`](./assets/) |
| Legacy rewrite shelf (archive) | [`archive/rewrite-shelf/`](./archive/rewrite-shelf/) |

---

## LLM navigation hints

1. **Ownership question** → `encyclopedia/12` + `encyclopedia/14` + `gateway/client-unified-gateway.md`
2. **Bug in DM UI** → `encyclopedia/04` + `messaging/` + truth map row for messaging
3. **Community membership** → `program/v1.5.0-phase3-scope.md` + `communities/` + `protocols/25–27`
4. **Release / ship** → `releases/v1.5.0-release.md` + `encyclopedia/07` + `encyclopedia/08`
5. **Do not ship claim without** → `trust/20-core-function-verification-matrix.md` + runtime evidence

---

## Maintenance

- Run `pnpm docs:check` after moving or renaming docs.
- Update this file when adding a new top-level shelf.
- Put version-specific execution plans in `program/`; merge into `program/PROGRAM.md` at release closeout.
- Move superseded plans to `archive/consolidated/` with a one-line “superseded by” in `PROGRAM.md`.
