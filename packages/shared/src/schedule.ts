import type { Autopilot, AutopilotSlot, Weekday } from './types';

/** Parses `HH:MM`; null when malformed. */
export function parseTime(hhmm: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/** Stable id for an autopilot's slot at a given time. */
export function slotId(autopilotId: string, at: Date): string {
  return `${autopilotId}@${at.toISOString()}`;
}

/**
 * The slots an autopilot has between `from` and `from + days`, in local time,
 * oldest first. Existing slots keep their state.
 */
export function planSlots(
  autopilot: Autopilot,
  from: Date,
  days: number,
  existing: AutopilotSlot[] = [],
): AutopilotSlot[] {
  const known = new Map(existing.map((s) => [s.id, s]));
  const out: AutopilotSlot[] = [];
  const times = autopilot.times.map(parseTime).filter((t): t is { h: number; m: number } => t !== null);
  for (let d = 0; d < days; d++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + d);
    if (!autopilot.days.includes(day.getDay() as Weekday)) continue;
    for (const t of times) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.h, t.m);
      if (at < from) continue;
      const id = slotId(autopilot.id, at);
      out.push(known.get(id) ?? { id, autopilotId: autopilot.id, at: at.toISOString(), state: 'planned' });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** The planned slot to start now: due within `leadMs`, not yet past. */
export function nextDueSlot(slots: AutopilotSlot[], now: Date, leadMs: number): AutopilotSlot | undefined {
  return slots
    .filter((s) => s.state === 'planned')
    .filter((s) => {
      const t = new Date(s.at).getTime();
      return t >= now.getTime() && t - now.getTime() <= leadMs;
    })
    .sort((a, b) => a.at.localeCompare(b.at))[0];
}

/** Planned slots whose time already passed become skipped. */
export function skipMissed(slots: AutopilotSlot[], now: Date): AutopilotSlot[] {
  return slots.map((s) =>
    s.state === 'planned' && new Date(s.at).getTime() < now.getTime() ? { ...s, state: 'skipped' } : s,
  );
}
