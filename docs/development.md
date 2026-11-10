# Development

## Prerequisites

- Node 22+, pnpm 10
- Rust stable and the [Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/)
- At runtime: an ACP agent, Node.js, FFmpeg and Chrome/Chromium on PATH

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Desktop app in dev mode (Vite on :1420 + Tauri) |
| `pnpm --filter @frameforge/desktop dev` | UI only, in a browser, with the demo backend |
| `pnpm test` / `pnpm typecheck` | Vitest / tsc in every package |
| `cargo test`, `cargo clippy` | Rust, in `apps/desktop/src-tauri` |
| `pnpm build` | Installers for this platform |

## Where things live

- **App data** (settings, chats, styles, schedule, autopilots): JSON files in the OS app-data folder for
  `org.frameforge.studio` (`chats/<id>.json` per chat).
- **Projects**: one folder per video in the working folder, with `frameforge.json` and renders in `out/`.
- **Loose chats** run in `<working folder>/.frameforge/chats`.

## Agents

| Agent | ACP command |
| --- | --- |
| Claude Code | `npx -y @agentclientprotocol/claude-agent-acp` |
| opencode | `opencode acp` |
| Gemini CLI | `gemini --experimental-acp` |
| Codex | `npx -y @zed-industries/codex-acp` |
| Other | any command, set in Settings › Agents |

Every agent process gets `FRAMEFORGE=1` in its environment and runs in its own process group, so stopping a
chat also stops renders it started.

## Permissions

FrameForge answers `session/request_permission` with the option the user presses. In Auto mode (per chat,
default from Settings, always on for autopilots) it picks the agent's `allow_once` option and writes
"Ran without asking: …" into the chat. FrameForge cannot see commands an agent's own configuration
auto-approves.

## The options block

The agent offers choices with a fenced block that the chat renders as cards:

````
```frameforge-options
{"question": "Which topic?", "options": [{"label": "…", "description": "…", "value": "message sent back"}]}
```
````

See `packages/skills/src/options.ts`.
