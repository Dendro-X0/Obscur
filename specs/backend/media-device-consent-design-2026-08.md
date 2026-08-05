# Design — Media device consent dialog

**Date (UTC):** 2026-08-04  
**Status:** Implement  
**Investigation:** [media-device-consent-investigation-2026-08.md](./media-device-consent-investigation-2026-08.md)

---

```text
NEXT ATOMIC STEP:     Media device consent dialog
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      media-device-access.ts · MediaDeviceConsentDialog · VoiceRecorder
PROOF BEFORE DONE:    L1 media-device-access + VoiceRecorder wiring tests · L3 desktop mic flow
OUT OF SCOPE:         Video conferencing UI · Soft L3 · AUTH-SESSION · groups/**
```

---

## Goal

One consent + detect surface before mic (voice note / voice call) or camera (QR only). Replace toast-only denial with dialog-first UX.

## Contracts

### Kinds

| Kind | Constraints | Product use |
|------|-------------|-------------|
| `microphone` | `{ audio: true }` (+ optional `deviceId`) | Voice note, realtime voice |
| `camera` | `{ video: true }` | QR scan only — **not** conferencing |

### Purpose codes (copy)

`voice_note` | `voice_call` | `qr_scan`

### Service API (`media-device-access.ts`)

```ts
listMediaInputDevices(kind: "audioinput" | "videoinput"): Promise<ReadonlyArray<{ deviceId; label; kind }>>
queryMediaPermission(kind: "microphone" | "camera"): Promise<"granted" | "denied" | "prompt" | "unknown">
requestMediaStream(params): Promise<{ ok: true; stream } | { ok: false; reasonCode; errorName }>
classifyMediaAccessError(error): reasonCode
shouldSkipMediaConsentDialog(permission): boolean  // granted → skip
```

Reason codes: `permission_denied` | `not_found` | `unavailable` | `unsupported` | `failed`

### Dialog UX (frontend)

- Modal, transparent overlay (match vault unlock — no heavy dim), z-index above composer.
- Title: Enable microphone / Enable camera  
- Body: purpose sentence + **Detected devices** list (label or “Microphone N” when label empty).  
- Empty list: “No devices detected yet — allow access so Obscur can list them.”  
- Primary: **Allow** → `requestMediaStream` → on success `onGranted(stream)` and close.  
- Secondary: **Not now** → close, no error toast.  
- Inline error on failure (denied / not found / in use) with English `defaultValue`s.  
- Optional device `<select>` when ≥2 labeled devices (mic only this slice).

### Skip dialog

**Amendment 2026-08-04:** First grant is OS-owned. Callers use `shouldRequestMediaPermissionDirectly` (`granted` | `prompt` | `unknown`) → `getUserMedia` immediately. In-app dialog is recovery when `denied` or after OS deny. See [voice-note-dark-mode-mic-single-step-design-2026-08.md](./voice-note-dark-mode-mic-single-step-design-2026-08.md).

Legacy: If `queryMediaPermission === "granted"` and at least one matching input exists → `shouldSkipMediaConsentDialog` still true.

### Wiring (this slice)

1. **VoiceRecorder** — mic button opens dialog (`purpose: voice_note`); onGranted starts MediaRecorder with returned stream.  
2. **ensureVoiceLocalStream** — if not granted, surface same dialog is harder inside main-shell; extract `requestMicrophoneStreamWithConsent` callback OR show toast only when dialog already refused… Prefer: shared hook used by VoiceRecorder; for voice call, call `requestMediaStream` after opening dialog via a small `MediaDeviceConsentHost` portal.

Minimal viable: VoiceRecorder fully wired; voice-call path uses shared `requestMediaStream` + opens dialog through a lightweight event/`MediaDeviceConsentProvider` if needed.

**Slice A (ship):** VoiceRecorder only + shared service/dialog.  
**Slice B (same PR if cheap):** `ensureVoiceLocalStream` accepts optional pre-acquired stream; voice call UI triggers consent dialog before `ensureVoiceLocalStream`.

Implement A + B if dialog is provider-based.

### Provider pattern

`MediaDeviceConsentProvider` at shell/chat level:

- `requestAccess({ kind, purpose }) => Promise<MediaStream | null>`
- Shows dialog, returns stream or null

VoiceRecorder and voice-call both call `requestAccess`.

## Invariants

- Never persist deviceIds as ambient global without profile scope if stored later (this slice: session-only selection).
- No video-call / camera-for-chat features.
- Do not claim fixed without desktop Allow → record proof.

## Proof

| Layer | Command |
|-------|---------|
| L1 | vitest `media-device-access.test.ts` (+ dialog/hook if present) |
| L3 | Desktop: mic → dialog lists devices → Allow → voice note records; Not now → no red toast |

## Frontend notes (ui-taste)

- One job: consent + detect. No settings dump.  
- shadcn Button; Mic/Camera lucide icons.  
- Match `VaultWriteUnlockDialog` layout density.
