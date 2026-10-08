import { DIAGRAMS } from '../../src/diagram/diagrams';
import { FIGURE_IDS } from '../../src/lesson/figures';
import { DAYS_PER_WEEK, getDay, plan, getDrillRef, PLAN_DAYS, TEST_ORDER } from '../../src/plan';

const blocks = plan.blocks;

test('eight weeks of six days; every day is 60–90 minutes and starts and ends with the daily basics', () => {
  expect(plan.weeks).toHaveLength(8);
  expect(PLAN_DAYS).toBe(8 * DAYS_PER_WEEK);
  for (let n = 1; n <= PLAN_DAYS; n++) {
    const d = getDay(n);
    expect(d.week).toBe(Math.ceil(n / 6));
    expect(d.minutes, `day ${n}`).toBeGreaterThanOrEqual(60);
    expect(d.minutes, `day ${n}`).toBeLessThanOrEqual(90);
    expect(d.blocks.map((b) => b.id).slice(0, 3)).toEqual(plan.daily.start);
    expect(d.blocks.at(-1)!.id).toBe('pm-review');
  }
  // Odd days of a week run its A blocks, even days its B blocks.
  expect(getDay(7).blocks.map((b) => b.id)).toContain(plan.weeks[1].a[0]);
  expect(getDay(8).blocks.map((b) => b.id)).toContain(plan.weeks[1].b[0]);
});

test('every week block exists and every block is used somewhere', () => {
  const used = new Set([...plan.daily.start, ...plan.daily.end, ...plan.weeks.flatMap((w) => [...w.a, ...w.b])]);
  expect([...used].filter((id) => !blocks.some((b) => b.id === id))).toEqual([]);
  expect(blocks.map((b) => b.id).filter((id) => !used.has(id))).toEqual([]);
});

test('break practice starts in week 7', () => {
  const first = plan.weeks.findIndex((w) => [...w.a, ...w.b].some((id) => id.startsWith('break-')));
  expect(first + 1).toBe(7);
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
  for (const x of [...plan.blocks, ...plan.tests]) {
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
