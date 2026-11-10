import type { ChatMessage, MessagePart, ToolCallPart } from '@frameforge/shared';
import { splitOptions } from '@frameforge/skills';
import { Brain, Check, ChevronRight, CircleAlert, Loader2, Terminal, Wrench } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { fileUrl } from '../lib/ipc';
import { fmtDuration } from '../lib/time';
import { Markdown } from './Markdown';
import { OptionCards } from './OptionCards';
import { cn } from './ui';

type Group = { kind: 'text'; text: string } | { kind: 'activity'; parts: MessagePart[] } | { kind: 'image'; path: string };

/** Text stays text; thoughts and tool calls between texts collapse into one activity line. */
export function groupParts(parts: MessagePart[]): Group[] {
  const out: Group[] = [];
  for (const p of parts) {
    if (p.kind === 'text') out.push({ kind: 'text', text: p.text });
    else if (p.kind === 'image') out.push({ kind: 'image', path: p.path });
    else {
      const last = out[out.length - 1];
      if (last?.kind === 'activity') last.parts.push(p);
      else out.push({ kind: 'activity', parts: [p] });
    }
  }
  return out;
}

function ToolIcon({ t }: { t: ToolCallPart }) {
  if (t.status === 'failed') return <CircleAlert size={13} className="text-red-400" />;
  if (t.status === 'pending' || t.status === 'in_progress') return <Loader2 size={13} className="animate-spin text-forge-400" />;
  return t.toolKind === 'execute' ? <Terminal size={13} className="text-ink-400" /> : <Check size={13} className="text-ink-400" />;
}

function Activity({ parts, live }: { parts: MessagePart[]; live: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const tools = parts.filter((p): p is ToolCallPart => p.kind === 'tool');
  const failed = tools.some((x) => x.status === 'failed');
  return (
    <div className="my-1.5">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-300">
        <ChevronRight size={13} className={cn('transition-transform', open && 'rotate-90')} />
        {live ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}
        {t('chat.activity', { n: parts.length })}
        {failed && <CircleAlert size={12} className="text-red-400" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 border-l border-ink-700 pl-3">
          {parts.map((p, i) =>
            p.kind === 'thought' ? (
              <div key={i} className="flex gap-1.5 text-xs italic text-ink-400">
                <Brain size={13} className="mt-0.5 shrink-0" />
                <span className="selectable whitespace-pre-wrap">{p.text}</span>
              </div>
            ) : p.kind === 'tool' ? (
              <div key={i} className="flex items-start gap-1.5 text-xs text-ink-300">
                <span className="mt-0.5 shrink-0">
                  <ToolIcon t={p} />
                </span>
                <span className="min-w-0">
                  <span>{p.title}</span>
                  {p.detail && <code className="selectable mt-0.5 block truncate font-mono text-[11px] text-ink-400">{p.detail}</code>}
                </span>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function AgentBody({ m, live, onPick }: { m: ChatMessage; live: boolean; onPick: (v: string) => void }) {
  const t = useT();
  const groups = groupParts(m.parts);
  return (
    <>
      {groups.map((g, i) => {
        if (g.kind === 'activity') return <Activity key={i} parts={g.parts} live={live && i === groups.length - 1} />;
        if (g.kind === 'image') return <img key={i} src={fileUrl(g.path)} className="my-2 h-24 rounded-lg border border-ink-700" alt="" />;
        return splitOptions(g.text).map((s, j) =>
          s.kind === 'markdown' ? (
            <Markdown key={`${i}-${j}`} text={s.text} />
          ) : s.kind === 'options' ? (
            <OptionCards key={`${i}-${j}`} block={s.block} disabled={live} onPick={onPick} />
          ) : (
            <div key={`${i}-${j}`} className="my-2 h-16 animate-pulse rounded-xl bg-ink-850" />
          ),
        );
      })}
      {!live && /frames checked|frame sudah dicek/i.test(groups.map((g) => (g.kind === 'text' ? g.text : '')).join(' ')) && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
          <Check size={12} /> {t('chat.framesChecked')}
        </span>
      )}
    </>
  );
}

function WorkingLine({ since }: { since: number }) {
  const t = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-ink-400">
      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-forge-500" />
      {t('chat.working')} · {fmtDuration(now - since)}
    </div>
  );
}

export function MessageList({ messages, running, since, onPick }: { messages: ChatMessage[]; running: boolean; since?: number; onPick: (v: string) => void }) {
  const t = useT();
  const end = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  const lastLen = last ? JSON.stringify(last.parts).length : 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, lastLen]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-6 py-6">
      {messages.map((m, i) => {
        const live = running && i === messages.length - 1 && m.role === 'agent';
        if (m.role === 'system')
          return (
            <div key={m.id} className="selectable whitespace-pre-wrap rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-xs text-ink-300">
              {m.parts.map((p) => (p.kind === 'text' ? p.text : '')).join('')}
            </div>
          );
        if (m.role === 'user')
          return (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink-800 px-4 py-2.5 text-sm">
                {m.parts.map((p, j) =>
                  p.kind === 'text' ? (
                    <div key={j} className="selectable whitespace-pre-wrap">
                      {p.text}
                    </div>
                  ) : p.kind === 'image' ? (
                    <img key={j} src={fileUrl(p.path)} alt="" className="mt-2 h-24 rounded-lg" />
                  ) : null,
                )}
              </div>
            </div>
          );
        return (
          <div key={m.id}>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-400">{t('chat.agent')}</div>
            <AgentBody m={m} live={live} onPick={onPick} />
          </div>
        );
      })}
      {running && since && <WorkingLine since={since} />}
      <div ref={end} />
    </div>
  );
}
