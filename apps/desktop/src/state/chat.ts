/**
 * Live chats: messages, the agent session behind each chat, permission prompts.
 */
import type { AgentId, Chat, ChatMessage, MessagePart, PermissionRequest, Project } from '@frameforge/shared';
import { buildPreamble } from '@frameforge/skills';
import { create } from 'zustand';
import { tNow } from '../i18n';
import { AcpClient, AcpError, commandOf, type AcpPermissionRequest } from '../lib/acp';
import { ipc, killAgent, spawnAgent } from '../lib/ipc';
import { applyUpdate, newMessage, settleTools, uid } from '../lib/messages';
import { agentCommand, allStyles, useApp } from './app';

interface Session {
  client: AcpClient;
  cwd: string;
  preambleSent: boolean;
}

const sessions = new Map<string, Session>();
const starting = new Map<string, Promise<Session>>();
const permissionResolvers = new Map<string, (optionId: string | null) => void>();

interface TurnResult {
  stopReason: string | null;
  error?: string;
}

interface ChatState {
  chats: Record<string, Chat>;
  running: Record<string, boolean>;
  turnStartedAt: Record<string, number>;
  permissions: PermissionRequest[];

  load(id: string): Promise<Chat | null>;
  create(opts: { title: string; projectId?: string; agent?: AgentId; autoMode?: boolean; autopilotId?: string }): Promise<Chat>;
  setAutoMode(id: string, on: boolean): void;
  send(id: string, text: string, opts?: { images?: string[]; hidden?: boolean }): Promise<TurnResult>;
  addSystem(id: string, text: string): void;
  stop(id: string): void;
  answerPermission(requestId: string, optionId: string | null): void;
  remove(id: string): Promise<void>;
}

function save(chat: Chat) {
  void ipc.storeWrite(`chats/${chat.id}`, chat);
  useApp.getState().upsertChatSummary(chat);
}

function projectOf(chat: Chat): Project | undefined {
  return chat.projectId ? useApp.getState().projects.find((p) => p.id === chat.projectId) : undefined;
}

/** The folder an agent session runs in: the project's, or `.frameforge/chats` for loose chats. */
export function chatCwd(chat: Chat): string {
  const project = projectOf(chat);
  if (project) return project.folder;
  const root = useApp.getState().settings.workingFolder;
  return `${root}/.frameforge/chats`;
}

function localNow() {
  const d = new Date();
  return d.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export const useChats = create<ChatState>((set, get) => {
  const patch = (id: string, fn: (c: Chat) => Chat) => {
    const c = get().chats[id];
    if (!c) return;
    set({ chats: { ...get().chats, [id]: fn(c) } });
  };

  const patchLastAgent = (id: string, fn: (parts: MessagePart[]) => MessagePart[]) =>
    patch(id, (c) => {
      const msgs = [...c.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'agent') {
          msgs[i] = { ...msgs[i], parts: fn(msgs[i].parts) };
          break;
        }
        if (msgs[i].role === 'user') break;
      }
      return { ...c, messages: msgs };
    });

  async function startSession(chat: Chat): Promise<Session> {
    const app = useApp.getState();
    const command = agentCommand(app.settings, app.agents, chat.agent);
    if (!command.length) throw new AcpError(`No command set for agent "${chat.agent}". Pick one in Settings.`);
    const cwd = chatCwd(chat);
    const transport = await spawnAgent(chat.id, command, cwd);
    const root = cwd;
    const client = new AcpClient(transport, {
      onUpdate: (u) => patchLastAgent(chat.id, (parts) => applyUpdate(parts, u)),
      onPermission: (req) => askPermission(chat.id, req),
      readTextFile: async (path, line, limit) => {
        const text = await ipc.readText(root, path);
        if (!line && !limit) return text;
        const lines = text.split('\n');
        const start = Math.max(0, (line ?? 1) - 1);
        return lines.slice(start, limit ? start + limit : undefined).join('\n');
      },
      writeTextFile: (path, content) => ipc.writeText(root, path, content),
      onExit: () => {
        sessions.delete(chat.id);
      },
    });
    await client.initialize();
    await client.newSession(cwd);
    return { client, cwd, preambleSent: false };
  }

  async function ensureSession(chat: Chat): Promise<Session> {
    const existing = sessions.get(chat.id);
    if (existing && !existing.client.isClosed) return existing;
    let p = starting.get(chat.id);
    if (!p) {
      p = startSession(chat);
      starting.set(chat.id, p);
    }
    try {
      const s = await p;
      sessions.set(chat.id, s);
      return s;
    } finally {
      starting.delete(chat.id);
    }
  }

  function askPermission(chatId: string, req: AcpPermissionRequest): Promise<string | null> {
    const chat = get().chats[chatId];
    const command = commandOf(req.toolCall?.rawInput);
    const allowOnce = req.options.find((o) => o.kind === 'allow_once');
    if (chat?.autoMode && allowOnce) {
      get().addSystem(chatId, tNow('perm.auto', { cmd: command ?? req.toolCall?.title ?? '?' }));
      return Promise.resolve(allowOnce.optionId);
    }
    const requestId = uid();
    set({
      permissions: [
        ...get().permissions,
        { requestId, chatId, title: req.toolCall?.title ?? 'Tool', command, options: req.options },
      ],
    });
    return new Promise((resolve) => permissionResolvers.set(requestId, resolve));
  }

  function previewText(text: string) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 60);
  }

  return {
    chats: {},
    running: {},
    turnStartedAt: {},
    permissions: [],

    async load(id) {
      if (get().chats[id]) return get().chats[id];
      const c = await ipc.storeRead<Chat>(`chats/${id}`);
      if (c) set({ chats: { ...get().chats, [id]: c } });
      return c;
    },

    async create(opts) {
      const app = useApp.getState();
      const now = new Date().toISOString();
      const chat: Chat = {
        id: uid(),
        title: opts.title,
        projectId: opts.projectId,
        agent: opts.agent ?? app.settings.defaultAgent,
        autoMode: opts.autoMode ?? app.settings.autoMode,
        autopilotId: opts.autopilotId,
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      set({ chats: { ...get().chats, [chat.id]: chat } });
      save(chat);
      return chat;
    },

    setAutoMode(id, on) {
      patch(id, (c) => ({ ...c, autoMode: on }));
      const c = get().chats[id];
      if (c) save(c);
    },

    addSystem(id, text) {
      patch(id, (c) => ({ ...c, messages: [...c.messages, newMessage('system', [{ kind: 'text', text }])] }));
    },

    async send(id, text, opts = {}) {
      const chat = get().chats[id] ?? (await get().load(id));
      if (!chat) return { stopReason: null, error: 'chat not found' };
      if (get().running[id]) return { stopReason: null, error: 'busy' };

      const userParts: MessagePart[] = [{ kind: 'text', text }];
      for (const path of opts.images ?? []) userParts.push({ kind: 'image', path });
      const user: ChatMessage = newMessage('user', userParts);
      const agent: ChatMessage = newMessage('agent');
      const now = new Date().toISOString();
      const isFirst = chat.messages.filter((m) => m.role === 'user').length === 0;
      patch(id, (c) => ({
        ...c,
        title: isFirst && c.title === 'New chat' ? previewText(text) || c.title : c.title,
        messages: opts.hidden ? [...c.messages, agent] : [...c.messages, user, agent],
        updatedAt: now,
      }));
      set({ running: { ...get().running, [id]: true }, turnStartedAt: { ...get().turnStartedAt, [id]: Date.now() } });

      let result: TurnResult = { stopReason: null };
      try {
        const session = await ensureSession(get().chats[id]);
        const blocks: { type: 'text'; text: string }[] = [];
        if (!session.preambleSent) {
          const app = useApp.getState();
          const project = projectOf(chat);
          const style = project?.styleId ? allStyles(app).find((s) => s.id === project.styleId) : undefined;
          blocks.push({
            type: 'text',
            text: buildPreamble({
              language: app.settings.language,
              videoLanguage: app.settings.videoLanguage,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              localNow: localNow(),
              projectId: project?.id,
              frameCheck: app.settings.frameCheck,
              stylePrompt: style?.prompt,
              styleName: style?.name,
            }),
          });
          session.preambleSent = true;
        }
        let body = text;
        if (opts.images?.length) body += `\n\nAttached image files: ${opts.images.join(', ')}`;
        blocks.push({ type: 'text', text: body });
        result.stopReason = await session.client.prompt(blocks);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        result = { stopReason: null, error: msg };
        const auth = e instanceof AcpError && e.authRequired;
        const hint = auth || /auth|login|sign in|credential/i.test(msg) ? `\n\n${tNow('chat.authHint', { cmd: loginCommand(chat.agent) })}` : '';
        get().addSystem(id, tNow('chat.error', { msg }) + hint);
      } finally {
        patchLastAgent(id, (parts) => settleTools(parts, result.stopReason === 'cancelled' || !!result.error));
        // Drop an agent message that never got content.
        patch(id, (c) => ({ ...c, messages: c.messages.filter((m) => m.role !== 'agent' || m.parts.length > 0), updatedAt: new Date().toISOString() }));
        set({ running: { ...get().running, [id]: false } });
        // Permission cards of a finished turn can't be answered any more.
        for (const p of get().permissions.filter((x) => x.chatId === id)) get().answerPermission(p.requestId, null);
        const c = get().chats[id];
        if (c) save(c);
      }
      return result;
    },

    stop(id) {
      sessions.get(id)?.client.cancel();
    },

    answerPermission(requestId, optionId) {
      permissionResolvers.get(requestId)?.(optionId);
      permissionResolvers.delete(requestId);
      set({ permissions: get().permissions.filter((p) => p.requestId !== requestId) });
    },

    async remove(id) {
      sessions.get(id)?.client.dispose();
      sessions.delete(id);
      await killAgent(id);
      const { [id]: _gone, ...rest } = get().chats;
      set({ chats: rest });
      await useApp.getState().removeChat(id);
    },
  };
});

export function loginCommand(agent: AgentId): string {
  switch (agent) {
    case 'claude':
      return 'claude /login';
    case 'opencode':
      return 'opencode auth login';
    case 'gemini':
      return 'gemini';
    case 'codex':
      return 'codex login';
    default:
      return 'your agent\'s login command';
  }
}

/** Stops every agent (used when the window closes in browser mode). */
export function stopAllSessions() {
  for (const [id, s] of sessions) {
    s.client.dispose();
    void killAgent(id);
  }
  sessions.clear();
}
