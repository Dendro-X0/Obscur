# Obscur v2.0.0 roadmap — consolidated issues & phased execution

**Status:** Active — **single maintainer queue** for v2.0.0 acceleration  
**Last updated:** 2026-07-04 (UTC)  
**Current semver:** `1.9.10` on `main`  
**Daily step:** [current-session.md](../handoffs/current-session.md)  
**Scope checklist (destination):** [version-roadmap-scope.md](./version-roadmap-scope.md)  
**Release pipeline (after Phase 1):** [v2.0-release-pipeline.md](../archive/program/inactive-2026-06/v2.0-release-pipeline.md)

---

## Why progress felt slow (diagnosis)

| Problem | Effect |
|---------|--------|
| **Two parallel tracks** | Engine-lab (packages, `verify:engine-lab`) advanced while **product verification** (COM-RUN, RIW, O-series) stayed ◐ |
| **Scattered registers** | Same symptom in CodaCtrl (`.codectx/verify/`), unified register, runtime tracker, UX-gate JSON — no single “what’s left” |
| **Patch loops on failed design** | COM-RUN-02 room-key restore consumed months before **CANCELLED** (2026-07-03) |
| **Tooling mistaken for fixes** | CodaCtrl captures/digests; does not close architecture gaps |
| **PAUSED bands without charter** | COM-RUN-01 roster, community crypto — agents spin without a chosen slice |

**Rule going forward:** One **phase** active at a time. A row exits only with **V** (verified) or **A** (accepted + user copy). Implementation without verification does not advance v2.0.0.

---

## Source registers (where issues live)

| Register | Path | Role |
|----------|------|------|
| **CodaCtrl issues (live)** | `.codectx/verify/issues-register.json` · `.codectx/verify/issues-register.summary.json` | Runtime capture queue (16 top groups, Jul 2026) |
| **Runtime tracker** | [obscur-runtime-issue-tracker-2026-07.md](./obscur-runtime-issue-tracker-2026-07.md) | Domain inventory + verification protocol |
| **Product COM-RUN** | [unified-verification-issues-register.md](./unified-verification-issues-register.md) · [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md) | Matrix-linked product rows |
| **UX-gate static** | [obscur-ux-gate-investigation-2026-07.md](./obscur-ux-gate-investigation-2026-07.md) · [obscur-ux-gate-register.v1.json](./obscur-ux-gate-register.v1.json) | 43 pattern findings (design debt) |
| **Subtraction** | [obscur-subtraction-register-2026-07.md](./obscur-subtraction-register-2026-07.md) | Removed vs deferred owners |
| **v2 scope** | [version-roadmap-scope.md](./version-roadmap-scope.md) | Lane K/C/T/X/P master checklist |

---

## Complete issue inventory (consolidated)

Legend: **Open** · **◐ Partial** · **✓ Verified** · **A Accepted** · **⏸ PAUSED** · **✕ CANCELLED**

### P0 — Blocks credible demo

| ID | Symptom / title | Status | Owner / next action |
|----|-----------------|--------|---------------------|
| **O-4** | Group thread send / relay ingest (`group-thread-relay-ingest`) | ◐ | Send works when stack + local key present; fails honestly without key — **Phase 2** |
| **COM-RUN-01** | Roster diverges across profiles (`community-roster-divergence`) | ⏸ Open | Single roster read owner — integration study before patches |
| **COM-RUN-11** | Invite lifecycle / accept UX (`COM-RUN-11`) | Open | Live invite matrix; fixture often has only superseded cards |
| **group-room-key-missing** | Sidebar warned no key while send succeeded (stale UI) | ✓ **R1 VERIFIED t4** | Health hook aligned with send owner — round `2026-07-04-r1-room-key-health-t4` |
| **O-2** | DM vanishes after cold restart (`dm-vanishes-cold-restart`) | ◐ | Round2 t4 pass recorded; auth gate on cold boot still blocks some paths |
| **COM-RUN-02** | Room-key restore / join gates | ✕ **CANCELLED** | [community-membership-redesign-charter-2026-07.md](./community-membership-redesign-charter-2026-07.md) — no repair loops |
| **COM-RUN-03** | Relay publish binding | ✓ | Verified Pass 2026-06-25 |
| **COM-RUN-04** | Membership UX gates | ◐ Mitigated | Navigation gates subtracted 2026-07-03; health diagnostic-only |
| **STAB-*** | Render loops (main shell, relay list) | ✓ | Fixed `2a1badf7` |

### P1 — Reliability / data truth

| ID | Symptom / title | Status | Owner / next action |
|----|-----------------|--------|---------------------|
| **RIW-1** | Membership ledger invalid (`groups-ledger-validation`) | ✓ L3 | Repair on load + archival validator split — `invalidEntries=0` NewTest 2 (2026-07-03) |
| **COM-RUN-05** | Partial join (member UI without atomic contract) | Open | Blocked on charter + join port |
| **COM-RUN-06** | Late drift detection | Open | Maps RIW-1 / health telemetry |
| **COM-RUN-07** | Six+ membership/roster owners (ACC-02) | Open / **A** architecture | Subtraction before new owners |
| **COM-RUN-10** | Display repair | Verify pending | COM-MEM-2 matrix |
| **REL-001–004** | Ledger precedence, restore boundary, profile scope, leave outbox | ✓ I · ◐ V | [version-roadmap-scope.md](./version-roadmap-scope.md) Lane T |
| **REL-005** | Mutation owner convergence | ✓ **A** | [community-membership-mutation-owner-map-2026-07.md](../../specs/backend/community-membership-mutation-owner-map-2026-07.md) — write funnel; read (COM-RUN-07) deferred |
| **MEM-002–006** | Cross-surface membership, invite pubkeys, terminal invite, re-hydrate | ✓ I · ◐ V | Matrix backlog |
| **SEC band** | SEC-V1–V5 programmatic | ✓ | Maintainer §1–§5 **signed partial** 2026-07-04; SEC-V4 **A** @ REL-002 |
| **UX-gate P0** | 6 findings (join/invite/trust pessimism) | ◐ | Partial subtraction; charter for crypto |
| **UX-gate P1** | 18 findings (ledger, sendability, projection) | Open | Map to phases below |

### P2 — Correctness / dev experience

| ID | Symptom / title | Status | Notes |
|----|-----------------|--------|-------|
| **RIW-2** | Projection authority oscillation (`projection-authority-not-ready`) | ◐ | `account-projection-runtime.ts` |
| **RIW-3** | DM normalize direction mismatch | ◐ | Masked when thread empty post-unlock |
| **RIW-4** | Coordination deltas unreachable in some dev sessions | ◐ | Stack preflight; curl OK when wrangler up |
| **RIW-9** | DM split-brain / cold auth (`dm-ui-split-brain`, `auth-keychain-restore-failed`) | ◐ | Warm path OK; cold boot → sign-in |
| **COM-RUN-08** | Dev profiles / fixture hygiene | Open | NewTest 2 purge protocol |
| **O-1** | DM notification storm | Not re-verified | Phase 3 polish |
| **O-3** | Relay offline flash on refresh | Not re-verified | Phase 3 |
| **Unmapped captures** | 25 digest buckets unmapped | Open | CodaCtrl taxonomy — not product fix |
| **UX-gate P2** | 14 findings | Open | Relay tier, terminal states |

### P3 — Deferred / tooling / mobile

| ID | Symptom / title | Status | Notes |
|----|-----------------|--------|-------|
| **RIW-5** | Partial relay stack (`relay-partial-stack-desktop-only`) | Open | Docker :7000 optional |
| **MOB-1** | 4GB RAM mobile performance | Deferred | After desktop core |
| **Conduit mesh C7+** | Pool retirement follow-on | ⏸ | Engine-lab band |
| **UX-gate P3** | 5 findings | Subtracted / diagnostic | |
| **DM-002–007** | Cross-device delete paths | Out of v2 gate | Unless re-chartered |
| **C-4.3** | Hybrid steward+vote | Defer | Record **A** at v2 gate |

### Accepted limitations (v2 gate copy required)

| ID | Topic |
|----|-------|
| **ACC-01** | Delete-for-me not durable across refresh |
| **ACC-02** | Roster multi-owner (display-layer R2) — architecture accepted, runtime divergence still **Open** as COM-RUN-01 |
| **MEM-001** | Roster architecture — **A** |
| **X4–X6** | Media preview — **A** |

---

## v2.0.0 phased roadmap

Aligned with [v2.0-release-pipeline.md](../archive/program/inactive-2026-06/v2.0-release-pipeline.md). **Only one phase is ACTIVE**; later phases are listed for orientation, not daily work.

```text
Phase 1  Product truth (I + V)     ← EXIT 2026-07-04 (1D complete; SEC-V4 A)
    │
Phase 2  Documentation structure  ← EXIT 2026-07-04
    │
Phase 3  Production installers      ← EXIT 2026-07-04
    │
Phase 4  Official website           ← PAUSED (no deploy until runtime fixes)
    │
Phase 5  Demo kit
    │
Phase 6  v2.0.0 tag + gate doc
```

### Phase 1 — Product truth **EXIT 2026-07-04**

**Exit:** All in-scope rows in [version-roadmap-scope.md](./version-roadmap-scope.md) are **V** or **A** with copy; no open **P0** in table above; `pnpm release:test-pack` green on exit commit.

Work **one sub-phase at a time**. Phase 2 exit recorded 2026-07-04. **Phase 3 (installers)** is next when maintainer pulls forward.

#### Phase 1A — Data truth & subtraction closeout **(EXIT 2026-07-03)**

| # | Deliverable | Issues closed | Proof |
|---|-------------|---------------|-------|
| 1 | RIW-1 ledger valid on NewTest 2 fixture after unlock | `groups-ledger-validation` | Digest: `invalidEntries=0` · `csess-2527774254b5` |
| 2 | UX-gate navigation subtraction complete | COM-RUN-04, UX P0 gates | `pnpm verify:fls-alignment` · L3 soak (navigation ✅) |
| 3 | Subtraction register honored | COM-RUN-02 repair removed | [obscur-subtraction-register-2026-07.md](./obscur-subtraction-register-2026-07.md) |
| 4 | REL-005 owner map or **A** | COM-RUN-07 (write) | [community-membership-mutation-owner-map-2026-07.md](../../specs/backend/community-membership-mutation-owner-map-2026-07.md) |

#### Phase 1B — Community crypto charter slice **(EXIT 2026-07-04)**

| # | Deliverable | Issues closed | Proof |
|---|-------------|---------------|-------|
| 1 | Maintainer picks **A, B, C, or D** | COM-RUN-02 ✕, group-room-key-missing | **C** selected · [community-coordination-room-key-wrap-slice-c-2026-07.md](../../specs/backend/community-coordination-room-key-wrap-slice-c-2026-07.md) |
| 2 | Implement **one** slice end-to-end | O-4 send path, join port | Slice C L3 pass · `test-results/phase1b-slice-c-l3-2026-07-03.json` |
| 3 | Wire or delete `community-sendability-guard` | UX UNWIRED_GUARD | Action-time resolve owner (C4) |

#### Phase 1C — Core flows verified **(EXIT 2026-07-04)**

| # | Flow | Issues | Proof |
|---|------|--------|-------|
| 1 | DM cold restart | O-2, RIW-9 | **VERIFIED t4** (2026-07-04) · `O2-phase1c-coldrestart-070T0559` |
| 2 | Group two-profile | O-4, COM-RUN-11 | **VERIFIED t4** (rounds 25–28) — fresh invite · Cancel/Accept/Decline matrix · dual send/receive |
| 3 | Community roster | COM-RUN-01 | **A** — roster read **PAUSED**; no patch band; integration study deferred |
| 4 | Coordination leave | K3 | **PARTIAL t3** K-M1 (coord leave delta OK; excluded UI band missing) · **VERIFIED t4** K-M2 re-invite + dual send (round 30) |

Exit evidence: chain `chain-com-run-11-phase1c-2026-07-04` → `n7-k-m2-rejoin-t4` · handoff `docs/handoffs/current-session.md`. §0 `transport:boundaries:check` has pre-existing allowlist debt; `verify:engine-lab` env-blocked while desktop CDP session holds `obscur_desktop_app.exe`.

#### Phase 1D — Lane closure & SEC manual **EXIT 2026-07-04**

| # | Deliverable | Proof |
|---|-------------|-------|
| 1 | Flip ◐ → **V** on Lane K, C-4.1/4.2, Lane T rows in version-roadmap-scope | **DONE** 2026-07-04 — see handoff + register |
| 2 | SEC maintainer checklist §1–5 | **DONE partial** 2026-07-04 — checklist signed; SEC-V4 **A** @ REL-002 |
| 3 | P3a–d SQLite restart soaks | **DONE** 2026-07-04 — `verify:phase2` + `verify:p5-persistence` green · cold restart t3 (`n8`) |

---

### Phases 2–6 (inactive — do not pull forward)

| Phase | Goal | Prerequisite |
|-------|------|--------------|
| **2** | Docs index + archive duplicates | Phase 1 exit — **EXIT** 2026-07-04 |
| **3** | Desktop/Android installers + checksums | Phase 2 exit — **next** |
| **4** | `apps/website` download + trust copy | Phase 3 |
| **5** | Demo scripts + evidence on site | Phase 4 |
| **6** | `v2.0.0` tag, CHANGELOG, gate doc | Phases 1–5 |

#### Phase 2 — Documentation structure **EXIT 2026-07-04**

| # | Deliverable | Proof |
|---|-------------|-------|
| D2-1 | Canonical index (≤3 hops from `docs/README.md`) | **Done** |
| D2-2 | `pnpm docs:check` green | **Done** |
| D2-3 | Presenter limitations sheet | [obscur-v2-known-limitations.md](./obscur-v2-known-limitations.md) |
| D2-4 | P3 gap owners documented | **Done** |
| D2-5 | Install/build docs | [obscur-v2-install-build-guide.md](./obscur-v2-install-build-guide.md) |

Charter: [obscur-v2-phase2-docs-charter.md](./obscur-v2-phase2-docs-charter.md)

#### Phase 3 — Production installers **EXIT 2026-07-04**

| # | Deliverable | Proof |
|---|-------------|-------|
| P3-1 | `pnpm desktop:package` → `release-assets/` + checksum | **Done** 2026-07-04 — [manifest.json](../../release-assets/manifest.json) |
| P3-2 | Signing policy — minisign or **unsigned accepted** | **Done** 2026-07-04 — [obscur-v2-phase3-signing-policy.md](./obscur-v2-phase3-signing-policy.md) |
| P3-3 | Android APK path + checksum in manifest | **Done** 2026-07-04 — `app-universal-debug.apk` @ [manifest.json](../../release-assets/manifest.json) |

#### Phase 4 — Official website **PAUSED**

Deploy and public release blocked until runtime repair band. Code complete (W4-1…W4-4); no Vercel launch.

| # | Deliverable | Proof |
|---|-------------|-------|
| W4-1 | `/download` — manifest artifacts + build-from-source | **Done** (not deployed) |
| W4-2 | Trust copy — limitations, unsigned policy | **Done** |
| W4-3 | Build/deploy documented | **Done** · deploy **PAUSED** |
| W4-4 | Nav structure | **Done** |

Charter: [obscur-v2-phase4-website-charter.md](./obscur-v2-phase4-website-charter.md)

**Current band:** Runtime repair — see [current-session.md](../handoffs/current-session.md)

---

## Engine-lab vs product (do not confuse)

| Track | Roadmap | Status |
|-------|---------|--------|
| **Engine-lab** | [obscur-backend-engine-roadmap.md](./obscur-backend-engine-roadmap.md) B0–B5 + conduit mesh C2–C6 | **Landed** w0 gates — continues in parallel, does not unblock v2 demo alone |
| **Product v2** | This doc Phases 1–3 + runtime repair | **Blocking** release |

Engine work **supports** product verification but **v2.0.0** is decided by runtime repair + Phase 4–6, not `verify:engine-lab` alone.

---

## What to do now (runtime repair band)

1. **R2** — Write investigation spec for `auth-keychain-restore-failed` / cold password unlock; proof = CodaCtrl t4 (restart → password, no Import Key).
2. **R3** — Sidebar preview stale after R2 or in parallel if owner is clear.
3. **Do not** resume COM-RUN-01 roster patches, COM-RUN-02 repair, website deploy, or `v2.0.0` tag.
4. **CodaCtrl** — t3/t4 capture on repair rows only; export to `.codactrl/verify/issue-report/`.

**Handoff atomic step:** [current-session.md](../handoffs/current-session.md) → **R2**.

## Revision history

| Date | Change |
|------|--------|
| 2026-07-04 | **R1 VERIFIED t4** — `group-room-key-missing` health hook aligned with send owner |
| 2026-07-04 | **Runtime-first gate** — Phase 4 deploy PAUSED; release prep frozen until runtime rows exit |
| 2026-07-04 | Phase 4 code complete — website deploy **PAUSED** @ W4-1…W4-4 |
| 2026-07-04 | Phase 3 **EXIT** — P3-1 desktop package · P3-2 unsigned policy · P3-3 Android debug APK in manifest |
| 2026-07-04 | Phase 2 **EXIT** — install/build guide; docs:check green |
| 2026-07-04 | Phase 1D **EXIT** — row 3 P3a–d cold-restart soaks; Phase 1 product verification complete |
| 2026-07-04 | Phase 1D row 2 — SEC §1–§5 partial sign-off @ `4d000257` |
| 2026-07-04 | Phase 1D row 1 lane closure recorded |
| 2026-07-04 | Phase 1C **EXIT** — rows 1–2 t4; row 3 **A**; row 4 K-M1 partial + K-M2 t4; **1D current** |
| 2026-07-03 | Initial consolidation — registers merged; Phase 1A current; COM-RUN-02 marked cancelled |
