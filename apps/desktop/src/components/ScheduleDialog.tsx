import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { toLocalInput } from '../lib/time';
import { useApp } from '../state/app';
import { Button, Dialog, Field, inputClass } from './ui';

export function ScheduleDialog({ open, onClose, projectId, date }: { open: boolean; onClose: () => void; projectId?: string; date?: Date }) {
  const t = useT();
  const projects = useApp((s) => s.projects);
  const setSchedule = useApp((s) => s.setSchedule);
  const [pid, setPid] = useState(projectId ?? '');
  const [when, setWhen] = useState('');

  useEffect(() => {
    if (!open) return;
    setPid(projectId ?? projects[0]?.id ?? '');
    const d = date ? new Date(date) : new Date(Date.now() + 3600_000);
    if (date) d.setHours(18, 0, 0, 0);
    setWhen(toLocalInput(d));
  }, [open, projectId, date, projects]);

  const save = async () => {
    if (!pid || !when) return;
    await setSchedule(pid, { at: new Date(when).toISOString() });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('cal.schedule')}>
      <div className="space-y-4">
        {!projectId && (
          <Field label={t('cal.pick')}>
            <select className={inputClass} value={pid} onChange={(e) => setPid(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={t('cal.when')}>
          <input type="datetime-local" className={inputClass} value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <p className="text-xs text-ink-400">{t('cal.hint')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={!pid}>
            {t('cal.save')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
