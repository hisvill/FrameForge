import type { Style, StyleBreakdown } from '@frameforge/shared';
import { copyStylePrompt, styleFromStudy } from '@frameforge/skills';
import { Copy, Link2, Pencil, Plus, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { NewVideoDialog } from '../components/NewVideoDialog';
import { Badge, Button, Card, Dialog, Field, PageHeader, inputClass } from '../components/ui';
import { useT, type MessageKey } from '../i18n';
import { ipc } from '../lib/ipc';
import { uid } from '../lib/messages';
import { allStyles, useApp, useStyles } from '../state/app';
import { chatCwd, useChats } from '../state/chat';

const FIELDS: (keyof StyleBreakdown)[] = ['camera', 'pacing', 'type', 'color', 'captions', 'transitions'];

function emptyStyle(): Style {
  return {
    id: uid(),
    name: '',
    source: 'yours',
    description: '',
    breakdown: { camera: '', pacing: '', type: '', color: '', captions: '', transitions: '' },
    prompt: '',
    swatch: 'linear-gradient(135deg,#3f3f46 0%,#f97316 100%)',
    createdAt: new Date().toISOString(),
  };
}

function StyleEditor({ initial, onClose }: { initial: Style; onClose: () => void }) {
  const t = useT();
  const save = useApp((s) => s.saveStyle);
  const [s, setS] = useState(initial);
  return (
    <div className="space-y-3">
      <Field label={t('style.name')}>
        <input className={inputClass} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
      </Field>
      <Field label={t('style.description')}>
        <input className={inputClass} value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <Field key={f} label={t(`style.${f}` as MessageKey)}>
            <input className={inputClass} value={s.breakdown[f]} onChange={(e) => setS({ ...s, breakdown: { ...s.breakdown, [f]: e.target.value } })} />
          </Field>
        ))}
      </div>
      <Field label={t('style.prompt')}>
        <textarea className={`${inputClass} font-mono text-xs`} rows={7} value={s.prompt} onChange={(e) => setS({ ...s, prompt: e.target.value })} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" disabled={!s.name.trim() || !s.prompt.trim()} onClick={() => save(s).then(onClose)}>
          {t('style.save')}
        </Button>
      </div>
    </div>
  );
}

function StyleDetail({ style, onClose }: { style: Style; onClose: () => void }) {
  const t = useT();
  const autopilots = useApp((s) => s.autopilots);
  const save = useApp((s) => s.saveStyle);
  const del = useApp((s) => s.deleteStyle);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [makeOpen, setMakeOpen] = useState(false);

  if (editing) return <StyleEditor initial={style} onClose={onClose} />;

  const clone = async () => {
    await save({ ...style, id: uid(), name: `${style.name} (copy)`, source: 'yours', basedOn: style.id, createdAt: new Date().toISOString() });
    onClose();
  };
  const remove = async () => {
    const user = autopilots.find((a) => a.styleId === style.id);
    if (user) return setError(t('style.inUse', { name: user.name }));
    await del(style.id);
    onClose();
  };

  return (
    <div>
      <div className="mb-4 h-28 rounded-xl" style={{ background: style.swatch }} />
      <p className="text-sm text-ink-300">{style.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f} className="rounded-lg bg-ink-850 p-2.5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{t(`style.${f}` as MessageKey)}</dt>
            <dd className="mt-0.5 text-xs text-ink-100">{style.breakdown[f] || '—'}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 text-[11px] font-medium uppercase tracking-wide text-ink-400">{t('style.prompt')}</div>
      <pre className="selectable mt-1 whitespace-pre-wrap rounded-lg bg-ink-950 p-3 font-mono text-xs text-ink-300">{style.prompt}</pre>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <Button variant="primary" onClick={() => setMakeOpen(true)}>
          <Wand2 size={14} /> {t('style.use')}
        </Button>
        <div className="flex gap-2">
          {style.source !== 'builtin' && (
            <Button onClick={() => setEditing(true)}>
              <Pencil size={14} /> {t('style.edit')}
            </Button>
          )}
          <Button onClick={clone}>
            <Copy size={14} /> {t('style.clone')}
          </Button>
          {style.source !== 'builtin' && (
            <Button variant="danger" onClick={remove}>
              <Trash2 size={14} /> {t('style.delete')}
            </Button>
          )}
        </div>
      </div>
      <NewVideoDialog open={makeOpen} onClose={() => (setMakeOpen(false), onClose())} styleId={style.id} />
    </div>
  );
}

function CopyFromVideo() {
  const t = useT();
  const save = useApp((s) => s.saveStyle);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'' | 'running' | 'done' | 'fail'>('');
  const [name, setName] = useState('');

  const study = async () => {
    if (!/^https?:\/\//.test(url.trim())) return;
    setStatus('running');
    const chats = useChats.getState();
    const chat = await chats.create({ title: `Style study: ${url.trim().slice(0, 40)}` });
    const id = uid();
    const outFile = `style-${id}.json`;
    await chats.send(chat.id, copyStylePrompt(url.trim(), outFile));
    try {
      const text = await ipc.readText(chatCwd(chat), outFile);
      const style = styleFromStudy(JSON.parse(text), id, url.trim(), new Date().toISOString());
      if (!style) throw new Error('bad');
      await save(style);
      setName(style.name);
      setStatus('done');
      setUrl('');
    } catch {
      setStatus('fail');
    }
  };

  return (
    <Card className="mb-8 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link2 size={15} /> {t('style.copy')}
      </div>
      <div className="mt-3 flex gap-2">
        <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('style.copyPh')} />
        <Button variant="primary" onClick={study} disabled={status === 'running' || !url.trim()}>
          {t('style.copyGo')}
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-400">{t('style.copyNote')}</p>
      {status === 'running' && <p className="mt-2 text-xs text-forge-400">{t('style.studying')}</p>}
      {status === 'done' && <p className="mt-2 text-xs text-emerald-400">{t('style.studyDone', { name })}</p>}
      {status === 'fail' && <p className="mt-2 text-xs text-red-400">{t('style.studyFail')}</p>}
    </Card>
  );
}

export function StyleScreen() {
  const t = useT();
  const styles = useStyles();
  const [open, setOpen] = useState<Style | null>(null);
  const [creating, setCreating] = useState(false);
  const groups: [Style['source'], MessageKey][] = [
    ['builtin', 'style.builtin'],
    ['copied', 'style.copied'],
    ['yours', 'style.yours'],
  ];
  return (
    <div className="h-full overflow-y-auto p-8">
      <PageHeader
        title={t('style.title')}
        body={t('style.body')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={15} /> {t('style.new')}
          </Button>
        }
      />
      <CopyFromVideo />
      {groups.map(([source, label]) => {
        const list = styles.filter((s) => s.source === source);
        if (!list.length) return null;
        return (
          <section key={source} className="mb-8">
            <h2 className="mb-3 text-sm font-medium text-ink-300">{t(label)}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {list.map((s) => (
                <Card key={s.id} className="overflow-hidden" onClick={() => setOpen(s)}>
                  <div className="h-24" style={{ background: s.swatch }} />
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      {s.basedOn && <Badge>clone</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-400">{s.description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''} wide>
        {open && <StyleDetail style={open} onClose={() => setOpen(null)} />}
      </Dialog>
      <Dialog open={creating} onClose={() => setCreating(false)} title={t('style.new')} wide>
        {creating && <StyleEditor initial={emptyStyle()} onClose={() => setCreating(false)} />}
      </Dialog>
    </div>
  );
}
