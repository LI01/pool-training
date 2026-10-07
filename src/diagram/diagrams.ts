import { along, cutCueBall, ghostBall, lineFromPocket, tangentDir, toRail, unit } from './geometry';
import { POCKETS, TABLE } from './table';
import type { Diagram, DiagramEl, Pt } from './types';

const S = lineFromPocket('TR', { x: 0, y: TABLE.height }); // standard straight-in line to top-right corner
const SB = lineFromPocket('BR', { x: 0, y: 0 });           // mirrored line to bottom-right corner
const OB_D = 15;                                           // object ball 15" from the pocket
const CONTACT = OB_D + TABLE.ball;                         // cue-ball centre at contact
// unit vector perpendicular to the standard shot line, pointing to the open (lower) side
const SIDE: Pt = (() => { const u = unit(S(0), S(10)); return { x: u.y, y: -u.x }; })();
const ob = (at: Pt, num = 1): DiagramEl => ({ t: 'ball', at, kind: 'object', num });
const cue = (at: Pt, label?: string): DiagramEl => ({ t: 'ball', at, kind: 'cue', label });
const cue6 = (at: Pt, label?: string): DiagramEl => ({ t: 'ball', at, kind: 'cue6dot', label });

function ladder(id: string, title: string, caption: string, cbDists: number[], extra: DiagramEl[], dot = false, obD = OB_D): Diagram {
  const els: DiagramEl[] = [
    { t: 'pocket', id: 'TR' },
    ob(S(obD)),
    { t: 'line', from: S(obD), to: POCKETS.TR, style: 'objPath', arrow: true },
    ...cbDists.map((d, i) => (dot ? cue6 : cue)(S(obD + d), String(i + 1))),
    ...cbDists.map((d) => ({ t: 'marker', at: S(obD + d + 3), text: `${d}"` }) as DiagramEl),
    { t: 'line', from: S(obD + cbDists[cbDists.length - 1]), to: S(obD + TABLE.ball), style: 'aim', arrow: true },
    ...extra,
  ];
  return { id, title, caption, panels: [els] };
}

function cutPanel(side: 'L' | 'R', angles: number[]): DiagramEl[] {
  const o: Pt = { x: 60, y: 16 };
  return [
    { t: 'pocket', id: 'TR' },
    ob(o),
    { t: 'line', from: o, to: POCKETS.TR, style: 'objPath', arrow: true },
    { t: 'ball', at: ghostBall(o, 'TR'), kind: 'ghost' },
    ...angles.flatMap((a): DiagramEl[] => {
      const cb = cutCueBall(o, 'TR', a, side, 18);
      return [cue(cb, `${a}°`), { t: 'line', from: cb, to: ghostBall(o, 'TR'), style: 'aim' }];
    }),
    { t: 'label', at: { x: 20, y: 34 }, text: side === 'L' ? 'Cutting LEFT' : 'Cutting RIGHT' },
  ];
}

function oneRail(): Diagram {
  const o: Pt = { x: 70, y: 6 }, c: Pt = { x: 52, y: 4 };
  const g = ghostBall(o, 'TR');
  const hit = toRail(g, tangentDir(c, o, 'TR'));
  const end = along(hit.pt, hit.dir, 15);
  return {
    id: 'pm-one-rail', title: 'One-rail position zones',
    caption: 'Pot the OB, send CB one rail into the 12–18" zone. Predict the route first.',
    panels: [[
      { t: 'pocket', id: 'TR' }, ob(o, 1), cue(c),
      { t: 'line', from: o, to: POCKETS.TR, style: 'objPath', arrow: true },
      { t: 'line', from: c, to: g, style: 'aim' },
      { t: 'line', from: g, to: hit.pt, style: 'cuePath' },
      { t: 'line', from: hit.pt, to: end, style: 'cuePath', arrow: true },
      { t: 'zone', shape: 'rect', at: { x: 60, y: 25 }, w: 14, h: 12, label: 'Target zone' },
      ob({ x: 54, y: 34 }, 2), { t: 'pocket', id: 'BM', label: 'next' },
    ]],
  };
}

const list: Diagram[] = [
  {
    id: 'am-straight-warmup', title: 'Straight-ball warm-up',
    caption: 'OB straight to corner. CB 1 ft → 2 → 3 → 4 ft. Sets of 5.',
    panels: [[
      { t: 'pocket', id: 'TR' }, ob(S(OB_D)),
      { t: 'line', from: S(OB_D), to: POCKETS.TR, style: 'objPath', arrow: true },
      ...[12, 24, 36, 48].map((d, i) => cue(S(OB_D + d), `${i + 1} ft`)),
      { t: 'line', from: S(OB_D + 48), to: S(CONTACT), style: 'aim', arrow: true },
    ]],
  },
  ladder('am-stop-ladder', 'Stop shot ladder', 'Centre ball. CB stops within ~3" of contact. 10 shots at each distance.',
    [12, 24, 36], [{ t: 'zone', shape: 'circle', at: S(CONTACT), r: 3, label: 'Stop zone' }]),
  ladder('am-draw-ladder', 'Draw ladder', 'Level cue, low contact. Draw back 6", then 12", then farther.',
    [8, 16, 24], [
      { t: 'marker', at: along(S(CONTACT + 6), SIDE, 3.5), text: 'draw 6"' },
      { t: 'marker', at: along(S(CONTACT + 12), SIDE, 3.5), text: 'draw 12"' },
    ], true),
  ladder('am-follow-ladder', 'Follow ladder', 'High centre. Pick a follow target (6", 12", 24") before each shot.',
    [12, 24, 36], [
      { t: 'zone', shape: 'circle', at: S(30 + TABLE.ball - 6), r: 2, label: '6"' },
      { t: 'zone', shape: 'circle', at: S(30 + TABLE.ball - 12), r: 2, label: '12"' },
      { t: 'zone', shape: 'circle', at: S(30 + TABLE.ball - 24), r: 2, label: '24"' },
    ], false, 30),
  {
    id: 'am-precision-pocket', title: 'Precision pocket drill',
    caption: 'Long straight & slight cuts. Alternate corners. Rattles count as misses.',
    panels: [[
      { t: 'pocket', id: 'TR' }, { t: 'pocket', id: 'BR' },
      ob(S(OB_D), 1), cue(S(OB_D + 48), 'A'),
      { t: 'line', from: S(OB_D + 48), to: S(CONTACT), style: 'aim', arrow: true },
      ob(SB(OB_D), 2), cue(SB(OB_D + 48), 'B'),
      { t: 'line', from: SB(OB_D + 48), to: SB(CONTACT), style: 'aim', arrow: true },
    ]],
  },
  {
    id: 'pm-cut-blocks', title: 'Cut-shot blocks',
    caption: '30°, 45°, 60° — both directions. 6 shots per angle/direction. Keep OB & pocket fixed.',
    panels: [cutPanel('L', [30, 45, 60]), cutPanel('R', [30, 45, 60])],
  },
  oneRail(),
  {
    id: 'pm-3ball', title: '3-ball pattern drill',
    caption: 'Example — use any open, makeable layout. Name all 3 shots & CB zones first.',
    panels: [[
      cue({ x: 56, y: 22 }, 'BIH'), ob({ x: 64, y: 10 }, 1), ob({ x: 44, y: 28 }, 2), ob({ x: 20, y: 12 }, 3),
      { t: 'pocket', id: 'TR', label: '1' }, { t: 'pocket', id: 'BM', label: '2' }, { t: 'pocket', id: 'TL', label: '3' },
      { t: 'zone', shape: 'circle', at: { x: 48, y: 19 }, r: 5, label: 'for 2' },
      { t: 'zone', shape: 'circle', at: { x: 28, y: 24 }, r: 5, label: 'for 3' },
    ]],
  },
  {
    id: 'pm-5ball', title: '5-ball clearance',
    caption: 'Example — scatter 5 open balls, ball-in-hand. Easiest route, minimal CB travel.',
    panels: [[
      cue({ x: 40, y: 24 }, 'BIH'),
      ob({ x: 14, y: 10 }, 1), ob({ x: 28, y: 30 }, 2), ob({ x: 42, y: 14 }, 3), ob({ x: 58, y: 30 }, 4), ob({ x: 70, y: 12 }, 5),
    ]],
  },
  {
    id: 'pm-review', title: 'Short review / replay',
    caption: "Recreate today's 2–3 worst shots. Re-shoot until you know the fix.",
    panels: [[{ t: 'label', at: { x: 39, y: 19.5 }, text: 'Set up your worst shots here' }]],
  },
  {
    id: 'test-straight', title: 'Test: Long straight pot',
    caption: 'OB ~15" from corner, CB 4 ft behind, perfectly straight. 10 shots.',
    panels: [[
      { t: 'pocket', id: 'TR' }, ob(S(OB_D)), cue(S(OB_D + 48)),
      { t: 'marker', at: S(OB_D + 24), text: '4 ft' },
      { t: 'line', from: S(OB_D + 48), to: S(CONTACT), style: 'aim', arrow: true },
      { t: 'line', from: S(OB_D), to: POCKETS.TR, style: 'objPath', arrow: true },
    ]],
  },
  {
    id: 'test-cut', title: 'Test: Cut shots',
    caption: 'Fixed 45° cut. 10 cutting left, then 10 cutting right. Never change the angle.',
    panels: [cutPanel('L', [45]), cutPanel('R', [45])],
  },
  {
    id: 'test-stop', title: 'Test: Stop shot',
    caption: 'Straight, CB 24" from OB. Success = OB made and CB within ~3" of contact.',
    panels: [[
      { t: 'pocket', id: 'TR' }, ob(S(OB_D)), cue(S(OB_D + 24)),
      { t: 'marker', at: S(OB_D + 27), text: '24"' },
      { t: 'zone', shape: 'circle', at: S(CONTACT), r: 3, label: '3"' },
      { t: 'line', from: S(OB_D + 24), to: S(CONTACT), style: 'aim', arrow: true },
    ]],
  },
  {
    id: 'test-draw', title: 'Test: Draw @24"',
    caption: 'Straight, CB 24" from OB. Same cue ball every test. Measure draw-back distance.',
    panels: [[
      { t: 'pocket', id: 'TR' }, ob(S(OB_D)), cue6(S(OB_D + 24)),
      { t: 'marker', at: S(OB_D + 27), text: '24"' },
      ...[6, 12, 18].map((d) => ({ t: 'marker', at: S(CONTACT + d), text: `${d}"` }) as DiagramEl),
      { t: 'line', from: S(CONTACT), to: S(CONTACT + 18), style: 'cuePath', arrow: true },
    ]],
  },
  {
    id: 'test-5ball', title: 'Test: 5-ball clearance (fixed layout)',
    caption: 'Use this exact layout every test. Ball-in-hand. 5 runs.',
    showMeasurements: true,
    panels: [[
      ob({ x: 16, y: 30 }, 1), ob({ x: 30, y: 10 }, 2), ob({ x: 46, y: 26 }, 3), ob({ x: 60, y: 10 }, 4), ob({ x: 68, y: 30 }, 5),
      { t: 'label', at: { x: 39, y: 19.5 }, text: 'Ball in hand' },
    ]],
  },
];

export const DIAGRAMS: Record<string, Diagram> = Object.fromEntries(list.map((d) => [d.id, d]));
export const getDiagram = (id: string): Diagram => DIAGRAMS[id];
