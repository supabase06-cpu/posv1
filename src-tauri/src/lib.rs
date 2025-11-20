// src-tauri/src/lib.rs
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // do NOT initialize non-installed plugins here (avoid tauri_plugin_path / tauri_plugin_fs unless added to Cargo.toml)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
