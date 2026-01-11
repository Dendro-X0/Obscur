#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let default_url: &str = "https://obscur-lovat.vercel.app";
      let raw_url: String = std::env::var("OBSCUR_DESKTOP_URL").unwrap_or_else(|_| default_url.to_string());
      let parsed_url: tauri::Url = raw_url.parse().unwrap_or_else(|_| default_url.parse().expect("default url must be valid"));
      let label: &str = "main";
      let window = tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::External(parsed_url))
        .title("Obscur")
        .build()?;
      window.show()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
