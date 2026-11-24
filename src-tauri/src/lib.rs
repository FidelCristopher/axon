use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct PiSessionEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub token_used: u64,
    pub updated_at: u64,
}

#[tauri::command]
pub fn fetch_real_pi_sessions() -> Result<Vec<PiSessionEntry>, String> {
    let sessions_dir = "/home/fidel/.pi/agent/sessions/--home-fidel--";
    let path = Path::new(sessions_dir);

    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();
            if file_name.ends_with(".jsonl") {
                list.push(PiSessionEntry {
                    id: file_name.replace(".jsonl", ""),
                    name: file_name.clone(),
                    path: entry.path().to_string_lossy().to_string(),
                    token_used: 15000,
                    updated_at: 1795400000,
                });
            }
        }
    }

    Ok(list)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![fetch_real_pi_sessions])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
