//! App data as small JSON files in the OS app-data folder.

use crate::paths::valid_store_name;
use serde_json::Value;
use std::path::{Path, PathBuf};

pub fn file(root: &Path, name: &str) -> Result<PathBuf, String> {
    if !valid_store_name(name) {
        return Err(format!("bad store name: {name}"));
    }
    Ok(root.join(format!("{name}.json")))
}

pub fn read(root: &Path, name: &str) -> Result<Option<Value>, String> {
    let path = file(root, name)?;
    match std::fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map(Some).map_err(|e| format!("{}: {e}", path.display())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Writes through a temp file and a rename, so a crash never leaves half a file.
pub fn write(root: &Path, name: &str, value: &Value) -> Result<(), String> {
    let path = file(root, name)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

pub fn delete(root: &Path, name: &str) -> Result<(), String> {
    let path = file(root, name)?;
    match std::fs::remove_file(path) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

/// Names in a store folder (`chats` → `["chats/a", "chats/b"]`).
pub fn list(root: &Path, folder: &str) -> Result<Vec<String>, String> {
    if !valid_store_name(folder) || folder.contains('/') {
        return Err(format!("bad store folder: {folder}"));
    }
    let dir = root.join(folder);
    let Ok(entries) = std::fs::read_dir(&dir) else { return Ok(vec![]) };
    let mut out: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().to_str().and_then(|n| n.strip_suffix(".json")).map(|n| format!("{folder}/{n}")))
        .collect();
    out.sort();
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn round_trips_and_lists() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(read(dir.path(), "settings").unwrap(), None);
        write(dir.path(), "settings", &json!({"a": 1})).unwrap();
        assert_eq!(read(dir.path(), "settings").unwrap(), Some(json!({"a": 1})));
        write(dir.path(), "chats/x", &json!([])).unwrap();
        write(dir.path(), "chats/y", &json!([])).unwrap();
        assert_eq!(list(dir.path(), "chats").unwrap(), vec!["chats/x", "chats/y"]);
        delete(dir.path(), "chats/x").unwrap();
        assert_eq!(list(dir.path(), "chats").unwrap(), vec!["chats/y"]);
        assert!(write(dir.path(), "../evil", &json!(1)).is_err());
    }
}
