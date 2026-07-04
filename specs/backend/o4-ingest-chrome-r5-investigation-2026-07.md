# Investigation — R5 O-4 ingest chrome (`group-thread-relay-ingest` residual)

**Status:** Investigation complete (2026-07-04) — design approved  
**Date:** 2026-07-04 (UTC)  
**Symptom class:** `group-thread-relay-ingest` · O-4 · membership/ingest UI chrome  
**Tracker:** [`docs/program/obscur-runtime-issue-tracker-2026-07.md`](../../docs/program/obscur-runtime-issue-tracker-2026-07.md) · queue **R5**  
**Handoff:** [`docs/handoffs/current-session.md`](../../docs/handoffs/current-session.md)  
**Related:** R1 room-key health · R3 sidebar preview · COM-RUN-02 (cancelled) · chain `chain-o4-group-ingest-2026-07-02` (**partial_accepted**)

---

## Summary

O-4 send on Tester1 is **verified** under full stack (docker `:7000` + coordination `:8787`). Register verdict: **partial_accepted** — residual band is **ingest-side UX + second-profile receive**, not sender publish.

R5 tracks **misleading or stale chrome** during/alongside relay ingest: health banners, sidebar placeholders, compose gates, and alert surfaces that disagree with thread truth after ingest lands.

R1 fixed health hook vs send owner. R3 fixed sidebar preview vs SQLite thread (**t4 PASS** `csess-264849283e3c`). **R5** asks what ingest chrome still lies after those fixes.

---

## R3 baseline (2026-07-04 post-rebuild)

| Field | Value |
|-------|--------|
| Session | `csess-264849283e3c` |
| Build | `pnpm dev:desktop -- --online --rebuild` (static shell; HMR/live not required) |
| Sidebar | **NewTest 2** preview → `R1-room-key-health-t4-070T1410` (was `No messages yet`) |
| Probe | `splitBrainSuspected: false` · `alertBannerCount: 3` (DM thread still open) |

**Note:** `dev:desktop --skip-build` does **not** pick up `groups/` source changes — static stale watch list omits `groups/providers`. Force `--rebuild` after group sidebar fixes.

---

## Symptom contract

| Field | Value |
|-------|--------|
| User action | Full stack up → Tester1 sends group message → Tester2 (or same profile) should ingest without misleading blockers |
| Expected | Ingested message visible; no false “room key missing” / relay blockers when send+ingest succeed |
| Actual (historical) | Send succeeds while sidebar/health show blockers; second-profile ingest often **not demonstrated** |
| Proof tier target | **t4** — dual-profile or cold-restart ingest with `client_surface_probe` + digest |
| Fixture | Tester1 / Tester2 · NewTest 2 · `b93f53e23d8c4456835afd3f4d3a627b` |
| Does not prove | COM-RUN-01 roster parity · packaged NSIS · mobile |

---

## Canonical owners (initial map)

| Concern | Module | Notes |
|---------|--------|-------|
| Relay subscription + decrypt ingest | `group-thread-relay-ingest.ts` · `use-group-thread-relay-ingest.ts` | Persists via `appendGroupThreadMessage` |
| Background joined-group ingest | `workspace-kernel-group-relay-ingest-owner.tsx` | Not only selected sidebar row |
| Membership health chrome | `use-community-membership-health.ts` · `community-membership-health-copy.ts` | R1 aligned key resolver |
| Sidebar preview | `group-sidebar-preview-sqlite-hydrate.ts` | R3 list-time hydrate |
| Thread display | `use-group-thread-messages.ts` | SQLite hydrate authority |
| Main shell wiring | `main-shell.tsx` · `group-home-page-client.tsx` | Ingest hook mount points |

**Subtraction rule:** Do not patch `conversation-row.tsx` or health copy until ingest vs chrome divergence is reproduced **post R1+R3**.

---

## Hypotheses (to verify)

| ID | Hypothesis | Test |
|----|------------|------|
| H1 | Ingest runs but chrome reads stale ledger/health before reconcile | Probe after send without opening community home |
| H2 | Second-profile ingest blocked by room-key scope mismatch | Dual-window `:9230`/`:9231` capture |
| H3 | `WorkspaceKernelGroupRelayIngestOwner` not subscribed for all joined groups | Digest + console during background ingest |
| H4 | Alert banner count (`alertBannerCount: 3` in probes) includes ingest-unrelated noise | Map banners to owner modules |
| H5 | Static shell stale detection misses `apps/pwa/app/features/groups/**` | **Confirmed** — R3 required `--rebuild` |

### Reason (initial verdict)

| Hypothesis | Verdict |
|------------|---------|
| H5 | **Confirmed** — dev ergonomics gap; not product bug |
| H1 / sidebar | **Closed by R3** — list-time SQLite hydrate |
| H4 | **Open** — 3 alert banners on DM surface; map owners before patch |
| H2 | **Primary R5 scope** — second-profile ingest never t4'd on current stack |
| H3 | **Unverified** — background ingest owner exists; needs send+ingest digest |

---

## Proof plan

| Layer | Command / action |
|-------|------------------|
| **L1** | Existing `group-thread-relay-ingest.test.ts` + health copy tests — regression guard |
| **L3** | MCP: full stack → send `R5-o4-ingest-t4-*` → probe thread + sidebar + health |
| **L4** | Tester2 window ingest OR cold restart → message visible without false blockers |
| **Chain** | Append to `chain-o4-group-ingest-2026-07-02` or new `chain-r5-o4-ingest-chrome-2026-07-04` |

### Capture sequence

1. Stack preflight — coordination `:8787` · docker relay `:7000` · desktop `:9230`
2. Rebuild/relaunch desktop post R3 commit (`3cf79dbe`)
3. R3 t4 sidebar probe (NewTest 2) — baseline before R5 send
4. Send + wait for ingest events in digest
5. `client_surface_probe` — record `alertBannerCount`, health blockers, thread count
6. Optional: second profile attach (`requireDualWindow: true`)

---

## Out of scope

- COM-RUN-01 roster (accepted @ ACC-02)
- COM-RUN-02 repair band (cancelled)
- New relay transport features

---

## Next step

1. ~~Design spec~~ — [o4-ingest-chrome-r5-design-2026-07.md](./o4-ingest-chrome-r5-design-2026-07.md) (**Option B** ingest room-key owner)
2. Implement smallest slice · L1 · t4 dual-profile ingest
