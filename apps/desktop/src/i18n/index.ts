import type { UiLanguage } from '@frameforge/shared';
import { en, type MessageKey } from './en';
import { id } from './id';
import { useApp } from '../state/app';

const dicts: Record<UiLanguage, Record<MessageKey, string>> = { en, id };

export type { MessageKey };

export function translate(lang: UiLanguage, key: MessageKey, vars?: Record<string, string | number>): string {
  const text = dicts[lang]?.[key] ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : text;
}

export function useT() {
  const lang = useApp((s) => s.settings.language);
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

export function tNow(key: MessageKey, vars?: Record<string, string | number>) {
  return translate(useApp.getState().settings.language, key, vars);
}

export function localeOf(lang: UiLanguage) {
  return lang === 'id' ? 'id-ID' : 'en-US';
}
