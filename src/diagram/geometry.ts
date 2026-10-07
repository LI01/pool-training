import { POCKETS, TABLE } from './table';
import type { PocketId, Pt } from './types';

const r1 = (n: number) => Math.round(n * 10) / 10;
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const unit = (from: Pt, to: Pt): Pt => {
  const d = dist(from, to);
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d };
};
export const along = (from: Pt, dir: Pt, d: number): Pt => ({ x: r1(from.x + dir.x * d), y: r1(from.y + dir.y * d) });

/** Point generator on the straight line from a pocket toward a target point. */
export const lineFromPocket = (pocket: PocketId, toward: Pt) => {
  const p = POCKETS[pocket];
  const u = unit(p, toward);
  return (d: number): Pt => along(p, u, d);
};

/** Cue-ball centre at contact for a straight-in pot (one ball diameter behind OB). */
export const ghostBall = (ob: Pt, pocket: PocketId): Pt => along(ob, unit(POCKETS[pocket], ob), TABLE.ball);

const rotate = (v: Pt, deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) };
};

/** Cue-ball position `dist` inches from the ghost ball, giving `angleDeg` cut. 'L' = cue ball left of the shot line as seen from behind the OB looking at the pocket. */
export const cutCueBall = (ob: Pt, pocket: PocketId, angleDeg: number, side: 'L' | 'R', d: number): Pt => {
  const g = ghostBall(ob, pocket);
  const away = unit(POCKETS[pocket], ob); // direction from pocket through OB, continuing behind it
  return along(g, rotate(away, side === 'L' ? angleDeg : -angleDeg), d);
};

/** Angle between the cue-ball travel line (CB→ghost) and the object-ball line (OB→pocket). */
export const cutAngleDeg = (cb: Pt, ob: Pt, pocket: PocketId): number => {
  const g = ghostBall(ob, pocket);
  const a = unit(cb, g);
  const b = unit(ob, POCKETS[pocket]);
  return (Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))) * 180) / Math.PI;
};
