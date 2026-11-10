import { describe, expect, it } from 'vitest';
import { applyUpdate, settleTools } from './messages';

describe('applyUpdate', () => {
  it('joins streamed text and keeps thoughts apart', () => {
    let p = applyUpdate([], { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'Hmm' } });
    p = applyUpdate(p, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hel' } });
    p = applyUpdate(p, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'lo' } });
    expect(p).toEqual([
      { kind: 'thought', text: 'Hmm' },
      { kind: 'text', text: 'Hello' },
    ]);
  });

  it('tracks a tool call through its updates', () => {
    let p = applyUpdate([], { sessionUpdate: 'tool_call', toolCallId: 't', title: 'Run', kind: 'execute', status: 'pending', rawInput: { command: 'npx remotion render' } });
    p = applyUpdate(p, { sessionUpdate: 'tool_call_update', toolCallId: 't', status: 'completed' });
    expect(p[0]).toMatchObject({ kind: 'tool', status: 'completed', detail: 'npx remotion render', title: 'Run' });
  });

  it('settles unfinished tools when a turn ends', () => {
    const p = settleTools([{ kind: 'tool', id: 'a', title: 'x', status: 'in_progress' }], true);
    expect(p[0]).toMatchObject({ status: 'failed' });
  });
});
