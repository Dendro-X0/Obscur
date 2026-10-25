# Investigation — DemoUser empty contacts + call UI smoke (2026-10)

```text
HANDOFF ATOMIC STEP: B2 smoke release exe (Tor OFF) → adjacent P0 mobile UX / call UI check
PAUSED / CANCELLED: Matrix · Tor Verified · Soft L3 · video usable (M1-L3) · Spaces · Nostr-client identity
CANONICAL OWNER: peer-trust / account-projection · VoiceCallDock / MobileDmThreadHeader
PROOF BEFORE DONE: L2 — contacts visible OR accepted peer for dial; voice dock smoke; video = structure only
SURFACE: mobile-preview (:3340) · data root `.obscur-mobile-preview-data`
```

## Symptom

DemoUser Network / connections previously had peers; now **CONNECTIONS = 0**. Remaining manual check: voice + video call UI.

## Likely causes (ordered)

1. **Surface isolation** — `dev:mobile-preview` uses `.obscur-mobile-preview-data`, not desktop AppData. Contacts from a desktop DemoUser session do not auto-appear here.
2. **Profile / partition** — unlock of a different profile label or wiped preview SQLite / localStorage `obscur.peer_trust.v1.<pubkey>`.
3. **Projection hold** — if both projection and legacy acceptedPeers are empty, Network shows empty (authority cannot revive peers that no longer exist in either store).
4. **Relay** — empty contacts are local; relay down does not wipe the list, but blocks re-accept / call invite publish.

## Call UI gate (honest)

| Path | Status |
|------|--------|
| Voice dial → dock → accept → connected | **Checkable** if ≥1 open relay + accepted DM peer |
| Video icon / fullscreen stage | **Structure only** — do not claim usable (no camera / M1-L3 PAUSED) |

Preflight: `canStartVoiceCallInviteDial({ openRelayCount })` — 0 relays → no invite.

## Recovery for smoke (no code)

1. Prefer **Tester1 ↔ Tester2** (lab matrix accounts) if they still share trust on this surface.
2. Or Network → Add / Find People → re-accept peer on DemoUser.
3. Confirm BUILD stamp online + at least one relay open before dialing.
4. Follow [mobile-call-ui-smoke-2026-10.md](../../docs/assets/demo/mobile-call-ui-smoke-2026-10.md).

## Out of scope this note

Restoring DemoUser contacts by inventing seed data; claiming video usable; Soft L3 dual-window.
