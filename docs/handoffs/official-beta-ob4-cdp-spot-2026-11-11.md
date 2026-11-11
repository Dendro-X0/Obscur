# Official Beta OB4 — packaged CDP spot (2026-11-11)

- **Verdict:** **Pass (attach)** · packaged title still foundation lab wording · Soft L3 / Continuity Pass **not** claimed
- **Surface:** `E:\Obscur\obscur_desktop_app.exe` · `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9230`
- **CDP:** `http://127.0.0.1:9230/json/version` **200** · Browser Edg/157
- **Page:** url `http://tauri.localhost/` · title **Obscur · desktop-ui lab** (installed foundation beta.10 face)

## Ladder

| Check | Result |
|-------|--------|
| WebView2 CDP attach `:9230` | **Pass** |
| Remaster Vite url (`tauri.localhost`) | **Pass** |
| Packaged page title = product `Obscur` | **Fail / owed** — still foundation “desktop-ui lab” until Official Beta cut rebuild (OB5) |
| Source `apps/desktop-ui` title `Obscur` | **Pass** (index.html + dist after `verify:ob4`) |
| Soft L3 / Continuity Pass | **Not claimed** |

## Claim language

- May say: OB4 source product chrome Pass; packaged CDP attach works; installed artifact still foundation title until OB5 cut
- Must not say: Soft L3 Fixed · Continuity Pass · packaged Official Beta title Pass · Matrix promote

JSON: [`official-beta-ob4-cdp-spot-2026-11-11.json`](./official-beta-ob4-cdp-spot-2026-11-11.json)
