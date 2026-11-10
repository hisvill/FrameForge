import type { AgentInfo, Autopilot, AutopilotSlot, Chat, Project, Settings, Style } from '@frameforge/shared';
import { useMemo } from 'react';
import { BUILTIN_STYLES } from '@frameforge/skills';
import { create } from 'zustand';
import { ipc } from '../lib/ipc';

export type Route =
  | { name: 'onboarding' }
  | { name: 'chat'; chatId?: string }
  | { name: 'videos' }
  | { name: 'style' }
  | { name: 'calendar' }
  | { name: 'autopilot' }
  | { name: 'settings' };

export interface ScheduleEntry {
  at: string;
  postedAt?: string;
  reminded?: boolean;
}

export interface ChatSummary {
  id: string;
  title: string;
  projectId?: string;
  autopilotId?: string;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  defaultAgent: 'claude',
  customAgentCommand: '',
  workingFolder: '',
  autoMode: false,
  frameCheck: true,
  videoLanguage: 'English',
  format: '9:16',
  fps: 30,
  onboarded: false,
};

interface AppState {
  loaded: boolean;
  route: Route;
  settings: Settings;
  agents: AgentInfo[];
  userStyles: Style[];
  projects: Project[];
  schedule: Record<string, ScheduleEntry>;
  autopilots: Autopilot[];
  slots: AutopilotSlot[];
  chats: ChatSummary[];

  go(route: Route): void;
  init(): Promise<void>;
  setSettings(patch: Partial<Settings>): Promise<void>;
  refreshProjects(): Promise<Project[]>;
  refreshAgents(): Promise<void>;
  saveStyle(style: Style): Promise<void>;
  deleteStyle(id: string): Promise<void>;
  setSchedule(projectId: string, entry: ScheduleEntry | null): Promise<void>;
  saveAutopilot(a: Autopilot): Promise<void>;
  deleteAutopilot(id: string): Promise<void>;
  setSlots(slots: AutopilotSlot[]): Promise<void>;
  upsertChatSummary(c: Chat): void;
  removeChat(id: string): Promise<void>;
}

export function allStyles(s: Pick<AppState, 'userStyles'>): Style[] {
  return [...BUILTIN_STYLES, ...s.userStyles];
}

export function agentCommand(settings: Settings, agents: AgentInfo[], id = settings.defaultAgent): string[] {
  if (id === 'custom') return settings.customAgentCommand.trim().split(/\s+/).filter(Boolean);
  return agents.find((a) => a.id === id)?.command ?? [];
}

export const useApp = create<AppState>((set, get) => ({
  loaded: false,
  route: { name: 'chat' },
  settings: DEFAULT_SETTINGS,
  agents: [],
  userStyles: [],
  projects: [],
  schedule: {},
  autopilots: [],
  slots: [],
  chats: [],

  go: (route) => set({ route }),

  async init() {
    const [saved, styles, schedule, autopilots, slots, chatIndex, info] = await Promise.all([
      ipc.storeRead<Partial<Settings>>('settings'),
      ipc.storeRead<Style[]>('styles'),
      ipc.storeRead<Record<string, ScheduleEntry>>('schedule'),
      ipc.storeRead<Autopilot[]>('autopilots'),
      ipc.storeRead<AutopilotSlot[]>('slots'),
      ipc.storeRead<ChatSummary[]>('chat-index'),
      ipc.info().catch(() => null),
    ]);
    const settings: Settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
    if (!saved?.language && info?.locale?.toLowerCase().startsWith('id')) {
      settings.language = 'id';
      settings.videoLanguage = 'Indonesian';
    }
    if (!settings.workingFolder) settings.workingFolder = await ipc.defaultWorkingFolder();
    set({
      settings,
      userStyles: styles ?? [],
      schedule: schedule ?? {},
      autopilots: autopilots ?? [],
      slots: slots ?? [],
      chats: chatIndex ?? [],
      route: settings.onboarded ? { name: 'chat' } : { name: 'onboarding' },
    });
    await Promise.all([get().refreshAgents(), get().refreshProjects()]);
    set({ loaded: true });
  },

  async setSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await ipc.storeWrite('settings', settings);
    if (patch.workingFolder) await get().refreshProjects();
  },

  async refreshProjects() {
    const folder = get().settings.workingFolder;
    if (!folder) return [];
    const projects = await ipc.projectsList(folder).catch(() => [] as Project[]);
    const schedule = get().schedule;
    const merged = projects.map((p) => ({ ...p, scheduledAt: schedule[p.id]?.at, postedAt: schedule[p.id]?.postedAt }));
    set({ projects: merged });
    return merged;
  },

  async refreshAgents() {
    set({ agents: await ipc.agents().catch(() => []) });
  },

  async saveStyle(style) {
    const rest = get().userStyles.filter((s) => s.id !== style.id);
    const userStyles = [...rest, style];
    set({ userStyles });
    await ipc.storeWrite('styles', userStyles);
  },

  async deleteStyle(id) {
    const userStyles = get().userStyles.filter((s) => s.id !== id);
    set({ userStyles });
    await ipc.storeWrite('styles', userStyles);
  },

  async setSchedule(projectId, entry) {
    const schedule = { ...get().schedule };
    if (entry) schedule[projectId] = entry;
    else delete schedule[projectId];
    set({
      schedule,
      projects: get().projects.map((p) => (p.id === projectId ? { ...p, scheduledAt: entry?.at, postedAt: entry?.postedAt } : p)),
    });
    await ipc.storeWrite('schedule', schedule);
  },

  async saveAutopilot(a) {
    const autopilots = [...get().autopilots.filter((x) => x.id !== a.id), a];
    set({ autopilots });
    await ipc.storeWrite('autopilots', autopilots);
  },

  async deleteAutopilot(id) {
    const autopilots = get().autopilots.filter((x) => x.id !== id);
    const slots = get().slots.filter((s) => s.autopilotId !== id);
    set({ autopilots, slots });
    await Promise.all([ipc.storeWrite('autopilots', autopilots), ipc.storeWrite('slots', slots)]);
  },

  async setSlots(slots) {
    set({ slots });
    await ipc.storeWrite('slots', slots);
  },

  upsertChatSummary(c) {
    const summary: ChatSummary = { id: c.id, title: c.title, projectId: c.projectId, autopilotId: c.autopilotId, updatedAt: c.updatedAt };
    const chats = [summary, ...get().chats.filter((x) => x.id !== c.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    set({ chats });
    void ipc.storeWrite('chat-index', chats);
  },

  async removeChat(id) {
    const chats = get().chats.filter((c) => c.id !== id);
    set({ chats });
    await Promise.all([ipc.storeWrite('chat-index', chats), ipc.storeDelete(`chats/${id}`)]);
  },
}));

/** Built-in plus the user's styles, stable between renders. */
export function useStyles(): Style[] {
  const userStyles = useApp((s) => s.userStyles);
  return useMemo(() => allStyles({ userStyles }), [userStyles]);
}
