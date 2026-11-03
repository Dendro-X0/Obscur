# Investigation — Dev window vanishes to tray within ~1s

**Status:** Fix implemented · L3 smoke pending · 2026-07-28  
**Symptom:** `pnpm dev:desktop` / `apps/desktop` cargo run — window appears briefly, then only tray icon remains  
**Band:** Production parity recovery (blocks L3 smoke)

---

## Evidence (live process)

| HWND class | Visible | Size | Notes |
|------------|---------|------|-------|
| `tray_icon_app` | **False** | 1440×753 @ (104,104) | Real main window was **hidden** (pre-fix) |
| `Tao Thread Event Target` | True | 16×16 @ (0,0) | Helper; Process.MainWindowHandle points here (misleading) |

Post-fix check (5s after launch): `Tauri Window VIS=True` ~1216×809; process stays interactive.

So the app did not crash; `CloseRequested` → `prevent_close` + `hide()` (or `window_close` → hide) ran shortly after show.

Canonical owner: `apps/desktop/src-tauri/src/lib.rs` window event handler + `commands/window.rs` `window_close`.

---

## Fix

| Build | Close / X behavior |
|-------|-------------------|
| **debug** | Quit process (tray hide is hostile for day-to-day dev) |
| **release** | Hide to tray (product behavior) after startup guard |
| **Both** | Startup guard (~8s): ignore hide/close, poll + re-reveal if not visible |

---

## Proof

- Launch debug exe → main `Tauri Window` stays `VIS=True` ≥5s
- Release: close still hides to tray after guard; tray Show restores
