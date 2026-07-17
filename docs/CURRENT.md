# Obscur — current state

**Read this first.** Snapshot for maintainers and agents (2026-07-16).

_Last updated: 2026-07-17 · Version train: **v2.0.0 fast-track** (collapse 1.9.13/1.9.14 into 2.0.0 notes)_

---

## Where we are

| Track | Status |
|-------|--------|
| **v1.9.12 MESH-TRUST** | **Shipped** (tag) · GitHub Release assets still stale @ 1.8.11 |
| **v1.9.13–1.9.14** | Landed in tree · L3 soak **accepted via GIF** · no separate tag required for v2 |
| **v2.0.0 gate** | **Fast-track** — [v2.0.0-gate.md](./releases/v2.0.0-gate.md) · [fast-track plan](../specs/backend/v2.0.0-fast-track-2026-07.md) |
| **Download surface** | Canonical = `release-assets/` · **`obscur.app` is not the messenger site** |
| **CI** | `reliability-gates` green · Full Release native-build red — [investigation](../specs/ci/2026-07-17-full-release-investigation.md) |
| **Community feature patches** | **PAUSED** — ACC-02 |

**Next step:** [handoffs/current-session.md](./handoffs/current-session.md) → commit train · bump 2.0.0 · package + GitHub Release · sign gate · tag

---

## Runtime repair queue

| Priority | ID | Status |
|----------|-----|--------|
| R1 | `group-room-key-missing` | **VERIFIED t4** — `chain-r1-room-key-health-2026-07-04` |
| R2 | `auth-keychain-restore-failed` / cold unlock | **VERIFIED t4** — `1ab19204` |
| R3 | Sidebar preview stale | **VERIFIED t4** (`csess-264849283e3c` · `3cf79dbe`) |
| R4 | COM-RUN-01 roster divergence | **A** @ ACC-02 |
| **R5** | O-4 ingest chrome | **VERIFIED t4** (`60c9bb3c`) |

Protocol: [program/obscur-runtime-issue-tracker-2026-07.md](./program/obscur-runtime-issue-tracker-2026-07.md) · CodaCtrl export `.codactrl/verify/issue-report/`

**R1 fix (landed, uncommitted):** membership health hook uses `resolveRoomKeyHexForMembershipHealthPanel` (same owner as send). L1: `community-coordination-room-key-owner.test.ts` + health-copy tests.

---

## Honest limits (demo / support)

**One page:** [program/obscur-v2-known-limitations.md](./program/obscur-v2-known-limitations.md)

Highlights: roster display may disagree between profiles (accepted); cold restart may require Import Key (R2); sidebar preview may lag thread (R3); SEC-V4 AB-15 accepted.

---

## Phase queue

[program/obscur-v2-roadmap-2026-07.md](./program/obscur-v2-roadmap-2026-07.md) — Phases 1–3 **EXIT** · Phase 4 code **PAUSED deploy** · Phases 5–6 frozen until runtime band.

---

## Engine lab (reference)

Libraries: `packages/libobscur`, `packages/dweb-*`, `packages/obscur-*`. UI archived per [program/obscur-ui-archive-manifest.md](./program/obscur-ui-archive-manifest.md).

| Gate | Command |
|------|---------|
| Engine lab | `pnpm verify:engine-lab` |
| Transport w68 | `pnpm verify:transport-engine-w68` |
| DM / workspace kernels | `pnpm verify:dm-engine-b3` · `pnpm verify:workspace-kernel` |
| Conduit Mesh C6 | `pnpm verify:conduit-mesh-c6` |
| Conduit Mesh C14 (includes C0–C13) | `pnpm verify:conduit-mesh-c14` |

**C10 L3 soak:** [conduit-mesh-c10-l3-http-soak-runbook.md](./program/conduit-mesh-c10-l3-http-soak-runbook.md) — HTTP-only DM **PASS** (2026-07-15).

**P14 L3 soak (active):** [v1.9.14-p14-l3-soak-runbook.md](./program/v1.9.14-p14-l3-soak-runbook.md) — pool + presets closeout for 1.9.14.

**Roadmap:** [program/obscur-backend-engine-roadmap.md](./program/obscur-backend-engine-roadmap.md)

---

## Build and install

[program/obscur-v2-install-build-guide.md](./program/obscur-v2-install-build-guide.md) — dev stack, `desktop:package`, Android debug APK in manifest.

```bash
pnpm release:test-pack    # release gate
pnpm docs:check           # doc link integrity
pnpm verify:phase2        # P3a/P3b authority
pnpm verify:p5-persistence
```

Client verification: CodaCtrl MCP on desktop CDP `:9230` — [program/obscur-dev-test-accounts.md](./program/obscur-dev-test-accounts.md).

---

## Do not boot from

[archive/](./archive/README.md) · [archive/program/inactive-2026-06/](./archive/program/inactive-2026-06/README.md) — historical only.
