import type { Project } from '@frameforge/shared';
import { ArrowUp, Film, Square, X } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '../i18n';
import { cn } from './ui';

export interface ComposerProps {
  running: boolean;
  onSend: (text: string, attached: Project[]) => void;
  onStop: () => void;
  projects?: Project[];
  allowMentions?: boolean;
  autoFocus?: boolean;
}

export function Composer({ running, onSend, onStop, projects = [], allowMentions, autoFocus }: ComposerProps) {
  const t = useT();
  const [text, setText] = useState('');
  const [attached, setAttached] = useState<Project[]>([]);
  const [mention, setMention] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const matches = useMemo(
    () => (mention === null ? [] : projects.filter((p) => p.title.toLowerCase().includes(mention.toLowerCase())).slice(0, 6)),
    [mention, projects],
  );

  const submit = () => {
    const v = text.trim();
    if (!v || running) return;
    onSend(v, attached);
    setText('');
    setAttached([]);
  };

  const attach = (p: Project) => {
    setAttached((a) => (a.some((x) => x.id === p.id) ? a : [...a, p]));
    setText((s) => s.replace(/@[^\s@]*$/, ''));
    setMention(null);
    ref.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention !== null && matches.length) {
      if (e.key === 'ArrowDown') return e.preventDefault(), setSel((sel + 1) % matches.length);
      if (e.key === 'ArrowUp') return e.preventDefault(), setSel((sel - 1 + matches.length) % matches.length);
      if (e.key === 'Enter') return e.preventDefault(), attach(matches[sel]);
      if (e.key === 'Escape') return setMention(null);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onChange = (v: string) => {
    setText(v);
    if (!allowMentions) return;
    const m = /(?:^|\s)@([^\s@]*)$/.exec(v);
    setMention(m ? m[1] : null);
    setSel(0);
  };

  return (
    <div className="relative">
      {mention !== null && matches.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-80 overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-xl">
          {matches.map((p, i) => (
            <button key={p.id} onMouseDown={(e) => (e.preventDefault(), attach(p))} className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm', i === sel && 'bg-ink-800')}>
              <Film size={14} className="text-ink-400" /> {p.title}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-2xl border border-ink-700 bg-ink-900 p-2 focus-within:border-ink-600">
        {attached.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 pb-1.5">
            {attached.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 rounded-md bg-ink-800 px-2 py-0.5 text-xs">
                <Film size={12} /> {p.title}
                <button onClick={() => setAttached(attached.filter((x) => x.id !== p.id))} aria-label="Remove">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={ref}
            autoFocus={autoFocus}
            rows={1}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('chat.placeholder')}
            className="max-h-48 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm placeholder:text-ink-400 focus:outline-none"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          {running ? (
            <button onClick={onStop} aria-label={t('chat.stop')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-700 hover:bg-ink-600">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button onClick={submit} disabled={!text.trim()} aria-label={t('chat.send')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-forge-500 text-ink-950 hover:bg-forge-400 disabled:opacity-30">
              <ArrowUp size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
