use std::path::{Component, Path, PathBuf};

/// GUI apps on macOS and some Linux desktops start with a bare PATH, so agent CLIs
/// installed through npm, Homebrew or cargo aren't found. Borrow the login shell's PATH.
pub fn extend_path_from_login_shell() {
    #[cfg(unix)]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
        let out = std::process::Command::new(shell).args(["-lc", "printf %s \"$PATH\""]).output();
        if let Ok(out) = out {
            let login = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !login.is_empty() {
                let current = std::env::var("PATH").unwrap_or_default();
                let mut parts: Vec<String> = login.split(':').map(String::from).collect();
                for p in current.split(':') {
                    if !p.is_empty() && !parts.iter().any(|x| x == p) {
                        parts.push(p.to_string());
                    }
                }
                std::env::set_var("PATH", parts.join(":"));
            }
        }
    }
}

/// Normalises `path` lexically (no filesystem access).
fn normalise(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in path.components() {
        match c {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Resolves `rel` (relative or absolute) and fails unless it stays inside `root`.
pub fn inside(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let root = normalise(root);
    let candidate = Path::new(rel);
    let joined = if candidate.is_absolute() { normalise(candidate) } else { normalise(&root.join(candidate)) };
    if joined.starts_with(&root) {
        Ok(joined)
    } else {
        Err(format!("{} is outside {}", rel, root.display()))
    }
}

/// Store names are plain slugs, optionally one folder deep (`chats/abc`).
pub fn valid_store_name(name: &str) -> bool {
    let parts: Vec<&str> = name.split('/').collect();
    !name.is_empty()
        && parts.len() <= 2
        && parts.iter().all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.') && *p != "." && *p != "..")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_paths_inside_the_root() {
        let root = Path::new("/work/p1");
        assert_eq!(inside(root, "out/video.mp4").unwrap(), PathBuf::from("/work/p1/out/video.mp4"));
        assert_eq!(inside(root, "/work/p1/a.txt").unwrap(), PathBuf::from("/work/p1/a.txt"));
        assert!(inside(root, "../p2/secret").is_err());
        assert!(inside(root, "/etc/passwd").is_err());
        assert!(inside(root, "a/../../x").is_err());
    }

    #[test]
    fn checks_store_names() {
        assert!(valid_store_name("settings"));
        assert!(valid_store_name("chats/abc-1"));
        assert!(!valid_store_name("../x"));
        assert!(!valid_store_name("a/b/c"));
        assert!(!valid_store_name("chats/.."));
        assert!(!valid_store_name(""));
    }
}
