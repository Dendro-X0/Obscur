# Community Roadmap (Invite-Only Micro-Communities)

## Goals

- Keep the product **invite-only** and **no-registration**.
- Keep identity and social state **local-first** and **per-identity**.
- Use Nostr relays for transport and NIP standards for interoperability.
- Maintain a safe-by-default UX for inbound DMs and community joins.

## Non-goals (for v1)

- Global discovery (keyword search, trending, recommended users/groups).
- Centralized accounts, email/phone registration, or server-side user profiles.
- Cross-device persona syncing (unless explicitly designed later).

## Current Foundation (already implemented)

- Per-identity storage boundaries:
  - Requests inbox keyed by identity public key.
  - Relay list keyed by identity public key.
  - Blocklist keyed by identity public key.
  - Invites inbox keyed by identity public key.
- Locked identity UX:
  - Routes render safely in locked state.
  - Inline unlock/create UX via the Identity UI.
- Invites:
  - Deep link handler route: `/invite?relay=...&group=...&inviter=...&name=...`.
  - Safe parsing and validation.
  - Save/open flows per identity.

## Milestone 1: Invite UX hardening (release)

### Deliverables

- Invite review UX should clearly communicate:
  - An invite is a **pointer**, not a credential.
  - Relay choice affects privacy/metadata exposure.
- Ensure consistent empty states:
  - No identity: inline identity create/unlock.
  - No invites: clear “paste invite link” guidance.
- Optional local metadata:
  - Allow a local-only label/nickname for saved invites.

### Security constraints

- Do not store sensitive secrets in query params.
- Do not auto-join or auto-post from an invite.

## Milestone 2: Group roles and join flow (NIP-29)

### Deliverables

- Group page supports:
  - Viewing metadata/timeline read-only when identity is locked.
  - Joining and posting only when identity is unlocked.
- Add explicit UX states:
  - Not a member + restricted group: show “Join to post”.
  - Membership status clearly visible.
- Roles support in UI:
  - owner / moderator / member / guest

### Notes

- Prefer handling role state via relay-signed metadata and membership events (per NIP-29).
- Avoid leaking role enforcement logic into unrelated features.

## Milestone 3: Join requests and moderation

### Deliverables

- Join request queue UI:
  - For restricted/closed groups, surface join requests.
  - Moderators can approve/deny.
- Local moderation controls per identity:
  - Mute/block problematic peers.
  - Remove unknown senders from Requests once actioned.

### Spam controls

- Rate-limit join requests per identity (client-side guardrails).
- Provide “ignore requests from this pubkey” shortcut.

## Milestone 4: Safety model for DMs and community interactions

### Deliverables

- Requests Inbox:
  - Unknown inbound DMs are hidden by default.
  - Reveal/accept/mute/block actions are prominent and consistent.
- Add optional “view once” behavior:
  - Reveal preview without implicitly accepting the sender.

### Constraints

- Keep all trust/block state local per identity.

## Milestone 5: Multi-persona (post-release / gated)

### Deliverables

- Identity store supports multiple personas on-device.
- UI for switching persona:
  - Persona name (local-only).
  - Active persona indicator.
- Strict boundaries:
  - Relays, invites, requests, trust, last-seen all isolated per persona.

### Risks

- Cross-persona data leakage in UI state.
- Confusing mental model if “identity” vs “persona” terminology is inconsistent.

## Testing & QA

- Playwright E2E coverage for critical journeys:
  - Navigation between main routes.
  - Locked identity on Requests/Search/Invites/Group.
  - Invite review -> save -> open group.
  - Requests inbox: reveal/accept/mute/block.

## Release readiness checklist

- No mock data paths for messenger flows.
- All critical routes:
  - Render when locked.
  - Allow inline unlock.
  - Do not crash on missing identity.
- Invite flows:
  - Safe parse.
  - Save/remove/open works per identity.
- NIP-29 group:
  - Read-only view when locked.
  - Join/post only when unlocked.
- E2E tests pass.
