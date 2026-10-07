import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { fmtInches as fmt, nearestRails } from './measure';
import { DIAMONDS, POCKETS, TABLE } from './table';
import type { Diagram, DiagramEl, PocketId, Pt } from './types';
import './diagram.css';

const W = TABLE.width, H = TABLE.height, R = TABLE.rail;
const BR = TABLE.ball / 2;
const MOUTH = TABLE.pocketMouth / 2;
const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
const GOLD = '#f2c14e';
const BALL_COLORS: Record<number, string> = { 1: '#f5c518', 2: '#1f4fd1', 3: '#d22', 4: '#5b2a86', 5: '#f07c1a' };

type Ctx = { id: string; rotate: boolean; k: number };

/** Screen-space offset and anchor for text placed `gap` inches from a point in table direction `dir`. */
function place(ctx: Ctx, dir: Pt | undefined, gap: number, s: number) {
  const v = dir ?? { x: 0, y: 0 };
  const sx = ctx.rotate ? -v.y : v.x, sy = ctx.rotate ? v.x : v.y; // direction on screen
  const anchor: 'start' | 'middle' | 'end' = sx > 0.3 ? 'start' : sx < -0.3 ? 'end' : 'middle';
  return { dx: sx * gap, dy: sy * (gap + s * 0.5), anchor };
}

/**
 * Text placed `gap` inches from a table point in direction `dir` (table coordinates). The offset turns with the
 * table but the text itself stays upright and is anchored on the side facing the point, so labels never run back
 * over what they label, in landscape or rotated portrait view.
 */
function Txt({ ctx, at, dir, gap = 0, size, fill = '#fff', children }: {
  ctx: Ctx; at: Pt; dir?: Pt; gap?: number; size: number; fill?: string; children: ComponentChildren;
}) {
  const s = size * ctx.k;
  const { dx, dy, anchor } = place(ctx, dir, gap, s);
  return (
    <g transform={`translate(${at.x} ${at.y})${ctx.rotate ? ' rotate(-90)' : ''}`}>
      <text
        x={dx} y={dy} font-size={s} font-family={FONT} font-weight={700} fill={fill}
        text-anchor={anchor} dominant-baseline="central"
        stroke="rgba(0,0,0,0.8)" stroke-width={s * 0.22} stroke-linejoin="round" paint-order="stroke"
      >{children}</text>
    </g>
  );
}

const N: Pt = { x: 0, y: -1 }, S: Pt = { x: 0, y: 1 }, E: Pt = { x: 1, y: 0 };
const D = Math.SQRT1_2;
const SE: Pt = { x: D, y: D };
const LABEL_DIRS: Pt[] = [N, S, E, { x: -1, y: 0 }, { x: D, y: -D }, { x: -D, y: -D }, SE, { x: -D, y: D }];
const BALL_LABEL = { size: 1.6, gap: BR + 0.3 };

type Box = { x0: number; y0: number; x1: number; y1: number };
const toScreen = (ctx: Ctx, p: Pt): Pt => (ctx.rotate ? { x: H - p.y, y: p.x } : p);
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** Approximate screen box of a text label (bold system font ≈ 0.6em per character). */
function textBox(ctx: Ctx, at: Pt, dir: Pt | undefined, gap: number, size: number, text: string): Box {
  const s = size * ctx.k, w = text.length * 0.6 * s;
  const { dx, dy, anchor } = place(ctx, dir, gap, s);
  const a = toScreen(ctx, at), x = a.x + dx, y = a.y + dy;
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  const pad = s * 0.2; // keep a little air between neighbouring labels
  return { x0: x0 - pad, y0: y - s / 2 - pad, x1: x0 + w + pad, y1: y + s / 2 + pad };
}

/**
 * Picks a side for each ball label (preferring above) so it avoids balls, lines, other labels and the
 * drawing edge. Greedy: each placed label becomes an obstacle for the next.
 */
function layoutBallLabels(ctx: Ctx, els: DiagramEl[]): Map<number, Pt> {
  const obstacles: Box[] = [];
  const samples: Pt[] = [];
  for (const el of els) {
    if (el.t === 'ball') {
      const c = toScreen(ctx, el.at);
      obstacles.push({ x0: c.x - BR, y0: c.y - BR, x1: c.x + BR, y1: c.y + BR });
    } else if (el.t === 'marker') obstacles.push(textBox(ctx, el.at, SE, 0.6, 1.6, el.text));
    else if (el.t === 'label') obstacles.push(textBox(ctx, el.at, undefined, 0, 2, el.text));
    else if (el.t === 'line') {
      const n = Math.ceil(Math.hypot(el.to.x - el.from.x, el.to.y - el.from.y) / 0.5);
      for (let i = 0; i <= n; i++) {
        samples.push(toScreen(ctx, { x: el.from.x + ((el.to.x - el.from.x) * i) / n, y: el.from.y + ((el.to.y - el.from.y) * i) / n }));
      }
    }
  }
  const bounds: Box = ctx.rotate ? { x0: -R, y0: -R, x1: H + R, y1: W + R } : { x0: -R, y0: -R, x1: W + R, y1: H + R };
  const out = new Map<number, Pt>();
  els.forEach((el, i) => {
    if (el.t !== 'ball' || !el.label) return;
    let best = { cost: Infinity, dir: N, box: obstacles[0] };
    LABEL_DIRS.forEach((dir, pref) => {
      const box = textBox(ctx, el.at, dir, BALL_LABEL.gap, BALL_LABEL.size, el.label!);
      const area = (box.x1 - box.x0) * (box.y1 - box.y0);
      const cost = pref * 0.05
        + obstacles.reduce((sum, o) => sum + overlap(box, o), 0)
        + samples.filter((p) => p.x > box.x0 && p.x < box.x1 && p.y > box.y0 && p.y < box.y1).length * 0.3
        + (area - overlap(box, bounds)) * 100;
      if (cost < best.cost) best = { cost, dir, box };
    });
    obstacles.push(best.box);
    out.set(i, best.dir);
  });
  return out;
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}wood`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#6b4426" />
        <stop offset="0.5" stop-color="#8a5a33" />
        <stop offset="1" stop-color="#5a3920" />
      </linearGradient>
      <pattern id={`${id}grainH`} patternUnits="userSpaceOnUse" width="37" height="2.3">
        <path d="M0 0.3 Q9 0.1 18 0.4 T37 0.3" stroke="#2e1a0b" stroke-opacity="0.35" stroke-width="0.09" fill="none" />
        <path d="M0 1.0 Q12 1.3 22 0.9 T37 1.0" stroke="#2e1a0b" stroke-opacity="0.22" stroke-width="0.06" fill="none" />
        <path d="M0 1.7 Q7 1.5 16 1.8 T37 1.7" stroke="#2e1a0b" stroke-opacity="0.3" stroke-width="0.12" fill="none" />
        <path d="M0 2.05 L37 2.05" stroke="#c48a55" stroke-opacity="0.18" stroke-width="0.07" />
      </pattern>
      <pattern id={`${id}grainV`} href={`#${id}grainH`} patternTransform="rotate(90)" />
      <radialGradient id={`${id}felt`} cx="0.5" cy="0.5" r="0.62">
        <stop offset="0" stop-color="#1b7a52" />
        <stop offset="1" stop-color="#0f5a3c" />
      </radialGradient>
      <filter id={`${id}cloth`} x="0" y="0" width="1" height="1">
        <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0.08  0 0 0 0 0.04  0 0 0 0.55 -0.1" />
      </filter>
      <radialGradient id={`${id}pearl`} cx="0.35" cy="0.35" r="0.7">
        <stop offset="0" stop-color="#ffffff" />
        <stop offset="1" stop-color="#cfc6b0" />
      </radialGradient>
      <radialGradient id={`${id}hole`} r="0.5">
        <stop offset="0.6" stop-color="#050505" />
        <stop offset="1" stop-color="#1c1c1c" />
      </radialGradient>
      <radialGradient id={`${id}cap`} r="0.5">
        <stop offset="0.55" stop-color="#4a2c17" />
        <stop offset="1" stop-color="#2a170a" />
      </radialGradient>
    </defs>
  );
}

/** Cushion trapezoids: nose on the playing-surface edge, back 1" into the rail, stopping at the pocket jaws. */
function cushions(): string[] {
  const c = 1;                                // cushion width
  const cn = TABLE.pocketMouth / Math.SQRT2;  // corner jaw nose, measured along the rail from the corner
  const cb = cn - 1.5;                        // corner jaw back (throat narrower than mouth)
  const sn = MOUTH, sb = MOUTH - 0.4;         // side jaw nose / back, from the side-pocket centre
  const poly = (pts: number[][]) => pts.map((p) => p.join(',')).join(' ');
  const long = (y0: number, y1: number) => [
    poly([[cn, y0], [W / 2 - sn, y0], [W / 2 - sb, y1], [cb, y1]]),
    poly([[W / 2 + sn, y0], [W - cn, y0], [W - cb, y1], [W / 2 + sb, y1]]),
  ];
  return [
    ...long(0, -c), ...long(H, H + c),
    poly([[0, cn], [-c, cb], [-c, H - cb], [0, H - cn]]),
    poly([[W, cn], [W + c, cb], [W + c, H - cb], [W, H - cn]]),
  ];
}
const CUSHIONS = cushions();

function TableLayer({ id }: { id: string }) {
  const u = (n: string) => `url(#${id}${n})`;
  return (
    <g data-layer="table">
      <Defs id={id} />
      <rect x={-R} y={-R} width={W + 2 * R} height={H + 2 * R} rx={2} fill={u('wood')} stroke="#2b190b" stroke-width="0.3" />
      <rect x={-R} y={-R} width={W + 2 * R} height={R} fill={u('grainH')} />
      <rect x={-R} y={H} width={W + 2 * R} height={R} fill={u('grainH')} />
      <rect x={-R} y={0} width={R} height={H} fill={u('grainV')} />
      <rect x={W} y={0} width={R} height={H} fill={u('grainV')} />
      <rect x={-R + 0.35} y={-R + 0.35} width={W + 2 * R - 0.7} height={H + 2 * R - 0.7} rx={1.7} fill="none" stroke="#b07a48" stroke-opacity="0.45" stroke-width="0.15" />
      {(Object.values(POCKETS) as Pt[]).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={MOUTH + 1.4} fill={u('cap')} />)}
      <rect x={-1.15} y={-1.15} width={W + 2.3} height={H + 2.3} fill="none" stroke="#24150a" stroke-width="0.3" />
      {CUSHIONS.map((pts, i) => <polygon key={i} points={pts} fill="#0c4a31" stroke="#08331f" stroke-width="0.08" />)}
      <rect x={0} y={0} width={W} height={H} fill={u('felt')} />
      <rect x={0} y={0} width={W} height={H} filter={u('cloth')} opacity="0.5" />
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="#2a9468" stroke-opacity="0.5" stroke-width="0.12" />
      <line x1={W / 4} y1={0} x2={W / 4} y2={H} stroke="#fff" stroke-opacity="0.18" stroke-width="0.12" stroke-dasharray="0.8 0.8" />
      <circle cx={(W * 3) / 4} cy={H / 2} r={0.35} fill="#fff" fill-opacity="0.45" />
      {DIAMONDS.map((d, i) => (
        <ellipse key={i} cx={d.x} cy={d.y} rx={d.y < 0 || d.y > H ? 0.3 : 0.22} ry={d.y < 0 || d.y > H ? 0.22 : 0.3}
          fill={u('pearl')} stroke="#5a4a30" stroke-width="0.04" />
      ))}
      {(Object.values(POCKETS) as Pt[]).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={MOUTH} fill={u('hole')} />)}
    </g>
  );
}

function Ball({ ctx, el, labelDir }: { ctx: Ctx; el: Extract<DiagramEl, { t: 'ball' }>; labelDir?: Pt }) {
  const { x, y } = el.at;
  const u = (n: string) => `url(#${ctx.id}${n})`;
  const label = el.label && <Txt ctx={ctx} at={el.at} dir={labelDir} gap={BALL_LABEL.gap} size={BALL_LABEL.size}>{el.label}</Txt>;
  if (el.kind === 'ghost') {
    return <g><circle cx={x} cy={y} r={BR} fill="none" stroke="#fff" stroke-opacity="0.85" stroke-width="0.14" stroke-dasharray="0.45 0.3" />{label}</g>;
  }
  const fill = el.kind === 'object' ? BALL_COLORS[el.num ?? 1] ?? '#888' : '#f7f7f2';
  return (
    <g>
      <circle cx={x + 0.25} cy={y + 0.35} r={BR} fill="#000" fill-opacity="0.35" />
      <circle cx={x} cy={y} r={BR} fill={fill} stroke={el.kind === 'object' ? '#00000055' : '#999'} stroke-width="0.08" />
      {el.kind === 'cue6dot' && [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3 + Math.PI / 6;
        return <circle key={i} cx={x + Math.cos(a) * 0.62} cy={y + Math.sin(a) * 0.62} r={0.18} fill="#d22" />;
      })}
      {el.kind === 'object' && el.num !== undefined && (
        <g>
          <circle cx={x} cy={y} r={0.6} fill="#fff" />
          <g transform={`translate(${x} ${y})${ctx.rotate ? ' rotate(-90)' : ''}`}>
            <text y={0.05} font-size={1.1} font-family={FONT} font-weight={700} fill="#111" text-anchor="middle" dominant-baseline="central">{el.num}</text>
          </g>
        </g>
      )}
      <circle cx={x} cy={y} r={BR} fill={u('shine')} />
      {label}
    </g>
  );
}

function Line({ ctx, el }: { ctx: Ctx; el: Extract<DiagramEl, { t: 'line' }> }) {
  const color = el.style === 'objPath' ? GOLD : '#fff';
  const dx = el.to.x - el.from.x, dy = el.to.y - el.from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const AL = 1.5, AW = 0.75; // arrowhead length / half-width
  const end = el.arrow ? { x: el.to.x - ux * AL * 0.8, y: el.to.y - uy * AL * 0.8 } : el.to;
  const base = { x: el.to.x - ux * AL, y: el.to.y - uy * AL };
  return (
    <g>
      <line x1={el.from.x} y1={el.from.y} x2={end.x} y2={end.y} stroke={color} stroke-width="0.35"
        stroke-opacity={el.style === 'aim' ? 0.85 : 1} stroke-dasharray={el.style === 'aim' ? '1 0.8' : undefined} />
      {el.arrow && (
        <polygon fill={color} points={`${el.to.x},${el.to.y} ${base.x - uy * AW},${base.y + ux * AW} ${base.x + uy * AW},${base.y - ux * AW}`} />
      )}
      {el.label && <Txt ctx={ctx} at={{ x: (el.from.x + el.to.x) / 2, y: (el.from.y + el.to.y) / 2 }} dir={N} gap={0.5} size={1.6} fill={color}>{el.label}</Txt>}
    </g>
  );
}

function Zone({ ctx, el }: { ctx: Ctx; el: Extract<DiagramEl, { t: 'zone' }> }) {
  const style = { fill: 'rgba(242,193,78,0.22)', stroke: GOLD, 'stroke-width': 0.25, 'stroke-dasharray': '0.8 0.5' };
  if (el.shape === 'circle') {
    // Small circles hold balls/arrows; put the label just below so it never covers them.
    const below = el.r < 4;
    return (
      <g>
        <circle cx={el.at.x} cy={el.at.y} r={el.r} {...style} />
        {el.label && (below
          ? <Txt ctx={ctx} at={el.at} dir={S} gap={el.r + 0.3} size={1.6} fill={GOLD}>{el.label}</Txt>
          : <Txt ctx={ctx} at={el.at} size={1.6} fill={GOLD}>{el.label}</Txt>)}
      </g>
    );
  }
  return (
    <g>
      <rect x={el.at.x} y={el.at.y} width={el.w} height={el.h} rx={0.6} {...style} />
      {el.label && <Txt ctx={ctx} at={{ x: el.at.x + el.w / 2, y: el.at.y + el.h / 2 }} size={1.6} fill={GOLD}>{el.label}</Txt>}
    </g>
  );
}

/** Label position for a pocket: pushed from the pocket toward the table centre. */
function pocketLabelAt(id: PocketId): Pt {
  const p = POCKETS[id];
  const dx = Math.sign(W / 2 - p.x), dy = Math.sign(H / 2 - p.y);
  return { x: p.x + dx * 4.6, y: p.y + dy * 4.6 };
}

function Overlay({ ctx, els, measure }: { ctx: Ctx; els: DiagramEl[]; measure: boolean }) {
  const labelDirs = layoutBallLabels(ctx, els);
  return (
    <g data-layer="overlay">
      {/* Overlay owns its own defs so it still renders if the table layer is replaced (e.g. by a photo). */}
      <defs>
        <radialGradient id={`${ctx.id}shine`} cx="0.35" cy="0.3" r="0.6">
          <stop offset="0" stop-color="#fff" stop-opacity="0.75" />
          <stop offset="0.35" stop-color="#fff" stop-opacity="0.12" />
          <stop offset="1" stop-color="#000" stop-opacity="0.25" />
        </radialGradient>
      </defs>
      {els.map((el, i) => {
        switch (el.t) {
          case 'ball': return null; // drawn last so balls sit on top of lines/zones
          case 'line': return <Line key={i} ctx={ctx} el={el} />;
          case 'zone': return <Zone key={i} ctx={ctx} el={el} />;
          case 'marker': return (
            <g key={i}>
              <line x1={el.at.x} y1={el.at.y - 0.7} x2={el.at.x} y2={el.at.y + 0.7} stroke={GOLD} stroke-width="0.25"
                transform={ctx.rotate ? `rotate(-90 ${el.at.x} ${el.at.y})` : undefined} />
              <Txt ctx={ctx} at={el.at} dir={SE} gap={0.6} size={1.6} fill={GOLD}>{el.text}</Txt>
            </g>
          );
          case 'label': return <Txt key={i} ctx={ctx} at={el.at} size={2}>{el.text}</Txt>;
          case 'pocket': {
            const p = POCKETS[el.id];
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={3} fill="none" stroke={GOLD} stroke-opacity="0.35" stroke-width="1.2" />
                <circle cx={p.x} cy={p.y} r={3} fill="none" stroke={GOLD} stroke-width="0.4" />
                {el.label && <Txt ctx={ctx} at={pocketLabelAt(el.id)} size={1.6} fill={GOLD}>{el.label}</Txt>}
              </g>
            );
          }
        }
      })}
      {measure && els.map((el, i) => el.t === 'ball' && el.kind === 'object' && <Dimensions key={`m${i}`} ctx={ctx} p={el.at} />)}
      {els.map((el, i) => el.t === 'ball' && <Ball key={`b${i}`} ctx={ctx} el={el} labelDir={labelDirs.get(i)} />)}
    </g>
  );
}

/** Dimension lines from a ball centre to its nearest short and long rail (cushion nose). */
function Dimensions({ ctx, p }: { ctx: Ctx; p: Pt }) {
  const r = nearestRails(p);
  const rx = r.x.at, ry = r.y.at, dx = r.x.d, dy = r.y.d;
  const st = { stroke: '#cfe8ff', 'stroke-width': 0.15, 'stroke-dasharray': '0.5 0.35' };
  return (
    <g>
      <line x1={p.x} y1={p.y} x2={rx} y2={p.y} {...st} />
      <line x1={p.x} y1={p.y} x2={p.x} y2={ry} {...st} />
      <Txt ctx={ctx} at={{ x: (p.x + rx) / 2, y: p.y }} dir={N} gap={0.4} size={1.3} fill="#cfe8ff">{fmt(dx)}</Txt>
      <Txt ctx={ctx} at={{ x: p.x, y: (p.y + ry) / 2 }} dir={E} gap={0.5} size={1.3} fill="#cfe8ff">{fmt(dy)}</Txt>
    </g>
  );
}

function Panel({ diagram, els, rotate, measure, k }: { diagram: Diagram; els: DiagramEl[]; rotate: boolean; measure: boolean; k: number }) {
  const id = `td${useId().replace(/[^a-zA-Z0-9]/g, '')}-`;
  const ctx: Ctx = { id, rotate, k };
  const vw = W + 2 * R, vh = H + 2 * R;
  const body = <><TableLayer id={id} /><Overlay ctx={ctx} els={els} measure={measure} /></>;
  return (
    <svg
      data-testid="table-diagram" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={diagram.title}
      viewBox={rotate ? `${-R} ${-R} ${vh} ${vw}` : `${-R} ${-R} ${vw} ${vh}`}
    >
      {rotate ? <g transform={`rotate(90) translate(0,${-H})`}>{body}</g> : body}
    </svg>
  );
}

/**
 * To-scale top-down drawing of the table with the diagram's overlay.
 * `textScale` enlarges labels for small inline renders (inches stay to scale for balls and table).
 */
export function TableDiagram({ diagram, panel, rotate = false, measure = false, textScale = 1 }: {
  diagram: Diagram; panel?: number; rotate?: boolean; measure?: boolean; textScale?: number;
}) {
  const panels = panel === undefined ? diagram.panels : [diagram.panels[panel]];
  return (
    <div class={`table-diagram${panels.length > 1 ? ' table-diagram--multi' : ''}`}>
      {panels.map((els, i) => <Panel key={i} diagram={diagram} els={els} rotate={rotate} measure={measure} k={textScale} />)}
    </div>
  );
}

