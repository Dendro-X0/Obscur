# Investigation — Update CTA no-op + website/GitHub version skew (2026-08)

## Symptom

- In-app **Update Available** shows: `Update policy manifest is invalid; update was blocked for safety.`
- Primary button label **Update Blocked**; click does nothing (no install, no browser open).
- Official website `/download` served **v1.9.14** while GitHub Release is **v1.9.16**.

## Allowed by handoff

PAUSED dialect research — **website/demo polish** and **critical regression fixes** allowed. No dialect / Tor Verified / groups / AUTH-SESSION.

## Root causes

### A. Policy parse passes a string into an object parser

`loadStreamingPolicyManifestResult` and `fetchRepoChannelDownloadRelease` fetch policy text, then call `parseStreamingUpdateManifest(raw)` without `JSON.parse`.

`parseStreamingUpdateManifest` requires an object (`isObjectRecord`). A JSON string always yields `{ ok: false, reason: "manifest must be an object" }` → `blockReasonCode: "manifest_invalid"` → `deliveryMode: "blocked"`.

Repo channel file `apps/desktop/release/channel/stable/streaming-update-policy.json` is also stale (**1.8.14**, placeholder checksums/signatures). Published release asset for v1.9.16 is correct and should be copied to the stable channel.

### B. Blocked CTA is a no-op

When `deliveryMode === "blocked"`:

- Button `onClick` → `installUpdate` (only `download_only` opens the download URL).
- `installUpdate` early-returns unless `deliveryMode === "streaming" && eligible`.

So the visible primary action does nothing.

### C. Website download truth stuck on release-assets manifest 1.9.14

`apps/website` reads `release-assets/manifest.json` (still **1.9.14**) and builds hrefs as `github.com/.../raw/main/release-assets/...`. GitHub Release **v1.9.16** already has the binaries + digests; manifest was not regenerated after publish.

## Fix plan (subtraction / smallest slice)

1. Accept JSON text in `parseStreamingUpdateManifest` (canonical owner) so all callers are safe.
2. When delivery is `blocked` or `download_only`, primary CTA opens official download / release URL (not a dead "Update Blocked" install path).
3. Rewrite `release-assets/manifest.json` for **1.9.16** using published release digests; point website artifact hrefs at **GitHub Releases download** URLs (same assets as secondary channel; avoids requiring huge binaries on `main` raw).
4. Replace stable channel `streaming-update-policy.json` with the published v1.9.16 policy.
5. Checkpoint handoff: Segment A recorded (~45s); dual-channel sync + updater fix.

## Proof

| Layer | Command / evidence |
|-------|-------------------|
| L1 | Vitest: `streaming-update-policy.test.ts` (+ string parse case) |
| L1 | `pnpm -C apps/website` build or targeted typecheck if touched |
| L2 | Manual: Settings → Updates shows Open download page; opens `/download` or release |
| L3 | After deploy: website shows **v1.9.16** checksums matching GitHub Release |

## Non-goals

- Enabling signed in-app streaming install end-to-end (placeholder `.sig` / updater keys).
- Dialect / Tor Verified / community.
