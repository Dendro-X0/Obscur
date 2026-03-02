# Multimedia Upload & Playback: Current Findings

## Scope

This document tracks the current state of multimedia upload + playback in Obscur, specifically:

- NIP-96 uploads (browser + native/Tauri)
- Rendering media in chat (especially external MP4 playback)
- Constraints specific to Tauri/WebView environments

It is intended as a living “investigation log” and a roadmap for long-term hardening.

## Current Symptom Summary

### 1) Upload succeeds, playback fails (desktop)

- Upload to public NIP-96 providers can succeed and returns a valid public URL.
- Example URL that repeatedly fails to play inside the chat UI (Tauri/WebView):
  - `https://video.nostr.build/c6f5030839806a178d1a68ce9cff8ba0b72b65e06379c409b30653244f78233c.mp4`
- In the chat UI, the custom `<video>` player shows **Load Failed**.

### 2) Desktop environment is hybrid

Observed logs indicate:

- Crypto runs natively: `[CryptoService] Running in Tauri: using NativeCryptoService`
- Some relay traffic is still browser-based: `[NativeRelay] Using browser WebSocket ...`

This matters because “desktop app” does not automatically imply all media/networking is native.

### 3) IndexedDB store NotFoundError noise

Logs show:

- `NotFoundError: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found.`

This appears unrelated to MP4 playback, but it can mask other logs and may indicate a schema/migration mismatch.

## What We Changed So Far

### Upload path hardening

Browser-side NIP-96 uploading was updated to match stricter providers:

- NIP-98 signing includes payload hash
- Multipart field name retries for compatibility

### Video player hardening + fallback

The chat `VideoPlayer` was updated to:

- Avoid cross-origin settings that can cause WebView playback failures
- Remount the `<video>` element on `src` change
- Drive UI state from media events (no `setState` in `useEffect`)

And in the error state:

- Log more detailed media error diagnostics
- Provide an **Open** action to open the media externally (Tauri shell open when available)

## Why Playback Can Still Fail in Tauri/WebView

Even with a correct URL, `<video src="https://...mp4">` can fail in WebViews due to:

- Codec support differences (H.264/AAC vs other encodings; HEVC; profile/level differences)
- WebView media pipeline restrictions
- CORS / CORP / COEP / CSP / `X-Content-Type-Options: nosniff` interactions
- Incorrect/unsupported `Content-Type` or `Accept-Ranges` behavior
- Redirect chains that the embedded media pipeline rejects
- TLS/certificate chain issues (less common, but possible)

The most common real-world cause is **codec incompatibility** (MP4 container != guaranteed playable encoding).

## Diagnostics To Capture (Next)

When the player fails, capture the console log emitted by `VideoPlayer`:

- `MediaError.code`
- `currentSrc`
- `readyState` / `networkState`

Then additionally validate outside the app:

- Open the MP4 URL in a regular browser (Chrome/Firefox) and confirm it plays.
- In DevTools > Network, inspect response headers:
  - `Content-Type`
  - `Content-Length`
  - `Accept-Ranges`
  - `Access-Control-Allow-Origin`
  - `Cross-Origin-Resource-Policy`

If it plays in the system browser but fails in the WebView, that strongly points to a WebView limitation.

## Long-Term Solution Options

### Option A: Keep `<video>` but add robust fallback UX (recommended short-term)

- If `onError` fires:
  - Offer **Open externally**
  - Offer **Download** (save to disk)
- Treat embedded playback as “best effort” on desktop WebView.

This ensures the feature is usable even if some encodings fail.

### Option B: Native playback path for desktop

Implement desktop-native playback via Tauri/Rust:

- Download the video via native HTTP (`reqwest`)
- Save to an app cache directory
- Render a local file URL / asset protocol that the WebView can load reliably

This may bypass some remote header/CORS issues but **does not fix codec incompatibility**.

### Option C: Provider-side / pipeline-side normalization

Make uploaded videos consistently playable by enforcing encoding constraints:

- Normalize to H.264 (baseline/main) + AAC
- Consider generating HLS (`.m3u8` + segments) for broad compatibility

This is the most reliable path but requires either:

- A controlled upload provider, or
- A user-configurable “transcode before upload” step (costly; complex)

### Option D: Media proxy service (centralized tradeoff)

A proxy can:

- Normalize headers
- Provide range requests
- Optionally transcode

But this introduces a centralized component that may conflict with project goals.

## Recent Improvements (v0.7.12)

### 1) Native Audio Support
The `extractAttachmentsFromContent` logic has been expanded to detect and categorize common audio formats (MP3, WAV, OGG, M4A). These are now rendered using a dedicated, aesthetically pleasing custom `AudioPlayer` component.

### 2) Hardened Upload Pipeline
- **Log Noise Suppression**: Downgraded individual NIP-96 provider failures to `console.warn` to prevent Next.js development overlays from blocking the UI during automatic fallback.
- **Fail-Fast Error Handling**: Network/fetch errors now trigger immediate provider fallback without waiting for a full 10s timeout, significantly speeding up the upload process when a provider is unreachable.
- **Resolved Sync Issues**: Improved the multipart request builder to be more resilient to specific NIP-96 provider variations (e.g. `nostr.build` vs `void.cat`).

## Known Related Issues
## Status

- **Upload Reliability**: Greatly improved for browser/PWA (matches native NIP-98/NIP-96 behavior).
- **Audio Support**: Complete as of v0.7.12.
- **Video Playback**: Embedded MP4 playback in Tauri/WebView remains a "best effort" due to codec limitations; fallback "Open Externally" is the recommended path for incompatible videos.
