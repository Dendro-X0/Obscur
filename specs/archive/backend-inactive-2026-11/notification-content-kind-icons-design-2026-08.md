# Design — Notification content-kind glyphs

**Date (UTC):** 2026-08-04  
**Status:** Pass (L1)  
**Owner:** `notification-presentation.ts` · `notification-content-kind.ts`

---

```text
NEXT ATOMIC STEP:     System notification content-kind icons
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
PROOF BEFORE DONE:    L1 notification-presentation.test.ts
OUT OF SCOPE:         Changing Windows notify_rust icon API · Soft L3
```

## Contract

1. Infer kind from preview copy (`Image (…)` / `Video` / `Audio` / `Voice note` / file / call / text).  
2. Prefix title + body with emoji so Windows Tauri toasts (no custom icon today) still show kind.  
3. Prefer peer/group `https://` avatar as `icon` when resolved; else SVG data-URI for web.  
   Windows desktop applies avatar via `image_path` after local cache download (see notification-peer-avatar design).  
4. Calls use call kind glyph (+ peer avatar when known).

## Proof

`pnpm -C apps/pwa exec vitest run app/features/notifications/utils/notification-presentation.test.ts`
