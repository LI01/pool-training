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

test('every block and test lists three common mistakes and has spoken tips', () => {
  for (const x of [...plan.sessions.flatMap((s) => s.blocks), ...plan.tests]) {
    expect(x.pitfalls, x.id).toHaveLength(3);
    expect(x.tipsSpeech.length, x.id).toBeGreaterThan(40);
  }
});

test('five tests in canonical order', () => {
  expect(plan.tests.map((t) => t.id)).toEqual(TEST_ORDER);
});
