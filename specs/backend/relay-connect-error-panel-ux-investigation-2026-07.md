# Investigation — Harsh stacking relay connect error panel

**Status:** Investigation · 2026-07-30  
**Symptom:** Bright red `Error: RELAY_CONNECT_FAILED` cards stack; messages dump TLS/HTTP/Cloudflare probe text.

---

## Session gate

```text
NEXT ATOMIC STEP:     User-chartered relay warning UX (softer + no stack)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · R-RELAY rewrite (transport)
CANONICAL OWNER:      native-error-store + ErrorPanel · message from native-relay addError
PROOF BEFORE DONE:    L1 native-error-store + error-panel presentation
OUT OF SCOPE:         Relay transport rewrite · community · claiming network fixed
```

---

## Owners

| Concern | Owner |
|---------|--------|
| Emit | `native-relay.ts` → `nativeErrorStore.addError({ code: RELAY_CONNECT_FAILED, message })` |
| Dedupe | `native-error-store.ts` — key=`RELAY_CONNECT_FAILED` within 60s |
| UI | `error-panel.tsx` — `bg-destructive`, full message, one card per store entry |

## Why two cards still appear

Dedupe window is **60s**. After expiry, a new connect failure creates a **second** `RELAY_CONNECT_FAILED` entry. Continuous flap → stack. Message embeds `${e}` + full `[RelayProbe]` / HTTP headers → harsh density.

## Next

Design: always coalesce connect failures to one slot; user-facing short copy; warning chrome; probe only in optional detail / logs.
