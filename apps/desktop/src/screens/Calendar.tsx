import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { ScheduleDialog } from '../components/ScheduleDialog';
import { Button, PageHeader, cn } from '../components/ui';
import { localeOf, useT } from '../i18n';
import { openProjectChat } from '../lib/projects';
import { useApp } from '../state/app';

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function CalendarScreen() {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  const projects = useApp((s) => s.projects);
  const schedule = useApp((s) => s.schedule);
  const slots = useApp((s) => s.slots);
  const autopilots = useApp((s) => s.autopilots);
  const setSchedule = useApp((s) => s.setSchedule);
  const go = useApp((s) => s.go);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dialogDate, setDialogDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const locale = localeOf(lang);
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7)); // weeks start on Monday
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const today = new Date();

  const scheduled = Object.entries(schedule)
    .map(([id, e]) => ({ project: projects.find((p) => p.id === id), entry: e }))
    .filter((x): x is { project: NonNullable<typeof x.project>; entry: typeof x.entry } => !!x.project);
  const ghostSlots = slots.filter((s) => s.state === 'planned' || s.state === 'making' || s.state === 'failed');

  const moveTo = async (projectId: string, day: Date) => {
    const e = schedule[projectId];
    if (!e) return;
    const at = new Date(e.at);
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate(), at.getHours(), at.getMinutes());
    await setSchedule(projectId, { ...e, at: next.toISOString(), reminded: false });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-8">
      <PageHeader
        title={t('cal.title')}
        body={t('cal.hint')}
        actions={
          <>
            <Button variant="ghost" onClick={() => go({ name: 'autopilot' })}>
              {t('cal.manage')}
            </Button>
            <Button variant="primary" onClick={() => (setDialogDate(null), setDialogOpen(true))}>
              <Plus size={15} /> {t('cal.schedule')}
            </Button>
          </>
        }
      />
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
          <ChevronLeft size={15} />
        </Button>
        <span className="w-40 text-center text-sm font-medium">{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</span>
        <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
          <ChevronRight size={15} />
        </Button>
        <Button size="sm" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
          {t('cal.today')}
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-ink-800 bg-ink-800 text-xs">
        {days.slice(0, 7).map((d) => (
          <div key={d.toISOString()} className="bg-ink-900 px-2 py-1.5 text-ink-400">
            {d.toLocaleDateString(locale, { weekday: 'short' })}
          </div>
        ))}
        {days.map((d) => {
          const items = scheduled.filter((x) => sameDay(new Date(x.entry.at), d));
          const ghosts = ghostSlots.filter((s) => sameDay(new Date(s.at), d) && !s.projectId);
          return (
            <div
              key={d.toISOString()}
              onDoubleClick={() => (setDialogDate(d), setDialogOpen(true))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragging && moveTo(dragging, d)}
              className={cn('min-h-24 space-y-1 bg-ink-900 p-1.5', d.getMonth() !== month.getMonth() && 'opacity-40')}
            >
              <div className={cn('mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]', sameDay(d, today) ? 'bg-forge-500 font-semibold text-ink-950' : 'text-ink-400')}>
                {d.getDate()}
              </div>
              {items.map(({ project, entry }) => (
                <div
                  key={project.id}
                  draggable
                  onDragStart={() => setDragging(project.id)}
                  onDragEnd={() => setDragging(null)}
                  className={cn('group cursor-grab rounded-md px-1.5 py-1', entry.postedAt ? 'bg-sky-500/15 text-sky-300' : project.latestRender ? 'bg-emerald-500/15 text-emerald-300' : 'bg-forge-500/15 text-forge-300')}
                >
                  <button className="block w-full truncate text-left" onClick={() => openProjectChat(project)}>
                    {new Date(entry.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} {project.title}
                  </button>
                  <div className="hidden gap-2 pt-0.5 text-[10px] group-hover:flex">
                    {!entry.postedAt && (
                      <button className="underline" onClick={() => setSchedule(project.id, { ...entry, postedAt: new Date().toISOString() })}>
                        {t('cal.markPosted')}
                      </button>
                    )}
                    <button className="underline" onClick={() => setSchedule(project.id, null)}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
              {ghosts.map((s) => (
                <div key={s.id} className={cn('truncate rounded-md border border-dashed px-1.5 py-1', s.state === 'failed' ? 'border-red-800 text-red-300' : 'border-ink-600 text-ink-400')}>
                  {new Date(s.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} {autopilots.find((a) => a.id === s.autopilotId)?.name} · {t(`slot.${s.state}`)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <ScheduleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} date={dialogDate ?? undefined} />
    </div>
  );
}
