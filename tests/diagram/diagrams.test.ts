import { DIAGRAMS } from '../../src/diagram/diagrams';
import { TABLE } from '../../src/diagram/table';
import { dist } from '../../src/diagram/geometry';
import { plan } from '../../src/plan';
import type { Pt } from '../../src/diagram/types';

const R = TABLE.ball / 2;
const inside = (p: Pt) => p.x >= R && p.x <= TABLE.width - R && p.y >= R && p.y <= TABLE.height - R;
const insideLoose = (p: Pt) => p.x >= 0 && p.x <= TABLE.width && p.y >= 0 && p.y <= TABLE.height;

test('every block and test has a diagram', () => {
  for (const b of plan.sessions.flatMap((s) => s.blocks)) expect(DIAGRAMS[b.diagramId], b.id).toBeDefined();
  for (const t of plan.tests) expect(DIAGRAMS[t.diagramId], t.id).toBeDefined();
});

test('all balls inside playing surface and non-overlapping', () => {
  for (const d of Object.values(DIAGRAMS))
    for (const panel of d.panels) {
      const balls = panel.filter((e) => e.t === 'ball' && e.kind !== 'ghost') as { at: Pt }[];
      for (const b of balls) expect(inside(b.at), `${d.id} ${JSON.stringify(b.at)}`).toBe(true);
      for (let i = 0; i < balls.length; i++)
        for (let j = i + 1; j < balls.length; j++)
          expect(dist(balls[i].at, balls[j].at), d.id).toBeGreaterThanOrEqual(TABLE.ball);
    }
});

test('all other points inside playing surface', () => {
  for (const d of Object.values(DIAGRAMS))
    for (const panel of d.panels)
      for (const e of panel) {
        if (e.t === 'line') { expect(insideLoose(e.from), d.id).toBe(true); expect(insideLoose(e.to), d.id).toBe(true); }
        if (e.t === 'marker' || e.t === 'label' || (e.t === 'zone')) expect(insideLoose(e.at), d.id).toBe(true);
      }
});

test('ladder markers match the plan distances', () => {
  const texts = (id: string) => DIAGRAMS[id].panels.flat().filter((e) => e.t === 'marker').map((e) => (e as { text: string }).text);
  expect(texts('am-stop-ladder')).toEqual(expect.arrayContaining(['12"', '24"', '36"']));
  expect(texts('am-draw-ladder')).toEqual(expect.arrayContaining(['8"', '16"', '24"']));
  expect(texts('am-follow-ladder')).toEqual(expect.arrayContaining(['12"', '24"', '36"']));
  expect(texts('test-stop')).toContain('24"');
  expect(texts('test-draw')).toContain('24"');
});

test('cut diagrams have two panels (left and right)', () => {
  expect(DIAGRAMS['pm-cut-blocks'].panels).toHaveLength(2);
  expect(DIAGRAMS['test-cut'].panels).toHaveLength(2);
});

test('5-ball test is a fixed template with measurements', () => {
  const d = DIAGRAMS['test-5ball'];
  expect(d.showMeasurements).toBe(true);
  expect(d.panels[0].filter((e) => e.t === 'ball' && e.kind === 'object')).toHaveLength(5);
});
