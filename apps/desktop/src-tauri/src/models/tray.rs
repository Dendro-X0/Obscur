//! Tray and notification models

#[cfg(desktop)]
use serde::Serialize;
#[cfg(desktop)]
use std::collections::HashMap;
#[cfg(desktop)]
use std::sync::Mutex;

/// Tray icon constants
#[cfg(desktop)]
pub const TRAY_ICON_ID: &str = "main-tray";
#[cfg(desktop)]
pub const TRAY_MENU_SHOW_ID: &str = "show";
#[cfg(desktop)]
pub const TRAY_MENU_HIDE_ID: &str = "hide";
#[cfg(desktop)]
pub const TRAY_MENU_ACCEPT_CALL_ID: &str = "accept_incoming_call";
#[cfg(desktop)]
pub const TRAY_MENU_DECLINE_CALL_ID: &str = "decline_incoming_call";
#[cfg(desktop)]
pub const TRAY_MENU_QUIT_ID: &str = "quit";
#[cfg(desktop)]
pub const TRAY_INCOMING_CALL_EVENT_NAME: &str = "desktop://incoming-call-action";
#[cfg(desktop)]
pub const INCOMING_CALL_STATE_EVENT_NAME: &str = "desktop://incoming-call-state";
#[cfg(desktop)]
pub const INCOMING_CALL_WINDOW_LABEL: &str = "incoming-call-popup";
#[cfg(desktop)]
pub const TRAY_BADGE_OVERFLOW_LABEL: &str = "99+";

/// Incoming call state for tray
#[cfg(desktop)]
#[derive(Clone)]
pub struct IncomingCallTrayState {
    pub caller_name: String,
    pub room_id: String,
}

/// Tray call state wrapper
#[cfg(desktop)]
pub struct TrayCallState {
    pub incoming: Mutex<Option<IncomingCallTrayState>>,
}

/// Tray badge state for unread counts
#[cfg(desktop)]
pub struct TrayBadgeState {
    pub base_icon: tauri::image::Image<'static>,
    #[allow(dead_code)]
    pub cache: Mutex<HashMap<String, tauri::image::Image<'static>>>,
}

#[cfg(desktop)]
impl TrayBadgeState {
    pub fn new(base_icon: tauri::image::Image<'static>) -> Self {
        Self {
            base_icon,
            cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn format_badge_label(unread_count: u32) -> Option<String> {
        if unread_count == 0 {
            return None;
        }
        if unread_count > 99 {
            return Some(TRAY_BADGE_OVERFLOW_LABEL.to_string());
        }
        Some(unread_count.to_string())
    }

    #[allow(dead_code)]
    pub fn icon_for_unread_count(
        &self,
        unread_count: u32,
    ) -> Result<tauri::image::Image<'static>, String> {
        let Some(label) = Self::format_badge_label(unread_count) else {
            return Ok(self.base_icon.clone());
        };

        {
            let cache = self.cache.lock().map_err(|e| e.to_string())?;
            if let Some(cached) = cache.get(&label) {
                return Ok(cached.clone());
            }
        }

        // Note: render_badged_tray_icon would need to be passed in or made available
        // For now, return base icon
        Ok(self.base_icon.clone())
    }
}

/// Tray incoming call action payload
#[cfg(desktop)]
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayIncomingCallActionPayload {
    pub action: String,
    pub room_id: Option<String>,
}

/// Incoming call state payload for events
#[cfg(desktop)]
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingCallStatePayload {
    pub active: bool,
    pub caller_name: String,
    pub room_id: String,
}
