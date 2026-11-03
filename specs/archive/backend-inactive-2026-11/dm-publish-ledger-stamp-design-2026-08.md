# Design — Synchronous P-evidence stamp for mesh publishToUrls

**Date (UTC):** 2026-08-02  
**Investigation:** [dm-publish-ledger-stamp-investigation-2026-08.md](./dm-publish-ledger-stamp-investigation-2026-08.md)

---

## Contract

| Surface | Rule |
|---------|------|
| `publishToUrls` success | Set `publishEvidenceRef.current.lastSuccessfulPublishAtUnixMs = Date.now()` **before** returning |
| `getTransportActivitySnapshot` | Return `ref ?? activitySnapshot` for that field |
| `mergeActivitySnapshot` | Must not clear ref; overlay still prefers ref |

Optional: same stamp on `publishToAll` / `broadcastEvent` when `result.success` (parity).

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | Extract tiny pure helper or extend existing mesh pool test; `pnpm exec vitest run` targeted file |
| L2 | Optional Soft L3 / CDP: after send, `lastSuccessfulPublishAtUnixMs != null` |

**Claim:** Implemented ≠ Soft L3 re-Pass required for this residual.

---

## Status

**Implemented (L1)** — 2026-08-02 · `publishEvidenceRef` + `resolveLastSuccessfulPublishAtUnixMs` in `use-conduit-mesh-relay-pool.ts` · vitest Pass (5).
