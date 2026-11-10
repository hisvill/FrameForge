import type { AgentId, ToolCheck, ToolId } from '@frameforge/shared';
import { installPrompt } from '@frameforge/skills';
import { Bot, Check, CircleAlert, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MessageList } from '../components/MessageList';
import { PermissionCard } from '../components/PermissionCard';
import { Button, Card, Logo, cn, inputClass } from '../components/ui';
import { useT, type MessageKey } from '../i18n';
import { ipc, type SystemInfo } from '../lib/ipc';
import { useApp } from '../state/app';
import { useChats } from '../state/chat';

function Steps({ at }: { at: number }) {
  return (
    <div className="mb-8 flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn('h-1 w-10 rounded-full', i <= at ? 'bg-forge-500' : 'bg-ink-700')} />
      ))}
    </div>
  );
}

function Welcome({ next }: { next: () => void }) {
  const t = useT();
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  return (
    <div>
      <div className="dither mb-8 inline-flex rounded-2xl p-5 text-forge-500">
        <Logo size={56} />
      </div>
      <div className="font-mono text-xs tracking-widest text-forge-400">{t('onb.welcome.kicker')}</div>
      <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight">{t('onb.welcome.title')}</h1>
      <p className="mt-4 max-w-xl text-ink-300">{t('onb.welcome.body')}</p>
      <div className="mt-8 flex items-center gap-4">
        <Button variant="primary" onClick={next}>
          {t('onb.welcome.start')}
        </Button>
        <select
          className="rounded-lg border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm"
          value={settings.language}
          onChange={(e) => {
            const language = e.target.value as 'en' | 'id';
            void setSettings({ language, videoLanguage: language === 'id' ? 'Indonesian' : 'English' });
          }}
          aria-label="Language"
        >
          <option value="en">English</option>
          <option value="id">Bahasa Indonesia</option>
        </select>
      </div>
    </div>
  );
}

export function AgentPicker() {
  const t = useT();
  const agents = useApp((s) => s.agents);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const rows: { id: AgentId; name: string; installed: boolean; version?: string }[] = [
    ...agents.map((a) => ({ id: a.id, name: a.name, installed: a.installed, version: a.version })),
    { id: 'custom', name: t('onb.connect.custom'), installed: !!settings.customAgentCommand.trim() },
  ];
  return (
    <div className="space-y-2">
      {rows.map((a) => (
        <button
          key={a.id}
          onClick={() => setSettings({ defaultAgent: a.id })}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl border p-3 text-left',
            settings.defaultAgent === a.id ? 'border-forge-500 bg-forge-500/5' : 'border-ink-700 bg-ink-900 hover:border-ink-600',
          )}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-800">
            <Bot size={18} strokeWidth={1.5} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-medium">{a.name}</span>
            <span className="block text-xs text-ink-400">{a.id === 'custom' ? t('onb.connect.customHint') : a.version ?? ''}</span>
          </span>
          <span className={cn('text-xs', a.installed ? 'text-emerald-400' : 'text-ink-400')}>
            {a.installed ? t('onb.connect.installed') : a.id === 'custom' ? '' : t('onb.connect.missing')}
          </span>
        </button>
      ))}
      {settings.defaultAgent === 'custom' && (
        <input className={inputClass} value={settings.customAgentCommand} onChange={(e) => setSettings({ customAgentCommand: e.target.value })} placeholder="my-agent --acp" />
      )}
    </div>
  );
}

function Connect({ next, back }: { next: () => void; back: () => void }) {
  const t = useT();
  const settings = useApp((s) => s.settings);
  const agents = useApp((s) => s.agents);
  const ok = settings.defaultAgent === 'custom' ? !!settings.customAgentCommand.trim() : agents.some((a) => a.id === settings.defaultAgent && a.installed);
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('onb.connect.title')}</h1>
      <p className="mt-2 text-sm text-ink-300">{t('onb.connect.body')}</p>
      <div className="mt-6">
        <AgentPicker />
      </div>
      <p className="mt-4 text-xs text-ink-400">{t('onb.connect.claudeHelp')}</p>
      <div className="mt-6 flex gap-2">
        <Button variant="ghost" onClick={back}>
          {t('onb.back')}
        </Button>
        <Button variant="primary" onClick={next} disabled={!ok}>
          {t('onb.next')}
        </Button>
        <Button variant="ghost" onClick={() => useApp.getState().refreshAgents()}>
          <RefreshCw size={14} />
        </Button>
      </div>
    </div>
  );
}

/** Tool checks plus agent-driven installs; also used in Settings. */
export function ToolList({ onChange }: { onChange?: (tools: ToolCheck[]) => void }) {
  const t = useT();
  const [tools, setTools] = useState<ToolCheck[] | null>(null);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [setupChat, setSetupChat] = useState<string | null>(null);
  const chats = useChats();

  const check = async () => {
    const list = await ipc.tools();
    setTools(list);
    onChange?.(list);
  };
  useEffect(() => {
    void check();
    void ipc.info().then(setInfo);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const install = async (id: ToolId) => {
    let chatId = setupChat;
    if (!chatId) {
      const c = await chats.create({ title: 'Setup', autoMode: false });
      chatId = c.id;
      setSetupChat(c.id);
    }
    const os = info ? `${info.os} ${info.arch}${info.packageManager ? `, ${info.packageManager} available` : ''}` : 'this computer';
    await useChats.getState().send(chatId, installPrompt(id, os));
    await check();
  };

  const chat = setupChat ? chats.chats[setupChat] : null;
  const busy = setupChat ? !!chats.running[setupChat] : false;

  if (!tools) return <Loader2 className="animate-spin text-ink-400" size={18} />;
  const section = (required: boolean) => (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-400">{t(required ? 'onb.check.required' : 'onb.check.recommended')}</div>
      {tools
        .filter((x) => x.required === required)
        .map((x) => (
          <Card key={x.id} className="flex items-center gap-3 p-3">
            {x.found ? <Check size={18} className="text-emerald-400" /> : <CircleAlert size={18} className={required ? 'text-forge-400' : 'text-ink-400'} />}
            <div className="flex-1">
              <div className="text-sm font-medium">{t(`tool.${x.id}` as MessageKey)}</div>
              <div className="text-xs text-ink-400">{x.found ? x.version ?? x.path ?? t('onb.check.ready') : t(`tool.${x.id}.why` as MessageKey)}</div>
            </div>
            {!x.found && (
              <Button size="sm" onClick={() => install(x.id)} disabled={busy}>
                {t('onb.check.install')}
              </Button>
            )}
          </Card>
        ))}
    </div>
  );
  return (
    <div className="space-y-5">
      {section(true)}
      {section(false)}
      <Button variant="ghost" size="sm" onClick={check}>
        <RefreshCw size={13} /> {t('onb.check.recheck')}
      </Button>
      {chat && (
        <div className="rounded-xl border border-ink-700 bg-ink-950">
          <div className="max-h-72 overflow-y-auto">
            <MessageList messages={chat.messages} running={busy} since={chats.turnStartedAt[chat.id]} onPick={(v) => void chats.send(chat.id, v)} />
          </div>
          <div className="space-y-2 p-3">
            {chats.permissions
              .filter((p) => p.chatId === chat.id)
              .map((p) => (
                <PermissionCard key={p.requestId} req={p} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckStep({ back, finish }: { back: () => void; finish: () => void }) {
  const t = useT();
  const [ready, setReady] = useState(false);
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('onb.check.title')}</h1>
      <p className="mt-2 text-sm text-ink-300">{t('onb.check.body')}</p>
      <div className="mt-6">
        <ToolList onChange={(tools) => setReady(tools.filter((x) => x.required).every((x) => x.found))} />
      </div>
      <div className="mt-6 flex items-center gap-2">
        <Button variant="ghost" onClick={back}>
          {t('onb.back')}
        </Button>
        <Button variant="primary" onClick={finish} disabled={!ready}>
          {t('onb.check.finish')}
        </Button>
        {!ready && <span className="text-xs text-ink-400">{t('onb.check.needAll')}</span>}
        {!ready && (
          <button className="ml-auto text-xs text-ink-400 underline" onClick={finish}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

export function Onboarding() {
  const [step, setStep] = useState(0);
  const setSettings = useApp((s) => s.setSettings);
  const go = useApp((s) => s.go);
  const finish = async () => {
    await setSettings({ onboarded: true });
    go({ name: 'chat' });
  };
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-8 py-16">
        <Steps at={step} />
        {step === 0 && <Welcome next={() => setStep(1)} />}
        {step === 1 && <Connect next={() => setStep(2)} back={() => setStep(0)} />}
        {step === 2 && <CheckStep back={() => setStep(1)} finish={finish} />}
      </div>
    </div>
  );
}
