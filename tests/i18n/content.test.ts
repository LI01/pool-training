import { setLang } from '../../src/i18n';
import { DIAGRAMS, getDiagram } from '../../src/diagram/diagrams';
import { DIAGRAMS_ZH, LABELS_ZH } from '../../src/diagram/diagrams.zh';
import { getBlock, plan } from '../../src/plan';
import planEn from '../../src/plan/plan.json';
import planZh from '../../src/plan/plan.zh.json';

/** Every non-string leaf and every string under an id/enum key (ID_KEYS) must match; other strings are translated. */
const ID_KEYS = new Set(['id', 'record', 'recordKind', 'drillRefId', 'diagramId', 'kind', 'code', 'blockIds']);
function sameShape(a: unknown, b: unknown, path: string, key = ''): void {
  if (Array.isArray(a)) {
    expect(Array.isArray(b), path).toBe(true);
    expect((b as unknown[]).length, path).toBe(a.length);
    a.forEach((x, i) => sameShape(x, (b as unknown[])[i], `${path}[${i}]`, key));
  } else if (a !== null && typeof a === 'object') {
    expect(b !== null && typeof b === 'object' && !Array.isArray(b), path).toBe(true);
    expect(Object.keys(b as object), path).toEqual(Object.keys(a));
    for (const [k, v] of Object.entries(a)) sameShape(v, (b as Record<string, unknown>)[k], `${path}.${k}`, k);
  } else if (typeof a === 'string' && !ID_KEYS.has(key)) {
    expect(typeof b, path).toBe('string');
    expect((b as string).trim(), path).not.toBe('');
  } else {
    expect(b, path).toEqual(a);
  }
}

test('plan.zh.json matches plan.json in shape and every id, number and enum', () => {
  sameShape(planEn, planZh, 'plan');
});

test('plan getters follow the language', () => {
  const en = plan.title;
  setLang('zh');
  expect(plan.title).toBe(planZh.title);
  expect(plan.title).not.toBe(en);
  expect(getBlock('pm-3ball')?.name).toBe(planZh.sessions[1].blocks.find((b) => b.id === 'pm-3ball')?.name);
  setLang('en');
  expect(plan.title).toBe(en);
});

test('every diagram has a Chinese title and caption', () => {
  for (const id of Object.keys(DIAGRAMS)) {
    expect(DIAGRAMS_ZH[id]?.title.trim(), id).toBeTruthy();
    expect(DIAGRAMS_ZH[id]?.caption.trim(), id).toBeTruthy();
  }
});

test('getDiagram returns Chinese text in zh and English in en', () => {
  const id = Object.keys(DIAGRAMS)[0];
  expect(getDiagram(id)).toBe(DIAGRAMS[id]);
  setLang('zh');
  expect(getDiagram(id).title).toBe(DIAGRAMS_ZH[id].title);
  expect(getDiagram(id).panels.length).toBe(DIAGRAMS[id].panels.length);
});

test('every on-table word or length has a Chinese label (numbers, angles and single letters may fall back)', () => {
  for (const d of Object.values(DIAGRAMS))
    for (const el of d.panels.flat()) {
      const s = 'text' in el ? el.text : el.label;
      if (s && /[a-z]{2,}|"/i.test(s)) expect(LABELS_ZH[s], `${d.id}: ${s}`).toBeTruthy();
    }
});

test('Chinese text uses metric lengths only', () => {
  const imperial = /英寸|英尺|\d\s*("|ft\b)/;
  const zhText = JSON.stringify([planZh, DIAGRAMS_ZH, Object.values(LABELS_ZH)]);
  expect(zhText.match(imperial)).toBeNull();
});
