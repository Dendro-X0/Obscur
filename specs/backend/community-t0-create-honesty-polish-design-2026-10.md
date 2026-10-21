# Design — CU-UX-2b T0 create honesty polish

**Date (UTC):** 2026-10-20  
**Investigation:** [community-t0-create-honesty-polish-investigation-2026-10.md](./community-t0-create-honesty-polish-investigation-2026-10.md)

---

## 1. Goals

1. T0 create default right column = honesty panel (+ ack when Quiet) only — no relay-baseline essay, no guarantee tag cloud.
2. Create surface copy stays Quick / Public relays (no “Sovereign Room” on create path).
3. Persist `hostingTier` so sealed metadata cannot be mistaken for managed workspace hosting.
4. Ack resets when selected host changes.

## 2. Contracts

### `hostingTier`

```ts
type CommunityHostingTier = "public_quiet" | "operator" | "custom";
```

| Create choice | Value |
|---------------|-------|
| Quick + Quiet / public_default host | `public_quiet` |
| Quick + writable non-public host | `custom` |
| Team (`managed_workspace`) | `operator` |

Wire `communityMode` unchanged: T0 → `sovereign_room`, T1 → `managed_workspace`.

Helper: `resolveHostingTierForCreate({ communityMode, isPublicQuietHost })` in `community-quick-group-create.ts`.

### UI (CreateGroupDialog)

- `isQuickGroup`: show honesty block; **hide** relay-baseline card and mode/guarantee cloud.
- `isTeamWorkspace`: keep trust panel + baseline + guarantees as today.
- `useEffect` on `info.host`: `setPublicLimitsAcked(false)` when host string changes while dialog open.
- Submit: include `hostingTier` on `GroupCreateInfo`.

### Persist

- `GroupMetadata.hostingTier?`
- `GroupConversation.hostingTier?`
- `CommunityDescriptorRelayHintPayload.hostingTier?`
- `global-dialog-manager` writes field into sealed create metadata + conversation object.

## 3. Proof (L1)

| Case | Expect |
|------|--------|
| Default Quick + Quiet | Honesty visible; baseline/guarantees testids absent |
| Create after ack | `onCreate` includes `hostingTier: "public_quiet"` |
| Host change | Ack unchecked again |
| Team + public host | Submit disabled + workspace blocked (regression) |
| `resolveHostingTierForCreate` unit | public_quiet / custom / operator mapping |

L3 Quiet create+send soak remains charter follow-up — not exit for this polish.

## 4. Subtraction

- Do not add a second create engine.
- Do not rename `COMMUNITY_MODE_DEFINITIONS` labels app-wide.
- Do not claim delete-for-all / directory on T0.
