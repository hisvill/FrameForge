import { CalendarDays, Clapperboard, Film, MessageSquarePlus, Palette, Plane, Settings } from 'lucide-react';
import type { MessageKey } from '../i18n';
import { useT } from '../i18n';
import { useApp, type Route } from '../state/app';
import { useChats } from '../state/chat';
import { Logo, cn } from './ui';

const items: { route: Route; icon: typeof Film; label: MessageKey }[] = [
  { route: { name: 'chat' }, icon: MessageSquarePlus, label: 'nav.chat' },
  { route: { name: 'videos' }, icon: Film, label: 'nav.videos' },
  { route: { name: 'style' }, icon: Palette, label: 'nav.style' },
  { route: { name: 'calendar' }, icon: CalendarDays, label: 'nav.calendar' },
  { route: { name: 'autopilot' }, icon: Plane, label: 'nav.autopilot' },
];

export function Sidebar() {
  const t = useT();
  const route = useApp((s) => s.route);
  const go = useApp((s) => s.go);
  const chats = useApp((s) => s.chats);
  const running = useChats((s) => s.running);

  const active = (r: Route) => route.name === r.name && (r.name !== 'chat' || !(route as { chatId?: string }).chatId);

  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
      <div className="flex items-center gap-2 px-4 py-4">
        <Logo />
        <span className="text-[15px] font-semibold tracking-tight">FrameForge</span>
      </div>
      <div className="space-y-0.5 px-2">
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => go(it.route)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm',
              active(it.route) ? 'bg-ink-800 text-ink-100' : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100',
            )}
          >
            <it.icon size={16} strokeWidth={1.5} />
            {t(it.label)}
          </button>
        ))}
      </div>
      <div className="mt-5 px-4 text-[11px] font-medium uppercase tracking-wide text-ink-400">{t('nav.recent')}</div>
      <div className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {chats.slice(0, 40).map((c) => (
          <button
            key={c.id}
            onClick={() => go({ name: 'chat', chatId: c.id })}
            className={cn(
              'flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-1.5 text-left text-[13px]',
              route.name === 'chat' && route.chatId === c.id ? 'bg-ink-800 text-ink-100' : 'text-ink-300 hover:bg-ink-850',
            )}
          >
            {c.projectId ? <Clapperboard size={13} className="shrink-0 text-ink-400" /> : <MessageSquarePlus size={13} className="shrink-0 text-ink-400" />}
            <span className="truncate">{c.title}</span>
            {running[c.id] && <span className="pulse-dot ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-forge-500" />}
          </button>
        ))}
      </div>
      <div className="border-t border-ink-800 p-2">
        <button
          onClick={() => go({ name: 'settings' })}
          className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm', route.name === 'settings' ? 'bg-ink-800' : 'text-ink-300 hover:bg-ink-850')}
        >
          <Settings size={16} strokeWidth={1.5} />
          {t('nav.settings')}
        </button>
        <div className="px-2.5 pt-2 text-[11px] text-ink-400">{t('nav.free')}</div>
      </div>
    </nav>
  );
}
