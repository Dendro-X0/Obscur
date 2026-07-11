# Group invite send — infinite loading investigation (2026-07-10)

**Symptom:** Invite Connections → select trusted connection → **Send Invites** spinner never stops; invitee never receives invite.

**Reporter context:** Managed workspace demo stack — Docker relay `ws://localhost:7000`, coordination on `:8787`, desktop `pnpm dev:desktop:no-coord -- --rebuild`.

---

## Canonical send path

| Step | Owner | Notes |
|------|-------|-------|
| 1 | `ensureRoomKeyHexForInviteDistribution` | hint → local store → coordination resolve → generate |
| 2 | `publishStewardCoordinationRoomKeyWrapsForInvitees` | Best-effort coordination escrow per invitee |
| 3 | `GroupService.distributeRoomKey` | NIP-17 gift-wrap rumor (kind 1059) |
| 4 | `publishDmNostrEvent` | Relay publish |
| 5 | `commitOutboundCommunityDmInvite` | SQLite + bus + ledger |

UI: `apps/pwa/app/features/groups/components/invite-connections-dialog.tsx`

---

## Runtime evidence (2026-07-10)

### Coordination (terminal wrangler log)

During Send Invites:

```
GET  .../membership/room-key-wraps     200 OK (486ms)
POST .../membership/room-key-wrap      403 Forbidden (582ms)
```

**403 root cause:** `evaluateRoomKeyWrapAcl` requires invitee to be **active** in membership materialization. Pre-join invitees are not active → `wrap_subject_not_active`.

This matches handoff note (C5): *"Steward wrap requires invitee active in coordination; pre-join invites still rely on DM + C2b self-wrap"* and slice-C spec ACL table (steward → active members only).

**Impact:** Coordination escrow path fails for new invitees. **Expected** until a pre-join escrow ACL slice lands. Not the spinner root cause (handler returns without throwing).

### Nostr relay (Docker `localhost:7000`)

No kind **1059** (gift-wrap) or DM invite event persisted during the attempt window. Only kind 30315 / 10105 (community chat) from steward profile.

**Impact:** Primary delivery path (DM gift-wrap) did not complete publish to workspace relay.

---

## Root causes

### RC-1 — DM publish scoped to wrong relay set (delivery)

`publishDmNostrEvent(relayPool, enabledRelayUrls, giftWrapEvent)` uses **DM transport relays** only (`resolveDmTransportRelayUrls`).

Managed workspace relay `ws://localhost:7000` is classified **community_candidate** (private/intranet) and is **excluded** from default DM scope unless experiment-online fallback merges it.

Invite flow computes `scopedRelayUrl` from `group.relayUrl` for payload metadata but **does not pass it to publish**. Invites never target the workspace relay the invitee needs.

**Owner:** `publish-dm-nostr-event.ts` + invite dialog callers.

### RC-2 — Native invoke fallback can hang without timeout (spinner)

`NativeCryptoService.invokeWithTimeout` falls back to raw `invoke()` when envelope returns `"Version not found in payload"`. That fallback has **no timeout**.

If `encrypt_gift_wrap` hits this path and native never resolves, `handleSendInvites` awaits forever → infinite spinner, no error toast (catch never runs).

**Owner:** `apps/pwa/app/features/crypto/native-crypto-service.ts`

### RC-3 — Coordination steward wrap 403 (delivery, secondary)

Pre-join invitees cannot receive coordination escrow wraps under current ACL. Documented limitation; DM path must succeed.

### RC-4 — `commitOutboundCommunityDmInvite` blocks on account projection replay (spinner)

After gift-wrap publish succeeds, `commitOutboundCommunityDmInvite` **awaited** `appendCanonicalDmEvent` → `queueReplay` → full account projection replay + `ensureLocalDmVisibilityReady`. Normal DM sends use **fire-and-forget** (`void appendCanonicalDmEvent`) in `dm-controller:v2`.

**Evidence (2026-07-10 retry):** Relay logged kind **1059** persisted (`e50af88e`) while UI spinner remained — hang is post-publish in commit path, not encrypt/relay.

**Owner:** `community-dm-invite-pipeline.ts` · `message-persistence-service.flushPendingNow` (early return when `isFlushing` caused race with duplicate sqlite write).

---

## Fix plan (this slice)

| ID | Change | Proof |
|----|--------|-------|
| F1 | Merge group `relayUrl` into invite DM publish URL list (deduped) | `publish-dm-nostr-event.test.ts` |
| F2 | Apply timeout to native invoke compatibility fallback | `native-crypto-service.test.ts` |
| F3 | Wire F1 in invite-connections / invite-member / network-profile invite paths | existing dialog tests + manual L3 |
| F4 | Stop awaiting `appendCanonicalDmEvent` on invite commit; fix `flushPendingNow` to await in-flight flush | `community-dm-invite-commit.test.ts` |

**Out of scope:** Coordination ACL pre-join escrow (new slice); COM-RUN-11 L4 matrix.

---

## L3 manual repro (maintainer)

1. `pnpm dev:coordination` · `pnpm dev:relay:docker` · `pnpm dev:desktop:no-coord -- --rebuild`
2. Tester1 creates managed workspace community on `ws://localhost:7000`
3. Invite Connections → Tester2 → Send Invites
4. Expect: spinner clears ≤20s; relay log shows gift-wrap persist; Tester2 DM thread shows invite card

**Proof commands (L1):**

```bash
pnpm vitest run apps/pwa/app/features/messaging/services/publish-dm-nostr-event.test.ts
pnpm vitest run apps/pwa/app/features/crypto/native-crypto-service.test.ts
pnpm vitest run apps/pwa/app/features/groups/components/invite-connections-dialog.test.tsx
```
