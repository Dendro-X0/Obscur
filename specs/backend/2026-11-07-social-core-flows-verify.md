# Verify — Social core flows (2026-11-07)

```text
HANDOFF ATOMIC STEP: Verify DMs · group chats · add/remove contacts · group invite · leave group
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote · A4 git tag
CANONICAL OWNER: messaging + network peer-trust + groups membership
PROOF BEFORE DONE: L1 vitest matrix · L2 dual webview2-cdp (Tester1↔Tester2) Tor OFF
SURFACE: Tauri static-dev (:9230/:9231) — not Soft L3 / not packaged NSIS
```

## Matrix

| # | Flow | Pass when |
|---|------|-----------|
| 1 | Add contact | Invitation delivered → peer Requests pending → Accept → connection listed |
| 2 | DM | Send text A→B · visible on both threads |
| 3 | Remove contact | Remove → peer demoted · Connect available again |
| 4 | Group chat | Existing or create group · send message · visible to members |
| 5 | Invite to group | Invite accepted peer into group · invite surfaces / membership updates |
| 6 | Leave group | Member leaves · removed from own sidebar · roster honest |

## Executed 2026-11-07

| Layer | Result |
|-------|--------|
| L1 | **101 Pass** (19 files) |
| L2 | **Partial** — [social-core-flows-l2-soak-2026-11-07.md](../../docs/handoffs/social-core-flows-l2-soak-2026-11-07.md) |

| # | Flow | L2 |
|---|------|----|
| 1 | Add contact | Pass |
| 2 | DM | Pass |
| 3 | Group chat | Pass |
| 4 | Invite to group | **Fail** (connections empty) |
| 5 | Leave group | **Partial** (published + thread residue) |
| 6 | Remove contact | **Blocked** (Stranger UI / no Remove) |

## Claim language

- May say: L1 Pass · L2 Partial per row above
- Must not say: Soft L3 Fixed · Tor Verified · Matrix promote · packaged beta verified · “all six Pass”
