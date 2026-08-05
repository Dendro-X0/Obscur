# Investigation — Relay warm-up + OS notification hygiene

**Date (UTC):** 2026-08-05  
**Status:** Investigation complete · design follows  
**Owners:** `dm-send-pipeline` · `notification-presentation` · `desktop-notification-handler`

---

```text
HANDOFF ATOMIC STEP: Voice call OS notification (user pivot: warm-up + message toast hygiene)
PAUSED / CANCELLED:   Dev Lab · COM-RUN-* · O-2/O-4 · RIW-8 · AUTH-SESSION · groups/**
CANONICAL OWNER:      dm-send-pipeline (warm) · notification-presentation · desktop-notification-handler
PROOF BEFORE DONE:    L1 presentation + handler + warmup helper tests
OUT OF SCOPE:         Soft L3 Docker · public Nostr SLA · AUTH-SESSION · groups/** · video
```

## A — Early send “Delivery could not be confirmed”

**Symptom:** Shortly after startup, outgoing DM shows clock status then red toast: “Delivery could not be confirmed…”.

**Cause:** Publish runs before any relay socket is open / ACK-ready. `waitForConnection` exists on the pool but the DM send path does not warm before `publishToRelays`. Zero-writable queue in `sendDmWithRetry` does not cover the race where the UI send path uses `sendDm` + `waitForConfirmation` while sockets are still dialing.

## B — Duplicate message icons on OS toast

**Symptom:** Title and body each prefix 💬 (screenshot).

**Cause:** `buildMessageNotificationPresentation` puts `kindEmoji` on **both** title and body. Coalesced flush can add another emoji for multi-message titles.

## C — OS toast while viewing that chat

**Symptom:** System notification can appear while the user is already in that DM.

**Cause:** Suppress gate requires `isForeground()` = `visibilityState === "visible" && document.hasFocus()`. Tauri webviews often report `hasFocus() === false` while the window is visible → suppress skipped → path treated as background → OS toast.

## Mental simulation (desired)

1. Cold start → first send waits up to warm timeout for an open relay → then publish; if still cold → honest queue / no_writable (not false “confirmed fail” race).
2. Toast: title without emoji; one emoji on description line; circular avatar remains the image icon.
3. Visible + viewing that conversation → no OS / in-app message notification. Visible + other screen → in-app only. Hidden / other app → OS toast.
