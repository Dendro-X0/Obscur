# Obscur — current state

**Read this first.** Snapshot for maintainers and agents (2026-07-09).

_Last updated: 2026-07-09 · Version train: **1.9.10** · **Runtime repair band EXIT** · **Vault sandbox evidence mode**_

---

## Where we are

| Track | Status |
|-------|--------|
| **v2 product verification (Phase 1)** | **EXIT** 2026-07-04 — [version-roadmap-scope.md](./program/version-roadmap-scope.md) |
| **v2 documentation (Phase 2)** | **EXIT** 2026-07-04 |
| **v2 installers (Phase 3)** | **EXIT** 2026-07-04 — [release-assets/manifest.json](../release-assets/manifest.json) |
| **Phase 4 website** | **Code done** · Vercel deploy **PAUSED** · [charter](./program/obscur-v2-phase4-website-charter.md) |
| **Phase 5 demo kit** | **Local prep** — script draft · GIF capture **maintainer-later** |
| **Runtime repair band** | **EXIT** — R1–R3 + R5 **VERIFIED t4** · R4 **A** |
| **Phase 6 precheck** | **Done** @ `ecbcf2eb` — gate draft · deps refreshed · engine lab PASS · tag **not yet** |
| **Vault sandbox (VAULT-SANDBOX-1)** | **Phases 1–5 implemented** · **G8 evidence mode** (maintainer L3/L4) · [plan](../specs/backend/vault-encryption-sandbox-plan-2026-07.md) |
| **CodaCtrl lane D** | **Obscur-side EXIT** — WEB-R2 hooks · RIW-8 draft mappings · runbook · **daemon wiring external** |
| **Engine lab (B0–B5, Conduit Mesh C0–C6)** | **Landed** — `pnpm verify:engine-lab` (parallel, does not unblock release alone) |
| **Community feature patches** | **PAUSED** — COM-RUN-01 accepted @ ACC-02 |

**Next step:** [handoffs/current-session.md](./handoffs/current-session.md) → **VAULT-SANDBOX-1 G8** (maintainer L3/L4 sign-off) · Phase 4–5 still gate v2 tag · CodaCtrl daemon wiring is **CodaCtrl repo**, not Obscur

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
