# Community membership health specification (2026-06)

**Status:** R2 implementation spec  
**Phase:** R2 — [community-relaunch-master-spec-2026-06.md](./community-relaunch-master-spec-2026-06.md)  
**Resolves:** COM-RUN-04, COM-RUN-06

---

## 1. Problem

Failures appear **days after** a one-time manual check because no aggregate answers: “Can this profile use this community (chat, invite, roster truth)?”

Individual gates (`disabled={!roomKeyHex}`, send-time throw) hide drift until action time (COM-RUN-06).

---

## 2. Target read model

**Single owner:** `resolveCommunityMembershipHealth` in new module:

`apps/pwa/app/features/groups/services/community-membership-health.ts`

No page-local merges. UI and gates **read only** this snapshot.

### Type contract

```typescript
export type CommunityMembershipHealthBlocker =
  | "room_key_missing"
  | "coordination_stale"
  | "coordination_missing_peer"
  | "relay_not_writable"
  | "relay_not_connected"
  | "activation_pending";

export type CommunityMembershipHealthRecoveryAction =
  | "invite_redemption"
  | "reconcile"
  | "configure_relays"
  | "retry_join";

export type CommunityMembershipHealth = Readonly<{
  ready: boolean;
  blockers: ReadonlyArray<CommunityMembershipHealthBlocker>;
  recoveryActions: ReadonlyArray<CommunityMembershipHealthRecoveryAction>;
  /** Dev-only: coordination-only mode without chat */
  chatEnabled: boolean;
}>;
```

### Input parameters

| Field | Source |
|-------|--------|
| `groupId`, `relayUrl`, `communityId` | Group conversation |
| `localMemberPubkey` | Identity |
| `coordinationDirectory` | `loadCoordinationMembershipDirectory` |
| `roomKeyPresent` | `roomKeyStore.getRoomKey` |
| `relayTransportReady` | `hasWritableCommunityRelayTransport` + pool connection |
| `activationPending` | Pending workspace activation store |
| `devCoordinationOnly` | `isCoordinationOnlyWorkspaceDevMode()` |

### `ready` computation

`ready === true` when:

- Room key present
- Coordination sync not `stale` / unconfigured (when workspace mode)
- Relay writable **and** connected (full-stack profile), **or** `devCoordinationOnly && !chatEnabled` with explicit copy
- No blocking `activation_pending` without recovery path

---

## 3. UI rules

| Surface | Gate |
|---------|------|
| Invite | `health.ready && health.chatEnabled` |
| Enter community chat | same |
| Manage (operator) | `health.ready` (may allow reconcile when not chat-ready) |
| Group home hero | Banner listing `blockers` + `recoveryActions` when `!ready` |

Replace silent `disabled={!roomKeyHex}` with health-driven disable + **visible reason** (COM-RUN-04).

Copy keys (i18n): `groups.membershipHealth.*` — blockers map to user-facing strings.

---

## 4. Drift detection (COM-RUN-06)

Recompute health when any of:

- Coordination directory changed event
- Relay pool connection status changed
- Room key store updated for `groupId`
- Membership ledger updated
- Reconcile membership completes

Log on every recompute (sampled on mount + material change):

```typescript
logAppEvent({
  name: "groups.membership_health_snapshot",
  level: health.ready ? "info" : "warn",
  context: { blockers: health.blockers.join(","), ready: health.ready ? 1 : 0, ... },
});
```

Dev-lab digest: feed `membershipSendability` / `communityLifecycleConvergence` from this snapshot.

---

## 5. Deliverables (R2)

| ID | Deliverable |
|----|-------------|
| H-1 | `community-membership-health.ts` + unit tests |
| H-2 | `useCommunityMembershipHealth` hook (thin wrapper) |
| H-3 | Group home banner component |
| H-4 | Wire invite/chat/manage gates to `health` |
| H-5 | Event `groups.membership_health_snapshot` |

---

## 6. Acceptance

- [ ] NewTest 2 joiner shows banner with blockers before fix; clear after R1+R4
- [ ] No member-only UI without banner when `!ready`
- [ ] Health recomputes after reconcile without page reload

---

## 7. Verification

```bash
pnpm -C apps/pwa exec vitest run app/features/groups/services/community-membership-health.test.ts
```

Runtime: COM-MEM-2 step 5; M8 digest gates on both profiles.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Initial membership health spec |
