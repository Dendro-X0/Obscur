//! Window control commands

#[cfg(desktop)]
use crate::models::window::{WindowState, MAIN_WINDOW_LABEL, PERSIST_WINDOW_STATE_IN_DEBUG};
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

/// Close the window (hides on desktop for background mode)
#[tauri::command]
pub async fn window_close(window: Window, app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(webview_window) = app.get_webview_window(window.label()) {
            if let Ok(state) = capture_window_state(&webview_window) {
                let _ = write_window_state(&app, webview_window.label(), &state);
            }
        }
        return window.hide().map_err(|e| e.to_string());
    }
    #[cfg(mobile)]
    {
        let _ = window;
        let _ = app;
        Ok(())
    }
}

/// Show and focus the window
#[tauri::command]
pub async fn window_show_and_focus(window: Window, app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        let target_window = app
            .get_webview_window(window.label())
            .or_else(|| app.get_webview_window(MAIN_WINDOW_LABEL));
        let Some(target_window) = target_window else {
            return Err("Main window unavailable".to_string());
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
