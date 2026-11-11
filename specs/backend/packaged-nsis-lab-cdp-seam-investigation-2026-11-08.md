# Investigation — Packaged NSIS lab CDP seam (2026-11-08)

```text
Context: docs/handoffs/v2.0.0-beta.9-nsis-install-l2-2026-11-07.md Partial
PAUSED: claiming packaged dual-CDP Pass without a seam · Soft L3 Fixed · Tor
```

## Facts

1. Release builds: `profile_window_additional_browser_args` / main CDP helpers are `#[cfg(debug_assertions)]` only → `None` in release (`apps/desktop/src-tauri/src/profiles.rs`).
2. `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` is process-wide and was already rejected for dual-profile ports.
3. Soft L3 leave / invite / block L2 Pass on **static-dev** dual CDP (`:9230` / `:9231`) — not a substitute for packaged sticky claims.

## Options (design later; no code this turn)

| Option | Idea | Risk |
|--------|------|------|
| Lab env flag | Release binary enables CDP only when `OBSCUR_LAB_CDP=1` (or signed lab channel) | Must fail closed for retail installs |
| Debug soak shell | Dogfood debug desktop for sticky; never claim as NSIS | Claim discipline only |
| Manual evidence | Screenshots / human checklist on NSIS | Weak automation |

## Claim bounds

- May say: packaged dual CDP soak **blocked** until maintainer-approved lab seam
- Must not say: packaged Requests/leave/block L2 Pass
