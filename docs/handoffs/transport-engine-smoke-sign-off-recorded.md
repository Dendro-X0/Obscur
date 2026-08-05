# Transport Engine — Live Desktop Publish Smoke Sign-Off (Recorded)

**Recorded sign-off.** Maintainer authorized W66 deletion (chat: `deletion`, 2026-08-04).

## Metadata

| Field | Value |
|-------|-------|
| Commit hash | `de421beae7dbf76c92efaceb3c9edc53dfb6426f` |
| Smoke date (UTC) | `2026-08-04T07:05:00Z` |
| Maintainer | chat authorization `deletion` |
| Verify gate | `pnpm verify:transport-engine-w68` Pass · invite mesh smoke Pass |

## Lab env used

| Env | Value |
|-----|-------|
| `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY` | unset / `0` (production-parity desktop) |
| Invite mesh evidence | `test-results/invite-mesh-smoke-2026-08-04.json` · marker `INV-MESH-msebc0ca` · `[dm-send] confirmed` |
| Mesh owner | `pool.publishToUrls` via `configureInviteRequestTransportBridge` (no standalone) |

## Evidence summary

- Invite connection-request publish on Tauri static shell via mesh (not `publishToUrlsStandalone`)
- `pnpm verify:transport-engine-w68` Pass after invite pin retarget (w12/w24)
- Product publish path uses mesh; standalone legacy safe to subtract

## Decision

**Decision:** PASS

**Blockers (if any):** none — maintainer authorized deletion

---

*Standalone `transport-kernel-standalone-publish-legacy.ts` deletion requires `Decision: PASS` plus `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`.*
