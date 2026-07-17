#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(desktop)]
use tauri::{
    tray::{TrayIconBuilder, TrayIconEvent},
};
use tauri::{Emitter, Manager};
#[cfg(desktop)]
use tauri::WebviewWindow;
// use tauri_plugin_updater::UpdaterExt;
use serde_json::json;
use std::sync::Mutex;
// use std::time::Duration;
use tauri_plugin_deep_link::DeepLinkExt;
// use tauri_plugin_shell::process::{CommandChild, CommandEvent};
// use tauri_plugin_shell::ShellExt;
mod net;
mod native_keychain;
mod keychain_session_envelope;
mod protocol;
mod profiles;
mod active_session_leases;
mod relay;
mod session;
mod upload;
mod wallet;
mod models;
mod commands;
mod update_channel;
mod data_root;
mod platform_biometric;
mod profile_web_storage_harvest;
mod storage_at_rest_state;
mod data_root_bind;
mod windows_junction;
mod local_save_scan;
mod warmup;
mod services;
pub mod dev_shell_freshness;

use profiles::DesktopProfileState;
use active_session_leases::ActiveSessionLeaseState;
use session::SessionState;
use commands::warmup::DesktopWarmupState;
use commands::tor::{load_tor_settings, start_tor};
#[cfg(desktop)]
use commands::tor::stop_tor_child;
#[cfg(desktop)]
use commands::window::{capture_window_state, write_window_state};

// Import window models
#[cfg(desktop)]
use models::window::{
    WindowState,
    PERSIST_WINDOW_STATE_IN_DEBUG,
    sanitize_window_state,
    is_reasonable_window_position,
    reveal_desktop_window,
};

// Import tray models and services
#[cfg(desktop)]
use models::tray::{TrayCallState, TrayBadgeState, TRAY_ICON_ID, TRAY_MENU_SHOW_ID, TRAY_MENU_HIDE_ID, TRAY_MENU_ACCEPT_CALL_ID, TRAY_MENU_DECLINE_CALL_ID, TRAY_MENU_QUIT_ID};
#[cfg(desktop)]
use services::tray::*;
use models::tor::{TorRuntimeStatus, TorState};

// Load window state from storage
#[cfg(desktop)]
fn load_window_state(app: &tauri::AppHandle) -> Option<WindowState> {
    if cfg!(debug_assertions) && !PERSIST_WINDOW_STATE_IN_DEBUG {
        return None;
    }
    let app_dir = app.path().app_data_dir().ok()?;
    let state_path = app_dir.join("window_state.json");
    let state_json = std::fs::read_to_string(state_path).ok()?;
    let raw = serde_json::from_str::<WindowState>(&state_json).ok()?;
    Some(sanitize_window_state(raw))
}

// Apply saved window state
#[cfg(desktop)]
fn apply_window_state(window: &WebviewWindow, state: WindowState) {
    let _ = window.set_resizable(true);
    if state.maximized {
        let _ = window.maximize();
    } else {
        if is_reasonable_window_position(state.x, state.y) {
            let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: state.x as i32,
                y: state.y as i32,
            }));
        }
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: state.width as u32,
            height: state.height as u32,
        }));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_store::Builder::new().build());

    builder
        .setup(|app| {
            app.manage(relay::RelayPool::new());
            let settings = load_tor_settings(&app.handle());

            app.manage(net::NativeNetworkRuntime::new(
                settings.enable_tor,
                settings.proxy_url.clone(),
            ));

            // Manage SessionState
            app.manage(SessionState::new());
            app.manage(DesktopProfileState::new(&app.handle()));
            match ActiveSessionLeaseState::new(&app.handle()) {
                Ok(lease_state) => {
                    app.manage(lease_state);
                }
                Err(error) => {
                    eprintln!("[obscur] Failed to initialize active session leases: {error}");
                }
            }
            app.manage(storage_at_rest_state::StorageAtRestState::new());

            let _ = crate::data_root::bootstrap_data_root_authority(&app.handle());

            let db_path = crate::data_root::resolve_effective_data_root(&app.handle())
                .unwrap_or_else(|_| {
                    app.path()
                        .app_data_dir()
                        .unwrap_or_else(|_| std::path::PathBuf::from("."))
                })
                .join("obscur.sqlite3");
            let db_state = commands::db::DbState::new_lazy(db_path);
            if let Err(error) = commands::db::bootstrap_sqlite_storage(&app.handle(), &db_state) {
                eprintln!("[obscur] Failed to bootstrap sqlite storage: {error}");
            }
            app.manage(db_state);
            app.manage(DesktopWarmupState::new());

            let protocol_db_path = crate::data_root::resolve_effective_data_root(&app.handle())
                .unwrap_or_else(|_| {
                    app.path()
                        .app_data_dir()
                        .unwrap_or_else(|_| std::path::PathBuf::from("."))
                })
                .join("protocol_state.sqlite3");
            app.manage(protocol::ProtocolState::new(protocol_db_path));

            // Manage TorState with loaded settings
            app.manage(TorState {
                child: Mutex::new(None),
                settings: Mutex::new(settings.clone()),
                runtime_status: Mutex::new(TorRuntimeStatus::Disconnected),
                using_external_instance: Mutex::new(false),
                logs: Mutex::new(Vec::new()),
            });

            // Start Tor if enabled
            if settings.enable_tor {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = start_tor(handle.clone(), handle.state()).await;
                });
            }

            // Create main window with proxy if enabled
            let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let health = crate::data_root::assess_data_root_bind_health(&app_data_dir);
            let main_data_dir = crate::data_root::resolve_webview_profile_workspace(
                &app.handle(),
                "default",
            )
            .unwrap_or_else(|error| {
                eprintln!("[obscur] Failed to resolve webview profile workspace: {error}");
                crate::data_root::recovery_webview_root(&app_data_dir)
                    .join("profiles")
                    .join("default")
            });

            #[cfg(desktop)]
            let _window = {
                let static_dev_stamp_script = if std::env::var("OBSCUR_DESKTOP_STATIC_DEV")
                    .ok()
                    .filter(|value| value == "1")
                    .is_some()
                {
                    let out_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                        .join("../../pwa/out");
                    match crate::dev_shell_freshness::read_shell_manifest_stamp(&out_dir) {
                        Ok(stamp) => {
                            eprintln!(
                                "[obscur] static-dev expected shell stamp: {stamp}"
                            );
                            crate::dev_shell_freshness::expected_shell_stamp_init_script(
                                &stamp,
                            )
                        }
                        Err(error) => {
                            eprintln!(
                                "[obscur] static-dev shell stamp unavailable: {error}"
                            );
                            String::new()
                        }
                    }
                } else {
                    String::new()
                };
                let base_builder = tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    profiles::resolve_profile_window_url(&app.handle()),
                )
                .initialization_script(&format!(
                    "{}{}{}",
                    profiles::main_window_boot_init_script(&app.handle()),
                    crate::data_root::data_root_boot_hint_script(&health),
                    static_dev_stamp_script,
                ))
                .data_directory(main_data_dir)
                .title("Obscur")
                .inner_size(1200.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .resizable(true)
                .decorations(false)
                .shadow(true); // We keep window shadow but remove OS border decorations
                #[cfg(debug_assertions)]
                let base_builder = if let Some(browser_args) = profiles::main_window_additional_browser_args() {
                    eprintln!("[obscur] Main window CDP args: {browser_args}");
                    base_builder.additional_browser_args(&browser_args)
                } else {
                    base_builder
                };
                #[cfg(debug_assertions)]
                let window_builder = base_builder
                    .visible(true)
                    .focused(true)
                    .center()
                    .devtools(true);
                #[cfg(not(debug_assertions))]
                let window_builder = base_builder.visible(false);
                window_builder.build().expect("Failed to build main window")
            };
            #[cfg(mobile)]
            let _window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .data_directory(main_data_dir)
            .build()
            .expect("Failed to build main window");
            let reset_app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let reset_state = reset_app.state::<DesktopProfileState>();
                if let Err(error) = reset_state.reset_startup_window_bindings(&reset_app).await {
                    eprintln!("[PROFILES] Startup window binding reset failed: {error}");
                }
            });
            #[cfg(desktop)]
            {
                let base_icon = app
                    .default_window_icon()
                    .cloned()
                    .ok_or("default window icon missing")?
                    .to_owned();
                app.manage(TrayCallState {
                    incoming: Mutex::new(None),
                });
                app.manage(TrayBadgeState::new(base_icon.clone()));
                let menu = create_tray_menu(&app.handle(), None)?;

                let _tray = TrayIconBuilder::with_id(TRAY_ICON_ID)
                    .icon(base_icon)
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        TRAY_MENU_QUIT_ID => {
                            let state = app.state::<TorState>();
                            let _ = stop_tor_child(&state);
                            app.exit(0);
                        }
                        TRAY_MENU_SHOW_ID => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        TRAY_MENU_HIDE_ID => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        TRAY_MENU_ACCEPT_CALL_ID => {
                            let _ = emit_tray_call_action(app, "accept");
                            let _ = clear_incoming_tray_call_state(app);
                            let _ = refresh_tray_menu(app);
                            let _ = sync_incoming_call_surface_state(app);
                        }
                        TRAY_MENU_DECLINE_CALL_ID => {
                            let _ = emit_tray_call_action(app, "decline");
                            let _ = clear_incoming_tray_call_state(app);
                            let _ = refresh_tray_menu(app);
                            let _ = sync_incoming_call_surface_state(app);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: tauri::tray::MouseButton::Left,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            // Load and apply saved window state
            #[cfg(desktop)]
            {
                if let Some(state) = load_window_state(&app.handle()) {
                    apply_window_state(&_window, state);
                }

                reveal_desktop_window(&_window, "setup");

                let failsafe_window = _window.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    if failsafe_window.is_visible().unwrap_or(true) {
                        return;
                    }
                    eprintln!("[WINDOW] Failsafe reveal for main window after startup");
                    reveal_desktop_window(&failsafe_window, "failsafe");
                });
            }

            // Save window state and intercept close
            #[cfg(desktop)]
            {
                let app_handle = app.handle().clone();
                let window_clone = _window.clone();
                _window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            if let Ok(state) = capture_window_state(&window_clone) {
                                let _ = write_window_state(&app_handle, window_clone.label(), &state);
                            }
                            // Prevent the window from closing and hide it instead
                            api.prevent_close();
                            let _ = window_clone.hide();
                        }
                        tauri::WindowEvent::Destroyed => {
                            let state = app_handle.state::<TorState>();
                            let _ = stop_tor_child(&state);
                        }
                        _ => {}
                    }
                });
            }

            // Register deep link handler
            let app_handle = app.handle().clone();
            // Deep link registration might be platform specific or handled by plugin
            // #[cfg(desktop)]
            // app.deep_link().register_all()?;

            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                let url = urls.first().map(|u| u.as_str()).unwrap_or("").to_string();

                // Emit event to frontend
                if let Some(window) = app_handle.get_webview_window("main") {
                    #[cfg(desktop)]
                    {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    let _ = window.emit("deep-link", json!({ "url": url }));
                }
            });

            Ok(())
        })
        .invoke_handler({
            #[cfg(desktop)]
            {
                tauri::generate_handler![
                    commands::window::window_minimize,
                    commands::window::window_maximize,
                    commands::window::window_unmaximize,
                    commands::window::window_close,
                    commands::window::window_show_and_focus,
                    commands::window::window_reveal_current,
                    commands::window::desktop_agent_focus_window,
                    commands::window::window_is_maximized,
                    commands::window::window_set_fullscreen,
                    commands::window::window_is_fullscreen,
                    commands::window::save_window_state,
                    commands::tray::set_tray_unread_badge_count,
                    commands::tray::set_tray_incoming_call_state,
                    commands::tray::desktop_get_incoming_call_state,
                    commands::tray::desktop_incoming_call_action,
                    commands::system::fetch_remote_text,
                    commands::system::fetch_remote_bytes,
                    commands::system::mesh_http_fetch_via_socks,
                    commands::system::check_for_updates,
                    commands::system::install_update,
                    commands::system::reset_app_storage,
                    commands::system::register_push_token,
                    commands::system::restart_app,
                    commands::system::desktop_open_storage_path,
                    commands::profile::desktop_get_profile_isolation_snapshot,
                    commands::profile::desktop_list_profiles,
                    commands::profile::desktop_create_profile,
                    commands::profile::desktop_rename_profile,
                    commands::profile::desktop_open_profile_window,
                    commands::profile::desktop_bind_window_profile,
                    commands::profile::desktop_remove_profile,
                    commands::profile::desktop_broadcast_profile_isolation_changed,
                    commands::profile::desktop_clear_profile_webview_data,
                    commands::profile::desktop_write_profile_workspace_archive,
                    commands::profile::desktop_list_profile_workspace_archives,
                    commands::profile::desktop_open_profile_archives_folder,
                    commands::profile::desktop_get_profile_archives_folder_path,
                    commands::profile::desktop_find_active_session_lease,
                    commands::profile::desktop_list_active_session_leases,
                    commands::profile::desktop_claim_active_session_lease,
                    commands::profile::desktop_touch_active_session_lease,
                    commands::profile::desktop_release_active_session_lease,
                    commands::data_root::desktop_get_obscur_data_root_config,
                    commands::data_root::desktop_set_obscur_data_root,
                    commands::data_root::desktop_prepare_data_root_change,
                    commands::data_root::desktop_import_obscur_data_from_default,
                    commands::data_root::desktop_probe_obscur_data_root,
                    commands::data_root::desktop_plan_obscur_data_root_change,
                    commands::data_root::desktop_preflight_obscur_data_root_migration,
                    commands::data_root::desktop_reconnect_obscur_data_root,
                    commands::profile_storage::desktop_harvest_profile_web_storage,
                    commands::data_root::desktop_write_workspace_bundle,
                    commands::data_root::desktop_write_data_root_export,
                    commands::data_root::desktop_reveal_path_in_file_manager,
                    commands::data_root::desktop_get_exports_folder_path,
                    commands::data_root::desktop_open_exports_folder,
                    commands::data_root::desktop_get_save_library_context,
                    commands::local_save::desktop_scan_local_saves,
                    commands::notification::show_notification,
                    commands::notification::request_notification_permission,
                    commands::notification::is_notification_permission_granted,
                    commands::system::get_system_theme,
                    commands::session::init_native_session,
                    commands::session::clear_native_session,
                    commands::session::get_session_status,
                    commands::session::desktop_force_session_restore,
                    commands::auth_boot::auth_boot_snapshot,
                    commands::login_assist::auth_login_assist_read,
                    commands::login_assist::auth_login_assist_write,
                    commands::login_assist::auth_login_assist_delete,
                    commands::storage_at_rest::desktop_storage_at_rest_unlock,
                    commands::storage_at_rest::desktop_storage_at_rest_restore_keychain,
                    commands::storage_at_rest::desktop_storage_at_rest_lock,
                    commands::les::desktop_les_commit,
                    commands::les::desktop_les_list,
                    commands::les::desktop_les_get,
                    commands::les::desktop_les_read_decrypted,
                    commands::les::desktop_les_delete,
                    upload::nip96_upload,
                    upload::nip96_upload_v2,
                    relay::connect_relay,
                    relay::probe_relay,
                    relay::disconnect_relay,
                    relay::recycle_relays,
                    relay::publish_event,
                    relay::subscribe_relay,
                    relay::unsubscribe_relay,
                    relay::send_relay_message,
                    wallet::get_native_npub,
                    wallet::import_native_nsec,
                    wallet::generate_native_nsec,
                    wallet::sign_event_native,
                    wallet::logout_native,
                    wallet::encrypt_nip04,
                    wallet::decrypt_nip04,
                    wallet::encrypt_nip44,
                    wallet::decrypt_nip44,
                    wallet::encrypt_gift_wrap,
                    wallet::decrypt_gift_wrap,
                    wallet::get_session_nsec,
                    commands::tor::start_tor,
                    commands::tor::stop_tor,
                    commands::tor::get_tor_status,
                    commands::tor::get_tor_logs,
                    commands::tor::save_tor_settings,
                    commands::system::request_biometric_auth,
                    commands::system::get_biometric_capability,
                    commands::system::mine_pow,
                    protocol::protocol_get_identity_root_state,
                    protocol::protocol_get_session_state,
                    protocol::protocol_authorize_device,
                    protocol::protocol_revoke_device,
                    protocol::protocol_x3dh_handshake,
                    protocol::protocol_get_ratchet_session,
                    protocol::protocol_verify_message_envelope,
                    protocol::protocol_publish_with_quorum,
                    protocol::protocol_check_storage_health,
                    protocol::protocol_run_storage_recovery,
                    commands::db::db_insert_message,
                    commands::engine::engine_invoke,
                    commands::transport_engine::engine_invoke_transport_publish_relay_event,
                    commands::db::db_get_messages,
                    commands::db::db_delete_message,
                    commands::db::db_delete_messages,
                    commands::db::db_insert_tombstone,
                    commands::db::db_insert_tombstones,
                    commands::db::db_get_tombstones,
                    commands::db::db_delete_all_tombstones_for_profile,
                    commands::db::db_upsert_conversation,
                    commands::db::db_get_conversations,
                    commands::db::db_upsert_group,
                    commands::db::db_get_groups,
                    commands::db::db_insert_group_message,
                    commands::db::db_get_group_messages,
                    commands::db::db_insert_group_tombstone,
                    commands::db::db_insert_call_record,
                    commands::db::db_update_call_record,
                    commands::db::db_get_call_records,
                    commands::db::db_upsert_relay_checkpoint,
                    commands::db::db_get_relay_checkpoint,
                    commands::db::db_get_relay_checkpoints,
                    commands::db::db_upsert_vault_media_index,
                    commands::db::db_get_vault_media_index_for_profile,
                    commands::db::db_delete_vault_media_index,
                    commands::db::db_delete_all_vault_media_index_for_profile,
                    commands::db::db_search_messages,
                    commands::db::db_wipe_profile_local_data,
                    commands::warmup::desktop_start_warmup,
                    commands::warmup::desktop_get_warmup_status
                ]
            }
            #[cfg(not(desktop))]
            {
                tauri::generate_handler![
                    commands::tray::set_tray_unread_badge_count,
                    commands::tray::set_tray_incoming_call_state,
                    commands::tray::desktop_get_incoming_call_state,
                    commands::tray::desktop_incoming_call_action,
                    commands::system::fetch_remote_text,
                    commands::system::fetch_remote_bytes,
                    commands::system::mesh_http_fetch_via_socks,
                    commands::system::check_for_updates,
                    commands::system::install_update,
                    commands::system::reset_app_storage,
                    commands::system::register_push_token,
                    commands::system::restart_app,
                    commands::system::desktop_open_storage_path,
                    commands::profile::desktop_get_profile_isolation_snapshot,
                    commands::profile::desktop_list_profiles,
                    commands::profile::desktop_create_profile,
                    commands::profile::desktop_rename_profile,
                    commands::profile::desktop_open_profile_window,
                    commands::profile::desktop_bind_window_profile,
                    commands::profile::desktop_remove_profile,
                    commands::profile::desktop_broadcast_profile_isolation_changed,
                    commands::profile::desktop_clear_profile_webview_data,
                    commands::profile::desktop_write_profile_workspace_archive,
                    commands::profile::desktop_list_profile_workspace_archives,
                    commands::profile::desktop_open_profile_archives_folder,
                    commands::profile::desktop_get_profile_archives_folder_path,
                    commands::profile::desktop_find_active_session_lease,
                    commands::profile::desktop_list_active_session_leases,
                    commands::profile::desktop_claim_active_session_lease,
                    commands::profile::desktop_touch_active_session_lease,
                    commands::profile::desktop_release_active_session_lease,
                    commands::data_root::desktop_get_obscur_data_root_config,
                    commands::data_root::desktop_set_obscur_data_root,
                    commands::data_root::desktop_prepare_data_root_change,
                    commands::data_root::desktop_import_obscur_data_from_default,
                    commands::data_root::desktop_probe_obscur_data_root,
                    commands::data_root::desktop_plan_obscur_data_root_change,
                    commands::data_root::desktop_preflight_obscur_data_root_migration,
                    commands::data_root::desktop_reconnect_obscur_data_root,
                    commands::profile_storage::desktop_harvest_profile_web_storage,
                    commands::data_root::desktop_write_workspace_bundle,
                    commands::data_root::desktop_write_data_root_export,
                    commands::data_root::desktop_reveal_path_in_file_manager,
                    commands::data_root::desktop_get_exports_folder_path,
                    commands::data_root::desktop_open_exports_folder,
                    commands::data_root::desktop_get_save_library_context,
                    commands::local_save::desktop_scan_local_saves,
                    commands::notification::show_notification,
                    commands::notification::request_notification_permission,
                    commands::notification::is_notification_permission_granted,
                    commands::system::get_system_theme,
                    commands::session::init_native_session,
                    commands::session::clear_native_session,
                    commands::session::get_session_status,
                    commands::session::desktop_force_session_restore,
                    commands::auth_boot::auth_boot_snapshot,
                    commands::login_assist::auth_login_assist_read,
                    commands::login_assist::auth_login_assist_write,
                    commands::login_assist::auth_login_assist_delete,
                    commands::storage_at_rest::desktop_storage_at_rest_unlock,
                    commands::storage_at_rest::desktop_storage_at_rest_restore_keychain,
                    commands::storage_at_rest::desktop_storage_at_rest_lock,
                    commands::les::desktop_les_commit,
                    commands::les::desktop_les_list,
                    commands::les::desktop_les_get,
                    commands::les::desktop_les_read_decrypted,
                    commands::les::desktop_les_delete,
                    upload::nip96_upload,
                    upload::nip96_upload_v2,
                    relay::connect_relay,
                    relay::probe_relay,
                    relay::disconnect_relay,
                    relay::recycle_relays,
                    relay::publish_event,
                    relay::subscribe_relay,
                    relay::unsubscribe_relay,
                    relay::send_relay_message,
                    wallet::get_native_npub,
                    wallet::import_native_nsec,
                    wallet::generate_native_nsec,
                    wallet::sign_event_native,
                    wallet::logout_native,
                    wallet::encrypt_nip04,
                    wallet::decrypt_nip04,
                    wallet::encrypt_nip44,
                    wallet::decrypt_nip44,
                    wallet::encrypt_gift_wrap,
                    wallet::decrypt_gift_wrap,
                    wallet::get_session_nsec,
                    commands::tor::start_tor,
                    commands::tor::stop_tor,
                    commands::tor::get_tor_status,
                    commands::tor::get_tor_logs,
                    commands::tor::save_tor_settings,
                    commands::system::request_biometric_auth,
                    commands::system::get_biometric_capability,
                    commands::system::mine_pow,
                    protocol::protocol_get_identity_root_state,
                    protocol::protocol_get_session_state,
                    protocol::protocol_authorize_device,
                    protocol::protocol_revoke_device,
                    protocol::protocol_x3dh_handshake,
                    protocol::protocol_get_ratchet_session,
                    protocol::protocol_verify_message_envelope,
                    protocol::protocol_publish_with_quorum,
                    protocol::protocol_check_storage_health,
                    protocol::protocol_run_storage_recovery,
                    commands::db::db_insert_message,
                    commands::engine::engine_invoke,
                    commands::transport_engine::engine_invoke_transport_publish_relay_event,
                    commands::db::db_get_messages,
                    commands::db::db_delete_message,
                    commands::db::db_delete_messages,
                    commands::db::db_insert_tombstone,
                    commands::db::db_insert_tombstones,
                    commands::db::db_get_tombstones,
                    commands::db::db_delete_all_tombstones_for_profile,
                    commands::db::db_upsert_conversation,
                    commands::db::db_get_conversations,
                    commands::db::db_upsert_group,
                    commands::db::db_get_groups,
                    commands::db::db_insert_group_message,
                    commands::db::db_get_group_messages,
                    commands::db::db_insert_group_tombstone,
                    commands::db::db_insert_call_record,
                    commands::db::db_update_call_record,
                    commands::db::db_get_call_records,
                    commands::db::db_upsert_relay_checkpoint,
                    commands::db::db_get_relay_checkpoint,
                    commands::db::db_get_relay_checkpoints,
                    commands::db::db_upsert_vault_media_index,
                    commands::db::db_get_vault_media_index_for_profile,
                    commands::db::db_delete_vault_media_index,
                    commands::db::db_delete_all_vault_media_index_for_profile,
                    commands::db::db_search_messages,
                    commands::db::db_wipe_profile_local_data,
                    commands::warmup::desktop_start_warmup,
                    commands::warmup::desktop_get_warmup_status
                ]
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Ready = event {
                #[cfg(desktop)]
                if let Some(window) = app_handle.get_webview_window("main") {
                    reveal_desktop_window(&window, "run_ready");
                }
            }
        });
}
