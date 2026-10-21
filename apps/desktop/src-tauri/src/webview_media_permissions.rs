//! WebView2 media capture grants (Windows).
//! Spec: specs/backend/webview-media-permission-grant-design-2026-08.md
//!
//! Wry only auto-allows clipboard. Without an explicit PermissionRequested
//! handler, mic/camera can stick as DENY after Block — and Obscur's in-app
//! Allow cannot change WebView/OS state.

#[cfg(all(desktop, windows))]
use tauri::WebviewWindow;

#[cfg(all(desktop, windows))]
pub fn install_webview_media_permissions(window: &WebviewWindow) {
    if let Err(error) = window.with_webview(|platform| {
        unsafe {
            use webview2_com::Microsoft::Web::WebView2::Win32::{
                ICoreWebView2Profile4, ICoreWebView2_13, COREWEBVIEW2_PERMISSION_KIND,
                COREWEBVIEW2_PERMISSION_KIND_CAMERA, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
                COREWEBVIEW2_PERMISSION_STATE_ALLOW,
            };
            use webview2_com::{
                PermissionRequestedEventHandler, SetPermissionStateCompletedHandler,
            };
            use windows::core::{Interface, HSTRING};

            let controller = platform.controller();
            let Ok(core) = controller.CoreWebView2() else {
                eprintln!("[obscur] WebView2 CoreWebView2 unavailable — media permissions not installed");
                return;
            };

            let mut token = i64::default();
            let handler = PermissionRequestedEventHandler::create(Box::new(|_sender, args| {
                let Some(args) = args else {
                    return Ok(());
                };
                let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
                args.PermissionKind(&mut kind)?;
                if kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
                    || kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA
                {
                    args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
                }
                Ok(())
            }));
            if let Err(error) = core.add_PermissionRequested(&handler, &mut token) {
                eprintln!("[obscur] Failed to register WebView2 media PermissionRequested: {error}");
            }

            // Clear sticky DENY for common Tauri origins (best-effort).
            let Ok(core13) = Interface::cast::<ICoreWebView2_13>(&core) else {
                return;
            };
            let Ok(profile) = core13.Profile() else {
                return;
            };
            let Ok(profile4) = Interface::cast::<ICoreWebView2Profile4>(&profile) else {
                return;
            };

            const ORIGINS: &[&str] = &[
                "http://tauri.localhost/",
                "https://tauri.localhost/",
                "tauri://localhost/",
                "http://localhost/",
                "https://localhost/",
            ];
            const KINDS: [COREWEBVIEW2_PERMISSION_KIND; 2] = [
                COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
                COREWEBVIEW2_PERMISSION_KIND_CAMERA,
            ];

            for origin in ORIGINS {
                let origin_hstring = HSTRING::from(*origin);
                for kind in KINDS {
                    let completed =
                        SetPermissionStateCompletedHandler::create(Box::new(|_hr| Ok(())));
                    if let Err(error) = profile4.SetPermissionState(
                        kind,
                        &origin_hstring,
                        COREWEBVIEW2_PERMISSION_STATE_ALLOW,
                        &completed,
                    ) {
                        eprintln!(
                            "[obscur] SetPermissionState failed for {origin} kind={kind:?}: {error}"
                        );
                    }
                }
            }
        }
    }) {
        eprintln!(
            "[obscur] with_webview media permission install failed on '{}': {error}",
            window.label()
        );
    }
}

#[cfg(all(desktop, not(windows)))]
pub fn install_webview_media_permissions(_window: &tauri::WebviewWindow) {}

#[cfg(not(desktop))]
pub fn install_webview_media_permissions(_window: &tauri::WebviewWindow) {}
