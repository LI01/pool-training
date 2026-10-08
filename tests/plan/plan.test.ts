import { DIAGRAMS } from '../../src/diagram/diagrams';
import { FIGURE_IDS } from '../../src/lesson/figures';
import { plan, getDrillRef, TEST_ORDER } from '../../src/plan';

const blocks = plan.sessions.flatMap((s) => s.blocks);

test('two sessions of 60 minutes each', () => {
  expect(plan.sessions.map((s) => s.id)).toEqual(['am', 'pm']);
  for (const s of plan.sessions) expect(s.blocks.reduce((n, b) => n + b.minutes, 0)).toBe(60);
});

test('block ids unique and drill refs resolve', () => {
  const ids = blocks.map((b) => b.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const b of blocks) if (b.drillRefId) expect(getDrillRef(b.drillRefId)).toBeDefined();
});

test('every text field is filled', () => {
  for (const b of blocks)
    for (const k of ['name', 'setup', 'volume', 'howToTrain', 'successStandard', 'purpose'] as const)
      expect(b[k].trim().length).toBeGreaterThan(0);
});

test('record kind consistent with record mode', () => {
  for (const b of blocks) {
    if (b.record === 'no') expect(b.recordKind).toBeNull();
    else expect(b.recordKind).not.toBeNull();
  }
});

test('every block has three illustrated key points and every test two, each with a known figure and its own speech', () => {
  for (const x of [...plan.sessions.flatMap((s) => s.blocks), ...plan.tests]) {
    expect(x.lesson, x.id).toHaveLength('kind' in x ? 2 : 3);
    for (const s of x.lesson) {
      expect(s.title.length && s.text.length, x.id).toBeGreaterThan(0);
      expect(s.speech.length, x.id).toBeGreaterThan(s.text.length * 0.8);
      if (s.figure.startsWith('diagram:')) expect(DIAGRAMS[s.figure.slice(8)], s.figure).toBeDefined();
      else expect(FIGURE_IDS, s.figure).toContain(s.figure);
    }
  }
});

test('five tests in canonical order', () => {
  expect(plan.tests.map((t) => t.id)).toEqual(TEST_ORDER);
});
