# COM-RUN-02 — membership health vs sidebar label investigation

- Status: **Open** (2026-07-02)
- Trigger: CodaCtrl verification rounds 4–9 (NewTest 2 · Tester1 · full stack)
- Tracker: [obscur-runtime-issue-tracker-2026-07.md](../../docs/program/obscur-runtime-issue-tracker-2026-07.md) §Step 7
- Symptom IDs: `group-room-key-missing` · product register **COM-RUN-02**

## Symptom (runtime evidence)

| Surface | Observed (rounds 6–9) | Send / chat |
|---------|------------------------|-------------|
| Sidebar preview | **Group key unavailable on this device** (constant) | Misleading when send works |
| `groups.membership_health_snapshot` | Transient `room_key_missing` → **`ready:1`, `chatEnabled:1`** after community home / Info visit | Authoritative for Enter Chat / health banner |
| Group thread compose | Send **disabled** until text entered; then **publishGroupEvent** to `ws://localhost:7000` succeeds | Works with full stack (round6–8) |
| Community home relay card | **Connected & optimized** | Aligns with health after cascade |

**Key contradiction:** Health telemetry reaches `ready:1` and local send publishes, while sidebar continues to show ledger placeholder text.

## Root cause class: parallel read models (not one owner)

### 1. Sidebar — ledger placeholder owner

Sidebar group row `lastMessage` is set from membership ledger synthesis when the row is ledger-only / unresolved:

- `LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE` in `community-membership-ledger.ts`
- Constant: `"Group key unavailable on this device"`
- Used when building `GroupConversation` from ledger without a hydrated thread preview

This path does **not** read `useCommunityMembershipHealth` or `roomKeyStore` at preview refresh time.

### 2. Health — `community-membership-health` owner

`groups.membership_health_snapshot` resolves blockers (`room_key_missing`, `relay_not_connected`, …) and emits `ready` / `chatEnabled`.

Observed cascade (round9 `cap-3111586f0844`):

1. `warn`: `ready:0`, `chatEnabled:0`, `blockers=room_key_missing`
2. `info` (~50ms later): `ready:1`, `chatEnabled:1`, `blockers=""`

Trigger: opening community home (`/groups/view`) after warm session — coordination + relay evidence reconciles.

### 3. Send gate — thread / workspace-kernel owner

Group thread send uses room key + relay transport evidence distinct from sidebar preview string. Round8 proved cold-start send without visiting Info when Docker `:7000` + coordination are up.

### 4. Backup merge vs runtime health

Backup restore logs show `mergedRoomKeyCount: 1`, `appliedRoomKeyCount: 1`, yet initial health snapshot still reports `room_key_missing` until reconcile on community home. Suggests **health resolver** and **ledger preview** use different key lookup scopes (`groupId` vs `communityId` / conversation id).

## Coordination HTTP paths (round9 probe)

Community: `v2_c32217ec6a10145ff4bb1109b78b73923f2f226ceb7c5f85afac773b0d2cf84f`

| Method | Path | HTTP | Notes |
|--------|------|------|-------|
| GET | `/communities/{id}/membership/deltas?since=0` | **200** | Correct poll path (`fetchCoordinationMembershipDeltasSince`) |
| GET | `/communities/{id}/membership/head` | **200** | Head available |
| GET | `/communities/{id}/membership/delta` | **404** | Singular path is **POST-only** for publish |
| POST | `/communities/{id}/membership/delta` | **400** | Expected without signed body |

Client code is consistent: **POST** publish uses singular `/membership/delta`; **GET** poll uses plural `/membership/deltas`.

Round4 browser **403** on GET singular path is a **misrouted or authenticated probe**, not the primary deltas poll. Investigation should capture Network tab for the failing request URL (localhost vs 127.0.0.1, community id encoding).

Artifact: `.codectx/verify/artifacts/com-run-02-membership-path-probe-2026-07-02.txt`

## Ledger fixture coupling (RIW-1)

NewTest 2 ledger entry `b93f53e2…` remains in **18/20 invalid** band (missing `publicKeyHex`). Sidebar placeholder may be a **symptom of ledger migration stall**, not missing crypto material — send succeeds because workspace-kernel / room key store has material under `communityId`.

## Canonical question (must be answered once)

> When should the UI show “group key unavailable” for a managed workspace community?

Today:

- Sidebar answers from **ledger placeholder** (static string).
- Health banner answers from **membership health resolver**.
- Send answers from **thread transport + key store**.

Required: one **CommunityMaterializationReadModel** (or explicit subscription) so sidebar preview, health, and send gate derive from the same `(communityId, groupId, roomKeyPresent, relayWritable)` snapshot.

## Subtraction plan (implementation — out of scope for verify pass)

1. **Remove** sidebar dependence on `LEDGER_ONLY_GROUP_PLACEHOLDER_MESSAGE` for communities with active workspace-kernel conversation rows.
2. **Subscribe** sidebar preview to last thread message OR health summary — not ledger-only synthesis.
3. **Align** health initial read with post-restore room key evidence (avoid transient false `room_key_missing` when `mergedRoomKeyCount: 1`).
4. **Do not** patch send gate from sidebar text; fix owners above.

## Proof plan (L1–L4)

| Layer | Command / method | Pass |
|-------|------------------|------|
| L2 | Contract: sidebar preview source for workspace-kernel communities | No ledger placeholder when `roomKeyStore` hit |
| L3 | MCP: Info visit → health `ready:1` → return to chats → sidebar text | Preview ≠ placeholder |
| L4 | Cold start + full stack (round8 protocol) | Send works; sidebar accurate |

## Evidence index (CodaCtrl)

| Round | Register / capture |
|-------|-------------------|
| round4 | `verify:issue:agent:43cde0c4b744b301` · `n4-room-key-health-snapshot` |
| round6 | `verify:issue:agent:5c5e1b25c17e9dca` · sidebar stale after ready |
| round8 | `verify:issue:agent:f21d04768c6b0594` · cold-start send without Info |
| round9 | `verify:issue:agent:*` (this pass) · health ready + sidebar stale repro |

Session: `csess-87ec64010847` · captures `cap-3111586f0844`, `cap-77153b4f0307`, `cap-29d052b53b74`

## Does not prove

- Tester2 joiner room-key path
- Invite redemption success
- Coordination POST failure root cause (403 vs 404 vs auth)
- O-4 ingest on second profile
