# Design — Chat attachment display after restart

**Date (UTC):** 2026-08-04  
**Status:** Implement  
**Investigation:** [chat-image-load-after-restart-investigation-2026-08.md](./chat-image-load-after-restart-investigation-2026-08.md)

---

```text
NEXT ATOMIC STEP:     Chat image load after restart
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      chat-attachment-display-url (+ MessageAttachmentLayout / OptimizedImage)
PROOF BEFORE DONE:    L1 unit tests · L3 restart paints prior DM image
OUT OF SCOPE:         Soft L3 · groups/** · AUTH-SESSION · rewriting LES catalog
```

---

## Goal

Chat image (and visual) bubbles remain paintable after cold start when bytes exist locally or can be fetched via native HTTP — without inventing a second vault catalog.

## Invariants

1. **Network URL stays message identity** — do not rewrite persisted `attachment.url` to `blob:` / `les://` / `asset:`.
2. **Display src is derived** — ephemeral blob / convertFileSrc for paint only.
3. **Prefer local before remote** when legacy index or LES `sourceAttachmentUrl` has bytes.
4. **On remote `<img>` failure** — one native-fetch→blob attempt before LOAD FAILED.
5. **Never persist `blob:`** as attachment URL (strip / refuse on write; prefer content HTTPS).

## Owner

| Piece | Path |
|-------|------|
| Resolve order | `apps/pwa/app/features/messaging/services/chat-attachment-display-url.ts` |
| Hook | `useChatAttachmentDisplaySrc` (same folder or hooks/) |
| Wire | `MessageAttachmentLayout` → image `src={displaySrc}` |
| Persist guard | `persistence.ts` `parseAttachment` / serialize — drop or replace `blob:` |

## Resolve order (async)

For remote identity `url`:

1. If already `blob:` / `data:` / `asset:` / `ipc` — use as-is for this session only (do not persist).
2. `resolveLocalMediaUrl(url)` if index entry exists.
3. LES: `listLesObjects` row with matching `sourceAttachmentUrl` → `readLesObjectDecrypted` → blob (register in blob lifecycle keyed by remote url).
4. Else return remote `url` for first paint.

## Error fallthrough (OptimizedImage / wrapper)

On `onError` when current src is remote http(s) and no local resolve yet:

1. Try steps 2–3 again.
2. Else `fetchRemoteAttachmentBytesForLesSave(url)` → blob → set display src once.
3. Else keep LOAD FAILED (Retry resets and re-runs).

## Subtraction

- Do **not** add a parallel MediaCAS paint path.
- Do **not** change LES commit contracts.
- Badge may still use legacy index this slice; optional follow-up: LES-aware “in vault” set.

## Proof

| Layer | Command / action |
|-------|------------------|
| L1 | vitest `chat-attachment-display-url` + persistence blob strip |
| L3 | Desktop: send/receive image → restart → reopen DM → image paints (not LOAD FAILED) |

## Claim language

- **Implemented** = L1 green + wired layout  
- **Fixed (runtime)** = L3 restart proof only
