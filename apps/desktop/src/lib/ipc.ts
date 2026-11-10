/**
 * Everything the UI asks of the Rust side. Outside Tauri (plain `vite` in a browser)
 * a small in-memory demo backend answers instead, so the UI can be developed and
 * previewed without the desktop shell.
 */
import type { AgentInfo, Project, ProjectManifest, ToolCheck } from '@frameforge/shared';
import type { Transport } from './acp';
import { demoBackend } from './demo';

export const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!inTauri) return demoBackend.invoke(cmd, args ?? {}) as Promise<T>;
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export interface SystemInfo {
  os: string;
  arch: string;
  locale: string;
  home?: string;
  packageManager?: string;
}

export const ipc = {
  storeRead: <T>(name: string) => call<T | null>('store_read', { name }),
  storeWrite: (name: string, value: unknown) => call<void>('store_write', { name, value }),
  storeDelete: (name: string) => call<void>('store_delete', { name }),
  storeList: (folder: string) => call<string[]>('store_list', { folder }),
  projectsList: (root: string) => call<Project[]>('projects_list', { root }),
  projectCreate: (root: string, manifest: ProjectManifest) => call<Project>('project_create', { root, manifest }),
  projectUpdate: (folder: string, patch: Partial<ProjectManifest>) => call<Project>('project_update', { folder, patch }),
  readText: (root: string, path: string) => call<string>('project_read_text', { root, path }),
  writeText: (root: string, path: string, content: string) => call<void>('project_write_text', { root, path, content }),
  extractFrame: (folder: string, video: string, seconds: number) => call<string>('project_extract_frame', { folder, video, seconds }),
  tools: () => call<ToolCheck[]>('system_tools'),
  agents: () => call<AgentInfo[]>('system_agents'),
  info: () => call<SystemInfo>('system_info'),
  defaultWorkingFolder: () => call<string>('default_working_folder'),
  ensureDir: (path: string) => call<void>('ensure_dir', { path }),
};

/** Starts an agent process for a chat and returns its ACP transport. */
export async function spawnAgent(chatId: string, command: string[], cwd: string): Promise<Transport> {
  if (!inTauri) return demoBackend.spawnAgent(chatId, cwd);
  const { listen } = await import('@tauri-apps/api/event');
  const lineListeners = new Set<(l: string) => void>();
  const exitListeners = new Set<(i: { code: number | null; stderr: string }) => void>();
  const offLine = await listen<{ chatId: string; line: string }>('agent-line', (e) => {
    if (e.payload.chatId === chatId) lineListeners.forEach((f) => f(e.payload.line));
  });
  const offExit = await listen<{ chatId: string; code: number | null; stderrTail: string }>('agent-exit', (e) => {
    if (e.payload.chatId === chatId) exitListeners.forEach((f) => f({ code: e.payload.code, stderr: e.payload.stderrTail }));
  });
  await call('agent_spawn', { chatId, command, cwd });
  return {
    send: (line) => call('agent_send', { chatId, line }),
    listen(onLine, onExit) {
      lineListeners.add(onLine);
      exitListeners.add(onExit);
      return () => {
        lineListeners.delete(onLine);
        exitListeners.delete(onExit);
        offLine();
        offExit();
      };
    },
  };
}

export const killAgent = (chatId: string) => call<void>('agent_kill', { chatId });

/** A local file as a URL the webview can load. */
export function fileUrl(path: string): string {
  if (!inTauri) return path;
  const internals = (window as unknown as { __TAURI_INTERNALS__: { convertFileSrc(p: string, proto?: string): string } }).__TAURI_INTERNALS__;
  return internals.convertFileSrc(path, 'asset');
}

export async function pickFolder(defaultPath?: string): Promise<string | null> {
  if (!inTauri) return null;
  const { open } = await import('@tauri-apps/plugin-dialog');
  const r = await open({ directory: true, defaultPath });
  return typeof r === 'string' ? r : null;
}

export async function openPath(path: string) {
  if (!inTauri) return;
  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(path);
}

export async function revealPath(path: string) {
  if (!inTauri) return;
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
  await revealItemInDir(path);
}

export async function openUrl(url: string) {
  if (!/^(https?:|mailto:)/.test(url)) return;
  if (!inTauri) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}

export async function notify(title: string, body: string) {
  if (!inTauri) {
    console.info('[notification]', title, body);
    return;
  }
  const n = await import('@tauri-apps/plugin-notification');
  let ok = await n.isPermissionGranted();
  if (!ok) ok = (await n.requestPermission()) === 'granted';
  if (ok) n.sendNotification({ title, body });
}
