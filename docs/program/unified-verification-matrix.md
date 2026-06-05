# Unified verification matrix

**Status:** Active — run in **Phase B** after [concentrated-version-delivery.md](./concentrated-version-delivery.md) Phase A exits  
**Design / process:** [design-goals-and-constraints.md](./design-goals-and-constraints.md) · [v1.9.x-execution-contract.md](./v1.9.x-execution-contract.md)  
**Environment:** [manual-verification-environment.md](./manual-verification-environment.md) — Tester 1 (dark) + Tester 2 (light), two desktop windows  
**Issues output:** [unified-verification-issues-register.md](./unified-verification-issues-register.md)

**Legend:** `[ ]` not run · `[P]` pass · `[F]` fail · `[B]` blocked (env) · `[S]` skipped · `[A]` accepted limitation (document in register)

## Maintainer band sign-off (v1.9.x)

| Field | Value |
|-------|--------|
| Date (UTC) | 2026-06-01 |
| Git SHA | `37320382` |
| Surface | Desktop client (`pnpm dev:desktop:online`) |
| Outcome | **Pass** (maintainer unified client-side verification) |
| Register | [unified-verification-issues-register.md](./unified-verification-issues-register.md) — no new failures |
| Skipped | §8 mobile native (postponed) · §4 coordination rows if env not exercised |

Row-level `[P]`/`[F]` marks in sections below remain optional detail; band exit is recorded at register + handoff.

---

---

## Session header (v1.9.4 Phase B — open)

| Field | Value |
|-------|--------|
| Date (UTC) | 2026-06-01 |
| Git SHA / tag | `0105f406` + **uncommitted** STAB-1–3 + P4-5 docs (land before tag) |
| Concentration unit | **v1.9.4** Phase B |
| Build | `pnpm dev:desktop:online` |
| Coordination URL | `[-]` (optional for §4) |
| Relay | `pnpm dev:relay` or `[-]` |
| Phase A exit | P4-5 owner matrix **done**; STAB-1–3 **fixed** (uncommitted) |
| §0 automated | **All Pass** — 2026-06-01 (see below) |
| Manual pending | §1–§7 maintainer A/B; P4-1 Android · P4-3 P3d restart soak |

---

## §0 — Automated preflight (required before manual)

| ID | Check | Command / evidence | Result |
|----|--------|-------------------|--------|
| AUTO-0 | Typecheck | `pnpm -C apps/pwa typecheck` | `[P]` |
| AUTO-1 | Release pack | `pnpm release:test-pack -- --skip-preflight` | `[P]` |
| AUTO-2 | Community invariants | `pnpm -C apps/pwa test:community-invariants` | `[P]` (97/97) |
| AUTO-3 | Transport boundaries | `pnpm transport:boundaries:check` | `[P]` |
| AUTO-4 | Gateway boundaries | `pnpm gateway:boundaries:check` | `[P]` |
| AUTO-5 | **UV-RUNTIME-1** relay/runtime loop gate | `pnpm verify:stability` + vitest relay/runtime stability tests (below) | `[P]` |

**UV-RUNTIME-1 automated evidence (required before manual Phase 1 soak):**

```bash
pnpm verify:stability
pnpm -C apps/pwa exec vitest run \
  app/features/runtime/use-shell-transport-ready.test.ts \
  app/features/runtime/services/window-runtime-supervisor.test.ts \
  app/features/relays/hooks/use-relay-primary-selection.test.ts \
  app/features/relays/services/relay-runtime-supervisor.test.ts \
  app/features/relays/services/relay-health-hints.test.ts
```

**UV-RUNTIME-1 manual (10 min, two profiles):** Settings → Relays tab switch 20×; toggle `localhost:7000`; rapid sidebar nav — **zero** “Maximum update depth exceeded” / fatal error boundary.

---

## Phase B run order (maintainer)

**Prerequisites:** §0 all `[P]` · two profile windows · [manual-verification-environment.md](./manual-verification-environment.md) credentials.

```bash
# Terminal 1 (optional for §4 / live DM)
pnpm dev:relay

# Terminal 2
pnpm dev:desktop:online
```

| Order | Block | Time | Rows |
|-------|-------|------|------|
| 1 | UV-RUNTIME-1 manual soak | ~10 min | §0 note |
| 2 | Auth + shell smoke | ~15 min | AUTH-1 … AUTH-4 |
| 3 | **P4-3 / P3b–P3d restart soak** | ~20 min | See below → COM-3, COM-8, DM-4, K-6 |
| 4 | DM + communities full | ~45 min | §2, §3 remaining |
| 5 | Sync + UI + relay | ~30 min | §5–§7 |
| 6 | Coordination (if env up) | ~20 min | §4 |
| 7 | Android (if AVD) | ~30 min | §8 / [android-p1-smoke-checklist.md](./android-p1-smoke-checklist.md) |

Copy every `[F]` to [unified-verification-issues-register.md](./unified-verification-issues-register.md) before Phase C close.

### P4-3 — native SQLite restart soak (P3b + P3d)

**Profile:** Tester1 (dark) · **native desktop only** (not `:3340` browser).

**DM (P3b):**

1. Open an existing DM or start one with Tester2; send **3+ messages** each direction.
2. Note last message preview in sidebar.
3. **Quit all Obscur windows** (Task Manager / `pkill` — not just minimize).
4. Relaunch Tester1; unlock.
5. **Pass** if: DM in sidebar with same preview; thread shows full history; no blank thread after nav (DM-1, DM-4).
6. **Fail** if: messages missing, sidebar empty, or deleted messages reappear → file **DM-001** / ACC-01 review.

**Community (P3d):**

1. Open a community with **2+ members** (or create + invite Tester2); send **2+ group messages**.
2. Note sidebar title + last preview + member count on group home.
3. **Quit all windows**; relaunch Tester1.
4. **Pass** if: group still in sidebar; messages intact; member count ≠ 1 when multiple members (COM-8); leave state unchanged if previously left (COM-3).
5. **Fail** if: group vanished, messages empty, roster collapsed to 1 → file register row + `community-group-sqlite-store` in notes.

**Optional second profile:** Repeat unlock-only on Tester2 window — list hydrates (DM-6, AUTH-2).

---

## §1 — Auth & profiles (desktop)

| ID | Feature | Steps | Result | Notes |
|----|---------|-------|--------|-------|
| AUTH-1 | Cold start → unlock | Launch; unlock Tester1; no spinner >45s | `[ ]` | |
| AUTH-2 | Second window / profile | Open profile 2 in new window; settings persist | `[ ]` | |
| AUTH-3 | Session isolation | Same profile two windows ~10s; no false duplicate lockout | `[ ]` | |
| AUTH-4 | Profile switch A/B | Communities/state not visible across profiles | `[ ]` | REL-003 |

---

## §2 — DM & messaging (desktop)

| ID | Feature | Steps | Result | Notes |
|----|---------|-------|--------|-------|
| DM-1 | Thread after nav | Open DM → Settings → back; thread not blank | `[ ]` | |
| DM-2 | Group → DM switch | Full bidirectional history without refresh | `[ ]` | |
| DM-3 | Send / receive | One message each direction in open DM | `[ ]` | |
| DM-4 | Delete for me (honest) | Delete messages → refresh; record if they return | `[ ]` | DM-001 accepted? |
| DM-5 | Search jump | Chat message search finds and highlights target | `[ ]` | |
| DM-6 | Secondary profile DM | Profile 2 unlock; list hydrates without auth bounce | `[ ]` | |
| DM-7 | One-sided restore | After account restore, note if thread is one-sided only | `[ ]` | DM-003 |
| DM-8 | Cross-device divergence | If two devices available, compare timelines | `[S]` | DM-002 |

---

## §3 — Communities & Network (desktop)

| ID | Feature | Steps | Result | Notes |
|----|---------|-------|--------|-------|
| COM-1 | Create / join gate | Workspace trust gate blocks bad relay without coordination | `[ ]` | |
| COM-2 | Invite accept path | Accept invite; honest copy about relay lag | `[ ]` | |
| COM-3 | Leave community | Leave; group absent from sidebar after refresh | `[ ]` | REL-001 |
| COM-4 | Leave outbox offline | Leave with relay down; later online — stays left | `[ ]` | REL-004 |
| COM-5 | Terminal invite (declined) | Inviter roster clears on decline/cancel | `[ ]` | MEM-005 |
| COM-6 | Network vs chat status | Join/leave consistent on Network card vs chat shell | `[ ]` | MEM-002 |
| COM-7 | Member modal count | Management modal count matches sealed/header | `[ ]` | |
| COM-8 | Roster collapse | Reload group home; count ≠ 1 when multiple members | `[ ]` | MEM-001 |
| COM-9 | Restore historical | Restore backup; left community does not resurrect | `[ ]` | REL-002 |
| COM-10 | Multi-profile restore | A left + B restore; no cross-profile leak | `[ ]` | AB-15 |
| COM-11 | Inbound bot (optional) | Steward enables trigger; keyword reply if env ready | `[S]` | B2 |

---

## §4 — Coordination & Lane K (requires env)

| ID | Feature | Steps | Result | Notes |
|----|---------|-------|--------|-------|
| K-1 | Coordination health | `curl …/health` → ok | `[ ]` | |
| K-2 | K-M1 directory | A leaves → B shows excluded within poll SLA | `[ ]` | v1.9.2 |
| K-3 | K-M2 re-invite | Re-invite after leave per demo matrix | `[ ]` | |
| K-4 | Sync mode UI | Settings → Relays → membership sync mode honest | `[ ]` | v1.9.3 |
| K-5 | Sovereign copy | No “relay-confirmed member” on public relay mode | `[ ]` | v1.9.3 |
| K-6 | R1 delete reload | Delete-for-me survives reload in test scenario | `[ ]` | v1.9.5 / DM-001 |

Ref: [v1.9.0 demo matrix](../assets/demo/v1.9.0/README.md)

---

## §5 — Account sync & restore

| ID | Feature | Steps | Result | Notes |
|----|---------|-------|--------|-------|
| SYNC-1 | Account restore | Restore backup; app usable; no permanent error boundary | `[ ]` | |
| SYNC-2 | Ghost voice | After restore/sync, no false active call from history | `[ ]` | MED-002 |
| SYNC-3 | Media in history | Images in restored thread / Vault linkage | `[ ]` | MED-001 |
| SYNC-4 | Status strip | Restore/sync banners not eating full viewport (mobile/desktop) | `[ ]` | P13 |

---

## §6 — Shell, navigation & settings

| ID | Feature | Steps | Result | Notes |
|----|---------|-------|--------|-------|
| UI-1 | Rapid nav | 10 fast sidebar switches + Settings; no freeze | `[ ]` | |
| UI-2 | Settings tabs | All tabs render; no JSX artifacts | `[ ]` | |
| UI-3 | Settings search | Search jumps to section with highlight | `[ ]` | |
| UI-4 | Network compact | Mobile-width network tabs usable | `[ ]` | P14 |
| UI-5 | Vault grid | Vault scroll + filters on compact layout | `[ ]` | P14 |
| UI-6 | Voice dock | In-call UI; no ghost ring from history alone | `[ ]` | |

---

## §7 — Relay & transport

| ID | Feature | Steps | Result | Notes |
|----|---------|-------|--------|-------|
| RELAY-1 | Primary failover | Disable primary; app selects alternate; no crash loop | `[ ]` | |
| RELAY-2 | Offline degraded | Relay down → degraded UI only; no provider throw | `[ ]` | |
| RELAY-3 | Experiment online | `dev:desktop:online` — messaging + sync activate | `[ ]` | |

---

## §8 — Mobile native (postponed — run at wrap-up)

| ID | Feature | Steps | Result | Notes |
|----|---------|-------|--------|-------|
| MOB-0 | APK install + cold start | `p12:android-smoke` with AVD running | `[S]` | Tier 0 |
| MOB-1 | Auth + shell | P1-1 … P1-4 from [android-p1-smoke-checklist.md](./android-p1-smoke-checklist.md) | `[S]` | |
| MOB-2 | Layout dev check | `dev:mobile-shell:online` device toolbar | `[S]` | Not native Tier 1 |

---

## §9 — Release artifacts (when tagging)

| ID | Feature | Steps | Result | Notes |
|----|---------|-------|--------|-------|
| REL-1 | Version in About | Matches `pnpm version:check` | `[ ]` | |
| REL-2 | Desktop installers | Asset names match tag | `[ ]` | |
| REL-3 | Android APK name | versionName aligned | `[S]` | |

---

## Phase B summary

| Metric | Count |
|--------|-------|
| Pass `[P]` | |
| Fail `[F]` | |
| Blocked `[B]` | |
| Skipped `[S]` | |
| Accepted `[A]` | |

**Phase B exit:** All §0 Pass; §1–§7 executed or explicitly Skipped with reason; every `[F]` copied to issues register.

---

## Cross-reference — known issue IDs

| Matrix rows | Register / queue ID |
|-------------|---------------------|
| COM-3, COM-9 | REL-001, REL-002 |
| AUTH-4, COM-10 | REL-003 |
| COM-4 | REL-004 |
| COM-6 | MEM-002 |
| COM-8 | MEM-001 |
| DM-4 | DM-001 |
| SYNC-2, SYNC-3 | MED-002, MED-001 |

Full queue: [v1.5.0-known-issues-and-investigation-queue.md](./v1.5.0-known-issues-and-investigation-queue.md) — **status updates happen in Phase C**, not during Phase A.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-01 | v1.9.4 Phase B — unified matrix is execution entry; P4-3 soak in matrix |
| 2026-06-01 | Initial matrix for v1.9.x unified pass |
