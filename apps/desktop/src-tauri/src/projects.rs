//! Video projects: one folder per video inside the working folder, each with a
//! `frameforge.json` manifest and renders in `out/`.

use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

pub const MANIFEST: &str = "frameforge.json";

pub fn slugify(title: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for c in title.trim().chars().flat_map(|c| c.to_lowercase()) {
        if c.is_alphanumeric() && c.is_ascii() {
            out.push(c);
            dash = false;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
        if out.len() >= 48 {
            break;
        }
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() { "video".into() } else { out }
}

fn unique_folder(root: &Path, slug: &str) -> PathBuf {
    let first = root.join(slug);
    if !first.exists() {
        return first;
    }
    (2..).map(|n| root.join(format!("{slug}-{n}"))).find(|p| !p.exists()).unwrap()
}

fn iso(t: SystemTime) -> String {
    let secs = t.duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    // RFC 3339 in UTC without pulling in a date crate.
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (y, m, d) = civil_from_days(days as i64);
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z", rem / 3600, (rem % 3600) / 60, rem % 60)
}

/// Howard Hinnant's days-to-civil algorithm.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Newest non-empty `.mp4` directly in `out/`.
pub fn latest_render(folder: &Path) -> Option<(PathBuf, SystemTime)> {
    let entries = std::fs::read_dir(folder.join("out")).ok()?;
    entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x.eq_ignore_ascii_case("mp4")).unwrap_or(false))
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            (meta.len() > 0).then(|| (e.path(), meta.modified().unwrap_or(SystemTime::UNIX_EPOCH)))
        })
        .max_by_key(|(_, t)| *t)
}

fn describe(folder: &Path) -> Option<Value> {
    let text = std::fs::read_to_string(folder.join(MANIFEST)).ok()?;
    let mut v: Value = serde_json::from_str(&text).ok()?;
    let obj = v.as_object_mut()?;
    obj.insert("folder".into(), json!(folder.to_string_lossy()));
    if let Some((path, t)) = latest_render(folder) {
        obj.insert("latestRender".into(), json!(path.to_string_lossy()));
        obj.insert("renderedAt".into(), json!(iso(t)));
    }
    Some(v)
}

pub fn list(root: &Path) -> Vec<Value> {
    let Ok(entries) = std::fs::read_dir(root) else { return vec![] };
    let mut out: Vec<Value> = entries.filter_map(|e| e.ok()).filter(|e| e.path().is_dir()).filter_map(|e| describe(&e.path())).collect();
    out.sort_by(|a, b| b["createdAt"].as_str().unwrap_or("").cmp(a["createdAt"].as_str().unwrap_or("")));
    out
}

pub fn create(root: &Path, manifest: Value) -> Result<Value, String> {
    let title = manifest["title"].as_str().unwrap_or("video");
    std::fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let folder = unique_folder(root, &slugify(title));
    std::fs::create_dir_all(folder.join("out")).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    std::fs::write(folder.join(MANIFEST), text).map_err(|e| e.to_string())?;
    describe(&folder).ok_or_else(|| "couldn't read the new project".into())
}

/// Merges `patch` into the manifest. `id` and `createdAt` never change.
pub fn update(folder: &Path, patch: Value) -> Result<Value, String> {
    let path = folder.join(MANIFEST);
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut current: Map<String, Value> = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if let Value::Object(p) = patch {
        for (k, v) in p {
            if k != "id" && k != "createdAt" && k != "folder" {
                current.insert(k, v);
            }
        }
    }
    std::fs::write(&path, serde_json::to_string_pretty(&current).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    describe(folder).ok_or_else(|| "couldn't read the project".into())
}

/// Grabs one frame of a video as a PNG with ffmpeg.
pub fn extract_frame(video: &Path, seconds: f64, out: &Path) -> Result<(), String> {
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let status = std::process::Command::new("ffmpeg")
        .args(["-y", "-loglevel", "error", "-ss", &format!("{seconds:.3}"), "-i"])
        .arg(video)
        .args(["-frames:v", "1"])
        .arg(out)
        .status()
        .map_err(|e| format!("ffmpeg didn't start: {e}"))?;
    if status.success() { Ok(()) } else { Err("ffmpeg couldn't read that frame".into()) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs() {
        assert_eq!(slugify("Why Octopuses Have 3 Hearts!"), "why-octopuses-have-3-hearts");
        assert_eq!(slugify("   "), "video");
        assert_eq!(slugify("Fakta unik: Kopi ☕"), "fakta-unik-kopi");
    }

    #[test]
    fn dates() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(20_767), (2026, 11, 10));
    }

    #[test]
    fn creates_lists_and_updates() {
        let dir = tempfile::tempdir().unwrap();
        let p = create(dir.path(), json!({"id": "p1", "title": "Hello World", "createdAt": "2026-11-10T00:00:00Z", "step": "topic"})).unwrap();
        assert!(p["folder"].as_str().unwrap().ends_with("hello-world"));
        let p2 = create(dir.path(), json!({"id": "p2", "title": "Hello World", "createdAt": "2026-11-11T00:00:00Z", "step": "topic"})).unwrap();
        assert!(p2["folder"].as_str().unwrap().ends_with("hello-world-2"));
        let folder = PathBuf::from(p["folder"].as_str().unwrap());
        std::fs::write(folder.join("out/video.mp4"), b"x").unwrap();
        let u = update(&folder, json!({"step": "render", "id": "nope"})).unwrap();
        assert_eq!(u["step"], "render");
        assert_eq!(u["id"], "p1");
        assert!(u["latestRender"].as_str().unwrap().ends_with("video.mp4"));
        let all = list(dir.path());
        assert_eq!(all.len(), 2);
        assert_eq!(all[0]["id"], "p2");
    }
}
