# Unified verification matrix

**Status:** Active — run in **Phase B** after [concentrated-version-delivery.md](./concentrated-version-delivery.md) Phase A exits  
**Environment:** [manual-verification-environment.md](./manual-verification-environment.md) — Tester 1 (dark) + Tester 2 (light), two desktop windows  
**Issues output:** [unified-verification-issues-register.md](./unified-verification-issues-register.md)

**Legend:** `[ ]` not run · `[P]` pass · `[F]` fail · `[B]` blocked (env) · `[S]` skipped · `[A]` accepted limitation (document in register)

**Do not run incrementally during Phase A implementation** — one maintainer session (or split by §) after v1.9.x engineering exit.

---

## Session header (fill once)

| Field | Value |
|-------|--------|
| Date (UTC) | |
| Git SHA / tag | |
| Concentration unit | e.g. `v1.9.x` |
| Build | `pnpm dev:desktop:online` / installed release |
| Coordination URL | `http://127.0.0.1:8787` or `[-]` |
| Relay | `pnpm dev:relay` or `[-]` |

---

## §0 — Automated preflight (required before manual)

| ID | Check | Command / evidence | Result |
|----|--------|-------------------|--------|
| AUTO-0 | Typecheck | `pnpm -C apps/pwa typecheck` | `[ ]` |
| AUTO-1 | Release pack | `pnpm release:test-pack -- --skip-preflight` | `[ ]` |
| AUTO-2 | Community invariants | `pnpm -C apps/pwa test:community-invariants` | `[ ]` |
| AUTO-3 | Transport boundaries | `pnpm transport:boundaries:check` | `[ ]` |
| AUTO-4 | Gateway boundaries | `pnpm gateway:boundaries:check` | `[ ]` |

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
| 2026-06-01 | Initial matrix for v1.9.x unified pass |
