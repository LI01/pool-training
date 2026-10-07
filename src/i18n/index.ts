import { en } from './en';
import { zh } from './zh';

export type Lang = 'en' | 'zh';
export type Key = keyof typeof en;

let lang: Lang = 'en';

export const getLang = (): Lang => lang;

/** Sets the UI language (callers re-render) and the document's lang attribute. */
export function setLang(l: Lang): void {
  lang = l;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
}

/** The browser's preferred language: Chinese if it starts with "zh", else English. */
export const detectLang = (): Lang => (navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en');

/** The string for `key` in the current language, with `{name}` replaced from params. */
export function t(key: Key, params?: Record<string, string | number>): string {
  const s = (lang === 'zh' ? zh : en)[key];
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}
