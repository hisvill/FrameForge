import { describe, expect, it } from 'vitest';
import { en } from './en';
import { id } from './id';
import { translate } from './index';

describe('i18n', () => {
  it('has the same keys and placeholders in both languages', () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(id[k], k).toBeTruthy();
      expect(vars(id[k]), k).toBe(vars(en[k]));
    }
  });

  it('fills placeholders', () => {
    expect(translate('id', 'chat.videoAttached', { n: 1 })).toBe('1 video terlampir');
  });

  it('never mentions pricing', () => {
    const all = [...Object.values(en), ...Object.values(id)].join(' ').toLowerCase();
    expect(all).not.toMatch(/pricing|upgrade|subscribe|harga|langganan/);
  });
});
