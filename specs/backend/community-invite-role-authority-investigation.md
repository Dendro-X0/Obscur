# Community invite role authority — investigation

- Status: **Open** (2026-06-25)
- Trigger: Manual test — User A sends invite; User B sees **Cancel** (inviter UI) instead of **Accept**. Sidebar preview shows correct direction; thread card does not.
- User constraint: **No patch loop** — requires canonical role ecosystem before further UI fixes.

## Symptom (runtime evidence)

| Surface | Tester1 (recipient in test) | Tester2 (sender in test) |
|---------|----------------------------|---------------------------|
| Sidebar preview | "Tester2 sent you an invitation" (incoming) | "Tester1 invited you to NewTest 2" (incoming) |
| Thread invite card | `INVITATION SENT` · **YOU** · **Cancel** (outgoing) | `INVITATION SENT` · **YOU** · **Cancel** (outgoing) |

Both profiles render the **inviter** affordance. Permissions are not profile-specific — they collapse to a single outgoing role.

## Root cause class: split-brain role authority

Invite card actions (`Accept` / `Decline` / `Cancel`) are gated on **`message.isOutgoing`** passed from the message list:

```tsx
// apps/pwa/app/features/messaging/components/message-list.tsx
<CommunityInviteCard
  isOutgoing={message.isOutgoing}
  ...
/>
```

`isOutgoing` is a **transport convenience flag** (bubble alignment / sqlite `is_outgoing`). It is **not** a stable authorization primitive. At least **five parallel paths** write or rewrite it:

| Owner | What it does | Role impact |
|-------|----------------|-------------|
| SQLite persist (`persistInviteToNativeSqlite`) | Stores `is_outgoing` at write time | Wrong slot / wrong ingest → wrong flag forever |
| DM normalize (`normalizeDmConversationMessageRow`) | Spreads persisted `isOutgoing`; infers sender from flag | Reinforces bad flag |
| Invite ledger synthetic merge (`buildSyntheticOutboundInviteMessages`) | Injects **new outgoing** invite rows from ledger `direction: "outbound"` | Recipient can see fabricated outgoing invite |
| Sender pubkey patch (`normalizeCommunityInviteThreadSenderPubkeys`) | On `isOutgoing && !senderPubkey`, sets sender = local account | Makes wrong outgoing rows look locally sent |
| Thread augment (`augmentCommunityDmInviteThreadMessages`) | Dedupe + synthetic + filter misdirected responses | Display-time band-aid; not authoritative |

Sidebar preview uses a **different** path (`formatConversationMessagePreview` + conversation row context) — hence **list correct, thread wrong**.

## Why patches fail (feasibility)

Recent patch band (dedupe, misdirect filter, ledger-only accept, dm-kernel augment hook) treats **symptoms in the augment layer**. Invariants remain broken:

1. **No single resolver** maps `(viewerPubkey, wireMessage) → role`.
2. **Synthetic messages** (`ledger-invite:*`) bypass wire sender/recipient truth.
3. **Ledger `direction`** is profile-local storage, not derived from wire + viewer.
4. **dm-kernel thread** and **legacy hydrate** apply different display pipelines.
5. **Accept/Cancel authorization** lives in UI (`community-invite-card.tsx`), not a shared policy module.

Each fix shifts failure mode (duplicate cards → wrong buttons → empty thread) without establishing role truth.

## Canonical question (must be answered once)

> For viewer **V**, message **M**, invite payload **P**: is V the **inviter**, **invitee**, or **neither**?

Today: answered implicitly by `M.isOutgoing` (+ augment heuristics).  
Required: answered explicitly by **InviteRoleAuthority** from wire facts only.

## Wire facts (durable, viewer-independent)

| Field | Source |
|-------|--------|
| `senderPubkey` | Nostr rumor / sqlite row |
| `recipientPubkey` | Nostr rumor / sqlite row |
| `inviteId`, `groupId` | Payload |
| `creatorPubkey` | Payload (when present) |
| `eventId` | Rumor id |

## Derived viewer role (never persisted as `isOutgoing`)

```
inviter   := senderPubkey == viewerPubkey OR creatorPubkey == viewerPubkey
invitee   := recipientPubkey == viewerPubkey AND NOT inviter
observer  := neither (historical / superseded / foreign)
```

`isOutgoing` may remain for **bubble layout** but must equal `(senderPubkey == viewerPubkey)` after normalize — never the inverse authority.

## Affected modules (integration surface)

- `apps/pwa/app/features/groups/components/community-invite-card.tsx` — actions
- `apps/pwa/app/features/messaging/components/message-list.tsx` — prop wiring
- `apps/pwa/app/features/groups/services/community-dm-invite-pipeline.ts` — synthetic + augment
- `apps/pwa/app/features/dm-kernel/use-dm-kernel-thread.ts` — display augment (recent)
- `apps/pwa/app/features/messaging/services/format-conversation-message-preview.ts` — list (reference impl for copy)
- `apps/pwa/app/features/groups/services/community-dm-invite-ledger.ts` — profile-local direction

## Out of scope for this investigation

- Relay membership convergence (COM-RUN-01/06)
- Room key missing (COM-RUN-02)
- Chat history slot scan (separate dm-kernel persistence band)

## Next step

Implement design in [`docs/program/community-invite-role-ecosystem-design.md`](../program/community-invite-role-ecosystem-design.md) before any invite UI or pipeline code.
