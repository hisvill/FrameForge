import type { ChatMessage, MessagePart, ToolCallPart, ToolStatus } from '@frameforge/shared';
import { commandOf, type SessionUpdate } from './acp';

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export function newMessage(role: ChatMessage['role'], parts: MessagePart[] = []): ChatMessage {
  return { id: uid(), role, parts, createdAt: new Date().toISOString() };
}

function status(s: unknown): ToolStatus | undefined {
  return s === 'pending' || s === 'in_progress' || s === 'completed' || s === 'failed' ? s : undefined;
}

function textOf(content: unknown): string | undefined {
  if (content && typeof content === 'object' && (content as { type?: string }).type === 'text') return (content as { text: string }).text;
  return undefined;
}

/** Applies one ACP session update to an agent message's parts (returns new parts). */
export function applyUpdate(parts: MessagePart[], u: SessionUpdate): MessagePart[] {
  const out = [...parts];
  const last = out[out.length - 1];
  switch (u.sessionUpdate) {
    case 'agent_message_chunk':
    case 'agent_thought_chunk': {
      const text = textOf((u as { content: unknown }).content);
      if (!text) return parts;
      const kind = u.sessionUpdate === 'agent_message_chunk' ? 'text' : 'thought';
      if (last && last.kind === kind) out[out.length - 1] = { ...last, text: last.text + text };
      else out.push({ kind, text });
      return out;
    }
    case 'tool_call': {
      const t = u as Extract<SessionUpdate, { sessionUpdate: 'tool_call' }>;
      const part: ToolCallPart = {
        kind: 'tool',
        id: t.toolCallId,
        title: t.title || 'Tool',
        toolKind: t.kind,
        status: status(t.status) ?? 'pending',
        detail: commandOf(t.rawInput),
      };
      const i = out.findIndex((p) => p.kind === 'tool' && p.id === t.toolCallId);
      if (i >= 0) out[i] = { ...(out[i] as ToolCallPart), ...part };
      else out.push(part);
      return out;
    }
    case 'tool_call_update': {
      const t = u as Extract<SessionUpdate, { sessionUpdate: 'tool_call_update' }>;
      const i = out.findIndex((p) => p.kind === 'tool' && p.id === t.toolCallId);
      const prev: ToolCallPart = i >= 0 ? (out[i] as ToolCallPart) : { kind: 'tool', id: t.toolCallId, title: 'Tool', status: 'pending' };
      const next: ToolCallPart = {
        ...prev,
        title: t.title || prev.title,
        toolKind: t.kind ?? prev.toolKind,
        status: status(t.status) ?? prev.status,
        detail: commandOf(t.rawInput) ?? prev.detail,
      };
      if (i >= 0) out[i] = next;
      else out.push(next);
      return out;
    }
    default:
      return parts;
  }
}

/** The visible text of a message, for titles and previews. */
export function plainText(m: ChatMessage): string {
  return m.parts
    .filter((p): p is Extract<MessagePart, { kind: 'text' }> => p.kind === 'text')
    .map((p) => p.text)
    .join('')
    .trim();
}

/** Marks tools still running as failed (the turn ended without finishing them). */
export function settleTools(parts: MessagePart[], cancelled: boolean): MessagePart[] {
  return parts.map((p) =>
    p.kind === 'tool' && (p.status === 'pending' || p.status === 'in_progress') ? { ...p, status: cancelled ? 'failed' : 'completed' } : p,
  );
}
