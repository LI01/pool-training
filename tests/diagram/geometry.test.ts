import { tangentDir, toRail, along, lineFromPocket, ghostBall, cutCueBall, cutAngleDeg, dist } from '../../src/diagram/geometry';
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

test('cut sides land on opposite sides of the OB→pocket line; L is left looking from OB to pocket', () => {
  const ob = { x: 60, y: 16 }, pocket = { x: 78, y: 0 };
  const cross = (cb: { x: number; y: number }) => (pocket.x - ob.x) * (cb.y - ob.y) - (pocket.y - ob.y) * (cb.x - ob.x);
  const l = cross(cutCueBall(ob, 'TR', 45, 'L', 18));
  const r = cross(cutCueBall(ob, 'TR', 45, 'R', 18));
  expect(Math.sign(l)).toBe(-Math.sign(r));
  // screen y points down: facing the pocket, left of travel gives a negative cross product
  expect(l).toBeLessThan(0);
});

test('tangent is perpendicular to OB→pocket line', () => {
  const t = tangentDir({ x: 52, y: 4 }, { x: 70, y: 6 }, 'TR');
  const b = { x: 8 / 10, y: -6 / 10 };
  expect(t.x * b.x + t.y * b.y).toBeCloseTo(0, 5);
  expect(Math.hypot(t.x, t.y)).toBeCloseTo(1, 5);
});

test('rail reflection off x=78 flips dx only', () => {
  const r = toRail({ x: 68, y: 7 }, { x: 0.6, y: 0.8 });
  expect(r.pt.x).toBe(78);
  expect(r.dir).toEqual({ x: -0.6, y: 0.8 });
});
