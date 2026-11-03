# Design — M2 peer display fallback

**Date (UTC):** 2026-08-04  
**Status:** M2 **Pass** (L1)  
**Parent:** [peer-metadata-unknown-sender-investigation-2026-08.md](./peer-metadata-unknown-sender-investigation-2026-08.md)  
**Prior:** M1 Pass — [peer-metadata-m1-retry-design-2026-08.md](./peer-metadata-m1-retry-design-2026-08.md)

---

```text
NEXT ATOMIC STEP:     M2 peer display fallback
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      profile/utils/resolve-peer-display-name · DM header/row/SenderName
PROOF BEFORE DONE:    L1 resolve-peer-display-name + existing header/row contracts still green
OUT OF SCOPE:         R1 toast dedupe · AUTH-SESSION · inventing fake names without pubkey
```

---

## Contract

`resolvePeerDisplayName({ pubkey, metadataDisplayName?, fallbackDisplayName? })`:

1. Meaningful **metadata** name (not empty, not raw/truncated pubkey placeholder).  
2. Else meaningful **fallback** (conversation / connection `displayName`).  
3. Else **short pubkey preview** `abcdefgh…ijklmnop` (8…8).  
4. Never return the full 64-char hex as the UI title.

Bubble `SenderName`: same resolver — replace hard-coded `"Unknown sender"` with short preview when kind 0 still missing (M1 may still fill name later).

---

## Wire

| Call site | Change |
|-----------|--------|
| `chat-header.tsx` | `resolvedName = resolvePeerDisplayName(...)` |
| `conversation-row.tsx` | same |
| `chat-view.tsx` | same |
| `message-list.tsx` `SenderName` | same (no metadata → short preview) |
