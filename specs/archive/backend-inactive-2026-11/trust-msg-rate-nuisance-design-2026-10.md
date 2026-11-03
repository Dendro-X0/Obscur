# Design — Soft-mute rate-only trust notices (ASE immature)

**Date (UTC):** 2026-10-19  
**Status:** Implemented (L1) · msg.rate-only → tier none  
**Charter:** Maintainer — ASE not fully developed; high message volume alone ≠ fraud; rate banners feel like a nuisance.

```text
HANDOFF ATOMIC STEP: Soften intrusive trust notices (msg.rate info strip)
PAUSED / CANCELLED: Soft L3 Fixed · Disable all trust banners · Remove cold+rate spam bundle without charter
CANONICAL OWNER:     dm-kernel-trust-assessment-port
PROOF BEFORE DONE:   L1 assessDmTrustWarning — msg.rate-only → tier none
SURFACE:             DM trust info strip / banner
```

## Contract

| Signals | Before | After |
|---------|--------|-------|
| Only `msg.rate` (accepted or cold) | info or elevated | **`none`** (no strip/banner) |
| `contact.cold` + `msg.rate` (`BUNDLE_SPAM_COLD`) | elevated | **unchanged** (cold spam shape) |
| `invite.fanout` alone | elevated | **unchanged** |

Signal may still be recorded in diagnostics elsewhere; UI tier is `none` for rate-only.

## Non-goals

Reworking full ASE · removing payment/phishing elevated banners

_Last updated: 2026-10-19T12:42:00Z_
