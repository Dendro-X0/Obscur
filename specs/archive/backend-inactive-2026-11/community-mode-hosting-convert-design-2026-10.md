# Design — CU-UX-6 Mode & hosting convert

**Date (UTC):** 2026-10-21  
**Status:** Implemented (L1) — 2026-10-21  
**Investigation:** [community-mode-hosting-convert-investigation-2026-10.md](./community-mode-hosting-convert-investigation-2026-10.md)  
**Depends on:** CU-UX-5 (public Quiet honesty) · CU-UX-4 (stewards)

---

## 1. Goals

1. Stewards/admins can convert an existing community **T0 ↔ T1** without recreating.
2. Stewards/admins can change **hosting host** (public Quiet / custom / private operator) with the same honesty rules as create.
3. Persist `communityMode` + `hostingTier` (+ `relayUrl` / capability tier) via existing descriptor `updateMetadata` path.
4. On T0→T1, steward role surface becomes available (seed actor as steward if none).
5. On T1→T0, steward mutations disable; keep `stewardPubkeys` in metadata for possible re-promote (do not wipe history) but UI treats roles as inactive.

---

## 2. Locked policy

| Action | Who | Gate |
|--------|-----|------|
| T0 → T1 | Steward/admin (creator if solo) | Coordination gate satisfied · writable host · if public Quiet → honesty ack |
| T1 → T0 | Steward/admin | Honesty ack: lose directory / delete-for-all claims · coordination membership optional after |
| Change host (any mode) | Steward/admin | Writable transport · T1 still needs coordination · public Quiet → honesty ack (CU-UX-5) |
| Custom RBAC / Spaces rooms | — | **Out of scope** (SF-B / later) |

### Hosting tier remap (reuse create helper)

| Selected host | `hostingTier` |
|---------------|---------------|
| Public Quiet | `public_quiet` |
| Private/intranet operator | `operator` (when mode is T1) or `custom` (when T0) |
| Other writable custom | `custom` |

Use `resolveHostingTierForCreate` (or rename to `resolveHostingTierForMutation`) so create and convert stay one owner.

### Roles (this slice)

- **Configurable roles** = existing steward promote/demote (CU-UX-4), visible only when `communityMode === "managed_workspace"`.
- T0→T1: if `stewardPubkeys` empty, seed converting actor.
- No new role types (moderator matrix, custom permissions) in CU-UX-6.

---

## 3. Code changes

| Area | Change |
|------|--------|
| `community-mode-convert-policy.ts` (new) | `assessCommunityModeConvert` · `assessCommunityHostingConvert` — allow/deny + reason + `requiresHonestyAck` |
| `group-management-dialog` / General (or Relay) panel | **Change mode** cards · **Change hosting** host picker (reuse create catalog helpers) · ack checkbox · Save |
| `updateMetadata` payload | Allow writing new `communityMode`, `hostingTier`, `relayUrl`, `relayCapabilityTier` when policy allows |
| Conversation/local cache | Provider merge must pick up new mode/host after save (existing upsert path) |
| i18n | `groups.manage.convert.*` honesty strings |
| Charter / handoff | Mark CU-UX-6 when L1 Pass |

---

## 4. UI sketch (one composition)

Manage → General (or dedicated “Mode & hosting” section under General):

```text
Mode:  [ Interest / Quick ]  [ Team workspace ]
Host:  [ catalog / host field ]   ← same Quiet honesty as create when public
[ ] I understand … (when required)
[ Apply changes ]
```

Show rose block only for hard deny (coordination down, unwritable host). Public Quiet = amber honesty, not hard-block.

---

## 5. Proof (L1)

- T0→T1 private + coordination healthy → allowed; seeds steward
- T0→T1 public Quiet → requires ack; after ack allowed
- T1→T0 → requires demote honesty ack; mode becomes sovereign
- Host change Quiet→private updates `hostingTier`
- Non-admin cannot convert
- Stewards UI appears only after T1

---

## 6. Out of scope

- SF-B Spaces / multi-room switching  
- Message history migration / dual-publish to old+new relays  
- Softening T1 coordination requirement  
- Claiming delete-for-all on public Team after convert  
- Custom role schemas beyond steward/member  

---

## 7. Flow

```text
Admin opens Manage
  → Change mode and/or host
  → Policy assess (reuse trust + managed gate + CU-UX-5 honesty)
  → Ack if required
  → updateMetadata({ communityMode, hostingTier, relayUrl, … })
  → UI: badge + steward tools refresh from metadata
```

---

_Last updated: 2026-10-21_
