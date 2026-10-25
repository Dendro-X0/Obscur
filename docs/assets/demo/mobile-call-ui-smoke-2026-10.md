# Mobile call UI — how to check (2026-10)

**Honesty:** Voice is the shippable path. Video dial + fullscreen stage exist (L1 structure) — **do not claim video usable** (handoff: no camera / M1-L3 blocked). Tor OFF for B2-style smokes.

## Surface map

| Piece | Where | Behavior |
|-------|--------|----------|
| Dial | `MobileDmThreadHeader` phone / video icons (DM only when `canSend*CallInvite`) | Sends invite over open relays (`canStartVoiceCallInviteDial`) |
| Incoming | `IncomingVoiceCallToast` via `GlobalVoiceCallOverlay` | Accept / decline / dismiss |
| Active voice | `VoiceCallDock` `presentation=dock` | Compact fixed bar; chat-route bottom offset clears composer |
| Active video (mobile shell) | `resolveVoiceCallPresentation` → `fullscreen` only when `callType=video` **and** phase is `connecting`/`connected` | Full-screen stage; outgoing ring stays **dock** |
| Desktop video | `presentation=stage` | Floating window (not this checklist) |

Flag: `REALTIME_VOICE_CALLS_ENABLED` ← `isRealtimeVoiceCallsEnabled()`.

## UI-only preview (no contacts / no dial)

Inspect **real** `VoiceCallDock` + `IncomingVoiceCallToast` chrome without restore, peers, or unlock:

```text
http://127.0.0.1:3340/lab/call-ui-preview
```

- Auto-cycles scenes (~4.5s). Lock one: `?scene=video_connected_fullscreen&cycle=0`
- Scenes include voice ring/toast/connected, video fullscreen + desktop stage, camera-unavailable, interrupted/ended
- Works in mobile-preview Tauri WebView or a normal browser pointed at `:3340`

## Preconditions (live dial smoke only)

1. `pnpm run dev:mobile-preview` (or packaged mobile shell) with **≥1 open relay**.
2. Two profiles (A/B) that can DM each other; peer accepted.
3. Mic permission for voice; camera optional (expect honesty banner / placeholders without camera).

## Smoke steps (voice — primary)

1. Unlock profile A → open DM with B → confirm phone icon on thread header (`mobile-thread-voice-call`).
2. Tap phone → expect outgoing ring **dock** (not fullscreen).
3. On B: incoming toast → Accept → both reach `connecting` → `connected`; audio level bars may move.
4. Leave thread / switch Network tab → dock should remain (global overlay portal).
5. End call → honesty reason if interrupted; dismiss clears overlay.
6. Dial with **0 relays** → invite should not publish (preflight).

## Smoke steps (video — structure only)

1. Tap video icon (`mobile-thread-video-call`) when enabled.
2. Outgoing ring stays **dock** until peer engages.
3. After accept + connecting: mobile shell should use **fullscreen** stage (remote + local PiP / placeholders).
4. Without camera: expect camera-unavailable / audio-only honesty — **not** a pass for “video works.”

## Pass / fail (mobile UI feel)

| Check | Pass |
|-------|------|
| Voice dock clears composer / tab bar | Controls usable; not trapped under chrome |
| Fullscreen video (if shown) respects safe-area | End/back reachable |
| No unlock wipe on soft nav during call | Session stays |
| Video usable / quality | **Out of scope** this smoke |

## Related

- `apps/pwa/app/features/messaging/services/realtime-call-presentation.ts`
- `docs/frontend-spec-desktop-video-call-stage-2026-10.md` (desktop only)
- Handoff: do not open video L3 before v2.0.0-beta.1 tag unless P0
