# Design — Single media permission prompt (mic now · camera later)

**Date (UTC):** 2026-08-21  
**Investigation:** [media-permission-double-prompt-investigation-2026-08.md](./media-permission-double-prompt-investigation-2026-08.md)

---

```text
HANDOFF ATOMIC STEP: none — greenfield / demo Segment H pivot
CANONICAL OWNER:     media-device-access.ts · VoiceRecorder · ensureVoiceLocalStream · MediaDeviceConsentDialog
PROOF BEFORE DONE:   L1 media-device-access · L3 first voice → one WebView prompt
OUT OF SCOPE:        Video conferencing UI · forcing camera on voice-note grant
```

---

## Goal

One user-facing permission decision for first media use: **WebView/OS `getUserMedia` only**. In-app dialog is **recovery after** `NotAllowedError`, not a pre-prompt.

## Policy (replace query-gated first path)

```ts
// Happy path — never gate on permissions.query for first grant
requestMediaStream({ kind }) 
  ok → use stream
  permission_denied → open MediaDeviceConsentDialog (recovery)
  other → toast / null

// Recovery Allow → requestMediaStream again (may re-prompt or fail with guidance)
```

`shouldRequestMediaPermissionDirectly` becomes obsolete for callers; keep as thin helper or delete from call sites. Prefer `shouldOpenMediaConsentRecovery(reasonCode)` → `reasonCode === "permission_denied"`.

Do **not** trust `permissions.query === "denied"` to mean “user blocked” on Tauri.

## Kinds (unchanged product scope)

| Kind | Constraints | Use |
|------|-------------|-----|
| `microphone` | `{ audio: true }` | Voice note · voice call |
| `camera` | `{ video: true }` | QR only today |
| Future `audio_and_video` | `{ audio: true, video: true }` | Reserved for video call ship — **one** WebView dialog asking for both |

Voice note / voice call stay **audio-only** so camera LED does not flash during Segment H.

## Dialog UX (recovery only)

- Opaque panel (`dark:bg-zinc-950`) — no wallpaper bleed.
- Copy: denied guidance + device list after failed grant.
- **Allow** retries `getUserMedia`; **Not now** closes.

## Call sites

1. `VoiceRecorder.requestConsentOrStart`
2. `ensureVoiceLocalStream` (main-shell)

QR camera path: same pattern if it still pre-opens a custom dialog (align in same PR if cheap).

## Proof

| Layer | Command / action |
|-------|------------------|
| L1 | vitest `media-device-access.test.ts` |
| L3 | Fresh profile / cleared site perms → mic → **only** tauri.localhost prompt → record |
