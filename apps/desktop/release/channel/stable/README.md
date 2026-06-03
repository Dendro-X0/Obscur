# Stable desktop update channel (repo-hosted)

Obscur desktop checks this folder on **`main`** for in-app streaming updates. This replaces GitHub Releases **Latest** and the Full Release workflow for day-to-day distribution.

## Files

| File | Role |
|------|------|
| `latest.json` | Tauri updater feed (signed platform artifacts) |
| `streaming-update-policy.json` | Rollout / kill-switch / checksum policy for the PWA updater UI |
| `version.json` | Optional mirror — canonical version is repo root [`version.json`](../../../../version.json) |

## Publish (maintainer, local — no CI)

```bash
# Package installer on your machine (~10–25 min typical; you get a file at the end)
pnpm desktop:package

# Optional: wire in-app updates after signed build
pnpm desktop:package --publish-channel
git add apps/desktop/release/channel/stable version.json
git commit -m "chore(desktop): publish stable update channel"
git push origin main
```

Full runbook: [local-desktop-packaging.md](../../../program/local-desktop-packaging.md)

Desktop clients poll `latest.json` from this path. Install runs **inside the app** (`dialog: false`) — no separate installer wizard.

## Unsigned / dev builds

`pnpm tauri dev` does not require channel artifacts. In-app install needs valid signatures in `latest.json` (generate with Tauri signer CLI).

## Overrides

| Env (build-time) | Effect |
|------------------|--------|
| `OBSCUR_STABLE_UPDATE_FEED_URL` | Rust updater feed URL |
| `NEXT_PUBLIC_STREAMING_UPDATE_FEED_URL` | PWA policy / UI |
| `NEXT_PUBLIC_STREAMING_UPDATE_POLICY_URL` | Policy manifest |
| `NEXT_PUBLIC_PREFER_REPO_UPDATE_CHANNEL=0` | Fall back to legacy GitHub Releases API |
