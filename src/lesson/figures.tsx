import type { ComponentChildren, JSX } from 'preact';
import { getLang } from '../i18n';
import { getDiagram } from '../diagram/diagrams';
import { TableDiagram } from '../diagram/TableSvg';
import { cutCueBall, ghostBall, lineFromPocket, tangentDir, toRail, unit } from '../diagram/geometry';
import { POCKETS, TABLE } from '../diagram/table';
import type { Diagram, DiagramEl, Pt } from '../diagram/types';

/** Picks the label for the current language. */
const L = (en: string, zh: string): string => (getLang() === 'zh' ? zh : en);

const BALL = TABLE.ball;
const S = lineFromPocket('TR', { x: 0, y: TABLE.height }); // straight line into the top-right corner
const SIDE: Pt = (() => { const u = unit(S(0), S(10)); return { x: u.y, y: -u.x }; })(); // perpendicular to it
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const ob = (at: Pt, num = 1, label?: string): DiagramEl => ({ t: 'ball', at, kind: 'object', num, label });
const cue = (at: Pt, label?: string): DiagramEl => ({ t: 'ball', at, kind: 'cue', label });
const ghost = (at: Pt, label?: string): DiagramEl => ({ t: 'ball', at, kind: 'ghost', label });
const line = (from: Pt, to: Pt, style: 'aim' | 'cuePath' | 'objPath', arrow = false, label?: string): DiagramEl =>
  ({ t: 'line', from, to, style, arrow, label });
const text = (at: Pt, s: string): DiagramEl => ({ t: 'label', at, text: s });

/** Joined line segments through `pts`, arrow on the last; `label` goes on segment `labelAt`. */
function path(pts: Pt[], style: 'aim' | 'cuePath', label?: string, labelAt = pts.length - 2): DiagramEl[] {
  return pts.slice(1).map((p, i) => line(pts[i], p, style, i === pts.length - 2, i === labelAt ? label : undefined));
}

/** Points of a curve leaving `from` along `dir`, turning toward `toward` by `deg` over `len` inches after `straight` inches. */
function bend(from: Pt, dir: Pt, toward: Pt, deg: number, len: number, straight = 0, tail = 0): Pt[] {
  const sign = Math.sign(dir.x * toward.y - dir.y * toward.x) || 1;
  const pts = [from];
  let p = add(from, dir, straight), a = Math.atan2(dir.y, dir.x);
  if (straight) pts.push(p);
  const n = 8;
  for (let i = 0; i < n; i++) {
    a += (sign * deg * Math.PI) / 180 / n;
    p = add(p, { x: Math.cos(a), y: Math.sin(a) }, len / n);
    pts.push(p);
  }
  if (tail) pts.push(add(p, { x: Math.cos(a), y: Math.sin(a) }, tail));
  return pts;
}

/** Crops the table to the elements' bounding box plus `pad` inches, at least `minAspect` wide. */
function fit(els: DiagramEl[], pad = 5, minAspect = 1.5): Diagram['view'] {
  const pts: Pt[] = els.flatMap((e) => (e.t === 'line' ? [e.from, e.to] : e.t === 'pocket' ? [POCKETS[e.id]] : 'at' in e ? [e.at] : []));
  let x0 = Math.min(...pts.map((p) => p.x)) - pad, x1 = Math.max(...pts.map((p) => p.x)) + pad;
  let y0 = Math.min(...pts.map((p) => p.y)) - pad, y1 = Math.max(...pts.map((p) => p.y)) + pad;
  if ((x1 - x0) / (y1 - y0) < minAspect) { const grow = ((y1 - y0) * minAspect - (x1 - x0)) / 2; x0 -= grow; x1 += grow; }
  const R = TABLE.rail;
  x0 = Math.max(x0, -R); x1 = Math.min(x1, TABLE.width + R); y0 = Math.max(y0, -R); y1 = Math.min(y1, TABLE.height + R);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A lesson diagram: cropped to its elements (with `crop` inches of padding, default 5) or, with `false`, the whole table. */
const table = (els: DiagramEl[], crop: number | false = 5): Diagram =>
  ({ id: 'lesson', title: '', caption: '', panels: [els], view: crop === false ? undefined : fit(els, crop) });

// --- Table figures ----------------------------------------------------------------------------------------------

/** A cut into the top-right corner: object ball, ghost ball, cue ball and the cue ball's stun (90°) direction. */
function cut(o: Pt = { x: 54, y: 12 }, angle = 40, d = 18) {
  const g = ghostBall(o, 'TR');
  const cb = cutCueBall(o, 'TR', angle, 'L', d);
  return { o, g, cb, t: tangentDir(cb, o, 'TR'), toPocket: unit(o, POCKETS.TR) };
}

function ghostBallFig(): Diagram {
  const { o, g, cb } = cut();
  return table([
    { t: 'pocket', id: 'TR' }, line(o, POCKETS.TR, 'objPath', true), line(cb, g, 'aim', true),
    ob(o), ghost(g, L('ghost ball', '假想球')), cue(cb),
  ]);
}

function contactFig(): Diagram {
  const { o, g, cb, toPocket } = cut();
  return table([
    { t: 'pocket', id: 'TR' }, line(o, POCKETS.TR, 'objPath', true), line(cb, g, 'aim', true),
    { t: 'marker', at: add(o, toPocket, -BALL / 2), text: L('contact point', '进球点') },
    ob(o), ghost(g, L('aim the center here', '主球中心瞄这里')), cue(cb),
  ]);
}

function cutMissFig(): Diagram {
  const { o, g, cb, toPocket } = cut();
  const c = unit(cb, g);
  const thick = unit({ x: 0, y: 0 }, add(toPocket, c, 0.2)), thin = unit({ x: 0, y: 0 }, add(toPocket, c, -0.2));
  return table([
    { t: 'pocket', id: 'TR' }, line(cb, g, 'aim', true), line(o, POCKETS.TR, 'objPath', true),
    line(o, toRail(o, thick).pt, 'aim', true, L('too thick', '偏厚')),
    line(o, toRail(o, thin).pt, 'aim', true, L('too thin', '偏薄')),
    ob(o), cue(cb),
  ]);
}

function tangentFig(withSpin: boolean): Diagram {
  const { o, g, cb, t, toPocket } = cut({ x: 50, y: 12 }, 40, 16);
  const els: DiagramEl[] = [{ t: 'pocket', id: 'TR' }, line(o, POCKETS.TR, 'objPath', true), line(cb, g, 'aim', true)];
  if (withSpin) {
    els.push(line(g, add(g, t, 15), 'aim'));
    const f = bend(g, t, toPocket, 55, 14, 1), d = bend(g, t, add({ x: 0, y: 0 }, toPocket, -1), 55, 14, 1);
    els.push(...path(f, 'cuePath'), ...path(d, 'cuePath'));
    els.push(text(add(f[f.length - 1], toPocket, 3.5), L('follow < 90°', '高杆 < 90°')));
    els.push(text(add(d[d.length - 1], toPocket, -3.5), L('draw > 90°', '低杆 > 90°')));
  } else {
    els.push(line(g, add(g, t, 16), 'cuePath', true, L('center ball: 90°', '中杆：90°')));
  }
  els.push(ob(o), cue(cb));
  return table(els);
}

function separationFig(): Diagram {
  const { o, g, cb, t, toPocket } = cut({ x: 50, y: 10 }, 40, 16);
  const pts = bend(g, t, toPocket, 60, 12, 6, 10);
  const n = pts.length;
  return table([
    { t: 'pocket', id: 'TR' }, line(o, POCKETS.TR, 'objPath', true), line(cb, g, 'aim', true),
    line(g, add(g, t, 18), 'aim'),
    line(pts[0], pts[1], 'cuePath', false, L('① straight: speed', '① 直线：看力度')),
    ...path(pts.slice(1, n - 1), 'cuePath', L('② curve: spin', '② 弧线：看旋转'), 3).map((e) => (e.t === 'line' ? { ...e, arrow: false } : e)),
    line(pts[n - 2], pts[n - 1], 'cuePath', true, L('③ straight again', '③ 又变直线')),
    ob(o), cue(cb),
  ]);
}

function trackLineFig(): Diagram {
  // Ball 1 into the bottom-right corner; the stunned cue ball comes off the bottom rail along ball 2's line to the top-left.
  const G: Pt = { x: 67.5, y: 25.7 };
  const toBR = unit(G, POCKETS.BR);
  const o1 = add(G, toBR, BALL);
  const t: Pt = { x: -toBR.y, y: toBR.x };
  const hit = toRail(G, t);
  const o2 = add(hit.pt, hit.dir, 30);
  const cb = add(G, unit({ x: 0, y: 0 }, add(toBR, t)), -16);
  return table([
    { t: 'pocket', id: 'BR' }, { t: 'pocket', id: 'TL' },
    line(o1, POCKETS.BR, 'objPath', true), line(o2, POCKETS.TL, 'objPath', true), line(cb, G, 'aim', true),
    line(G, hit.pt, 'cuePath'), line(hit.pt, add(hit.pt, hit.dir, 24), 'cuePath', true, L('anywhere on this line', '停在这条线上都能打')),
    ob(o1, 1), ob(o2, 2), cue(cb),
  ], false);
}

function twoHalvesFig(): Diagram {
  const o2: Pt = { x: 44, y: 14 }, cb: Pt = { x: 54, y: 27 }, o3: Pt = { x: 12, y: 14 };
  const back = toRail(o2, unit(POCKETS.TR, o2)).pt;
  const g = ghostBall(o2, 'TR');
  const hit = toRail(g, tangentDir(cb, o2, 'TR'));
  return table([
    { t: 'pocket', id: 'TR' }, line(POCKETS.TR, back, 'aim'), line(o2, POCKETS.TR, 'objPath', true),
    line(cb, g, 'aim'), line(g, hit.pt, 'cuePath'), line(hit.pt, add(hit.pt, hit.dir, 12), 'cuePath', true),
    text({ x: 17, y: 5 }, L('ball 3 is on this side', '第三颗在这半边')),
    text({ x: 50, y: 35 }, L('so leave the cue ball here', '主球就停这半边')),
    ob(o2, 2, L('next', '下一颗')), ob(o3, 3), cue(cb),
  ], false);
}

function angleFig(): Diagram {
  const o: Pt = { x: 54, y: 12 };
  const g = ghostBall(o, 'TR');
  const back = add(g, unit(POCKETS.TR, o), 16);
  return table([
    { t: 'pocket', id: 'TR' }, line(o, POCKETS.TR, 'objPath', true), line(g, back, 'aim'),
    cue(back, L('straight ✗', '直球 ✗')),
    cue(cutCueBall(o, 'TR', 15, 'L', 16), '15°'), cue(cutCueBall(o, 'TR', 30, 'L', 16), '30° ✓'),
    ob(o),
  ]);
}

function backwardFig(): Diagram {
  const b: Pt[] = [{ x: 62, y: 28 }, { x: 46, y: 12 }, { x: 30, y: 27 }, { x: 18, y: 12 }, { x: 8, y: 30 }];
  return table([
    ...[4, 3, 2, 1].map((i) => line(b[i], b[i - 1], 'aim', true, i === 4 ? L('plan backwards', '倒着排') : undefined)),
    cue({ x: 70, y: 18 }),
    ob(b[0], 1, L('first', '第一颗')), ob(b[1], 2, L('transition', '过渡球')), ob(b[2], 3, L('transition', '过渡球')),
    ob(b[3], 4, L('key ball', '关键球')), ob(b[4], 5, L('last', '最后一颗')),
  ], false);
}

function troubleFig(): Diagram {
  return table([
    line({ x: 54, y: 22 }, { x: 40, y: 4 }, 'aim', true),
    cue({ x: 62, y: 30 }),
    ob({ x: 52, y: 22 }, 1), ob({ x: 38, y: BALL / 2 }, 2, L('on the rail: deal with it early', '贴库难点球：先处理')),
    ob({ x: 24, y: 26 }, 3), ob({ x: 12, y: 12 }, 4),
  ], false);
}

function smallMovesFig(): Diagram {
  return table([
    { t: 'zone', shape: 'rect', at: { x: 50, y: 4 }, w: 24, h: 30, label: L('clear this area first', '先清这一片') },
    line({ x: 66, y: 26 }, { x: 62, y: 18 }, 'cuePath', true), line({ x: 62, y: 18 }, { x: 64, y: 10 }, 'cuePath', true),
    ...path([{ x: 30, y: 20 }, { x: 39, y: 36 }, { x: 10, y: 34 }], 'aim', L('✗ past a pocket', '✗ 经过袋口'), 0),
    { t: 'pocket', id: 'BM', label: L('scratch risk', '洗袋风险') },
    cue({ x: 66, y: 28 }), ob({ x: 58, y: 22 }, 1), ob({ x: 68, y: 14 }, 2), ob({ x: 58, y: 8 }, 3),
    ob({ x: 22, y: 12 }, 4), ob({ x: 14, y: 26 }, 5),
  ], false);
}

function pocketFig(): Diagram {
  const o = S(14);
  return table([
    { t: 'pocket', id: 'TR' }, line(S(30), S(14 + BALL), 'aim', true), line(o, POCKETS.TR, 'objPath', true),
    { t: 'zone', shape: 'circle', at: POCKETS.TR, r: 1 },
    text({ x: 66, y: 14 }, L('dead center; a rattle is a miss', '瞄正中；磕袋角 = 没进')),
    ob(o), cue(S(30)),
  ]);
}

function hardBridgeFig(): Diagram {
  const o: Pt = { x: 46, y: 9 };
  const g = ghostBall(o, 'TR');
  const cb: Pt = { x: 26, y: BALL / 2 + 0.3 };
  return table([
    { t: 'pocket', id: 'TR' }, line(o, POCKETS.TR, 'objPath', true), line(cb, g, 'aim', true),
    { t: 'zone', shape: 'rect', at: { x: 14, y: -2.5 }, w: 10, h: 6 },
    text({ x: 22, y: 9 }, L('the rail cramps the bridge', '手架被台边卡住')),
    ob(o), cue(cb),
  ]);
}

function microAngleFig(): Diagram {
  const o = S(36);
  const cb = add(S(36 + BALL + 7), SIDE, BALL * 0.6);
  const dir = unit(cb, o);
  return table([
    { t: 'pocket', id: 'TR' }, line(S(36 + BALL + 12), POCKETS.TR, 'objPath', false),
    line(o, add(o, dir, 36), 'aim', true, L('played as a straight ball', '当直球打')),
    ob(o), cue(cb, L('½–¾ ball off the line', '偏出半颗到¾颗')),
  ]);
}

function drawAxisFig(): Diagram {
  const o = S(15);
  return table([
    { t: 'pocket', id: 'TR' }, line(S(15 + 40), S(15 + 24 + 1.5), 'cuePath', false, L('cue through both centers', '球杆穿过两球中心')),
    line(S(15 + 24), POCKETS.TR, 'aim'),
    ob(o), ghost(S(15 + BALL), L('covers it fully', '整颗重合')), cue(S(15 + 24)),
  ]);
}

function drawBackFig(): Diagram {
  const c = S(15 + BALL);
  return table([
    { t: 'pocket', id: 'TR' }, line(c, S(15 + BALL + 18), 'cuePath', true, L('straight back', '原路退回')),
    line(c, add(S(15 + BALL + 16), SIDE, 5), 'aim', true),
    text(add(S(15 + BALL + 19), SIDE, 8), L('drift = side spin', '偏了 = 带了塞')),
    ob(S(15)), cue(S(15 + 26)),
  ]);
}

function stopDistanceFig(): Diagram {
  const c = S(15 + BALL);
  return table([
    { t: 'pocket', id: 'TR' }, line(S(15), POCKETS.TR, 'objPath', true),
    { t: 'zone', shape: 'circle', at: c, r: 3 },
    ob(S(15)),
    cue(S(15 + 12), L('center', '中杆')),
    cue(S(15 + 24), L('center, a bit firmer', '中杆，加点力')),
    cue(S(15 + 36), L('½–1 tip lower, firmer', '低半个到一个皮头，加力')),
  ], 14);
}

function cueLeftFig(): Diagram {
  const cb = S(15 + 24);
  return table([
    { t: 'pocket', id: 'TR' }, line(S(15 + 24 + 40), POCKETS.TR, 'aim'),
    line(add(S(15 + 24 + 34), SIDE, 1.6), add(S(15 + 24 + 1.6), SIDE, 0.3), 'cuePath'),
    text(add(S(15 + 24 + 16), SIDE, 7), L('the cue you left: still on center?', '留在台上的球杆：还对着中心吗？')),
    ob(S(15)), cue(cb),
  ]);
}

function railCheckFig(): Diagram {
  return table([
    line({ x: 28.6, y: 28 }, { x: 28.6, y: 0.6 }, 'aim', true),
    line({ x: 29.4, y: 0.6 }, { x: 29.4, y: 24 }, 'cuePath', true),
    line({ x: 29, y: 0.6 }, { x: 21, y: 22 }, 'aim', true), line({ x: 29, y: 0.6 }, { x: 37, y: 22 }, 'aim', true),
    text({ x: 29, y: 34 }, L('straight back = no side', '原路弹回 = 没带塞')),
    text({ x: 15, y: 25 }, L('left = left side', '偏左 = 左塞')), text({ x: 43, y: 25 }, L('right = right side', '偏右 = 右塞')),
    cue({ x: 29, y: 29.5 }),
  ]);
}

const TABLE_FIGURES: Record<string, () => Diagram> = {
  'ghost-ball': ghostBallFig, 'contact-half-ball': contactFig, 'cut-miss': cutMissFig,
  'tangent-stun': () => tangentFig(false), 'tangent-high-low': () => tangentFig(true), 'separation-path': separationFig,
  'track-line': trackLineFig, 'two-halves': twoHalvesFig, 'angle-leave': angleFig,
  'backward-plan': backwardFig, 'trouble-first': troubleFig, 'small-moves': smallMovesFig,
  'pocket-center': pocketFig, 'hard-bridge': hardBridgeFig, 'micro-angle': microAngleFig,
  'draw-axis': drawAxisFig, 'draw-back-line': drawBackFig, 'stop-distance': stopDistanceFig,
  'cue-left': cueLeftFig, 'rail-check': railCheckFig,
};

// --- Close-up figures (not on the table) ------------------------------------------------------------------------

const C = { bg: '#0f3527', line: '#e8efe9', dim: '#7f9c8f', accent: '#f2c14e', good: '#7ee09a', bad: '#ff7b7b', ball: '#f7f7f2', tip: '#3b7be0' };

function Svg({ label, w = 320, h = 200, children }: { label: string; w?: number; h?: number; children: ComponentChildren }) {
  return (
    <svg class="lesson-fig__svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} font-family="system-ui, -apple-system, sans-serif">
      <rect width={w} height={h} rx="10" fill={C.bg} />
      {children}
    </svg>
  );
}

function T({ x, y, children, fill = C.line, size = 13, anchor = 'start', weight = 600 }: {
  x: number; y: number; children: ComponentChildren; fill?: string; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number;
}) {
  return <text x={x} y={y} fill={fill} font-size={size} font-weight={weight} text-anchor={anchor} dominant-baseline="central">{children}</text>;
}

/** The cue ball face with the five vertical tip positions; `mark` is the one this lesson is about. */
function TipFig({ mark }: { mark: 'center' | 'high' }) {
  const cx = 110, cy = 100, r = 72;
  const levels = [L('follow', '高杆'), L('slight follow', '中高杆'), L('center (stop)', '中杆（定杆）'), L('slight draw', '中低杆'), L('draw', '低杆')];
  const ys = [-0.6, -0.3, 0, 0.3, 0.6].map((k) => cy + k * r);
  const on = mark === 'center' ? 2 : 0;
  return (
    <Svg label={L('Tip position on the cue ball', '主球击球点')}>
      <circle cx={cx} cy={cy} r={r} fill={C.ball} />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={mark === 'high' ? C.accent : '#c9cfc9'} stroke-width={mark === 'high' ? 3 : 1.5} />
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#c9cfc9" stroke-width="1.5" />
      {ys.map((y, i) => (
        <g key={i}>
          <circle cx={cx} cy={y} r={i === on ? 11 : 4} fill={i === on ? C.tip : '#9aa39c'} stroke={i === on ? '#fff' : 'none'} stroke-width="2" />
          <line x1={cx + r + 6} y1={y} x2={cx + r + 16} y2={y} stroke={i === on ? C.accent : C.dim} stroke-width="2" />
          <T x={cx + r + 22} y={y} fill={i === on ? C.accent : C.dim} size={i === on ? 15 : 12}>{levels[i]}</T>
        </g>
      ))}
      {mark === 'high' && (
        <g>
          <circle cx={cx + 20} cy={ys[0] + 6} r={7} fill="none" stroke={C.bad} stroke-width="2" stroke-dasharray="3 2" />
          <T x={20} y={186} fill={C.bad} size={12}>{L('off the line = side spin', '偏离中线 = 带塞')}</T>
        </g>
      )}
    </Svg>
  );
}

/** Side view: a level cue for draw, versus the butt raised. */
function CueLevelFig() {
  const row = (y: number, ok: boolean) => {
    const tip = { x: 228, y: y + 4 }, butt = ok ? { x: 20, y: y - 2 } : { x: 30, y: y - 44 };
    return (
      <g>
        <line x1={14} y1={y + 18} x2={306} y2={y + 18} stroke={C.dim} stroke-width="2" />
        <circle cx={250} cy={y} r={18} fill={C.ball} />
        <circle cx={tip.x + 4} cy={tip.y} r={3.5} fill={C.tip} />
        <line x1={butt.x} y1={butt.y} x2={tip.x} y2={tip.y} stroke="#d9b98a" stroke-width="6" stroke-linecap="round" />
        <line x1={butt.x} y1={butt.y} x2={butt.x + (tip.x - butt.x) * 0.3} y2={butt.y + (tip.y - butt.y) * 0.3} stroke="#5a3a22" stroke-width="7" stroke-linecap="round" />
        <T x={ok ? 300 : 300} y={y - 30} anchor="end" fill={ok ? C.good : C.bad}>
          {ok ? L('✓ butt down, cue level', '✓ 杆尾压低，球杆放平') : L('✗ butt raised', '✗ 杆尾抬太高')}
        </T>
      </g>
    );
  };
  return <Svg label={L('Keep the cue level', '球杆放平')}>{row(70, true)}{row(160, false)}</Svg>;
}

/** Top view of the stance: everything on the shot line, feet and bridge make a triangle. */
function StanceFig() {
  const lx = 150; // the shot line
  return (
    <Svg label={L('Stance from above', '站位俯视图')} h={240}>
      <line x1={lx} y1={8} x2={lx} y2={232} stroke={C.accent} stroke-width="2" stroke-dasharray="6 5" />
      <circle cx={lx} cy={22} r={10} fill={C.ball} />
      <line x1={lx} y1={40} x2={lx} y2={200} stroke="#d9b98a" stroke-width="5" stroke-linecap="round" />
      <polygon points={`${lx},70 ${lx - 46},150 ${lx + 4},206`} fill="rgba(242,193,78,0.12)" stroke={C.accent} stroke-width="1.5" stroke-dasharray="4 3" />
      <path d={`M ${lx - 14} 76 L ${lx} 62 L ${lx + 14} 76`} fill="none" stroke={C.line} stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx={lx} cy={118} r={16} fill="none" stroke={C.line} stroke-width="3" />
      <circle cx={lx} cy={180} r={7} fill={C.line} />
      <ellipse cx={lx - 46} cy={150} rx={9} ry={18} fill={C.line} transform={`rotate(-25 ${lx - 46} 150)`} />
      <ellipse cx={lx + 4} cy={206} rx={9} ry={18} fill={C.line} transform={`rotate(15 ${lx + 4} 206)`} />
      <T x={lx + 22} y={66}>{L('bridge', '手架')}</T>
      <T x={lx + 24} y={118}>{L('head and eyes on the line', '头和视线在线上')}</T>
      <T x={lx + 16} y={180}>{L('cue hand on the line', '握杆的手在线上')}</T>
      <T x={lx + 22} y={214}>{L('back foot under the hand', '右脚在手的正下方')}</T>
      <T x={12} y={150} fill={C.accent} size={12}>{L('front foot', '左脚')}</T>
      <T x={12} y={96} fill={C.accent} size={12}>{L('stable triangle', '稳固三角形')}</T>
    </Svg>
  );
}

/** The pre-shot routine as cue-tip movement over time: 3 long, 1 short, confirm, slow back, pause, stroke, freeze. */
function RhythmFig() {
  const y0 = 84, A = 40;
  const d = `M 14 ${y0} ${'q 14 72 28 0 '.repeat(3)}q 8 28 16 0 l 12 0 l 56 ${A} l 22 0 l 20 ${-A * 1.8} l 40 0`;
  const labels: [number, number, string][] = [
    [56, 168, L('3 long', '三长')], [106, 188, L('1 short', '一短')], [124, 168, L('check', '确认')],
    [154, 188, L('slow back', '慢拉')], [193, 168, L('pause', '后停')], [214, 188, L('accelerate', '加速出杆')], [250, 168, L('freeze', '定住')],
  ];
  return (
    <Svg label={L('Stroke rhythm', '运杆节奏')}>
      <line x1={10} y1={y0} x2={312} y2={y0} stroke={C.dim} stroke-dasharray="4 4" />
      <T x={312} y={y0 - 12} fill={C.dim} size={11} anchor="end">{L('cue ball', '主球位置')}</T>
      <T x={312} y={y0 + 34} fill={C.dim} size={11} anchor="end">{L('↓ back', '↓ 往后')}</T>
      <path d={d} fill="none" stroke={C.accent} stroke-width="3" stroke-linejoin="round" />
      {labels.map(([x, y, s]) => <T key={s} x={x} y={y} anchor="middle" size={12}>{s}</T>)}
    </Svg>
  );
}

/** Side view after the stroke: stay down two seconds and check four things. */
function FreezeFig() {
  const checks = [L('tip still on the line', '杆头还指着线'), L('head not up', '头没抬'), L('body still', '身体没动'), L('stroke finished', '后手送到位')];
  return (
    <Svg label={L('Freeze after the shot', '静默停顿')}>
      <line x1={0} y1={130} x2={150} y2={130} stroke={C.dim} stroke-width="2" />
      <line x1={36} y1={190} x2={52} y2={100} stroke={C.line} stroke-width="5" stroke-linecap="round" />
      <line x1={70} y1={190} x2={52} y2={100} stroke={C.line} stroke-width="5" stroke-linecap="round" />
      <line x1={52} y1={100} x2={118} y2={112} stroke={C.line} stroke-width="6" stroke-linecap="round" />
      <circle cx={130} cy={110} r={9} fill={C.line} />
      <line x1={112} y1={114} x2={100} y2={124} stroke={C.line} stroke-width="4" stroke-linecap="round" />
      <line x1={112} y1={114} x2={146} y2={124} stroke={C.line} stroke-width="4" stroke-linecap="round" />
      <line x1={28} y1={122} x2={166} y2={122} stroke="#d9b98a" stroke-width="4" stroke-linecap="round" />
      <T x={84} y={30} fill={C.accent} size={22} anchor="middle" weight={800}>{L('2 s', '2 秒')}</T>
      <T x={84} y={56} fill={C.dim} size={11} anchor="middle">{L('stay down', '趴住不动')}</T>
      {checks.map((c, i) => (
        <g key={c}>
          <circle cx={184} cy={56 + i * 32} r={9} fill="none" stroke={C.good} stroke-width="2" />
          <path d={`M ${179} ${56 + i * 32} l 4 4 l 7 -8`} fill="none" stroke={C.good} stroke-width="2" />
          <T x={200} y={56 + i * 32} size={12}>{c}</T>
        </g>
      ))}
    </Svg>
  );
}

const CLOSE_UPS: Record<string, () => JSX.Element> = {
  'tip-center': () => <TipFig mark="center" />, 'tip-high': () => <TipFig mark="high" />,
  'cue-level': CueLevelFig, stance: StanceFig, rhythm: RhythmFig, freeze: FreezeFig,
};

/** Every figure id a lesson step may use (besides `diagram:<id>`). */
export const FIGURE_IDS = [...Object.keys(TABLE_FIGURES), ...Object.keys(CLOSE_UPS)];

/** The picture for one lesson step. */
export function LessonFigure({ id }: { id: string }) {
  if (id.startsWith('diagram:')) return <TableDiagram diagram={getDiagram(id.slice(8))} textScale={1.6} />;
  const close = CLOSE_UPS[id];
  if (close) return close();
  const d = TABLE_FIGURES[id]();
  return <TableDiagram diagram={d} textScale={d.view ? 1.15 : 1.6} />;
}
