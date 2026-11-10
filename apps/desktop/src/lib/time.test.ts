import { describe, expect, it } from 'vitest';
import { fmtDuration, fmtTime, toLocalInput } from './time';

describe('time', () => {
  it('formats timecodes and durations', () => {
    expect(fmtTime(65.5)).toBe('1:05.50');
    expect(fmtDuration(80_000)).toBe('1m 20s');
    expect(fmtDuration(5_000)).toBe('5s');
    expect(toLocalInput(new Date(2026, 0, 2, 3, 4))).toBe('2026-01-02T03:04');
  });
});
