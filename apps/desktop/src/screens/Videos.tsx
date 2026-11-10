import type { Project } from '@frameforge/shared';
import { CalendarPlus, Clapperboard, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NewVideoDialog } from '../components/NewVideoDialog';
import { ScheduleDialog } from '../components/ScheduleDialog';
import { Badge, Button, Card, PageHeader, cn } from '../components/ui';
import { localeOf, useT, type MessageKey } from '../i18n';
import { fileUrl } from '../lib/ipc';
import { openProjectChat, projectStatus } from '../lib/projects';
import { fmtWhen } from '../lib/time';
import { allStyles, useApp } from '../state/app';

type Tab = 'all' | 'progress' | 'rendered' | 'scheduled';
const TABS: [Tab, MessageKey][] = [
  ['all', 'videos.all'],
  ['progress', 'videos.progress'],
  ['rendered', 'videos.rendered'],
  ['scheduled', 'videos.scheduled'],
];

function VideoCard({ p, onSchedule }: { p: Project; onSchedule: () => void }) {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  const style = useApp((s) => allStyles(s).find((x) => x.id === p.styleId));
  const status = projectStatus(p);
  return (
    <Card className="overflow-hidden" onClick={() => openProjectChat(p)}>
      <div className="relative aspect-[9/12] bg-ink-950" style={!p.latestRender && style ? { background: style.swatch } : undefined}>
        {p.latestRender ? (
          <video src={`${fileUrl(p.latestRender)}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/60">
            <Clapperboard size={28} strokeWidth={1.25} />
          </div>
        )}
        <div className="absolute left-2 top-2">
          <Badge tone={status === 'progress' ? 'neutral' : status === 'rendered' ? 'green' : status === 'posted' ? 'blue' : 'forge'}>
            {status === 'progress' ? t(`step.${p.step}`) : status === 'rendered' ? t('videos.rendered') : status === 'posted' ? t('videos.posted') : t('videos.scheduled')}
          </Badge>
        </div>
      </div>
      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{p.title}</div>
          <div className="truncate text-xs text-ink-400">
            {p.scheduledAt ? t('videos.scheduledFor', { when: fmtWhen(p.scheduledAt, localeOf(lang)) }) : style?.name ?? p.format}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSchedule();
          }}
          className="rounded-md p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          aria-label={t('preview.schedule')}
        >
          <CalendarPlus size={15} />
        </button>
      </div>
    </Card>
  );
}

export function Videos() {
  const t = useT();
  const projects = useApp((s) => s.projects);
  const refresh = useApp((s) => s.refreshProjects);
  const [tab, setTab] = useState<Tab>('all');
  const [newOpen, setNewOpen] = useState(false);
  const [scheduling, setScheduling] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
    const i = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(i);
  }, [refresh]);

  const shown = projects.filter((p) => {
    const s = projectStatus(p);
    if (tab === 'all') return true;
    if (tab === 'scheduled') return s === 'scheduled' || s === 'posted';
    return s === tab;
  });

  return (
    <div className="h-full overflow-y-auto p-8">
      <PageHeader
        title={t('videos.title')}
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Plus size={15} /> {t('videos.new')}
          </Button>
        }
      />
      <div className="mb-5 flex gap-1">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn('rounded-lg px-3 py-1.5 text-sm', tab === id ? 'bg-ink-800 text-ink-100' : 'text-ink-400 hover:text-ink-100')}>
            {t(label)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-ink-400">{t('videos.empty')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {shown.map((p) => (
            <VideoCard key={p.id} p={p} onSchedule={() => setScheduling(p.id)} />
          ))}
        </div>
      )}
      <NewVideoDialog open={newOpen} onClose={() => setNewOpen(false)} />
      <ScheduleDialog open={!!scheduling} onClose={() => setScheduling(null)} projectId={scheduling ?? undefined} />
    </div>
  );
}
