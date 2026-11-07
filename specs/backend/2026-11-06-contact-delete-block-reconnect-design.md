# Design — Contact delete / reconnect + Discovery clear history (2026-11-06)

```text
WHY: Cold-run shows delete leaves A/B unable to re-handshake; Discovery history has no clear.
OWNERS: account-event-reducer · requests-inbox · incoming-lifecycle · network-profile-view · search-page-client
PROOF: L1 tests below · L2 operator remove→Connect→pending on peer
```

## Invariants

1. After local **Remove**, local projection contact for that peer is gone (`none` / deleted key) — no `canceled` placeholder.
2. **Remove** notifies peer with `connection-cancel` (best effort) and demotes local trust + evidence + inbox row + hides/deletes DM conversation.
3. Incoming **`connection-cancel`** and **`connection-decline`** both `unacceptPeer` + reset evidence.
4. Incoming **`connection-request`** with a distinct event id against an `accepted` peer is processed (not ignored) and demotes trust to pending until Accept.
5. Discovery Recent Searches expose **Clear** that wipes scoped + legacy storage keys.

## Subtraction-first changes

| Change | File |
|--------|------|
| `CONTACT_REMOVED` deletes contact key; ignore `canceled`/`declined` when current is missing/`none` | account-event-reducer |
| `requestsInbox.remove` always clears local + evidence; emit `CONTACT_REMOVED` (not cancel/decline) | use-requests-inbox |
| Incoming cancel → `unacceptPeer` | contact-request-incoming-lifecycle |
| Accept-with-new-request: do not ignore; demote trust | use-requests-inbox (+ optional lifecycle) |
| `confirmRemove` → cancel wire + unaccept + remove + deleteConversation | network-profile-view |
| Clear recent searches control | search-page-client + en.json |

## Dual blocklist (honesty)

Two stores remain this cut. Connect already blocks when network blocklist says blocked. Follow-up: single owner under messaging blocklist contract.

## Non-goals

- GA claim · Soft L3 · Tor · Matrix promote · full QA matrix
