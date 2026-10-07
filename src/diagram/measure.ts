import { TABLE } from './table';
import type { Pt } from './types';

const W = TABLE.width, H = TABLE.height;

/** Nearest short rail (x) and long rail (y) to a point: the rail's coordinate and the distance to its cushion nose. */
export function nearestRails(p: Pt) {
  const left = p.x <= W / 2, top = p.y <= H / 2;
  return {
    x: { side: left ? 'left' : 'right', at: left ? 0 : W, d: left ? p.x : W - p.x },
    y: { side: top ? 'top' : 'bottom', at: top ? 0 : H, d: top ? p.y : H - p.y },
  } as const;
}

export const fmtInches = (n: number) => `${Math.round(n * 10) / 10}"`;

/** Distance from a point to its nearest short (x) rail and nearest long (y) rail, e.g. `16" from left`. */
export function railOffsets(p: Pt): { x: string; y: string } {
  const r = nearestRails(p);
  return { x: `${fmtInches(r.x.d)} from ${r.x.side}`, y: `${fmtInches(r.y.d)} from ${r.y.side}` };
}
