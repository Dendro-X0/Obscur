fn main() {
  if let Err(error) = tauri_build::try_build(tauri_build::Attributes::new()) {
    eprintln!("[Desktop build.rs] tauri-build failed: {error}");
    std::process::exit(1);
  }
}
