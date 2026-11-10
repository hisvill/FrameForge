import type { Project } from '@frameforge/shared';
import { topicIdeasPrompt } from '@frameforge/skills';
import { Clapperboard, Lightbulb, Trash2, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Composer } from '../components/Composer';
import { MessageList } from '../components/MessageList';
import { NewVideoDialog } from '../components/NewVideoDialog';
import { PermissionCard } from '../components/PermissionCard';
import { Preview } from '../components/Preview';
import { ScheduleDialog } from '../components/ScheduleDialog';
import { StepBar } from '../components/StepBar';
import { Badge, Button, Logo, Toggle } from '../components/ui';
import { useT, type MessageKey } from '../i18n';
import { fileName } from '../lib/projects';
import { fmtTime } from '../lib/time';
import { allStyles, useApp } from '../state/app';
import { useChats } from '../state/chat';

function withContext(text: string, attached: Project[]) {
  if (!attached.length) return text;
  const ctx = attached.map((p) => `- "${p.title}" (FrameForge id ${p.id}), folder ${p.folder}`).join('\n');
  return `${text}\n\nAttached videos:\n${ctx}`;
}

export function ChatHome() {
  const t = useT();
  const projects = useApp((s) => s.projects);
  const go = useApp((s) => s.go);
  const [newOpen, setNewOpen] = useState(false);

  const start = async (text: string, attached: Project[] = []) => {
    const chats = useChats.getState();
    const chat = await chats.create({ title: 'New chat' });
    go({ name: 'chat', chatId: chat.id });
    void chats.send(chat.id, withContext(text, attached));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="dither mb-5 rounded-2xl p-4 text-forge-500">
          <Logo size={44} />
        </div>
        <h1 className="text-2xl font-semibold">{t('chat.new.title')}</h1>
        <p className="mt-2 max-w-md text-center text-sm text-ink-300">{t('chat.new.body')}</p>
        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            <Clapperboard size={15} /> {t('chat.new.startVideo')}
          </Button>
          <Button onClick={() => start(topicIdeasPrompt('', allStyles(useApp.getState())))}>
            <Lightbulb size={15} /> {t('chat.new.ideas')}
          </Button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-6 pb-6">
        <Composer running={false} onStop={() => {}} onSend={start} projects={projects} allowMentions autoFocus />
        <div className="mt-2 text-center text-[11px] text-ink-400">{t('chat.noVideo')}</div>
      </div>
      <NewVideoDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

const CHIPS: [MessageKey, MessageKey][] = [
  ['chip.faster', 'chip.faster.msg'],
  ['chip.shorter', 'chip.shorter.msg'],
  ['chip.bigger', 'chip.bigger.msg'],
  ['chip.render', 'chip.render.msg'],
];

export function ChatThread({ chatId }: { chatId: string }) {
  const t = useT();
  const chats = useChats();
  const chat = chats.chats[chatId];
  const running = !!chats.running[chatId];
  const permissions = chats.permissions.filter((p) => p.chatId === chatId);
  const projects = useApp((s) => s.projects);
  const refreshProjects = useApp((s) => s.refreshProjects);
  const go = useApp((s) => s.go);
  const project = chat?.projectId ? projects.find((p) => p.id === chat.projectId) : undefined;
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [lastRender, setLastRender] = useState<string | undefined>();

  useEffect(() => {
    void chats.load(chatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // While the agent works, watch the project folder for a new render.
  useEffect(() => {
    if (!project) return;
    if (!running) {
      void refreshProjects();
      return;
    }
    const i = setInterval(() => void refreshProjects(), 4000);
    return () => clearInterval(i);
  }, [running, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project?.renderedAt) return;
    if (lastRender && lastRender !== project.renderedAt && project.latestRender) {
      chats.addSystem(chatId, t('chat.renderDone', { file: fileName(project.latestRender) }));
    }
    setLastRender(project.renderedAt);
  }, [project?.renderedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chat) return <div className="p-8 text-sm text-ink-400">{t('common.loading')}</div>;

  const send = (text: string, attached: Project[] = [], images?: string[]) => void chats.send(chatId, withContext(text, attached), { images }).then(() => refreshProjects());

  const remove = async () => {
    await chats.remove(chatId);
    go({ name: 'chat' });
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-ink-800 px-5 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{chat.title}</div>
            <div className="mt-0.5">
              {project ? <StepBar step={project.step} /> : <span className="text-[11px] text-ink-400">{t('chat.noVideo')}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {chat.autopilotId && <Badge tone="forge">Autopilot</Badge>}
            <label className="flex items-center gap-2 text-xs text-ink-300" title={t('chat.autoHint')}>
              <Zap size={13} /> {t('chat.auto')}
              <Toggle checked={!!chat.autoMode} onChange={(v) => chats.setAutoMode(chatId, v)} label={t('chat.auto')} />
            </label>
            <Button variant="ghost" size="sm" onClick={remove} title={t('chat.delete')} aria-label={t('chat.delete')}>
              <Trash2 size={14} />
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MessageList messages={chat.messages} running={running} since={chats.turnStartedAt[chatId]} onPick={(v) => send(v)} />
        </div>
        <div className="mx-auto w-full max-w-3xl space-y-2 px-6 pb-5">
          {permissions.map((p) => (
            <PermissionCard key={p.requestId} req={p} />
          ))}
          {project && !running && (
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map(([label, msg]) => (
                <button key={label} onClick={() => send(t(msg))} className="rounded-full border border-ink-700 px-2.5 py-1 text-xs text-ink-300 hover:border-ink-600 hover:text-ink-100">
                  {t(label)}
                </button>
              ))}
            </div>
          )}
          <Composer running={running} onStop={() => chats.stop(chatId)} onSend={(text, att) => send(text, att)} projects={projects} allowMentions={!project} />
        </div>
      </div>
      {project && (
        <Preview
          project={project}
          onSchedule={() => setScheduleOpen(true)}
          onSendFrame={(path, time) => send(t('preview.frameMsg', { time: fmtTime(time), path }), [], [path])}
        />
      )}
      {project && <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} projectId={project.id} />}
    </div>
  );
}
