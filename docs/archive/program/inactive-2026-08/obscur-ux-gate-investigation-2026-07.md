# Obscur UX-gate & truth-owner investigation (2026-07)

**Status:** Active — investigation complete (static pass); remediation **not** authorized until maintainer picks charter slice  
**Last updated:** 2026-07-03 (UTC)  
**Scope:** `apps/pwa`, `apps/desktop` (Tauri shell → shared PWA), `packages/*` contracts  
**Method:** Repository-wide static analysis — **no CodaCtrl / no runtime soak** for this pass  
**Machine register:** [obscur-ux-gate-register.v1.json](./obscur-ux-gate-register.v1.json)  
**Related:** [community-membership-redesign-charter-2026-07.md](./community-membership-redesign-charter-2026-07.md) · [membership-graph-integration-study-2026-06.md](./membership-graph-integration-study-2026-06.md) · [codactrl-improvement-findings-2026-07.md](./codactrl-improvement-findings-2026-07.md)

---

## 1. Why this investigation

Maintainer feedback (2026-07-03): the room-key band is not an isolated bug — it exemplifies **grammatically correct modules that block users on local state that does not round-trip after recovery**. The codebase contains parallel readiness models, unwired guards, and terminal client states with no reset path.

This report is **designable and deterministic**: each finding has a typed pattern, severity, owner module, and recommended action class. It is **not** a mandate to patch everything — community feature work remains **PAUSED** except charter-driven redesign.

---

## 2. Methodology

| Step | Action | Output |
|------|--------|--------|
| 1 | Pattern grep across `apps/pwa` for `disabled=`, `*Present`, `blockers`, `terminal_failed`, `chatEnabled`, `ready` | Gate candidates |
| 2 | Trace truth owners for membership, crypto, projection (`groups/`, `workspace-kernel/`, `account-sync/`) | Owner-split map |
| 3 | Read `packages/dweb-core` community contracts vs app enforcement | Contract drift |
| 4 | Cross-check tracker + handoff for verified runtime contradictions | Evidence links |
| 5 | Emit JSON register + CodaCtrl capability spec (§10) | Tool iteration input |

**Out of scope this pass:** Rust/Tauri native gates (`apps/desktop/src-tauri`), live MCP capture, automated fix PRs.

**Note:** `apps/desktop` has no separate UI — all product gates live in the shared PWA bundle.

---

## 3. Taxonomy (pattern types)

| Pattern | Definition | User impact |
|---------|------------|-------------|
| **GATE** | Button/route/action disabled or hard-return based on **local** predicate | Cannot act despite network/membership evidence |
| **HEALTH_MISMATCH** | Readiness model (`ready`, `chatEnabled`, blockers) disagrees with another layer (UI, sidebar, compose) | Confusing partial function |
| **OWNER_SPLIT** | Same lifecycle concern has ≥2 writers/readers without single canonical merge | Divergent truth per profile/device |
| **TERMINAL_STATE** | Client persistence reaches terminal status with no maintainer/user reset | Feels irreversible |
| **UNWIRED_GUARD** | Guard/policy module exists and is tested but **not connected** to UI | Silent failure at action time instead of honest UX |
| **CONTRACT_DRIFT** | `packages/dweb-core` describes correct layering; apps violate it | Spec says one thing, runtime another |

---

## 4. Executive summary

### 4.1 Scale

| Severity | Count | Domains |
|----------|-------|---------|
| **P0** | 6 | Community join/invite, room key, trust gate pessimism |
| **P1** | 18 | Membership ledger, tombstones, sendability, projection, account-sync |
| **P2** | 14 | Relay tier gates, terminal invite/transport states, roster-derived disables |
| **P3** | 5 | Subtracted/dead wiring, diagnostic-only |

**Total registered findings:** 43 (see JSON register).

### 4.2 Root causes (systemic, not accidental)

1. **Local cache treated as authority** — profile-scoped `localStorage` (room keys, ledger, tombstones, coordination directory cache, invite relay join state) gates actions that network truth already satisfied.
2. **Partial subtraction** — policy layer disabled gates (`community-membership-ui-action-policy`) while consumers still gate (`invite-connections-dialog`, join port, invite card).
3. **Guards written but not wired** — `checkCommunitySendability` has full test coverage; **zero production imports** outside tests. Composer stays enabled; crypto throws at send.
4. **Health banner dead** — `CommunityMembershipHealthBanner` is **never imported**; blockers logged to telemetry only.
5. **Truth owner proliferation** — COM-RUN-07: six+ membership/roster paths; coordination directory, ledger, tombstones, kernel port, legacy provider, account-sync CRDT each participate.
6. **Contracts ahead of apps** — `dweb-core` separates `localCacheState` from `contentAvailabilityState` and outbox from membership intent; apps still collapse these into single “not ready” UX.

### 4.3 What is *not* broken (appropriate fail-closed)

Transport packages (`obscur-conduit-mesh`, `obscur-transport-engine`, `obscur-engine-host`) fail closed on **publish boundaries** — envelope validation, Tor policy, unsupported engine invoke. This matches product rules. **Do not subtract these.**

---

## 5. Finding register (by domain)

Full rows: [obscur-ux-gate-register.v1.json](./obscur-ux-gate-register.v1.json). Highlights below.

### 5.1 Community — crypto & room key (P0)

| ID | File | Pattern | Issue |
|----|------|---------|-------|
| UG-001 | `community-membership-health.ts` | HEALTH_MISMATCH | `chatEnabled` requires `roomKeyPresent` from local store |
| UG-002 | `workspace-kernel-membership-port.ts` | GATE | Join hard-fails `room_key_missing` when local store empty |
| UG-003 | `community-membership-join-transaction.ts` | GATE | `isManagedWorkspaceJoinSuccessful` requires `roomKeyPresent` |
| UG-004 | `community-invite-card.tsx` | GATE | `isInviteDefective` hides accept when local/invite key empty |
| UG-005 | `invite-connections-dialog.tsx` | GATE | Send disabled when `roomKeyHex` empty (contradicts UI policy subtraction) |
| UG-006 | `room-key-store.ts` | OWNER_SPLIT | Profile localStorage is de facto authority for Layer 2 crypto |

**Maintainer status:** COM-RUN-02 **CANCELLED** — redesign charter required before new crypto owner.

### 5.2 Community — trust & coordination (P0–P1)

| ID | File | Pattern | Issue |
|----|------|---------|-------|
| UG-010 | `use-workspace-community-trust-gate.ts` | GATE | `coordinationHealthy ?? false` — probe pending treated as unhealthy; buttons start blocked |
| UG-011 | `group-home-page-client.tsx` | GATE | Guest join `disabled={guestJoinBlocked}` inherits pessimism |
| UG-012 | `group-join-dialog.tsx` | GATE | Same trust gate on join button |
| UG-013 | `community-coordination-membership-directory-store.ts` | OWNER_SPLIT | Directory cached in localStorage; health reads stale copy |

### 5.3 Community — send path split (P1)

| ID | File | Pattern | Issue |
|----|------|---------|-------|
| UG-020 | `community-sendability-guard.ts` | UNWIRED_GUARD | Full sendability model; **not imported by composer or group thread** |
| UG-021 | `group-service.ts` | GATE | `sendSealedMessage` throws on missing local room key at action time |
| UG-022 | `community-membership-ui-action-policy.ts` | CONTRACT_DRIFT | Policy says never disable chat/invite; send path still fails closed |

Tracker evidence: round6–9 documented sidebar warning vs compose enabled vs health `ready:1`.

### 5.4 Membership truth & roster (P1 — COM-RUN-07)

| ID | File | Pattern | Issue |
|----|------|---------|-------|
| UG-030 | `community-membership-truth.ts` | OWNER_SPLIT | Declared single owner; falls back to ledger when directory stale |
| UG-031 | `workspace-kernel-list-port.ts` | OWNER_SPLIT | Sidebar filters tombstones + terminal ledger, not coordination |
| UG-032 | `workspace-kernel-roster-port.ts` | OWNER_SPLIT | Roster reads truth snapshot; list-port uses different inputs |
| UG-033 | `group-provider-legacy.tsx` | OWNER_SPLIT | Parallel legacy path when kernel authority off |
| UG-034 | `group-tombstone-store.ts` | GATE | Local tombstone hides group despite coordination membership |
| UG-035 | `community-membership-leave-intent.ts` | GATE | Durable leave intent suppresses rejoin while directory may still list active |

### 5.5 Client irreversibility (P1–P2)

| ID | File | Pattern | Issue |
|----|------|---------|-------|
| UG-040 | `community-membership-ledger.ts` | TERMINAL_STATE | Invalid entries logged but **still persisted** (RIW-1: 7/7 invalid) |
| UG-041 | `community-invite-relay-join.ts` | TERMINAL_STATE | `terminal_failed` in localStorage after max retries; no auto-clear on relay success |
| UG-042 | `community-invite-lifecycle.ts` | TERMINAL_STATE | `superseded` / `expired` → non-actionable; COM-RUN-11 blocked |
| UG-043 | `request-transport-service.ts` | TERMINAL_STATE | Connection request `terminal_failed` in local queue |

### 5.6 Messaging & social (P1–P2)

| ID | File | Pattern | Issue |
|----|------|---------|-------|
| UG-050 | `composer.tsx` | GATE | `disableCompose` when peer not accepted locally |
| UG-051 | `main-shell.tsx` | GATE | `resolvePeerEstablishedForUi` from local trust, not relay |
| UG-052 | `use-account-projection-runtime.ts` | OWNER_SPLIT | Projection vs SQLite count split (RIW-2 verified) |

### 5.7 Packages — contract layer (reference)

| ID | Package | Pattern | Notes |
|----|---------|---------|-------|
| UG-060 | `dweb-core/community-runtime-contracts.ts` | CONTRACT | `blocked_room_key_missing` — correct for **send** if scoped |
| UG-061 | `dweb-core/community-projection-contracts.ts` | CONTRACT | `localCacheState` ⊥ `contentAvailabilityState` — apps should follow |
| UG-062 | `dweb-core/community-runtime-contracts.ts` | CONTRACT | Outbox vs `SelfMembershipIntent` — transport must not rollback local intent |

---

## 6. Contradiction inventory

These are **internal inconsistencies** — multiple modules disagree on the same user question.

| User question | Module A says | Module B says | Evidence |
|---------------|---------------|---------------|----------|
| Can I open Invite? | `ui-action-policy`: always enabled | `invite-connections-dialog`: send disabled without key | Static + maintainer screenshot |
| Can I enter chat? | `ui-action-policy`: not disabled | `membership-health`: `chatEnabled: false` | Telemetry `membership_health_snapshot` |
| Can I send group message? | Composer: enabled | `group-service`: throws `no room key` | Tracker O-4 partial |
| Am I ready? | Info health: `ready:1` | Sidebar: group key warning | Tracker round6–9 |
| Who owns roster? | `membership-truth`: coordination | `list-port`: tombstone + ledger | COM-RUN-01 / COM-RUN-07 |
| Is sendability modeled? | `sendability-guard` tests pass | Production: unwired | Grep: tests only |

---

## 7. Irreversibility — why problems feel permanent

| Mechanism | Storage | Recovery path today | Gap |
|-----------|---------|---------------------|-----|
| Invalid membership ledger | profile localStorage | Manual dev-tools / wipe | No user-facing repair; validator rejects load |
| Missing room key | profile localStorage | Cancelled restore band | Redesign only |
| Invite relay join terminal | profile localStorage | Manual localStorage edit | No UI reset |
| Superseded invite cards | DM thread + ledger | New invite from sender | COM-RUN-11 fixture blocked |
| Group tombstone | profile localStorage | None in UI | Hidden from lists permanently |
| EBWebView wipe | destroys keys, keeps bad metadata | Re-import backup | Worst case: joined + invalid ledger + no keys |

---

## 8. Remediation framework (non-dogmatic)

Maintainer picks **one band at a time**. Order is a recommendation, not a rule.

### Phase A — Subtraction (no new owners)

Remove or neutralize **GATE** rows where predicate is local cache only:

- UG-005 invite dialog send disable
- UG-004 invite defective accept hide (show honest error at action time)
- UG-010 trust gate null → unknown (not false)

### Phase B — Wire or delete UNWIRED_GUARD

- Either connect `checkCommunitySendability` → composer **or** delete guard and document send-time-only failure
- Import or delete `CommunityMembershipHealthBanner`

### Phase C — Charter slice (community crypto)

Per [community-membership-redesign-charter-2026-07.md](./community-membership-redesign-charter-2026-07.md) directions A–D — **design spec before code**.

### Phase D — Owner consolidation (COM-RUN-07)

Single roster **read** projection; coordination authoritative for managed_workspace; ledger for intent only; tombstones scoped to explicit user hide.

### Phase E — Terminal state reset paths

User-visible “retry” that clears `terminal_failed` / invalid ledger rows when network evidence contradicts local terminal state.

---

## 9. Verification proof (when remediation starts)

| Layer | Command / evidence |
|-------|-------------------|
| L1 | Unit tests for each subtracted gate + sendability wiring |
| L2 | `pnpm verify:engine-lab` · `pnpm docs:check` |
| L3 | Desktop: wipe → re-import → NewTest 2 invite + chat + send |
| L4 | COM-MEM-2 graph walk with worksheet |

---

## 10. CodaCtrl capability spec (future tooling)

This investigation was done **without CodaCtrl** because the task is **static architecture audit**, not runtime capture. The register below defines **deterministic, customizable rules** CodaCtrl could implement in a future lane.

### 10.1 Design goals

| Goal | Meaning |
|------|---------|
| **Designable** | Each rule has explicit pattern type, severity, and owner path prefix |
| **Deterministic** | Same repo snapshot → same register rows (CI-friendly) |
| **Customizable** | Per-app rule packs (`obscur-community-v1`, `obscur-messaging-v1`) toggled in config |
| **Non-dogmatic** | Rules **report** contradictions; they do not auto-fail CI unless maintainer enables gate |

### 10.2 Proposed CodaCtrl lane: `verify:ux-gate-audit`

```text
Input:  repo root + rule pack JSON
Output: ux-gate-register.json + summary.md
Mode:   static (ripgrep/AST); optional CDP overlay for HEALTH_MISMATCH
```

### 10.3 Rule catalog v0.1

| Rule ID | Detector | Example signal |
|---------|----------|----------------|
| `RG-GATE-DISABLED-LOCAL` | `disabled={*roomKey*}` \| `*Present*` \| `*blocker*` | UG-005 |
| `RG-GATE-HARD-RETURN` | `if (!*Present) return` / `toast.error` before network call | UG-002 |
| `RG-UNWIRED-EXPORT` | exported function with tests but zero non-test imports | UG-020 |
| `RG-DEAD-COMPONENT` | exported React component never imported | UG health banner |
| `RG-POLICY-CONSUMER-DRIFT` | policy returns constant; consumer still branches on same input | UG-022 |
| `RG-TERMINAL-LOCALSTORAGE` | write `terminal_failed` / `superseded` without TTL/reset API | UG-041 |
| `RG-OWNER-SPLIT` | config: ≥2 modules in owner group touch same storage key prefix | UG-030–035 |
| `RT-HEALTH-UI-SPLIT` | digest: `membership_health_snapshot.ready=1` while UI snapshot shows disabled control | Tracker round6 |
| `RT-BLOCKER-MAP` | map `blockers` string → symptom registry row | RIW-8 backlog |

### 10.4 Register schema

See [obscur-ux-gate-register.v1.json](./obscur-ux-gate-register.v1.json):

```json
{
  "schemaVersion": "1.0",
  "findings": [{
    "id": "UG-001",
    "pattern": "HEALTH_MISMATCH",
    "severity": "p0",
    "domain": "community",
    "file": "apps/pwa/app/features/groups/services/community-membership-health.ts",
    "symbols": ["resolveCommunityMembershipHealth", "roomKeyPresent"],
    "actionClass": "subtract_or_redesign",
    "trackerRef": "COM-RUN-02",
    "status": "cancelled_band"
  }]
}
```

### 10.5 Integration with existing CodaCtrl primitives

| Existing | Extension |
|----------|-----------|
| `issues-register.json` | Import UG-* rows as architecture findings (severity p1, not runtime p0) |
| `signalsExtract` (RIW-8) | Add static rule hits as `source: "ux-gate-audit"` |
| `client_runtime_digest_pull` | Cross-check RT-* rules against captured telemetry |
| `report-rollup.md` | New section: **Architecture contradictions** (count by pattern) |

### 10.6 Customization knobs (`.codactrl/config.json` future)

```json
{
  "uxGateAudit": {
    "enabled": true,
    "rulePacks": ["obscur-community-v1", "obscur-messaging-v1"],
    "failCiOn": ["p0"],
    "ignoreIds": ["UG-060"],
    "ownerGroups": {
      "membership": ["community-membership-*", "workspace-kernel-membership-*"]
    }
  }
}
```

---

## 11. References

- [obscur-runtime-issue-tracker-2026-07.md](./obscur-runtime-issue-tracker-2026-07.md)
- [community-membership-redesign-charter-2026-07.md](./community-membership-redesign-charter-2026-07.md)
- [runtime-issue-investigation-workflows-2026-06.md](./runtime-issue-investigation-workflows-2026-06.md)
- [modular-iteration-contract.md](./modular-iteration-contract.md)
- `rules/01-operating-principles.md` — one owner; local ≠ network truth

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-03 | Initial repository-wide static investigation + JSON register + CodaCtrl spec §10 |
