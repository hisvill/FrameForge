//! FrameForge desktop backend.
//!
//! The Rust side is deliberately small: it starts agent processes and relays their
//! stdio, keeps app data as JSON files, reads and writes project folders, and checks
//! which tools are installed. The ACP protocol itself lives in the web UI
//! (`src/lib/acp.ts`), where it is unit-tested.

mod agent;
mod commands;
mod paths;
mod projects;
mod store;
mod system;

use tauri::Manager;

pub fn run() {
    paths::extend_path_from_login_shell();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(agent::Agents::default())
        .invoke_handler(tauri::generate_handler![
            commands::agent_spawn,
            commands::agent_send,
            commands::agent_kill,
            commands::store_read,
            commands::store_write,
            commands::store_delete,
            commands::store_list,
            commands::projects_list,
            commands::project_create,
            commands::project_update,
            commands::project_read_text,
            commands::project_write_text,
            commands::project_extract_frame,
            commands::system_tools,
            commands::system_agents,
            commands::system_info,
            commands::default_working_folder,
            commands::ensure_dir,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let agents = window.app_handle().state::<agent::Agents>();
                agents.kill_all();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running FrameForge");
}
