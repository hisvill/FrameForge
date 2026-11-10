//! Agent processes. One process per chat, speaking newline-delimited JSON-RPC (ACP)
//! over stdio. Rust only relays lines; the web UI drives the protocol.

use serde::Serialize;
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::mpsc;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineEvent {
    pub chat_id: String,
    pub line: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExitEvent {
    pub chat_id: String,
    pub code: Option<i32>,
    pub stderr_tail: String,
}

struct Running {
    tx: mpsc::UnboundedSender<String>,
    pid: Option<u32>,
}

#[derive(Default)]
pub struct Agents {
    running: Mutex<HashMap<String, Running>>,
}

fn build_command(command: &[String]) -> Result<Command, String> {
    let (program, args) = command.split_first().ok_or("empty agent command")?;
    #[cfg(windows)]
    let mut cmd = {
        // npx, opencode and friends are .cmd shims on Windows.
        let mut c = Command::new("cmd");
        c.arg("/C").arg(program).args(args);
        c
    };
    #[cfg(not(windows))]
    let mut cmd = {
        let mut c = Command::new(program);
        c.args(args);
        c.process_group(0);
        c
    };
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true);
    Ok(cmd)
}

impl Agents {
    pub fn spawn(
        &self,
        app: AppHandle,
        chat_id: String,
        command: Vec<String>,
        cwd: String,
        env: HashMap<String, String>,
    ) -> Result<(), String> {
        self.kill(&chat_id);
        std::fs::create_dir_all(&cwd).map_err(|e| format!("can't create {cwd}: {e}"))?;
        let mut cmd = build_command(&command)?;
        cmd.current_dir(&cwd).env("FRAMEFORGE", "1").envs(env);
        let mut child: Child = cmd.spawn().map_err(|e| format!("can't start {}: {e}", command.join(" ")))?;
        let pid = child.id();
        let mut stdin = child.stdin.take().ok_or("no stdin")?;
        let stdout = child.stdout.take().ok_or("no stdout")?;
        let stderr = child.stderr.take().ok_or("no stderr")?;
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();

        tauri::async_runtime::spawn(async move {
            while let Some(line) = rx.recv().await {
                if stdin.write_all(line.as_bytes()).await.is_err() || stdin.write_all(b"\n").await.is_err() {
                    break;
                }
                let _ = stdin.flush().await;
            }
        });

        let tail = std::sync::Arc::new(Mutex::new(Vec::<String>::new()));
        let tail_w = tail.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let mut t = tail_w.lock().unwrap();
                t.push(line);
                if t.len() > 40 {
                    t.remove(0);
                }
            }
        });

        let app_out = app.clone();
        let id_out = chat_id.clone();
        tauri::async_runtime::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }
                let _ = app_out.emit("agent-line", LineEvent { chat_id: id_out.clone(), line });
            }
            let code = child.wait().await.ok().and_then(|s| s.code());
            let stderr_tail = tail.lock().unwrap().join("\n");
            let _ = app_out.emit("agent-exit", ExitEvent { chat_id: id_out, code, stderr_tail });
        });

        self.running.lock().unwrap().insert(chat_id, Running { tx, pid });
        Ok(())
    }

    pub fn send(&self, chat_id: &str, line: String) -> Result<(), String> {
        let running = self.running.lock().unwrap();
        let r = running.get(chat_id).ok_or("the agent isn't running")?;
        r.tx.send(line).map_err(|_| "the agent stopped".to_string())
    }

    pub fn kill(&self, chat_id: &str) {
        if let Some(r) = self.running.lock().unwrap().remove(chat_id) {
            terminate(r.pid);
        }
    }

    pub fn kill_all(&self) {
        let all: Vec<Running> = self.running.lock().unwrap().drain().map(|(_, r)| r).collect();
        for r in all {
            terminate(r.pid);
        }
    }
}

fn terminate(pid: Option<u32>) {
    let Some(pid) = pid else { return };
    #[cfg(unix)]
    unsafe {
        // The agent runs in its own process group, so its children (renders, npx) stop too.
        libc::killpg(pid as libc::pid_t, libc::SIGTERM);
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"]).output();
    }
}
