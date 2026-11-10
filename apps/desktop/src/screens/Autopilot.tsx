import type { AgentId, Autopilot, Weekday } from '@frameforge/shared';
import { Pause, Pencil, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Dialog, Field, PageHeader, Toggle, cn, inputClass } from '../components/ui';
import { localeOf, useT } from '../i18n';
import { produce, planAll } from '../lib/engine';
import { uid } from '../lib/messages';
import { openProjectChat } from '../lib/projects';
import { fmtWhen } from '../lib/time';
import { allStyles, useApp, useStyles } from '../state/app';

function blank(agent: AgentId): Autopilot {
  return {
    id: uid(),
    name: '',
    niche: '',
    styleId: 'kinetic-type',
    agent,
    times: ['09:00'],
    days: [1, 2, 3, 4, 5],
    lengthSec: 30,
    reviewFirst: true,
    paused: false,
    createdAt: new Date().toISOString(),
  };
}

function Editor({ initial, onClose }: { initial: Autopilot; onClose: () => void }) {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  const styles = useStyles();
  const agents = useApp((s) => s.agents);
  const save = useApp((s) => s.saveAutopilot);
  const [a, setA] = useState(initial);
  const dayNames = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 8 + i).toLocaleDateString(localeOf(lang), { weekday: 'short' })); // 8 Nov 2026 is a Sunday
  const toggleDay = (d: Weekday) => setA({ ...a, days: a.days.includes(d) ? a.days.filter((x) => x !== d) : [...a.days, d].sort() as Weekday[] });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('ap.name')}>
          <input className={inputClass} value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} />
        </Field>
        <Field label={t('ap.niche')}>
          <input className={inputClass} value={a.niche} onChange={(e) => setA({ ...a, niche: e.target.value })} placeholder={t('ap.nichePh')} />
        </Field>
        <Field label={t('ap.style')}>
          <select className={inputClass} value={a.styleId} onChange={(e) => setA({ ...a, styleId: e.target.value })}>
            {styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('ap.agent')}>
          <select className={inputClass} value={a.agent} onChange={(e) => setA({ ...a, agent: e.target.value as AgentId })}>
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.name}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </Field>
        <Field label={t('ap.length')}>
          <select className={inputClass} value={a.lengthSec} onChange={(e) => setA({ ...a, lengthSec: Number(e.target.value) })}>
            {[15, 30, 45, 60, 90].map((n) => (
              <option key={n} value={n}>
                {t('common.seconds', { n })}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('ap.days')}>
        <div className="flex gap-1">
          {dayNames.map((n, i) => (
            <button key={i} type="button" onClick={() => toggleDay(i as Weekday)} className={cn('h-8 w-11 rounded-lg text-xs', a.days.includes(i as Weekday) ? 'bg-forge-500 text-ink-950' : 'bg-ink-800 text-ink-300')}>
              {n}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('ap.times')}>
        <div className="flex flex-wrap items-center gap-2">
          {a.times.map((tm, i) => (
            <span key={i} className="flex items-center gap-1">
              <input type="time" className={`${inputClass} w-28`} value={tm} onChange={(e) => setA({ ...a, times: a.times.map((x, j) => (j === i ? e.target.value : x)) })} />
              {a.times.length > 1 && (
                <button type="button" onClick={() => setA({ ...a, times: a.times.filter((_, j) => j !== i) })} aria-label="Remove time">
                  <X size={14} className="text-ink-400" />
                </button>
              )}
            </span>
          ))}
          {a.times.length < 6 && (
            <Button size="sm" type="button" onClick={() => setA({ ...a, times: [...a.times, '18:00'] })}>
              <Plus size={13} /> {t('ap.addTime')}
            </Button>
          )}
        </div>
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <Toggle checked={a.reviewFirst} onChange={(v) => setA({ ...a, reviewFirst: v })} /> {t('ap.review')}
      </label>
      <p className="text-xs text-forge-400">{t('ap.autoWarn')}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={!a.name.trim() || !a.niche.trim() || !a.days.length || !a.times.length}
          onClick={async () => {
            await save(a);
            await planAll();
            onClose();
          }}
        >
          {t('ap.save')}
        </Button>
      </div>
    </div>
  );
}

function AutopilotCard({ a, onEdit }: { a: Autopilot; onEdit: () => void }) {
  const t = useT();
  const lang = useApp((s) => s.settings.language);
  const allSlots = useApp((s) => s.slots);
  const slots = allSlots.filter((x) => x.autopilotId === a.id);
  const projects = useApp((s) => s.projects);
  const style = useApp((s) => allStyles(s).find((x) => x.id === a.styleId));
  const save = useApp((s) => s.saveAutopilot);
  const del = useApp((s) => s.deleteAutopilot);
  const setSlots = useApp((s) => s.setSlots);
  const now = Date.now();
  const upcoming = slots.filter((s) => new Date(s.at).getTime() >= now - 86_400_000).sort((x, y) => x.at.localeCompare(y.at));
  const next = upcoming.find((s) => s.state === 'planned');
  const made = slots.filter((s) => s.state === 'ready' || s.state === 'review').length;
  const failed = slots.filter((s) => s.state === 'failed').length;
  const locale = localeOf(lang);

  const approve = (id: string) => setSlots(useApp.getState().slots.map((s) => (s.id === id ? { ...s, state: 'ready' } : s)));

  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <div className="h-16 w-12 shrink-0 rounded-lg" style={{ background: style?.swatch }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{a.name}</span>
            <Badge tone={a.paused ? 'neutral' : 'green'}>{a.paused ? t('ap.paused') : t('ap.active')}</Badge>
          </div>
          <div className="mt-0.5 text-xs text-ink-400">
            {a.niche} · {style?.name} · {a.times.join(', ')}
          </div>
          <div className="mt-1 text-xs text-ink-300">
            {next && !a.paused ? t('ap.next', { when: fmtWhen(next.at, locale) }) : ''} {t('ap.made', { n: made, f: failed })}
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => save({ ...a, paused: !a.paused }).then(() => planAll())} aria-label={a.paused ? t('ap.resume') : t('ap.pause')}>
            {a.paused ? <Play size={14} /> : <Pause size={14} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label={t('ap.edit')}>
            <Pencil size={14} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => del(a.id)} aria-label={t('ap.delete')}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {upcoming.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">{t('ap.slots')}</div>
          <div className="space-y-1">
            {upcoming.slice(0, 8).map((s) => {
              const project = projects.find((p) => p.id === s.projectId);
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-lg bg-ink-850 px-3 py-1.5 text-xs">
                  <span className="w-36 text-ink-300">{fmtWhen(s.at, locale)}</span>
                  <Badge tone={s.state === 'failed' ? 'red' : s.state === 'ready' ? 'green' : s.state === 'review' ? 'forge' : 'neutral'}>{t(`slot.${s.state}`)}</Badge>
                  {project && (
                    <button className="truncate text-ink-100 underline" onClick={() => openProjectChat(project)}>
                      {project.title}
                    </button>
                  )}
                  {s.error && <span className="truncate text-red-400">{s.error}</span>}
                  <span className="ml-auto flex gap-1">
                    {s.state === 'review' && (
                      <Button size="sm" variant="primary" onClick={() => approve(s.id)}>
                        {t('ap.approve')}
                      </Button>
                    )}
                    {s.state === 'failed' && (
                      <Button size="sm" onClick={() => produce(s)}>
                        <RotateCcw size={12} /> {t('ap.retry')}
                      </Button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

export function AutopilotScreen() {
  const t = useT();
  const autopilots = useApp((s) => s.autopilots);
  const defaultAgent = useApp((s) => s.settings.defaultAgent);
  const [editing, setEditing] = useState<Autopilot | null>(null);
  return (
    <div className="h-full overflow-y-auto p-8">
      <PageHeader
        title={t('ap.title')}
        body={t('ap.body')}
        actions={
          <Button variant="primary" onClick={() => setEditing(blank(defaultAgent))}>
            <Plus size={15} /> {t('ap.new')}
          </Button>
        }
      />
      {autopilots.length === 0 ? (
        <p className="text-sm text-ink-400">{t('ap.empty')}</p>
      ) : (
        <div className="space-y-3">
          {autopilots.map((a) => (
            <AutopilotCard key={a.id} a={a} onEdit={() => setEditing(a)} />
          ))}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.name || t('ap.new')} wide>
        {editing && <Editor initial={editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}
