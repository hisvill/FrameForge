import { describe, expect, it } from 'vitest';
import { nextDueSlot, parseTime, planSlots, skipMissed } from '../src/schedule';
import type { Autopilot } from '../src/types';

const ap: Autopilot = {
  id: 'ap1',
  name: 'Facts',
  niche: 'space facts',
  styleId: 'kinetic-type',
  agent: 'claude',
  times: ['09:00', '18:30'],
  days: [1, 2, 3, 4, 5],
  lengthSec: 30,
  reviewFirst: true,
  paused: false,
  createdAt: '2026-11-01T00:00:00Z',
};

describe('parseTime', () => {
  it('reads HH:MM and rejects junk', () => {
    expect(parseTime('09:05')).toEqual({ h: 9, m: 5 });
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('nine')).toBeNull();
  });
});

describe('planSlots', () => {
  it('plans weekday slots and skips times already past', () => {
    // Monday 2026-11-09 12:00 local
    const from = new Date(2026, 10, 9, 12, 0);
    const slots = planSlots(ap, from, 7);
    // Mon: only 18:30, Tue-Fri: 2 each, Sat/Sun none => 1 + 8
    expect(slots).toHaveLength(9);
    expect(new Date(slots[0].at).getHours()).toBe(18);
  });

  it('keeps the state of known slots', () => {
    const from = new Date(2026, 10, 9, 12, 0);
    const first = planSlots(ap, from, 1);
    first[0].state = 'ready';
    expect(planSlots(ap, from, 1, first)[0].state).toBe('ready');
  });
});

describe('nextDueSlot / skipMissed', () => {
  it('picks the soonest planned slot inside the lead time', () => {
    const from = new Date(2026, 10, 10, 8, 0);
    const slots = planSlots(ap, from, 1);
    expect(nextDueSlot(slots, from, 2 * 3600_000)?.at).toBe(new Date(2026, 10, 10, 9, 0).toISOString());
    expect(nextDueSlot(slots, from, 30 * 60_000)).toBeUndefined();
  });

  it('marks past planned slots as skipped', () => {
    const from = new Date(2026, 10, 10, 8, 0);
    const slots = planSlots(ap, from, 1);
    const later = new Date(2026, 10, 10, 20, 0);
    expect(skipMissed(slots, later).every((s) => s.state === 'skipped')).toBe(true);
  });
});
