# Investigation — Chat images LOAD FAILED after restart

**Date (UTC):** 2026-08-04  
**Status:** Findings → design  
**Evidence:** Maintainer screenshot (Tester2 bubble · Load Failed · Retry/Open · HardDrive save affordance · 1h ago) · desktop `pnpm dev:desktop:online`

---

```text
NEXT ATOMIC STEP:     (user pivot) Chat image load after restart
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      MessageAttachmentLayout → OptimizedImage (+ local-media / LES display resolve)
PROOF BEFORE DONE:    L1 display-url + persistence strip · L3 restart desktop DM image paints
OUT OF SCOPE:         Soft L3 Docker · public Nostr SLA · AUTH-SESSION · groups/**
```

---

## Symptom

After app restart, prior chat image bubbles show **LOAD FAILED** (Retry / Open). Same thread worked in the previous session. Save-to-Vault HardDrive control is still shown (legacy “not in vault index” path).

## Owner map

| Surface | Module | Role today |
|---------|--------|------------|
| Paint | `OptimizedImage` ← `MessageAttachmentLayout` | Always uses `attachment.url` as `<img>` src |
| Vault badge | `getLocalMediaIndexSnapshot()` | Index presence only — **does not remap src** |
| Sent auto-cache | `cacheAttachmentLocally(..., "sent")` in `use-chat-actions` | Writes legacy vault index; **chat never reads it for display** |
| Received auto-cache | — | **None** |
| Explicit vault save | LES `saveChatAttachmentToLes` | Catalog by `sourceAttachmentUrl`; Vault grid decrypts → blob; **chat does not** |
| Vault display | `resolveLocalMediaUrl` / `useLesVaultMedia` | Decrypt / `convertFileSrc` / blob — chat unused |

## Findings

1. **Single display path = remote URL.** Chat never calls `resolveLocalMediaUrl` or LES decrypt for bubble paint. Cold start always hits HTTPS (or whatever was persisted).
2. **Screenshot HardDrive** ⇒ `!localAttachmentUrlSet.has(url)` ⇒ legacy index miss (incoming never auto-cached; or LES-only save; or SQLite index not hydrated into badge set). Local bytes may still exist under LES without remapping src.
3. **Persistence accepts `blob:`.** `parseAttachment` keeps any non-empty `url`. Blob object URLs die on process restart → guaranteed LOAD FAILED if any path persisted them.
4. **Video/audio have cache-bust retry; images do not** have native-fetch→blob fallthrough. WebView cold `<img>` of CDN hosts can fail while native `fetch_remote_bytes` / plugin-http (already used by vault/LES save) succeeds.
5. **Not a PAUSED band** (messaging display / vault read path). Prior handoff slice (vault unlock i18n) is Pass L1; this is a maintainer pivot.

## Mental simulation (restart)

1. Unlock profile → hydrate messages with stored `attachments[].url` (usually `https://…`).
2. Bubble mounts `OptimizedImage src={https}` → webview fetch fails → LOAD FAILED.
3. Local encrypted copy (sent cache or LES) may exist but is never consulted.
4. Retry reloads same dead remote src (or dead `blob:`).

## Root cause (working)

**Chat paint treats network URL as durable display truth.** After restart, remote may fail and/or persisted `blob:` is invalid, with **no fallthrough** to local/LES/native-fetched bytes — unlike Vault.

## Design pointer

See `chat-image-load-after-restart-design-2026-08.md`.
