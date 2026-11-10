/**
 * Background work while the app is open: autopilot production and post reminders.
 */
import { nextDueSlot, planSlots, skipMissed, type AutopilotSlot } from '@frameforge/shared';
import { autopilotPrompt } from '@frameforge/skills';
import { tNow } from '../i18n';
import { allStyles, useApp } from '../state/app';
import { useChats } from '../state/chat';
import { notify } from './ipc';
import { createProject, fileName } from './projects';

const LEAD_MS = 3 * 3600_000; // start a video up to 3 h before it's due
let producing = false;

function updateSlot(id: string, patch: Partial<AutopilotSlot>) {
  const app = useApp.getState();
  return app.setSlots(app.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

/** Keeps 7 days of slots planned per autopilot and marks missed ones skipped. */
export async function planAll(now = new Date()) {
  const app = useApp.getState();
  let slots = skipMissed(app.slots, now).filter((s) => s.state !== 'skipped' || new Date(s.at).getTime() > now.getTime() - 7 * 86_400_000);
  for (const a of app.autopilots) {
    if (a.paused) {
      slots = slots.filter((s) => !(s.autopilotId === a.id && s.state === 'planned'));
      continue;
    }
    const mine = slots.filter((s) => s.autopilotId === a.id);
    const planned = planSlots(a, now, 7, mine);
    const ids = new Set(planned.map((s) => s.id));
    slots = [...slots.filter((s) => s.autopilotId !== a.id || !ids.has(s.id)), ...planned];
  }
  slots = slots.filter((s) => app.autopilots.some((a) => a.id === s.autopilotId));
  if (JSON.stringify(slots) !== JSON.stringify(app.slots)) await app.setSlots(slots);
}

export async function produce(slot: AutopilotSlot) {
  const app = useApp.getState();
  const autopilot = app.autopilots.find((a) => a.id === slot.autopilotId);
  if (!autopilot) return;
  const style = allStyles(app).find((s) => s.id === autopilot.styleId);
  producing = true;
  await updateSlot(slot.id, { state: 'making', error: undefined });
  try {
    const project = await createProject({ title: `${autopilot.name} · ${new Date(slot.at).toLocaleDateString()}`, styleId: style?.id, lengthSec: autopilot.lengthSec });
    const chats = useChats.getState();
    const chat = await chats.create({ title: project.title, projectId: project.id, agent: autopilot.agent, autoMode: true, autopilotId: autopilot.id });
    await updateSlot(slot.id, { projectId: project.id, chatId: chat.id });
    const pastTitles = app.projects.filter((p) => app.slots.some((s) => s.autopilotId === autopilot.id && s.projectId === p.id)).map((p) => p.title);
    const res = await chats.send(chat.id, autopilotPrompt({ niche: autopilot.niche, style, lengthSec: autopilot.lengthSec, pastTitles }));
    const projects = await useApp.getState().refreshProjects();
    const done = projects.find((p) => p.id === project.id);
    if (done?.latestRender) {
      await updateSlot(slot.id, { state: autopilot.reviewFirst ? 'review' : 'ready' });
      await useApp.getState().setSchedule(project.id, { at: slot.at });
      if (autopilot.reviewFirst) void notify(autopilot.name, tNow('cal.reviewBody', { title: done.title }));
      else useChats.getState().addSystem(chat.id, tNow('chat.renderDone', { file: fileName(done.latestRender) }));
    } else {
      await updateSlot(slot.id, { state: 'failed', error: res.error ?? 'No video was rendered.' });
    }
  } catch (e) {
    await updateSlot(slot.id, { state: 'failed', error: e instanceof Error ? e.message : String(e) });
  } finally {
    producing = false;
  }
}

/** Sends a reminder for every scheduled video that just became due. */
export async function remind(now = new Date()) {
  const app = useApp.getState();
  for (const [projectId, entry] of Object.entries(app.schedule)) {
    if (entry.reminded || entry.postedAt) continue;
    if (new Date(entry.at).getTime() > now.getTime()) continue;
    const project = app.projects.find((p) => p.id === projectId);
    if (!project) continue;
    const slot = app.slots.find((s) => s.projectId === projectId);
    const body = slot?.state === 'review' ? tNow('cal.reviewBody', { title: project.title }) : tNow('cal.reminderBody', { title: project.title });
    void notify(tNow('cal.reminderTitle'), body);
    await app.setSchedule(projectId, { ...entry, reminded: true });
  }
}

export async function tick(now = new Date()) {
  await planAll(now);
  await remind(now);
  if (producing) return;
  const slot = nextDueSlot(useApp.getState().slots, now, LEAD_MS);
  if (slot) void produce(slot);
}

export function startEngine(): () => void {
  // Slots left "making" by a previous run can't finish any more.
  const app = useApp.getState();
  const stale = app.slots.some((s) => s.state === 'making');
  if (stale) void app.setSlots(app.slots.map((s) => (s.state === 'making' ? { ...s, state: 'failed', error: 'FrameForge was closed while making this video.' } : s)));
  void tick();
  const timer = setInterval(() => void tick(), 30_000);
  return () => clearInterval(timer);
}
