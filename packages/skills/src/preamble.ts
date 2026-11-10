import type { UiLanguage } from '@frameforge/shared';
import skill from '../skills/frameforge/SKILL.md?raw';

export const SKILL_TEXT = skill;

export function stripFrontmatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n+/, '').trim();
}

export interface SessionContext {
  language: UiLanguage;
  /** Language the video itself is in (e.g. "Indonesian"). */
  videoLanguage: string;
  timeZone: string;
  localNow: string;
  projectId?: string;
  frameCheck: boolean;
  /** Prompt of the style the project uses, if any. */
  stylePrompt?: string;
  styleName?: string;
}

export function languageHint(language: UiLanguage): string {
  return language === 'id'
    ? 'The user reads Indonesian. Reply in Indonesian unless they write in another language. Keep code, commands and file names as they are.'
    : '';
}

/**
 * Everything FrameForge tells the agent at the start of a session. Sent in front of the
 * first prompt, so it works with every ACP agent without installing anything globally.
 */
export function buildPreamble(ctx: SessionContext): string {
  return [
    'You are running inside FrameForge. Follow these instructions for the whole session.',
    stripFrontmatter(SKILL_TEXT),
    languageHint(ctx.language),
    `Videos are in ${ctx.videoLanguage} unless the user asks otherwise.`,
    `The user's time zone is ${ctx.timeZone}. It was ${ctx.localNow} when this chat started.`,
    ctx.projectId ? `This chat is about the video with FrameForge id ${ctx.projectId}.` : '',
    ctx.frameCheck ? '' : 'The user turned the frame check off: skip it unless they ask.',
    ctx.stylePrompt ? `## Style for this video: ${ctx.styleName ?? ''}\n\n${ctx.stylePrompt}` : '',
    '---',
  ]
    .filter(Boolean)
    .join('\n\n');
}
