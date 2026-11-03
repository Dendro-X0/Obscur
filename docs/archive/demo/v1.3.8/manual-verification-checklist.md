# v1.3.8 Manual Verification Checklist

Mark each gate after completing replay on desktop + PWA targets.

## Offline UX Replay (M2)

- [x] PWA offline boot: app shell renders with local assets only after switching browser offline mode.
- [x] PWA offline navigation: core shell navigation remains usable while network-only surfaces show degraded messaging.
- [ ] Desktop offline state: offline indicator + degraded messaging copy appear deterministically when network drops.
- [x] Reconnect transition: degraded/offline UI recovers to ready state after network restoration without reload.
- [ ] Desktop foreground incoming-message card replay: while on a non-chat route, receive DM and verify Obscur in-app card shows `Reply`, `Mark read`, `Open chat` with sender/context/timestamp and badge row.
- [ ] Desktop card action replay: verify `Open chat` and `Reply` navigate into the target conversation and `Mark read` clears the conversation unread indicator.
- [ ] Desktop incoming-call popup + card visual consistency replay: with app minimized/backgrounded, incoming call popup uses the same premium card visual language and actionable `Accept/Decline` controls.

## In-App Update Replay (M2)

- [ ] Update success path: previous stable desktop build detects candidate update and completes in-app upgrade flow.
- [ ] Update failure path (verification): tampered/bad-signature payload is rejected and current version is preserved.
- [ ] Rollout controls path: kill-switch/rollout holdback blocks install with clear user-facing reason.
- [ ] Min-safe path: below-min-safe version surfaces force-update guidance.

## Diagnostics Capture (M2)

- [x] Attach offline replay diagnostics (events, logs, screenshots/video) under `docs/assets/demo/v1.3.8/raw/` or `gifs/`.
- [ ] Attach updater replay diagnostics (success + failure + rollout-block examples).
- [ ] Update `runtime-evidence-summary.json` with final replay verdicts and artifact references.

## Release Closeout (M3)

- [ ] Publish `v1.3.8` tag and verify production updater path.
- [ ] Append final checkpoint marking v1.3.8 plan complete.
- [ ] Confirm roadmap deletion guard conditions are fully true before removing plan file.

## Final Manual Verdict

- [ ] Manual verification pass accepted for `v1.3.8` closeout.
- Notes:
  - `v1.3.8` tag has been pushed to `origin`; production updater-path verification remains open.
  - 2026-04-06 UTC production replay confirms SW control and offline reload success:
    `raw/pwa-offline-replay.json` (`swControlled=true`, `offlineBootOk=true`, `offlineNavOk=true`).
  - New replay artifacts captured:
    `raw/pwa-online.png`, `raw/pwa-offline.png`, `raw/pwa-offline-settings.png`, `raw/pwa-reconnect.png`.
  - Remaining manual blockers are desktop offline-state replay and in-app updater success/failure/rollout/min-safe replays.
  - Notification UX parity blockers now include foreground message-card actions (`Reply/Mark read/Open chat`) and incoming-call popup/card visual consistency replay.
