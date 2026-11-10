import type { VideoFormat } from '@frameforge/shared';
import type { ReactNode } from 'react';
import { Button, Card, Field, PageHeader, Toggle, inputClass } from '../components/ui';
import { useT } from '../i18n';
import { notify, openUrl, pickFolder } from '../lib/ipc';
import { useApp } from '../state/app';
import { AgentPicker, ToolList } from './Onboarding';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-medium text-ink-300">{title}</h2>
      <Card className="space-y-4 p-5">{children}</Card>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="mt-0.5 max-w-lg text-xs text-ink-400">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const t = useT();
  const s = useApp((x) => x.settings);
  const set = useApp((x) => x.setSettings);
  const go = useApp((x) => x.go);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-3xl">
        <PageHeader title={t('set.title')} />
        <Section title={t('set.general')}>
          <Row label={t('set.language')}>
            <select className={`${inputClass} w-48`} value={s.language} onChange={(e) => set({ language: e.target.value as 'en' | 'id' })}>
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
          </Row>
          <Row label={t('set.folder')} hint={s.workingFolder}>
            <Button
              onClick={async () => {
                const f = await pickFolder(s.workingFolder);
                if (f) await set({ workingFolder: f });
              }}
            >
              {t('set.change')}
            </Button>
          </Row>
          <Row label={t('set.notify')}>
            <Button onClick={() => notify('FrameForge', '👋')}>{t('set.notify')}</Button>
          </Row>
        </Section>

        <Section title={t('set.agents')}>
          <Field label={t('set.defaultAgent')}>
            <AgentPicker />
          </Field>
          <Row label={t('set.autoMode')} hint={t('set.autoModeHint')}>
            <Toggle checked={s.autoMode} onChange={(v) => set({ autoMode: v })} label={t('set.autoMode')} />
          </Row>
          <Row label={t('set.frameCheck')}>
            <Toggle checked={s.frameCheck} onChange={(v) => set({ frameCheck: v })} label={t('set.frameCheck')} />
          </Row>
        </Section>

        <Section title={t('set.video')}>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('set.videoLanguage')}>
              <input className={inputClass} value={s.videoLanguage} onChange={(e) => set({ videoLanguage: e.target.value })} />
            </Field>
            <Field label={t('set.format')}>
              <select className={inputClass} value={s.format} onChange={(e) => set({ format: e.target.value as VideoFormat })}>
                <option value="9:16">9:16 (TikTok, Reels, Shorts)</option>
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
              </select>
            </Field>
            <Field label={t('set.fps')}>
              <select className={inputClass} value={s.fps} onChange={(e) => set({ fps: Number(e.target.value) })}>
                {[24, 30, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} fps
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title={t('set.tools')}>
          <ToolList />
        </Section>

        <Section title={t('set.about')}>
          <p className="text-sm text-ink-300">{t('set.aboutBody')}</p>
          <div className="flex gap-2">
            <Button onClick={() => openUrl('https://github.com/hisvill/FrameForge')}>GitHub</Button>
            <Button variant="ghost" onClick={() => go({ name: 'onboarding' })}>
              {t('set.rerunOnboarding')}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
