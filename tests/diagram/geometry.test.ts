import { along, lineFromPocket, ghostBall, cutCueBall, cutAngleDeg, dist } from '../../src/diagram/geometry';
import { TABLE, DIAMONDS } from '../../src/diagram/table';

test('lineFromPocket places points at exact distances from the pocket', () => {
  const p = lineFromPocket('TR', { x: 0, y: 39 });
  expect(dist(p(15), { x: 78, y: 0 })).toBeCloseTo(15, 1);
  expect(dist(p(15), p(39))).toBeCloseTo(24, 1);
});

test('ghost ball sits one ball diameter behind OB, away from pocket', () => {
  const g = ghostBall({ x: 60, y: 16 }, 'TR');
  expect(dist(g, { x: 60, y: 16 })).toBeCloseTo(TABLE.ball, 1);
  expect(dist(g, { x: 78, y: 0 })).toBeGreaterThan(dist({ x: 60, y: 16 }, { x: 78, y: 0 }));
});

test.each([30, 45, 60])('cutCueBall produces the requested cut angle %i°', (a) => {
  for (const side of ['L', 'R'] as const) {
    const cb = cutCueBall({ x: 60, y: 16 }, 'TR', a, side, 18);
    expect(cutAngleDeg(cb, { x: 60, y: 16 }, 'TR')).toBeCloseTo(a, 0);
  }
});

test('along moves along a unit direction', () => {
  expect(along({ x: 0, y: 0 }, { x: 1, y: 0 }, 5)).toEqual({ x: 5, y: 0 });
});

test('18 diamonds', () => expect(DIAMONDS).toHaveLength(18));
