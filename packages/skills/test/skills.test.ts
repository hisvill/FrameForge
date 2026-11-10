import { describe, expect, it } from 'vitest';
import { BUILTIN_STYLES, buildPreamble, splitOptions, styleFromStudy, startProjectPrompt } from '../src';

describe('buildPreamble', () => {
  const base = { language: 'en' as const, videoLanguage: 'English', timeZone: 'Asia/Jakarta', localNow: 'Tue 2026-11-10 10:00', frameCheck: true };

  it('includes the skill without frontmatter', () => {
    const p = buildPreamble(base);
    expect(p).toContain('# FrameForge');
    expect(p).not.toMatch(/^---\nname:/);
    expect(p).toContain('Asia/Jakarta');
  });

  it('adds the Indonesian hint, project id and style', () => {
    const p = buildPreamble({ ...base, language: 'id', projectId: 'p1', stylePrompt: 'Glow', styleName: 'Neon' });
    expect(p).toContain('Reply in Indonesian');
    expect(p).toContain('p1');
    expect(p).toContain('Style for this video: Neon');
  });

  it('never mentions pricing or plans', () => {
    expect(buildPreamble(base).toLowerCase()).not.toMatch(/pricing|paid plan|subscription/);
  });
});

describe('splitOptions', () => {
  it('parses an options block between Markdown', () => {
    const text = 'Pick one:\n\n```frameforge-options\n{"question":"Topic?","options":[{"label":"A","value":"Make A"}]}\n```\nThanks';
    const segs = splitOptions(text);
    expect(segs.map((s) => s.kind)).toEqual(['markdown', 'options', 'markdown']);
    const o = segs[1];
    if (o.kind !== 'options') throw new Error();
    expect(o.block.options[0]).toEqual({ label: 'A', value: 'Make A', description: undefined });
  });

  it('shows a streaming block as pending and broken JSON as text', () => {
    expect(splitOptions('Hi\n```frameforge-options\n{"opt').map((s) => s.kind)).toEqual(['markdown', 'pending']);
    expect(splitOptions('```frameforge-options\nnot json\n```').map((s) => s.kind)).toEqual(['markdown']);
  });
});

describe('styles', () => {
  it('ships built-in styles with every breakdown field', () => {
    expect(BUILTIN_STYLES.length).toBeGreaterThanOrEqual(3);
    for (const s of BUILTIN_STYLES) {
      expect(Object.values(s.breakdown).every(Boolean)).toBe(true);
      expect(s.prompt.length).toBeGreaterThan(50);
    }
  });

  it('reads a study result and rejects one without a prompt', () => {
    const st = styleFromStudy({ name: 'Retro', prompt: 'VHS look', camera: 'shaky' }, 'c1', 'https://x', 'now');
    expect(st?.source).toBe('copied');
    expect(st?.breakdown.camera).toBe('shaky');
    expect(styleFromStudy({ name: 'x' }, 'c2', 'u', 'now')).toBeNull();
  });

  it('builds a start prompt', () => {
    expect(startProjectPrompt({ title: 'T', lengthSec: 30, format: '9:16' })).toContain('Suggest some');
  });
});
