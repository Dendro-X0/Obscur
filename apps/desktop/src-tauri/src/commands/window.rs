//! Window control commands

#[cfg(desktop)]
use crate::models::window::{WindowState, MAIN_WINDOW_LABEL, PERSIST_WINDOW_STATE_IN_DEBUG};

#[cfg(desktop)]
fn is_main_window_label(label: &str) -> bool {
    label == MAIN_WINDOW_LABEL
}
#[cfg(desktop)]
use tauri::Manager;
use tauri::{AppHandle, WebviewWindow, Window};

/// Minimize the window
#[tauri::command]
pub async fn window_minimize(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    return window.minimize().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(())
    }
}

/// Maximize the window
#[tauri::command]
pub async fn window_maximize(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    return window.maximize().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(())
    }
}

/// Unmaximize the window
#[tauri::command]
pub async fn window_unmaximize(window: Window) -> Result<(), String> {
    #[cfg(desktop)]
    return window.unmaximize().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(())
    }
}

/// Close the window — main window hides (tray); profile windows are destroyed.
#[tauri::command]
pub async fn window_close(window: Window, app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(webview_window) = app.get_webview_window(window.label()) {
            if let Ok(state) = capture_window_state(&webview_window) {
                let _ = write_window_state(&app, webview_window.label(), &state);
            }
        }
        if is_main_window_label(window.label()) {
            return window.hide().map_err(|e| e.to_string());
        }
        return window.close().map_err(|e| e.to_string());
    }
    #[cfg(mobile)]
    {
        let _ = window;
        let _ = app;
        Ok(())
    }
}

/// Show and focus the invoking window (used after profile boot in secondary windows).
#[tauri::command]
pub async fn window_show_and_focus(window: Window, app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let target_window = app
            .get_webview_window(window.label())
            .or_else(|| app.get_webview_window(MAIN_WINDOW_LABEL));
        let Some(target_window) = target_window else {
            return Err("Window unavailable".to_string());
        };
        target_window.unminimize().map_err(|e| e.to_string())?;
        target_window.show().map_err(|e| e.to_string())?;
        target_window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(mobile)]
    {
        let _ = window;
        let _ = app;
        Ok(())
    }
}

/// Focus and show a window by label (dev agent bridge; native path bypasses webview ACL).
#[tauri::command]
#[cfg(desktop)]
pub async fn desktop_agent_focus_window(app: AppHandle, label: String) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let target_label = label.trim();
        if target_label.is_empty() {
            return Err("window label required".to_string());
        }
        let Some(window) = app.get_webview_window(target_label) else {
            return Err(format!("no window with label {target_label}"));
        };
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = app;
        let _ = label;
        Err("desktop_agent_focus_window is only available in debug builds".to_string())
    }
}

/// Reveal the current webview after frontend boot — secondary profile windows start hidden.
#[tauri::command]
pub async fn window_reveal_current(window: WebviewWindow) -> Result<(), String> {
    #[cfg(desktop)]
    {
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(())
    }
}

/// Check if window is maximized
#[tauri::command]
pub async fn window_is_maximized(window: Window) -> Result<bool, String> {
    #[cfg(desktop)]
    return window.is_maximized().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(true)
    }
}

/// Set window fullscreen state
#[tauri::command]
pub async fn window_set_fullscreen(window: Window, fullscreen: bool) -> Result<(), String> {
    #[cfg(desktop)]
    return window.set_fullscreen(fullscreen).map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        let _ = fullscreen;
        Ok(())
    }
}

/// Check if window is fullscreen
#[tauri::command]
pub async fn window_is_fullscreen(window: Window) -> Result<bool, String> {
    #[cfg(desktop)]
    return window.is_fullscreen().map_err(|e| e.to_string());
    #[cfg(mobile)]
    {
        let _ = window;
        Ok(true)
    }
}

/// Capture current window state
#[cfg(desktop)]
pub fn capture_window_state(window: &WebviewWindow) -> Result<WindowState, String> {
    use crate::models::window::sanitize_window_state;
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    Ok(sanitize_window_state(WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
    }))
}

/// Write window state to disk
#[cfg(desktop)]
pub fn write_window_state(
    app: &AppHandle,
    window_label: &str,
    state: &WindowState,
) -> Result<(), String> {
    if cfg!(debug_assertions) && !PERSIST_WINDOW_STATE_IN_DEBUG {
        return Ok(());
    }
    if window_label != MAIN_WINDOW_LABEL {
        return Ok(());
    }

    let state_json = serde_json::to_string(state).map_err(|e| e.to_string())?;
    if let Ok(app_dir) = app.path().app_data_dir() {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let state_path = app_dir.join("window_state.json");
        std::fs::write(state_path, state_json).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Save window state command
#[tauri::command]
pub async fn save_window_state(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Ok(state) = capture_window_state(&window) {
            let _ = write_window_state(&app, window.label(), &state);
        }
        Ok(())
    }
    #[cfg(mobile)]
    {
        let _ = window;
        let _ = app;
        Ok(())
    }
}
