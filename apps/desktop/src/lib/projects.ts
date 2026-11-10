import type { Project, ProjectManifest } from '@frameforge/shared';
import { startProjectPrompt } from '@frameforge/skills';
import { allStyles, useApp } from '../state/app';
import { useChats } from '../state/chat';
import { ipc } from './ipc';
import { uid } from './messages';

export interface NewVideo {
  title: string;
  idea?: string;
  styleId?: string;
  lengthSec: number;
}

export async function createProject(v: NewVideo): Promise<Project> {
  const app = useApp.getState();
  await ipc.ensureDir(app.settings.workingFolder);
  const manifest: ProjectManifest = {
    id: uid(),
    title: v.title.trim() || 'Untitled video',
    topic: v.idea?.trim() || undefined,
    styleId: v.styleId,
    format: app.settings.format,
    fps: app.settings.fps,
    step: 'topic',
    createdAt: new Date().toISOString(),
  };
  const project = await ipc.projectCreate(app.settings.workingFolder, manifest);
  await app.refreshProjects();
  return project;
}

/** Creates the project and its chat, opens it and sends the first message. */
export async function startVideo(v: NewVideo): Promise<string> {
  const project = await createProject(v);
  const chats = useChats.getState();
  const chat = await chats.create({ title: project.title, projectId: project.id });
  useApp.getState().go({ name: 'chat', chatId: chat.id });
  const style = allStyles(useApp.getState()).find((s) => s.id === v.styleId);
  void chats
    .send(chat.id, startProjectPrompt({ title: project.title, idea: v.idea, style, lengthSec: v.lengthSec, format: project.format }))
    .then(() => useApp.getState().refreshProjects());
  return chat.id;
}

/** The chat that belongs to a project, created if missing. */
export async function openProjectChat(project: Project): Promise<void> {
  const app = useApp.getState();
  const existing = app.chats.find((c) => c.projectId === project.id && !c.autopilotId) ?? app.chats.find((c) => c.projectId === project.id);
  if (existing) {
    app.go({ name: 'chat', chatId: existing.id });
    return;
  }
  const chat = await useChats.getState().create({ title: project.title, projectId: project.id });
  app.go({ name: 'chat', chatId: chat.id });
}

export function projectStatus(p: Project): 'progress' | 'rendered' | 'scheduled' | 'posted' {
  if (p.postedAt) return 'posted';
  if (p.scheduledAt) return 'scheduled';
  if (p.latestRender) return 'rendered';
  return 'progress';
}

export function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}
