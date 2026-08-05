# CodaCtrl Studio — F5 / refresh boot crash (`Studio failed to load: unknown`)

**Date:** 2026-07-30  
**Subject:** CodaCtrl Studio shell (not Obscur)  
**Symptom:** After refresh (F5 / Reload), WebView shows dark screen: `Studio failed to load: unknown`  
**Severity:** Blocks Monitor capture + Obscur R-AUTH prove (operator cannot use Studio UI)  
**MCP status:** Daemon(s) still respond — Cursor MCP ≠ Studio UI health

---

## Evidence gathered (this machine)

| Signal | Value |
|--------|--------|
| Splash source | `apps/desktop/index.html` — `window` `error` capture; `detail = event.message \|\| error.message \|\| "unknown"` |
| Crashpad reports | **Empty** (`Crashpad/reports/` no dumps) — not a native process abort |
| Watchdog | `shell boot: boot-start` → `boot-rendered` on cold start; **no** `boot-fatal` line after refresh fail |
| Dual window | `main` → CodaCtrl repo · daemon **:46231** · `studio-1` → Obscur · daemon **:46232** |
| Dual `codactrld` | PIDs present on both ports; reconcile thrashing `["main","studio-1"]` in `watchdog.log` |
| Vite `:5173` | **Not listening** (Studio Vite closed) — DEV `devUrl` is `http://127.0.0.1:5173` |
| Installed UI process | `CodaCtrl Studio` still running while splash shows failure |

Window session files:

```json
// %AppData%/com.codactrl.desktop/windows/main.json
{ "path": "E:\\Experimental projects\\codactrl", "daemon_port": 46231 }

// studio-1.json  
{ "path": "E:\\Web Projects\\experimental-workspace\\obscur", "daemon_port": 46232 }
```

---

## Ranked hypotheses

| ID | Hypothesis | Why it fits |
|----|------------|-------------|
| **S1** | Module / chunk load fails on F5; WebView2 emits Script error with **empty** `message` → splash prints **`unknown`** | No Crashpad; splash still in DOM (React never `removeBootSplash`); only `error` listener, no `unhandledrejection` |
| **S2** | Installed build F5 reloads while **dist assets stale / hashed chunk 404** after `deploy:installed` mismatch | Classic Tauri asset reload; cold start worked earlier (boot-rendered) |
| **S3** | DEV shell F5 hits `devUrl :5173` but Vite is down → module script fails | `tauri.conf.json` `devUrl`; port 5173 was closed in MCP env scan |
| **S4** | Dual-window (`main` + `studio-1`) + dual daemon race corrupts WebView navigation / label query on reload | Watchdog reconcile flip-flop; WORKSPACE-MODEL = one window ↔ one repo |
| **S5** | Bootstrap stall → user hits Reload → same broken module graph (loop) | `studio-bootstrap-guard` / error-boundary call `location.reload()` |

**Primary:** **S1 + (S2 or S3)** — improve splash diagnostics first so “unknown” becomes a real URL/status.

---

## CodaCtrl product fixes (recommended)

1. **Splash diagnostics (P0)** — on `error` and `unhandledrejection`, show:
   - `event.filename` · `lineno` · `message`
   - `navigator.onLine` · `location.href`
   - failed `script[type=module]` `src` if present  
   Never collapse to bare `unknown` without those fields.

2. **F5 smoke gate** — extend `verify-o1e-ui-live.mjs`: cold paint **and** `page.reload()` then assert no `Studio failed to load`.

3. **Safe recovery path** — when splash fails, buttons: Safe mode · Open DevTools · Copy diagnostics (not only dark text).

4. **Dual-window guard** — warn when `main` + `studio-1` both live; document “one Studio window for Obscur prove”; optional auto-close orphan window on F5.

5. **DEV vs installed** — if `devUrl` host unreachable, splash should say `Vite :5173 not reachable` instead of `unknown`.

---

## Operator recovery (now)

1. Quit **all** CodaCtrl Studio windows (main + studio-1).  
2. Kill leftover `codactrld` if ports stay up (`46231` / `46232`).  
3. Relaunch **one** Studio window; open **Obscur** only.  
4. If crash returns: DevTools → Console → copy first red error; or safe mode:  
   `localStorage.setItem('studio_safe_mode_v1','1')` then reload.  
5. Prefer **Restart Studio app** over F5 until S1 splash fix ships.  
6. Cursor MCP can continue (daemon alive) — but **Monitor capture needs a healthy Studio UI**.

---

## Impact on Obscur R-AUTH

Blocked on operator Studio UI + Obscur CDP `:9230`. MCP salvage pathway is at **prove**; do not claim client-visible auth fix while Studio shell cannot survive refresh.
