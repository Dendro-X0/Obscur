//! Tray and notification helper functions

use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use crate::models::tray::*;

/// Create tray menu with optional incoming call state
#[cfg(desktop)]
pub fn create_tray_menu(
    app: &AppHandle,
    incoming_call: Option<&IncomingCallTrayState>,
) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let show = MenuItem::with_id(app, TRAY_MENU_SHOW_ID, "Show", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, TRAY_MENU_HIDE_ID, "Hide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, TRAY_MENU_QUIT_ID, "Quit", true, None::<&str>)?;

    let menu = if let Some(call) = incoming_call {
        let accept = MenuItem::with_id(
            app,
            TRAY_MENU_ACCEPT_CALL_ID,
            format!("Accept call from {}", call.caller_name),
            true,
            None::<&str>,
        )?;
        let decline = MenuItem::with_id(
            app,
            TRAY_MENU_DECLINE_CALL_ID,
            "Decline call",
            true,
            None::<&str>,
        )?;
        Menu::with_items(
            app,
            &[
                &accept,
                &decline,
                &PredefinedMenuItem::separator(app)?,
                &show,
                &hide,
                &PredefinedMenuItem::separator(app)?,
                &quit,
            ],
        )
    } else {
        Menu::with_items(
            app,
            &[
                &show,
                &hide,
                &PredefinedMenuItem::separator(app)?,
                &quit,
            ],
        )
    };
    menu
}

/// Get current incoming call state from tray
#[cfg(desktop)]
pub fn current_incoming_tray_call_state(app: &AppHandle) -> Result<Option<IncomingCallTrayState>, String> {
    let state = app.state::<TrayCallState>();
    let guard = state.incoming.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

/// Build incoming call state payload
#[cfg(desktop)]
pub fn current_incoming_call_state_payload(app: &AppHandle) -> Result<IncomingCallStatePayload, String> {
    let incoming = current_incoming_tray_call_state(app)?;
    if let Some(value) = incoming {
        return Ok(IncomingCallStatePayload {
            active: true,
            caller_name: value.caller_name,
            room_id: value.room_id,
        });
    }
    Ok(IncomingCallStatePayload {
        active: false,
        caller_name: String::new(),
        room_id: String::new(),
    })
}

/// Emit incoming call state event
#[cfg(desktop)]
pub fn emit_incoming_call_state(app: &AppHandle) -> Result<(), String> {
    let payload = current_incoming_call_state_payload(app)?;
    app.emit(INCOMING_CALL_STATE_EVENT_NAME, payload)
        .map_err(|e| e.to_string())
}

/// Position incoming call window on primary monitor
#[cfg(desktop)]
pub fn position_incoming_call_window(window: &WebviewWindow) {
    let monitor = window.current_monitor().ok().flatten();
    let Some(monitor) = monitor else {
        return;
    };
    let monitor_size = monitor.size();
    let window_size = window.inner_size().unwrap_or(*monitor_size);
    let x = (monitor_size.width - window_size.width) as i32;
    let y = (monitor_size.height - window_size.height) as i32;
    let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }));
}

/// Ensure incoming call window exists and is visible
#[cfg(desktop)]
pub fn ensure_incoming_call_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window(INCOMING_CALL_WINDOW_LABEL) {
        let _ = existing.unminimize();
        let _ = existing.show();
        let _ = existing.set_focus();
        position_incoming_call_window(&existing);
        return Ok(existing);
    }

    let window = tauri::WebviewWindowBuilder::new(
        app,
        INCOMING_CALL_WINDOW_LABEL,
        tauri::WebviewUrl::App("/incoming-call".into()),
    )
    .title("Incoming Call")
    .resizable(false)
    .inner_size(360.0, 200.0)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| e.to_string())?;

    position_incoming_call_window(&window);
    Ok(window)
}

/// Hide incoming call window
#[cfg(desktop)]
pub fn hide_incoming_call_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(INCOMING_CALL_WINDOW_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Refresh tray menu based on current call state
#[cfg(desktop)]
pub fn refresh_tray_menu(app: &AppHandle) -> Result<(), String> {
    let incoming = current_incoming_tray_call_state(app)?;
    let menu = create_tray_menu(app, incoming.as_ref()).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id(TRAY_ICON_ID) {
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Clear incoming call state
#[cfg(desktop)]
pub fn clear_incoming_tray_call_state(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<TrayCallState>();
    let mut guard = state.incoming.lock().map_err(|e| e.to_string())?;
    *guard = None;
    Ok(())
}

/// Sync call surface state (window visibility)
#[cfg(desktop)]
pub fn sync_incoming_call_surface_state(app: &AppHandle) -> Result<(), String> {
    let payload = current_incoming_call_state_payload(app)?;
    if payload.active {
        let _ = ensure_incoming_call_window(app)?;
    } else {
        let _ = hide_incoming_call_window(app);
    }
    emit_incoming_call_state(app)?;
    Ok(())
}

/// Emit tray call action event
#[cfg(desktop)]
pub fn emit_tray_call_action(app: &AppHandle, action: &str) -> Result<(), String> {
    let room_id = current_incoming_tray_call_state(app)?
        .map(|value| value.room_id);
    app.emit(
        TRAY_INCOMING_CALL_EVENT_NAME,
        TrayIncomingCallActionPayload {
            action: action.to_string(),
            room_id,
        },
    )
    .map_err(|e| e.to_string())
}

// Badge icon rendering helpers

/// Get glyph bitmap for a character
#[cfg(desktop)]
pub fn glyph_rows(character: char) -> Option<[u8; 5]> {
    match character {
        '0' => Some([0b111, 0b101, 0b101, 0b101, 0b111]),
        '1' => Some([0b010, 0b110, 0b010, 0b010, 0b111]),
        '2' => Some([0b111, 0b001, 0b111, 0b100, 0b111]),
        '3' => Some([0b111, 0b001, 0b111, 0b001, 0b111]),
        '4' => Some([0b101, 0b101, 0b111, 0b001, 0b001]),
        '5' => Some([0b111, 0b100, 0b111, 0b001, 0b111]),
        '6' => Some([0b111, 0b100, 0b111, 0b101, 0b111]),
        '7' => Some([0b111, 0b001, 0b001, 0b001, 0b001]),
        '8' => Some([0b111, 0b101, 0b111, 0b101, 0b111]),
        '9' => Some([0b111, 0b101, 0b111, 0b001, 0b111]),
        '+' => Some([0b000, 0b010, 0b111, 0b010, 0b000]),
        _ => None,
    }
}

/// Set pixel in RGBA buffer
#[cfg(desktop)]
pub fn set_pixel_rgba(
    rgba: &mut [u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    color: [u8; 4],
) {
    if x >= width || y >= height {
        return;
    }
    let index = ((y * width) + x) * 4;
    if index + 3 >= rgba.len() {
        return;
    }
    rgba[index] = color[0];
    rgba[index + 1] = color[1];
    rgba[index + 2] = color[2];
    rgba[index + 3] = color[3];
}

/// Draw badge background bubble
#[cfg(desktop)]
pub fn draw_badge_background(
    rgba: &mut [u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    bubble_width: usize,
    bubble_height: usize,
    color: [u8; 4],
) {
    if bubble_width == 0 || bubble_height == 0 {
        return;
    }
    let radius = bubble_height / 2;
    let center_y = y + radius;
    let left_center_x = x + radius;
    let right_center_x = x + bubble_width.saturating_sub(radius + 1);

    for current_y in y..(y + bubble_height) {
        if current_y >= height {
            break;
        }
        for current_x in x..(x + bubble_width) {
            if current_x >= width {
                break;
            }

            let inside_middle = current_x >= left_center_x && current_x <= right_center_x;
            let within_left_arc = {
                let dx = left_center_x as isize - current_x as isize;
                let dy = center_y as isize - current_y as isize;
                (dx * dx + dy * dy) <= (radius as isize * radius as isize)
            };
            let within_right_arc = {
                let dx = right_center_x as isize - current_x as isize;
                let dy = center_y as isize - current_y as isize;
                (dx * dx + dy * dy) <= (radius as isize * radius as isize)
            };

            if inside_middle || within_left_arc || within_right_arc {
                set_pixel_rgba(rgba, width, height, current_x, current_y, color);
            }
        }
    }
}

/// Draw a glyph character
#[cfg(desktop)]
pub fn draw_glyph(
    rgba: &mut [u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    character: char,
    scale: usize,
    color: [u8; 4],
) {
    let Some(rows) = glyph_rows(character) else {
        return;
    };
    for (row_index, row_bits) in rows.iter().enumerate() {
        for col_index in 0..3 {
            let bit_mask = 1 << (2 - col_index);
            if (row_bits & bit_mask) == 0 {
                continue;
            }
            for sy in 0..scale {
                for sx in 0..scale {
                    set_pixel_rgba(
                        rgba,
                        width,
                        height,
                        x + (col_index * scale) + sx,
                        y + (row_index * scale) + sy,
                        color,
                    );
                }
            }
        }
    }
}

/// Render a badged tray icon with unread count
#[cfg(desktop)]
pub fn render_badged_tray_icon(
    base_icon: &tauri::image::Image<'static>,
    badge_label: &str,
) -> tauri::image::Image<'static> {
    let width = base_icon.width() as usize;
    let height = base_icon.height() as usize;
    let mut rgba = base_icon.rgba().to_vec();
    if width == 0 || height == 0 || badge_label.is_empty() {
        return tauri::image::Image::new_owned(rgba, base_icon.width(), base_icon.height());
    }

    let label_chars: Vec<char> = badge_label.chars().take(3).collect();
    let glyph_width = 3usize;
    let glyph_height = 5usize;
    let spacing = 1usize;
    let scale = if width >= 48 || height >= 48 { 3usize } else { 2usize };
    let text_width = ((label_chars.len() * glyph_width) + (label_chars.len().saturating_sub(1) * spacing)) * scale;
    let text_height = glyph_height * scale;

    let padding_x = scale + 1;
    let padding_y = scale;
    let mut bubble_height = text_height + (padding_y * 2);
    bubble_height = bubble_height.max((height / 2).max(12));
    let mut bubble_width = text_width + (padding_x * 2);
    bubble_width = bubble_width.max(bubble_height);
    bubble_width = bubble_width.min(width.saturating_sub(1));
    bubble_height = bubble_height.min(height.saturating_sub(1));

    let bubble_x = width.saturating_sub(bubble_width + 1);
    let bubble_y = 1usize;

    draw_badge_background(
        &mut rgba,
        width,
        height,
        bubble_x,
        bubble_y,
        bubble_width,
        bubble_height,
        [220, 38, 38, 255],
    );

    let text_x = bubble_x + (bubble_width.saturating_sub(text_width) / 2);
    let text_y = bubble_y + (bubble_height.saturating_sub(text_height) / 2);
    for (index, character) in label_chars.iter().enumerate() {
        let glyph_x = text_x + (index * (glyph_width + spacing) * scale);
        draw_glyph(
            &mut rgba,
            width,
            height,
            glyph_x,
            text_y,
            *character,
            scale,
            [255, 255, 255, 255],
        );
    }

    tauri::image::Image::new_owned(
        rgba,
        base_icon.width(),
        base_icon.height(),
    )
}
