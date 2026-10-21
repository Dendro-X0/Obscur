# Design: Dialog Esc dismiss + Team Save enables typed relay (2026-08)

**Status:** Ready to implement  
**Pairs:** [dialog-escape-and-docker-relay-investigation-2026-08.md](./dialog-escape-and-docker-relay-investigation-2026-08.md)

## HANDOFF

```text
HANDOFF ATOMIC STEP: none — bugfix under community dual-tier UX dogfood
PAUSED / CANCELLED:   COM-RUN-02 · COM-RUN-01 roster parity ship · Tor Verified · AUTH-SESSION
CANONICAL OWNER:      CreateGroupDialog / NewChatDialog overlays · OperatorTrustSetupWizard
PROOF BEFORE DONE:    L1 app-shell + create-group Esc · L1 preferred-tier / wizard enable path · ops: docker :7000 up
```

## Contracts

### Esc

1. Custom modal roots (`CreateGroupDialog`, `NewChatDialog`, `GroupJoinDialog`, invite dialogs) set `data-escape-layer="open"`.
2. On Escape (capture or bubble before shell): `preventDefault` + `onClose` unless busy (creating).
3. Shell continues to skip `history.back` when any escape-layer is present.

### Team Save / Docker

1. If Workspace Relay field has a normalized URL, **Save & use** enables that relay (`addRelay`) and clears skip-only path — lab “Test without local Nostr relay” only applies when the relay field is empty.
2. Persist preferred create tier `team` as today.
3. Ops honesty: coordination must be up for Team path; Docker on `:7000` must be running.

## Proof

- L1: existing escape-layer shell test + create-dialog Esc closes without `history.back`
- L1: operator apply with URL enables even if skip flag was true in state
- Manual: Enable localhost:7000 after Save; metrics not DISABLED
