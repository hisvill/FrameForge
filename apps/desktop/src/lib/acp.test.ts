import { describe, expect, it, vi } from 'vitest';
import { AcpClient, commandOf, type AcpHandlers, type Transport } from './acp';

/** A scripted fake agent: answers requests and lets the test push lines. */
function fakeAgent(reply: (msg: any, push: (o: object) => void) => void) {
  let onLine: (l: string) => void = () => {};
  let onExit: (i: { code: number | null; stderr: string }) => void = () => {};
  const sent: any[] = [];
  const push = (o: object) => onLine(JSON.stringify({ jsonrpc: '2.0', ...o }));
  const t: Transport = {
    send(line) {
      const msg = JSON.parse(line);
      sent.push(msg);
      queueMicrotask(() => reply(msg, push));
    },
    listen(l, e) {
      onLine = l;
      onExit = e;
      return () => {};
    },
  };
  return { t, sent, push, exit: (stderr = '') => onExit({ code: 1, stderr }) };
}

const handlers = (over: Partial<AcpHandlers> = {}): AcpHandlers => ({
  onUpdate: vi.fn(),
  onPermission: vi.fn(async () => 'allow'),
  readTextFile: vi.fn(async () => 'file text'),
  writeTextFile: vi.fn(async () => {}),
  ...over,
});

describe('AcpClient', () => {
  it('initializes, opens a session and runs a turn with streamed updates', async () => {
    const h = handlers();
    const agent = fakeAgent((msg, push) => {
      if (msg.method === 'initialize') push({ id: msg.id, result: { protocolVersion: 1, agentInfo: { name: 'fake' } } });
      if (msg.method === 'session/new')
        push({ id: msg.id, result: { sessionId: 's1', modes: { availableModes: [{ id: 'default' }, { id: 'auto' }] } } });
      if (msg.method === 'session/prompt') {
        push({ method: 'session/update', params: { sessionId: 's1', update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hi' } } } });
        push({ id: msg.id, result: { stopReason: 'end_turn' } });
      }
    });
    const c = new AcpClient(agent.t, h);
    await c.initialize();
    expect(c.agentInfo.name).toBe('fake');
    await c.newSession('/work/p1');
    expect(c.sessionId).toBe('s1');
    expect(c.hasMode('auto')).toBe(true);
    expect(await c.prompt([{ type: 'text', text: 'hello' }])).toBe('end_turn');
    expect(h.onUpdate).toHaveBeenCalledWith({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hi' } });
    expect(agent.sent[1].params).toEqual({ cwd: '/work/p1', mcpServers: [] });
  });

  it('answers permission and file requests from the agent', async () => {
    const h = handlers({ onPermission: vi.fn(async () => null) });
    const agent = fakeAgent(() => {});
    new AcpClient(agent.t, h);
    agent.push({ id: 7, method: 'session/request_permission', params: { sessionId: 's', toolCall: { title: 'Run ls' }, options: [] } });
    agent.push({ id: 8, method: 'fs/read_text_file', params: { sessionId: 's', path: '/a.txt' } });
    agent.push({ id: 9, method: 'terminal/create', params: {} });
    await new Promise((r) => setTimeout(r, 0));
    const byId = Object.fromEntries(agent.sent.map((m) => [m.id, m]));
    expect(byId[7].result).toEqual({ outcome: { outcome: 'cancelled' } });
    expect(byId[8].result).toEqual({ content: 'file text' });
    expect(byId[9].error.code).toBe(-32601);
  });

  it('rejects pending requests when the agent exits', async () => {
    const agent = fakeAgent(() => {});
    const onExit = vi.fn();
    const c = new AcpClient(agent.t, handlers({ onExit }));
    const p = c.initialize();
    agent.exit('boom: not logged in');
    await expect(p).rejects.toThrow('not logged in');
    expect(onExit).toHaveBeenCalled();
    expect(c.isClosed).toBe(true);
  });

  it('surfaces auth errors', async () => {
    const agent = fakeAgent((msg, push) => push({ id: msg.id, error: { code: -32000, message: 'Authentication required' } }));
    const c = new AcpClient(agent.t, handlers());
    await expect(c.newSession('/x')).rejects.toMatchObject({ authRequired: true });
  });
});

describe('commandOf', () => {
  it('reads string and array commands', () => {
    expect(commandOf({ command: 'ls -la' })).toBe('ls -la');
    expect(commandOf({ command: ['brew', 'install', 'ffmpeg'] })).toBe('brew install ffmpeg');
    expect(commandOf({ path: 'x' })).toBeUndefined();
  });
});
