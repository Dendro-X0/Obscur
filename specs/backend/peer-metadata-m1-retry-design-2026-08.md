# Design — M1 peer kind-0 metadata auto-retry

**Date (UTC):** 2026-08-04  
**Parent:** [peer-metadata-unknown-sender-investigation-2026-08.md](./peer-metadata-unknown-sender-investigation-2026-08.md)  
**Status:** M1 **Pass** (L1) · next **M2** display fallback

---

```text
NEXT ATOMIC STEP:     M1 kind-0 metadata auto-retry
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      useProfileMetadata (+ profile-metadata-hydrate-retry policy)
PROOF BEFORE DONE:    L1 policy unit + use-profile-metadata retry tests
OUT OF SCOPE:         M2 display fallback · R1 toast dedupe · AUTH-SESSION · dual cache
```

---

## Contract

1. While `needsRelayHydration(metadata)` and `live` and ≥1 enabled relay URL:  
   - Run direct kind-0 fetch (existing).  
   - If fetch returns no usable event → **schedule retry** with backoff `[2s, 5s, 15s, 30s]` · max **5** attempts per pubkey (session maps cleared by `clearProfileMetadataCache`).  
2. When **open relay count increases** while still needing hydration → **immediate** retry (reset backoff index for that recovery nudge; still count toward max attempts).  
3. Stop retries when `displayName` present (or disposed / `live: false`).  
4. Keep single in-flight fetch via existing `directFetchState`.  
5. No second metadata cache.

---

## Files

| File | Change |
|------|--------|
| `profile-metadata-hydrate-retry.ts` | Pure delay / should-schedule / pool-recovery gates |
| `use-profile-metadata.ts` | Wire retries + open-count dep |
| `*.test.ts` | L1 |

---

## Non-goals

- Inventing display names without kind 0 / connection (M2).  
- Claiming public relay SLA.
