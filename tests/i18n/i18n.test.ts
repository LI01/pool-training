import { en } from '../../src/i18n/en';
import { zh } from '../../src/i18n/zh';
import { detectLang, getLang, setLang, t } from '../../src/i18n';
import { validateBackup } from '../../src/db/store';

test('every key has a non-empty Chinese string (key parity is enforced by the type)', () => {
  expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  for (const [k, v] of Object.entries(zh)) expect(v.trim(), k).not.toBe('');
});

test('t() interpolates params and follows the language', () => {
  expect(getLang()).toBe('en');
  expect(t('today.dayOf', { day: 3, total: 48 })).toBe('Day 3 of 48');
  setLang('zh');
  expect(t('today.dayOf', { day: 3, total: 48 })).toBe('第 3 天 / 共 48 天');
  expect(document.documentElement.lang).toBe('zh-CN');
  setLang('en');
  expect(document.documentElement.lang).toBe('en');
});

test('detectLang picks Chinese only for zh browsers', () => {
  const spy = vi.spyOn(navigator, 'language', 'get');
  spy.mockReturnValue('zh-CN');
  expect(detectLang()).toBe('zh');
  spy.mockReturnValue('en-US');
  expect(detectLang()).toBe('en');
  spy.mockRestore();
});

test('backup settings.lang is optional and must be en or zh', () => {
  const b = (settings: object) => ({ app: 'pool-training', schema: 1, exportedAt: 0, sessions: [], tests: [], settings });
  expect(() => validateBackup(b({ soundOn: true }))).not.toThrow();
  expect(() => validateBackup(b({ soundOn: true, lang: 'zh' }))).not.toThrow();
  expect(() => validateBackup(b({ soundOn: true, lang: 'fr' }))).toThrow();
});
