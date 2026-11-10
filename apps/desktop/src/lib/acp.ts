/**
 * Agent Client Protocol (ACP) client over newline-delimited JSON-RPC 2.0.
 * https://agentclientprotocol.com
 *
 * The transport is abstract: in the app it is a process started by the Rust side,
 * in tests it is a fake agent.
 */

export interface Transport {
  send(line: string): Promise<void> | void;
  /** Registers the line and exit listeners; returns a function that removes them. */
  listen(onLine: (line: string) => void, onExit: (info: { code: number | null; stderr: string }) => void): () => void;
}

export interface AcpPermissionOption {
  optionId: string;
  name: string;
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
}

export interface AcpPermissionRequest {
  sessionId: string;
  toolCall: { toolCallId?: string; title?: string; kind?: string; rawInput?: unknown };
  options: AcpPermissionOption[];
}

export interface AcpHandlers {
  onUpdate(update: SessionUpdate): void;
  /** Resolve with the chosen option id, or null to cancel. */
  onPermission(req: AcpPermissionRequest): Promise<string | null>;
  readTextFile(path: string, line?: number, limit?: number): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;
  onExit?(info: { code: number | null; stderr: string }): void;
}

/** The `update` object of a `session/update` notification. */
export type SessionUpdate =
  | { sessionUpdate: 'agent_message_chunk'; content: ContentBlock }
  | { sessionUpdate: 'agent_thought_chunk'; content: ContentBlock }
  | { sessionUpdate: 'user_message_chunk'; content: ContentBlock }
  | {
      sessionUpdate: 'tool_call';
      toolCallId: string;
      title?: string;
      kind?: string;
      status?: string;
      rawInput?: unknown;
      content?: unknown[];
    }
  | {
      sessionUpdate: 'tool_call_update';
      toolCallId: string;
      title?: string | null;
      kind?: string | null;
      status?: string | null;
      rawInput?: unknown;
      content?: unknown[] | null;
    }
  | { sessionUpdate: 'plan'; entries: { content: string; status: string }[] }
  | { sessionUpdate: string; [k: string]: unknown };

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource_link'; uri: string; name: string }
  | { type: string; [k: string]: unknown };

export interface SessionMode {
  id: string;
  name?: string;
}

export interface NewSessionResult {
  sessionId: string;
  modes?: { currentModeId?: string; availableModes?: SessionMode[] };
}

export type StopReason = 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled' | string;

export class AcpError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
  }
  get authRequired() {
    return this.code === -32000;
  }
}

interface Pending {
  resolve(v: unknown): void;
  reject(e: unknown): void;
}

export const PROTOCOL_VERSION = 1;

/** Finds a shell command in a tool call's raw input, if there is one. */
export function commandOf(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const c = r.command ?? r.cmd;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(String).join(' ');
  return undefined;
}

export class AcpClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private unlisten: () => void;
  private closed = false;
  sessionId: string | null = null;
  modes: SessionMode[] = [];
  agentInfo: { name?: string; version?: string } = {};

  constructor(
    private transport: Transport,
    private handlers: AcpHandlers,
  ) {
    this.unlisten = transport.listen(
      (line) => this.onLine(line),
      (info) => {
        this.closed = true;
        for (const p of this.pending.values()) p.reject(new AcpError(info.stderr.trim().split('\n').slice(-3).join('\n') || 'The agent stopped.'));
        this.pending.clear();
        handlers.onExit?.(info);
      },
    );
  }

  get isClosed() {
    return this.closed;
  }

  dispose() {
    this.unlisten();
    this.closed = true;
  }

  private write(msg: object) {
    return this.transport.send(JSON.stringify({ jsonrpc: '2.0', ...msg }));
  }

  request<T = unknown>(method: string, params: unknown): Promise<T> {
    if (this.closed) return Promise.reject(new AcpError('The agent stopped.'));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      Promise.resolve(this.write({ id, method, params })).catch((e) => {
        this.pending.delete(id);
        reject(e instanceof Error ? e : new AcpError(String(e)));
      });
    });
  }

  notify(method: string, params: unknown) {
    return this.write({ method, params });
  }

  private respond(id: unknown, result: unknown) {
    void this.write({ id, result });
  }

  private respondError(id: unknown, code: number, message: string) {
    void this.write({ id, error: { code, message } });
  }

  private onLine(line: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line);
    } catch {
      return; // agents sometimes log plain text to stdout
    }
    if (!msg || typeof msg !== 'object') return;
    const { id, method } = msg as { id?: unknown; method?: string };
    if (typeof method === 'string' && id !== undefined && id !== null) {
      void this.onRequest(id, method, msg.params as Record<string, unknown>);
    } else if (typeof method === 'string') {
      if (method === 'session/update') {
        const p = msg.params as { update?: SessionUpdate } | undefined;
        if (p?.update) this.handlers.onUpdate(p.update);
      }
    } else if (typeof id === 'number') {
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      const err = msg.error as { code?: number; message?: string; data?: unknown } | undefined;
      if (err) {
        const detail = typeof err.data === 'string' ? `: ${err.data}` : '';
        p.reject(new AcpError((err.message ?? 'Agent error') + detail, err.code));
      } else p.resolve(msg.result);
    }
  }

  private async onRequest(id: unknown, method: string, params: Record<string, unknown>) {
    try {
      switch (method) {
        case 'session/request_permission': {
          const optionId = await this.handlers.onPermission(params as unknown as AcpPermissionRequest);
          this.respond(id, { outcome: optionId ? { outcome: 'selected', optionId } : { outcome: 'cancelled' } });
          return;
        }
        case 'fs/read_text_file': {
          const content = await this.handlers.readTextFile(
            String(params.path),
            params.line as number | undefined,
            params.limit as number | undefined,
          );
          this.respond(id, { content });
          return;
        }
        case 'fs/write_text_file':
          await this.handlers.writeTextFile(String(params.path), String(params.content ?? ''));
          this.respond(id, null);
          return;
        default:
          this.respondError(id, -32601, `FrameForge doesn't support ${method}`);
      }
    } catch (e) {
      this.respondError(id, -32603, e instanceof Error ? e.message : String(e));
    }
  }

  async initialize() {
    const res = await this.request<{ protocolVersion?: number; agentInfo?: { name?: string; version?: string } }>('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: false },
      clientInfo: { name: 'frameforge', title: 'FrameForge', version: '0.1.0' },
    });
    this.agentInfo = res?.agentInfo ?? {};
    return res;
  }

  async newSession(cwd: string) {
    const res = await this.request<NewSessionResult>('session/new', { cwd, mcpServers: [] });
    this.sessionId = res.sessionId;
    this.modes = res.modes?.availableModes ?? [];
    return res;
  }

  async prompt(blocks: ContentBlock[]): Promise<StopReason> {
    if (!this.sessionId) throw new AcpError('No session yet.');
    const res = await this.request<{ stopReason: StopReason }>('session/prompt', { sessionId: this.sessionId, prompt: blocks });
    return res?.stopReason ?? 'end_turn';
  }

  cancel() {
    if (this.sessionId && !this.closed) void this.notify('session/cancel', { sessionId: this.sessionId });
  }

  hasMode(id: string) {
    return this.modes.some((m) => m.id === id);
  }

  async setMode(modeId: string) {
    if (!this.sessionId) return;
    await this.request('session/set_mode', { sessionId: this.sessionId, modeId });
  }
}
