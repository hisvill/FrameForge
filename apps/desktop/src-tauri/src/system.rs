//! What's installed on this computer: tools the videos need and ACP agents.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::Command;

pub fn which(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    let exts: Vec<String> = if cfg!(windows) {
        std::env::var("PATHEXT").unwrap_or(".EXE;.CMD;.BAT".into()).split(';').map(|s| s.to_lowercase()).collect()
    } else {
        vec![String::new()]
    };
    for dir in std::env::split_paths(&path) {
        for ext in &exts {
            let p = dir.join(format!("{name}{ext}"));
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

fn version(program: &PathBuf, arg: &str) -> Option<String> {
    let out = Command::new(program).arg(arg).output().ok()?;
    let text = if out.stdout.is_empty() { out.stderr } else { out.stdout };
    let first = String::from_utf8_lossy(&text).lines().next()?.trim().to_string();
    (!first.is_empty()).then(|| first.chars().take(80).collect())
}

fn chrome() -> Option<PathBuf> {
    for n in ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"] {
        if let Some(p) = which(n) {
            return Some(p);
        }
    }
    let mut fixed: Vec<PathBuf> = vec![
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into(),
        "/Applications/Chromium.app/Contents/MacOS/Chromium".into(),
    ];
    for var in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"] {
        if let Ok(base) = std::env::var(var) {
            fixed.push(PathBuf::from(base).join("Google/Chrome/Application/chrome.exe"));
        }
    }
    fixed.into_iter().find(|p| p.is_file())
}

fn tool(id: &str, required: bool, path: Option<PathBuf>, arg: &str) -> Value {
    let v = path.as_ref().and_then(|p| if arg.is_empty() { None } else { version(p, arg) });
    json!({ "id": id, "required": required, "found": path.is_some(), "version": v, "path": path.map(|p| p.to_string_lossy().to_string()) })
}

pub fn tools() -> Vec<Value> {
    vec![
        tool("node", true, which("node"), "--version"),
        tool("ffmpeg", true, which("ffmpeg"), "-version"),
        tool("chrome", true, chrome(), ""),
        tool("ytdlp", false, which("yt-dlp"), "--version"),
    ]
}

/// (id, name, binary to look for, ACP command)
const AGENTS: &[(&str, &str, &str, &[&str])] = &[
    ("claude", "Claude Code", "claude", &["npx", "-y", "@agentclientprotocol/claude-agent-acp"]),
    ("opencode", "opencode", "opencode", &["opencode", "acp"]),
    ("gemini", "Gemini CLI", "gemini", &["gemini", "--experimental-acp"]),
    ("codex", "Codex", "codex", &["npx", "-y", "@zed-industries/codex-acp"]),
];

pub fn agents() -> Vec<Value> {
    AGENTS
        .iter()
        .map(|(id, name, bin, cmd)| {
            let path = which(bin);
            let v = path.as_ref().and_then(|p| version(p, "--version"));
            json!({ "id": id, "name": name, "command": cmd, "installed": path.is_some(), "version": v })
        })
        .collect()
}

pub fn info() -> Value {
    json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "locale": sys_locale::get_locale().unwrap_or_else(|| "en".into()),
        "home": dirs::home_dir().map(|p| p.to_string_lossy().to_string()),
        "packageManager": package_manager(),
    })
}

fn package_manager() -> Option<&'static str> {
    ["brew", "winget", "apt", "dnf", "pacman", "zypper"].into_iter().find(|p| which(p).is_some())
}

#[cfg(test)]
mod tests {
    #[test]
    fn lists_every_agent_and_tool() {
        assert_eq!(super::agents().len(), 4);
        let tools = super::tools();
        assert_eq!(tools.iter().filter(|t| t["required"] == true).count(), 3);
    }
}
