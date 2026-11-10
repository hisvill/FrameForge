/**
 * Demo backend for running the UI in a plain browser. Data lives in localStorage,
 * and the "agent" is a tiny scripted ACP agent so the chat flow can be tried.
 */
import type { AgentInfo, Project, ProjectManifest, ToolCheck } from '@frameforge/shared';
import type { Transport } from './acp';

const KEY = 'frameforge-demo:';
const projects: Project[] = [];

function slug(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video';
}

const handlers: Record<string, (a: Record<string, any>) => unknown> = {
  store_read: ({ name }) => {
    const v = localStorage.getItem(KEY + name);
    return v ? JSON.parse(v) : null;
  },
  store_write: ({ name, value }) => void localStorage.setItem(KEY + name, JSON.stringify(value)),
  store_delete: ({ name }) => void localStorage.removeItem(KEY + name),
  store_list: ({ folder }) =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${KEY}${folder}/`))
      .map((k) => k.slice(KEY.length)),
  projects_list: () => [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  project_create: ({ root, manifest }) => {
    const p: Project = { ...(manifest as ProjectManifest), folder: `${root}/${slug(manifest.title)}` };
    projects.push(p);
    return p;
  },
  project_update: ({ folder, patch }) => {
    const p = projects.find((x) => x.folder === folder);
    if (!p) throw new Error('no project');
    Object.assign(p, patch);
    return p;
  },
  project_read_text: () => '',
  project_write_text: () => undefined,
  project_extract_frame: ({ folder }) => `${folder}/out/frames/frame.png`,
  system_tools: (): ToolCheck[] => [
    { id: 'node', required: true, found: true, version: 'v22.12.0' },
    { id: 'ffmpeg', required: true, found: true, version: 'ffmpeg version 7.1' },
    { id: 'chrome', required: true, found: true },
    { id: 'ytdlp', required: false, found: false },
  ],
  system_agents: (): AgentInfo[] => [
    { id: 'claude', name: 'Claude Code', command: ['npx', '-y', '@agentclientprotocol/claude-agent-acp'], installed: true, version: '2.1.0' },
    { id: 'opencode', name: 'opencode', command: ['opencode', 'acp'], installed: false },
    { id: 'gemini', name: 'Gemini CLI', command: ['gemini', '--experimental-acp'], installed: false },
    { id: 'codex', name: 'Codex', command: ['npx', '-y', '@zed-industries/codex-acp'], installed: false },
  ],
  system_info: () => ({ os: 'demo', arch: 'web', locale: navigator.language, home: '~', packageManager: 'brew' }),
  default_working_folder: () => '~/Videos/FrameForge',
  ensure_dir: () => undefined,
  agent_kill: () => undefined,
};

const DEMO_REPLY = [
  'Here are a few ideas that fit your style. This is the **demo agent**: run FrameForge as a desktop app to use your real agent.\n\n',
  '```frameforge-options\n',
  JSON.stringify({
    question: 'Which topic should we make?',
    options: [
      { label: 'Why octopuses have three hearts', description: 'Biology · 30 s', value: 'Make it about why octopuses have three hearts' },
      { label: 'How a black hole bends light', description: 'Space · 30 s', value: 'Make it about how a black hole bends light' },
      { label: 'The tallest tree on Earth', description: 'Nature · 30 s', value: 'Make it about the tallest tree on Earth' },
    ],
  }),
  '\n```\n',
];

export const demoBackend = {
  async invoke(cmd: string, args: Record<string, unknown>) {
    const h = handlers[cmd];
    if (!h) throw new Error(`demo backend: ${cmd} isn't available outside the desktop app`);
    return h(args);
  },

  spawnAgent(_chatId: string, _cwd: string): Transport {
    let onLine: (l: string) => void = () => {};
    const push = (o: object) => setTimeout(() => onLine(JSON.stringify({ jsonrpc: '2.0', ...o })), 0);
    const update = (u: object) => push({ method: 'session/update', params: { sessionId: 'demo', update: u } });
    return {
      send(line) {
        const msg = JSON.parse(line);
        if (msg.method === 'initialize') push({ id: msg.id, result: { protocolVersion: 1, agentInfo: { name: 'demo' } } });
        if (msg.method === 'session/new') push({ id: msg.id, result: { sessionId: 'demo' } });
        if (msg.method === 'session/prompt') {
          update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Picking topics that fit the style.' } });
          update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Read frameforge.json', kind: 'read', status: 'completed' });
          DEMO_REPLY.forEach((text, i) =>
            setTimeout(() => update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } }), 150 * (i + 1)),
          );
          setTimeout(() => push({ id: msg.id, result: { stopReason: 'end_turn' } }), 150 * (DEMO_REPLY.length + 1));
        }
      },
      listen(l) {
        onLine = l;
        return () => {};
      },
    };
  },
};
