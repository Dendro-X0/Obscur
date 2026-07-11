# Demo GIF readiness — 2026-07-07

**Stack:** Docker relay `:7000` · coordination `:8787` · static-shell Tauri CDP `:9230`

## Verified (automated t3)

| Segment | GIF asset | Status | Evidence |
|---------|-----------|--------|----------|
| §2 Unlock | `obscur_login_1.gif` | **PASS** | Shell after Tester1 import + password |
| §4 Settings nav | `obscur_settings_panel_1.gif` | **PASS** | `/settings` · no Welcome Back kick |
| §4 Relays | `coordination_relay_settings_1.gif` | **PASS** | `1/5 active relays` with Docker up |

## Needs manual thread / second window

| Segment | GIF asset | Status | Next step |
|---------|-----------|--------|-----------|
| §3 DM send | `obscur_chat_ui_1.gif` | **BLOCKED** | Open a DM thread (sidebar row) then re-run probe or record GIF |
| §6 Group | `community_group_send_receive_1.gif` (P0 gap) | **PENDING** | Chats → **Group** toggle → NewTest 2 · dual-profile send |
| §5 Multi-profile | `multi_profile_management_1.gif` | **PENDING** | Second window / profile picker — manual capture |
| §7 Media/voice | `multimedia_*` · `voice_*` | **PENDING** | Open DM compose · attach file · voice surface |

## GIF capture recipe (now unblocked)

1. Keep **three terminals:** `dev:relay:docker` · `dev:coordination` · `dev:desktop:no-coord -- --skip-build`
2. Unlock **Tester1** (import key once per fresh profile dir)
3. Record with ShareX / ScreenToGif — 1280×720 · 8–15s loops
4. Priority order: **§6 group** → §2 login → §3 DM → §4 settings → §5 multi-profile → §7 media

## Probe commands

```bash
node scripts/demo-gif-readiness-probe.mjs
# report → .codectx/verify/demo-gif-readiness-2026-07-07/report.json
```

**CodaCtrl:** `client_session_connect { cdpPort: 9230, skipStackPreflight: true }` then step through script; `client_demo_record_gif` after `autoScreenshot` on connect.
