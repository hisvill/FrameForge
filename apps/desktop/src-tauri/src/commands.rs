use crate::{agent::Agents, paths, projects, store, system};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, State};

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn agent_spawn(
    app: AppHandle,
    agents: State<'_, Agents>,
    chat_id: String,
    command: Vec<String>,
    cwd: String,
    env: Option<HashMap<String, String>>,
) -> Result<(), String> {
    agents.spawn(app, chat_id, command, cwd, env.unwrap_or_default())
}

#[tauri::command]
pub fn agent_send(agents: State<'_, Agents>, chat_id: String, line: String) -> Result<(), String> {
    agents.send(&chat_id, line)
}

#[tauri::command]
pub fn agent_kill(agents: State<'_, Agents>, chat_id: String) {
    agents.kill(&chat_id)
}

#[tauri::command]
pub fn store_read(app: AppHandle, name: String) -> Result<Option<Value>, String> {
    store::read(&data_dir(&app)?, &name)
}

#[tauri::command]
pub fn store_write(app: AppHandle, name: String, value: Value) -> Result<(), String> {
    store::write(&data_dir(&app)?, &name, &value)
}

#[tauri::command]
pub fn store_delete(app: AppHandle, name: String) -> Result<(), String> {
    store::delete(&data_dir(&app)?, &name)
}

#[tauri::command]
pub fn store_list(app: AppHandle, folder: String) -> Result<Vec<String>, String> {
    store::list(&data_dir(&app)?, &folder)
}

#[tauri::command]
pub fn projects_list(root: String) -> Vec<Value> {
    projects::list(Path::new(&root))
}

#[tauri::command]
pub fn project_create(root: String, manifest: Value) -> Result<Value, String> {
    projects::create(Path::new(&root), manifest)
}

#[tauri::command]
pub fn project_update(folder: String, patch: Value) -> Result<Value, String> {
    projects::update(Path::new(&folder), patch)
}

/// Reads a text file the agent asked for (`fs/read_text_file`); only inside `root`.
#[tauri::command]
pub fn project_read_text(root: String, path: String) -> Result<String, String> {
    let p = paths::inside(Path::new(&root), &path)?;
    std::fs::read_to_string(&p).map_err(|e| format!("{}: {e}", p.display()))
}

/// Writes a text file the agent asked for (`fs/write_text_file`); only inside `root`.
#[tauri::command]
pub fn project_write_text(root: String, path: String, content: String) -> Result<(), String> {
    let p = paths::inside(Path::new(&root), &path)?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&p, content).map_err(|e| format!("{}: {e}", p.display()))
}

#[tauri::command]
pub async fn project_extract_frame(folder: String, video: String, seconds: f64) -> Result<String, String> {
    let video = paths::inside(Path::new(&folder), &video)?;
    let out = Path::new(&folder).join("out/frames").join(format!("sent-{:.0}ms.png", seconds * 1000.0));
    let out2 = out.clone();
    tokio::task::spawn_blocking(move || projects::extract_frame(&video, seconds, &out2)).await.map_err(|e| e.to_string())??;
    Ok(out.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn system_tools() -> Vec<Value> {
    tokio::task::spawn_blocking(system::tools).await.unwrap_or_default()
}

#[tauri::command]
pub async fn system_agents() -> Vec<Value> {
    tokio::task::spawn_blocking(system::agents).await.unwrap_or_default()
}

#[tauri::command]
pub fn system_info() -> Value {
    system::info()
}

#[tauri::command]
pub fn default_working_folder() -> String {
    dirs::video_dir()
        .or_else(dirs::home_dir)
        .map(|p| p.join("FrameForge").to_string_lossy().to_string())
        .unwrap_or_else(|| "FrameForge".into())
}

#[tauri::command]
pub fn ensure_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())
}
