//! Window state and related models

use serde::{Deserialize, Serialize};

/// Window state for persistence
#[cfg(desktop)]
#[derive(Serialize, Deserialize, Debug)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

/// Window constants
#[cfg(desktop)]
pub const MAIN_WINDOW_LABEL: &str = "main";
#[cfg(desktop)]
#[allow(dead_code)]
pub const DEFAULT_WINDOW_WIDTH: u32 = 1200;
#[cfg(desktop)]
#[allow(dead_code)]
pub const DEFAULT_WINDOW_HEIGHT: u32 = 800;
#[cfg(desktop)]
pub const MIN_WINDOW_WIDTH: u32 = 800;
#[cfg(desktop)]
pub const MIN_WINDOW_HEIGHT: u32 = 600;
#[cfg(desktop)]
pub const MAX_REASONABLE_WINDOW_WIDTH: u32 = 8192;
#[cfg(desktop)]
pub const MAX_REASONABLE_WINDOW_HEIGHT: u32 = 8192;
#[cfg(desktop)]
pub const MAX_REASONABLE_POSITION_ABS: i32 = 20_000;
#[cfg(desktop)]
pub const PERSIST_WINDOW_STATE_IN_DEBUG: bool = false;

/// Validates window position is reasonable
#[cfg(desktop)]
pub fn is_reasonable_window_position(x: i32, y: i32) -> bool {
    x.abs() <= MAX_REASONABLE_POSITION_ABS && y.abs() <= MAX_REASONABLE_POSITION_ABS
}

/// Sanitizes window state to ensure reasonable values
#[cfg(desktop)]
pub fn sanitize_window_state(state: WindowState) -> WindowState {
    WindowState {
        x: state.x.clamp(-MAX_REASONABLE_POSITION_ABS, MAX_REASONABLE_POSITION_ABS),
        y: state.y.clamp(-MAX_REASONABLE_POSITION_ABS, MAX_REASONABLE_POSITION_ABS),
        width: state
            .width
            .clamp(MIN_WINDOW_WIDTH, MAX_REASONABLE_WINDOW_WIDTH),
        height: state
            .height
            .clamp(MIN_WINDOW_HEIGHT, MAX_REASONABLE_WINDOW_HEIGHT),
        maximized: state.maximized,
    }
}
