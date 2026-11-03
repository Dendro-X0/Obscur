# Check — Video call “Camera unavailable” (2026-11)

```text
HANDOFF ATOMIC STEP: feedback readiness · video usable still PAUSED
PAUSED / CANCELLED: Soft L3 · Tor · Matrix promote · Continuity · video usable (M1-L3)
CANONICAL OWNER: realtime-call-local-media · media-device-access · webview_media_permissions
PROOF: code path + operator checklist (no “video usable” claim)
SURFACE: desktop dual-profile video dial (TESTER1 ↔ TESTER2)
```

## Observed UI

- Local pane: **Camera unavailable** (YOU).
- Call stays connected (timer advances) — voice path continues.
- Banner contract: `mediaMode === "audio_only_fallback"` → honesty copy “Camera unavailable — continuing with voice”.

## Product path (working as designed)

1. Video dial → `prepareLocalMediaForCallDial` / `acquireLocalCallMedia(wantVideo: true)`.
2. Mic acquire required; camera `getUserMedia` attempted.
3. On any camera failure → keep mic, `mediaMode: "audio_only_fallback"`, optional `cameraReasonCode` (`permission_denied` | `not_found` | `unavailable` | …).
4. Dock shows placeholder + banner; peer may still receive video if they have a camera (recvonly transceiver when local video missing).

## Maintainer stance

Handoff: **do NOT claim video usable** — M1-L3 blocked without a working camera soak. This check does not reopen the video promote band.

## Operator checklist (this machine)

1. Windows Privacy → Camera → allow desktop apps / Obscur.
2. Confirm a real camera or OBS Virtual Camera is **started** and not exclusively locked by another app (`NotReadableError` → `unavailable`).
3. If OS prompt was Blocked earlier: Windows Settings → reset camera permission for the app, relaunch (WebView2 can stick DENY; native `webview_media_permissions` grants on ask when installed).
4. Retry video dial; if mic works and only camera fails, expect audio-only honesty (not a hang).
5. Optional lab-only: `NEXT_PUBLIC_OBSCUR_LAB_CANVAS_VIDEO` / `obscur.dev.lab_canvas_video.v1` — **lab canvas stand-in, not a camera claim**.

## Operator follow-up (2026-11-02)

Maintainer confirmed: **Obscur camera integration works** (feed can appear). Dropouts a few seconds later with signal loss are a **hardware / physical camera connection** fault on this machine — not an app regression to chase in the video band.

## Not claiming broken without L3 soak

- Signaling/relays (2/3) — call connected, so invite/WebRTC path is alive enough for audio.
- Full A/V product readiness — still PAUSED until M1-L3 with stable real camera evidence (this host’s intermittent cable/device does not count as product fail).
