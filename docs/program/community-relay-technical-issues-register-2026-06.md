# Community & relay — technical issues register (2026-06)

**Status:** Active — **Path B narrow relaunch** (R0 specs landed; implementation R1+ gated)  
**Last updated:** 2026-06-25 (UTC)  
**Trigger:** Maintainer A/B on **NewTest 2** (`ws://localhost:7000`, managed workspace) — symptoms persisted after prior “green” checks; delayed failure days later  
**Audience:** Agents and maintainers before touching `apps/pwa/app/features/groups/**` or `workspace-kernel/**`  
**Decision:** [community-relaunch-decision-2026-06.md](./community-relaunch-decision-2026-06.md) · **Master spec:** [community-relaunch-master-spec-2026-06.md](../archive/program/inactive-2026-06/community-relaunch-master-spec-2026-06.md)  
**Related:** [community-membership-relay-feasibility.md](../archive/program/inactive-2026-06/community-membership-relay-feasibility.md) · [community-membership-invariants.md](../archive/program/inactive-2026-06/community-membership-invariants.md) · [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md) · [unified-verification-issues-register.md](./unified-verification-issues-register.md) (ACC-02)

---

## Executive summary

Managed-workspace communities exhibit **low fault tolerance** and **late detection**: a two-user setup can appear healthy at first verification, then diverge silently across profiles until send, invite, or participant surfaces fail.

This is not a single bug. It is the combined effect of:

1. **Multiple parallel membership truths** (coordination directory, ledger, relay hints, known-participants OR-set, monotonic roster session, terminal cache, room-key store).
2. **Split product contracts** (discovery roster vs membership gates vs sendability vs crypto material).
3. **Partial join success** (UI shows “member” without room key and/or writable relay).
4. **Implement-before-verify** (Lane K rows marked implemented while two-user soak remains partial — see [version-roadmap-scope.md](./version-roadmap-scope.md) K3–K5).
5. **Dev-mode escapes** that relax membership gates without establishing chat prerequisites.

Incremental UI/roster patches do not converge these layers. **Path B narrow** relaunch specs define R1–R6 implementation; see master spec. No feature code until R0 maintainer review complete.

---

## Reproduction fixture (maintainer)

| Field | Value |
|-------|--------|
| Community | **NewTest 2** |
| Relay | `ws://localhost:7000` |
| Mode | `managed_workspace` (Path B) |
| Actors | **Tester 1** (creator), **Tester 2** (joiner), separate profiles/windows |
| Stack | Terminal 1: `pnpm dev:coordination` (:8787) · Terminal 2: `pnpm dev:desktop:no-coord -- --rebuild` |
| Env (COM-MEM-2) | **full-stack profile:** coordination URL + relay :7000; `DEV_COORDINATION_ONLY` false — see [community-dev-profiles-spec-2026-06.md](../archive/program/inactive-2026-06/community-dev-profiles-spec-2026-06.md) |
| Env (directory-only) | `NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true` — not valid for COM-MEM-2 Pass |

**Purge before clean retest:** `node scripts/purge-workspace-communities.mjs --match NewTest` (quit Obscur first).

---

## Issue index

| ID | Severity | Category | Summary | Spec | Phase | Status |
|----|----------|----------|---------|------|-------|--------|
| COM-RUN-01 | P0 | Membership | Participant list diverges between profiles; joiner may not see creator | [roster-read-owner](../archive/program/inactive-2026-06/community-roster-read-owner-spec-2026-06.md) | R3 | Open |
| COM-RUN-02 | P0 | Crypto | Room key missing on joiner — chat and invite blocked | [atomic-join](../archive/program/inactive-2026-06/community-atomic-join-spec-2026-06.md) | R1 | Open |
| COM-RUN-03 | P0 | Transport | “No writable relays connected” on community publish | [relay-transport-binding](../archive/program/inactive-2026-06/community-relay-transport-binding-spec-2026-06.md) | R4 | **Verified Pass** (2026-06-25 — COM-MEM-2 step 6; relay bootstrap + `dev:desktop:online`) |
| COM-RUN-04 | P1 | UX | Invite disabled when `roomKeyHex` empty (symptom of COM-RUN-02) | [membership-health](../archive/program/inactive-2026-06/community-membership-health-spec-2026-06.md) | R2 | **Mitigated** (2026-06-25 — health/coordination gates subtracted from chat/invite UI; room-key gate retained) |
| COM-RUN-05 | P1 | Membership | Partial join: member UI without atomic join contract | [atomic-join](../archive/program/inactive-2026-06/community-atomic-join-spec-2026-06.md) | R1 | Open |
| COM-RUN-06 | P1 | Detection | Failures surface days after “confirmed OK” — no convergence health | [membership-health](../archive/program/inactive-2026-06/community-membership-health-spec-2026-06.md) + [COM-MEM-2](../archive/program/inactive-2026-06/community-verification-com-mem-2-spec-2026-06.md) | R2, R6 | Open |
| COM-RUN-07 | P1 | Architecture | Six+ roster/membership owners; ACC-02 / MEM-001 | [roster-read-owner](../archive/program/inactive-2026-06/community-roster-read-owner-spec-2026-06.md) | R3 | Open (ACC-02 until COM-MEM-2 V) |
| COM-RUN-08 | P2 | Dev env | `DEV_COORDINATION_ONLY_WORKSPACE` masks full-stack failures | [dev-profiles](../archive/program/inactive-2026-06/community-dev-profiles-spec-2026-06.md) | R5 | Open |
| COM-RUN-09 | P2 | Build | Duplicate `authorEvidencePubkeys` in `group-management-dialog.tsx` broke static build | — | — | **Fixed** (2026-06-17) |
| COM-RUN-10 | P2 | Display | Stale directory repair via thin join-evidence only | [COM-MEM-2](../archive/program/inactive-2026-06/community-verification-com-mem-2-spec-2026-06.md) | R6 | Patch landed; verify or revert |
| COM-RUN-11 | P0 | Invite UX | Both profiles see inviter Cancel — no Accept; sidebar vs card role split | [role-ecosystem-design](./community-invite-role-ecosystem-design.md) | IRA | **Open** (2026-06-25) |

---

## COM-RUN-01 — Participant roster desynchronization

### Symptoms

- On **Tester 2**, **NewTest 2** participants modal / home “Active membership evidence” shows **only Tester 2** (“TE”).
- **Tester 1** absent from offline/online lists intermittently; sometimes appears as OFFLINE after reconcile, sometimes missing entirely.
- **Reconcile membership** does not reliably restore parity.

### Evidence

- Maintainer screenshots (2026-06): single-member chip on group home; participants modal with only one DIRECTORY/ONLINE row.
- Diagnostic event: `groups.page.participant_projection_state` (warn when visible count < stable roster).

### Technical analysis

Participant **display** for managed workspace uses coordination directory as authority when present:

- `resolveCommunityParticipantDisplayPubkeys` → coordination `activeMemberPubkeys` + repair seeds.
- Repair previously relied on `joinEvidenceMemberPubkeys` only (`group.memberPubkeys` + membership ledger).
- When coordination directory and join evidence both list **only the local member**, other members drop from UI despite monotonic roster session possibly still widening from message/known-participant evidence.

**Owners involved (read paths, not single writer):**

| Layer | Module / hook |
|-------|----------------|
| Coordination directory | `community-coordination-membership-directory-store`, `useCoordinationMembershipDirectory` |
| Display read model | `community-participant-display-read-model.ts` |
| Monotonic session | `useCommunityParticipantRosterReadModel`, `community-participant-roster-read-model.ts` |
| Join repair context | `managed-workspace-roster-repair-context.ts` |
| Page composition | `group-home-page-client.tsx`, `group-management-dialog.tsx` |
| Truth snapshot | `community-membership-truth.ts` (`readCommunityMembershipTruthSnapshot` repairs from ledger when directory thinner) |

**Gap:** Display path did not align with truth snapshot repair breadth; multiple surfaces still merge different pubkey sets.

### In-flight patch (unverified at runtime)

Extended stale-directory repair to union:

- `joinEvidenceMemberPubkeys`
- `knownParticipantPubkeys`
- `participationAuthorPubkeys` (message authors)

Files touched: `community-participant-display-read-model.ts`, `managed-workspace-roster-repair-context.ts`, `group-home-page-client.tsx`, `group-management-dialog.tsx`. Unit tests pass; **maintainer two-user soak not re-run**.

### Why patch alone is insufficient

Does not fix coordination directory missing peer, room key, or relay publish. Treat as **display-layer mitigation**, not membership truth fix.

---

## COM-RUN-02 — Room key missing after join

### Symptoms

- Toast / error: **“No room key found for this community on this device. Restore may be incomplete or key distribution has not arrived yet.”**
- **Invite** button greyed out (`disabled={!roomKeyHex}` in `group-home-page-client.tsx`).
- Sealed send (`GroupService.sendSealedMessage`) throws when `roomKeyStore.getRoomKey(groupId)` is empty.

### Technical analysis

Room keys are persisted on canonical paths:

| Path | When key is saved |
|------|-------------------|
| Create community | `global-dialog-manager.tsx`, `workspace-kernel-membership-port.ts` — `generateRoomKey` + `roomKeyStore.saveRoomKey` |
| Accept invite DM | `community-invite-card.tsx`, `incoming-dm-event-handler.ts` — key from invite payload |
| Invite redemption | Requires `roomKey` in invite payload before accept |

**Join paths that may not save room key:**

- Guest / open join via `requestJoinNip29` without invite DM payload.
- Reconcile / materialize group row from membership evidence without crypto step.
- Profile-scoped store mismatch (key saved under different profile scope).

**Logging:** `groups.room_key_missing_send_blocked` with `reasonCode` e.g. `target_room_key_missing_after_membership_joined`, `no_local_room_keys`.

### Product impact

Without room key: **no sealed chat**, **no invite**, **no sealed leave/vote gossip** — but UI may still show **Enter Community Chat** and member chrome.

---

## COM-RUN-03 — Writable relay not connected for community publish

### Symptoms

- **“Could not publish to community relays. No writable relays are connected. Check network settings and try again.”**
- Relay footer may show connected/optimized while community publish path still fails.

### Technical analysis

- Gate: `hasWritableCommunityRelayTransport(relayUrl)` in `community-relay-transport.ts`.
- `ws://localhost:7000` is writable **if** port is present and relay pool has an **enabled, connected** entry for that URL.
- Community publish uses pool + `prepareWorkspaceRelayForJoin` / activation transport — separate from sidebar relay indicator state.
- `assessWorkspaceCommunityTrust`: with `DEV_COORDINATION_ONLY_WORKSPACE`, create/join may **allow** without relay while chat publish still requires writable transport.

### Common failure modes

1. Group references `ws://localhost:7000` but relay not added/enabled in **Settings → Relays** for that profile.
2. Docker relay down or stack started without relay phase ready.
3. Coordination-only dev mode: membership tests pass, **chat transport never established**.

---

## COM-RUN-04 — Invite gated on room key (not membership alone)

### Behavior

Invite button disabled when `!roomKeyHex`, not when membership ledger alone says joined.

### Assessment

**Correct given sealed invite model** — but exposes COM-RUN-05: user sees member affordances while invite/chat prerequisites fail.

**Improvement direction (study):** Single “membership incomplete” banner listing missing: room key, relay, coordination row — not silent grey button.

---

## COM-RUN-05 — Partial join (split success criteria)

### Description

A profile can reach state where:

- `createdGroups` / group home treats user as **non-guest** (`!isGuest`).
- `groupState.membership.status === "member"` or active-member evidence exists.
- **But** room key absent and/or relay not writable and/or coordination directory lists only self.

### Root cause class

No **atomic join transaction**: success is decided per subsystem instead of all-or-nothing rollback.

**Canonical join should require (proposal for re-charter):**

1. Coordination delta applied (or explicit queued pending with UI).
2. `roomKeyStore.saveRoomKey` persisted.
3. Relay publish evidence for join/sealed events (or explicit failed + recovery actions).
4. Only then: member UI, invite, chat entry enabled.

---

## COM-RUN-06 — Delayed failure / low observability

### Description

Maintainer confirmed behavior “normal,” then days later:

- Participant desync.
- Room key / relay errors on send.
- Different behavior between Tester 1 and Tester 2 on same community name.

### Why detection is late

| Factor | Effect |
|--------|--------|
| No per-community health aggregate | Drift silent until user action |
| Discovery roster widen-only | Hides shrink/conflict in one layer |
| Dev escapes | Membership gates pass without chat stack |
| Multiple stores | Any layer can update independently on reconnect/refresh |
| Manual verify once | No continuous or CI two-profile soak on join→restart→chat |

### Logging hooks (for future study)

- `groups.page.participant_projection_state`
- `groups.room_key_missing_send_blocked`
- `workspace_kernel.membership.*` / `groups.community_creation_mode_selected`
- M8 capture: `membershipSendability`, `communityLifecycleConvergence` (dev-lab)

---

## COM-RUN-07 — Architectural: multi-owner membership (ACC-02)

### Status

**Pre-registered** in [unified-verification-issues-register.md](./unified-verification-issues-register.md) as **ACC-02** / MEM-001.

### Summary

Roster and membership truth fragmented across:

- Coordination materialization (Path B authority **by policy**)
- Monotonic participant roster session (widen-only OR-set)
- Known-participants localStorage OR-set
- Membership ledger
- Terminal membership cache
- Relay NIP-29 / 39002 hints
- Sealed-community CRDT (`use-sealed-community`)
- Page-local merges (`group-home-page-client`, `group-management-dialog`, `group-provider`)

**Park mode:** No new membership features; only invariant-preserving fixes ([community-membership-invariants.md](../archive/program/inactive-2026-06/community-membership-invariants.md)).

**Exit:** R2 single read owner ([v1.5.0-architecture-refactor-queue.md](../archive/program/inactive-2026-06/v1.5.0-architecture-refactor-queue.md)) — not yet shipped.

---

## COM-RUN-08 — Dev configuration masks production failures

### Config

`NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true` in `apps/pwa/.env.local`.

### Effect

- `assessWorkspaceCommunityTrust` may allow workspace create/join when coordination gate satisfied **without** writable Nostr relay.
- Copy in trust policy: membership directory tests work; **chat requires relay**.

### Risk

Maintainer and agents validate membership UI under config that **does not match** production Path B requirements (coordination + trusted relay + room key).

### Study note

Separate **membership dev profile** from **full-stack dev profile** in docs and scripts; label UI when coordination-only mode active.

---

## COM-RUN-09 — Build break: duplicate binding (fixed)

### Symptom

`pnpm dev:desktop:no-coord -- --rebuild` failed:

```text
group-management-dialog.tsx:347 — the name `authorEvidencePubkeys` is defined multiple times
```

### Cause

Roster read-model hook introduced second `authorEvidencePubkeys` alongside existing binding from `resolveActiveMemberPubkeysFromConversation`.

### Fix

Renamed hook output to `rosterAuthorEvidencePubkeys` in `group-management-dialog.tsx` (2026-06-17).

---

## COM-RUN-10 — Display repair patch (tests only)

### Change

Broadened coordination stale-directory repair seeds (see COM-RUN-01 in-flight patch).

### Tests

- `community-participant-display-read-model.test.ts` — repair from known participants, author evidence, loading fallback.
- `managed-workspace-roster-repair-context.test.ts` — known participants merged into join evidence.

### Not done

- Runtime two-user verification after patch.
- Coordination directory root cause if peer never registered.
- Invite/chat path verification.

---

## Symptom → layer map (troubleshooting)

```text
User symptom                    Likely primary layer
────────────────────────────────────────────────────────────
Only self in participants     Coordination directory + display repair seeds
Invite greyed out               room-key-store (COM-RUN-02)
No room key toast on send       room-key-store + join path
No writable relays on send      relay pool / Settings → Relays
Enter chat works, send fails    COM-RUN-02 and/or COM-RUN-03
Reconcile doesn't fix peers     coordination sync + join evidence upstream
Works Tuesday, broken Friday    COM-RUN-06 — silent drift, no health gate
```

---

## Verification gaps (program)

| Matrix / gate | Known gap |
|---------------|-----------|
| K3–K5 ([version-roadmap-scope.md](./version-roadmap-scope.md)) | Partial verify (◐); formal A/B optional |
| COM-8 / joiner repair scenario | Programmatic read-model tests; not full runtime join |
| `dev-lab-membership-join-leave.mjs` | Notes join/leave publish stubbed; coordination health only |
| ACC-02 | Architecture accepted; root not closed |
| Community invariants park | Further roster patches discouraged |

---

## Fork options for further study (no decision recorded)

From [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md):

| Path | Tradeoff |
|------|----------|
| **A — DM-only** | Stop community surface; shippable honest client |
| **B — Narrow workspace** | One join port + coordination mandatory; rebuild don’t patch |
| **C — Defer communities** | v2 exit = DM + desktop + storage; communities post-v2 |

---

## Recommended implementation sequence

1. **R0 review** — [community-relaunch-decision-2026-06.md](./community-relaunch-decision-2026-06.md) + [community-relaunch-master-spec-2026-06.md](../archive/program/inactive-2026-06/community-relaunch-master-spec-2026-06.md).
2. **R1→R4→R3→R6→R5** — per master spec phase table (atomic join → health → relay → roster → COM-MEM-2 → dev badge).
3. **COM-MEM-2 baseline** — purge NewTest 2; record first failing layer before/after each phase.
4. **Close register rows** — update Status column only on COM-MEM-2 step Pass for each issue.

---

## Code references (investigation)

| Topic | Path |
|-------|------|
| Display vs coordination | `apps/pwa/app/features/groups/services/community-participant-display-read-model.ts` |
| Roster session | `apps/pwa/app/features/groups/hooks/use-community-participant-roster-read-model.ts` |
| Join evidence seeds | `apps/pwa/app/features/groups/services/managed-workspace-roster-repair-context.ts` |
| Group home composition | `apps/pwa/app/groups/[...id]/group-home-page-client.tsx` |
| Room key on send | `apps/pwa/app/features/groups/services/group-service.ts` |
| Relay writable gate | `apps/pwa/app/features/groups/services/community-relay-transport.ts` |
| Trust / dev escape | `apps/pwa/app/features/groups/services/community-trust-policy.ts`, `community-dev-flags.ts` |
| Membership truth | `apps/pwa/app/features/groups/services/community-membership-truth.ts` |
| Purge script | `scripts/purge-workspace-communities.mjs` |

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Initial register from maintainer A/B NewTest 2 investigation and strategic pause discussion |
| 2026-06-17 | Path B relaunch specs linked; Spec/Phase columns; study sequence → implementation sequence |
