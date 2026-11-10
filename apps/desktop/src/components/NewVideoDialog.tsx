import { useState } from 'react';
import { useT } from '../i18n';
import { startVideo } from '../lib/projects';
import { allStyles, useApp, useStyles } from '../state/app';
import { Button, Dialog, Field, inputClass } from './ui';

export function NewVideoDialog({ open, onClose, styleId }: { open: boolean; onClose: () => void; styleId?: string }) {
  const t = useT();
  const styles = useStyles();
  const [title, setTitle] = useState('');
  const [idea, setIdea] = useState('');
  const [style, setStyle] = useState(styleId ?? '');
  const [length, setLength] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await startVideo({ title: title || idea.slice(0, 50) || 'New video', idea, styleId: style || undefined, lengthSec: length });
      onClose();
      setTitle('');
      setIdea('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('new.title')}>
      <div className="space-y-4">
        <Field label={t('new.name')}>
          <input autoFocus className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('new.namePh')} />
        </Field>
        <Field label={t('new.idea')}>
          <textarea className={inputClass} rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={t('new.ideaPh')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('new.style')}>
            <select className={inputClass} value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="">{t('new.styleAuto')}</option>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('new.length')}>
            <select className={inputClass} value={length} onChange={(e) => setLength(Number(e.target.value))}>
              {[15, 30, 45, 60, 90].map((n) => (
                <option key={n} value={n}>
                  {t('common.seconds', { n })}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            {t('new.cancel')}
          </Button>
          <Button variant="primary" onClick={create} disabled={busy}>
            {t('new.create')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
