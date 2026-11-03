# Design — Invite publish → mesh pool

**Date (UTC):** 2026-08-04  
**Investigation:** [invite-publish-mesh-retarget-investigation-2026-08.md](./invite-publish-mesh-retarget-investigation-2026-08.md)

---

## Contract

```ts
type InviteRelayPublishPort = Readonly<{
  publishToUrls: (
    urls: ReadonlyArray<string>,
    payload: string,
  ) => Promise<{ success: boolean; successCount: number; totalRelays: number; overallError?: string }>;
}>;
```

| Owner | Role |
|-------|------|
| Live mesh pool (UI) | Implements port via `pool.publishToUrls` |
| `inviteManager.setRelayPublishPort(port)` or constructor inject | Single writer for connection-request EVENT |
| Standalone / browser-pool | **Not** called from invites |

Fallback when port unset: fail closed with clear error (do not silently use standalone after this slice).

---

## Implement slice (smallest)

1. Add optional publish port on `InviteManagerImpl` + setter used by messaging provider / invites hook once pool is ready.  
2. `sendConnectionRequest` uses port; remove `publishToUrlsStandalone` import.  
3. L1: contract test expects mesh/port wiring, forbids standalone import.  
4. Mental sim: unlocked desktop → send connection request → mesh `publishToUrls` → same path Soft L3 uses.

---

## Proof

| Layer | Command |
|-------|---------|
| L1 | vitest invite contracts + path-b-b2-2-exit |
| L2/L3 | Manual or Soft L3 adjacent — connection request optional; Soft L3 re-proof when CDP stable |

### Claim

| May say | When |
|---------|------|
| **Implemented** | L1 + no standalone import in invite-manager |
| W66 ready | After Implemented + native invite smoke |
| Fixed (invites) | L3 send evidence |

---

## Status

**Implemented** — standalone fallback removed; mesh via `configureInviteRequestTransportBridge` (main-shell) only; fail-closed when unset.
