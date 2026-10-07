# Pool Training App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An installable, offline phone web app that guides the daily 2-hour pool training block by block, scores the standard test shot by shot, shows setup diagrams on a to-scale drawn table, and charts progress.

**Architecture:** Vite + Preact + TypeScript single-page app with hash routing. The logic modules are pure TypeScript with no UI imports and are fully unit-tested:
- `plan/` — static plan content
- `diagram/` — table geometry and diagram data
- `stats/` — derived numbers
- `runner/` — session and test state machines

`db/` wraps IndexedDB. `ui/` holds the Preact screens. `vite-plugin-pwa` provides offline caching and installability. GitHub Actions deploys to GitHub Pages.

**Tech Stack:** Node 26, npm, Vite 8, Preact 10 + `@preact/preset-vite`, TypeScript (strict), Vitest 4 + jsdom + `@testing-library/preact`, `idb` 8, `fake-indexeddb` (tests), Chart.js 4, `vite-plugin-pwa` 1.x.

**Spec:** `docs/superpowers/specs/2026-10-07-pool-training-app-design.md` — read it before starting any task.

## Global Constraints

- English UI only.
- All plan text comes verbatim from `30_Day_Pool_Training_Plan_v2.xlsx`. Do not paraphrase drill instructions.
- Vite `base: '/pool-training/'`. Hash routing (`#/…`) only, with no history API routes, so GitHub Pages works.
- Data is stored only on the device (IndexedDB database `pool-training`, schema v1). No network calls at runtime.
- Diagram coordinates are inches on the playing surface. The origin is the top-left cushion nose, x runs along the long side, and y runs down.
- Table defaults: playing surface 78" × 39", ball 2.25", pocket mouth 4.8". All of these are constants in `src/diagram/table.ts`.
- The session runner never auto-advances. P/C/S/D tags are always optional.
- Tests are always normal-pocket. Reducer scores are never recorded in a test.
- Scores are derived from raw shots and never stored as totals.
- **Deviation from the spec (intentional):** diagram data lives in `src/diagram/diagrams.ts` instead of `src/plan/diagrams.json`, so diagrams can use geometry helpers (exact cut angles and ladder distances). It is still pure data with no UI imports.
- Mobile-first layout: tap targets at least 48px; primary Make/Miss buttons at least 96px tall.
- Every task: run `npm test -- --run` and `npx tsc --noEmit` before committing; both must pass.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Review Focus

These are the five failure modes most likely to bite a user, each pinned to the task that must test it.

1. **Phone locked for a long time mid-block** (e.g., 25 min on a 10-min block): on return, the timer shows overtime (`+15:00`), not a reset or a wrong value. Pinned in Task 6.
2. **Tapping Make twice quickly, or after the test is full:** extra shots are ignored and the count never exceeds the attempt count. Pinned in Task 7.
3. **Day numbering across the DST change** (US DST ends 2026-11-01): Day N must not skip or repeat. Pinned in Task 5.
4. **Importing a garbage or foreign JSON file:** shows an error and leaves existing data untouched. Pinned in Task 8.
5. **Quick-entry sheet input:** negative, blank, or non-numeric inches, or successes greater than attempts, are rejected with an inline message. Never saved as NaN. Pinned in Task 11 via `validateEntry` (Task 6).

---

## File Structure

```
index.html
vite.config.ts
tsconfig.json
package.json
.github/workflows/deploy.yml
public/icons/ (icon-192.png, icon-512.png, apple-touch-icon.png)
scripts/make_icons.py
src/
  main.tsx                 app bootstrap, router mount
  styles.css               global mobile styles
  plan/
    types.ts               Plan/Block/TestDef/... types
    plan.json              content from the spreadsheet
    index.ts               typed plan export + accessors
  diagram/
    table.ts               TABLE constants, POCKETS, diamonds
    geometry.ts            along/lineFromPocket/ghostBall/cutCueBall/angle helpers
    types.ts               Pt, PocketId, DiagramEl, Diagram
    diagrams.ts            all 15 diagrams
    TableDiagram.tsx       SVG renderer (table layer + overlay layer)
    DiagramViewer.tsx      full-screen viewer (rotate + pinch-zoom)
  db/
    types.ts               SessionRecord/TestRecord/Shot/Settings/ActiveState/Backup
    store.ts               IndexedDB store, export/import, validateBackup
  stats/
    dates.ts               localDate/daysBetween/addDays
    index.ts               all stats functions
  runner/
    session.ts             session runner reducer + remainingMs + validateEntry
    test.ts                test runner reducer
  platform/
    wakeLock.ts
    chime.ts
  ui/
    App.tsx                hash router + data context
    useAppData.ts          loads/refreshes records from store
    components/            BigButton.tsx, TagPicker.tsx, Timer.tsx, LineChart.tsx, BarChart.tsx, Sheet.tsx
    screens/               Today.tsx, SessionRunner.tsx, TestRunner.tsx, Progress.tsx, Settings.tsx, DiagramsReview.tsx
tests/ mirrors src/ (e.g., tests/stats/index.test.ts)
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/styles.css`, `src/ui/App.tsx`, `.gitignore`, `tests/setup.ts`, `tests/smoke.test.tsx`

**Interfaces:**
- Produces: `npm run dev|build|preview|test`, and a Vitest jsdom environment with `@testing-library/preact`.

- [ ] **Step 1: Initialize and install**

```bash
cd /Users/leon/Documents/work/pool-training
npm init -y
npm i preact chart.js idb
npm i -D vite @preact/preset-vite typescript vitest jsdom @testing-library/preact @testing-library/jest-dom fake-indexeddb vite-plugin-pwa @types/node
```

Set `package.json` fields: `"name": "pool-training"`, `"private": true`, `"type": "module"`, and these scripts:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "test": "vitest"
}
```

- [ ] **Step 2: Config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`vite.config.ts` (the PWA plugin is added in Task 14; keep this minimal now):
```ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/pool-training/',
  plugins: [preact()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
```
If TypeScript complains about the `test` key, add `/// <reference types="vitest/config" />` as the first line.

`tests/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

`.gitignore`:
```
node_modules
dist
.DS_Store
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0e3b2e" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <title>Pool Training</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { render } from 'preact';
import { App } from './ui/App';
import './styles.css';

render(<App />, document.getElementById('app')!);
```

`src/ui/App.tsx` (placeholder; replaced in Task 10):
```tsx
export function App() {
  return <main class="screen"><h1>Pool Training</h1></main>;
}
```

`src/styles.css`: CSS custom properties.
- Colors:
  - `--bg: #0b1512`
  - `--surface: #13231d`
  - `--felt: #0e5a3f`
  - `--text: #eef3ef`
  - `--muted: #9fb3a9`
  - `--accent: #f2c14e`
  - `--good: #3fbf7f`
  - `--bad: #e5534b`
- Body: `margin: 0`; system-ui font at 17px; `background: var(--bg)`; `color: var(--text)`.
- `.screen`: max-width 640px, centered, with padding `16px 16px calc(16px + env(safe-area-inset-bottom))`.
- `button`: min-height 48px, border-radius 12px, font-size 17px.

- [ ] **Step 3: Smoke test**

`tests/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/preact';
import { App } from '../src/ui/App';

test('app renders title', () => {
  render(<App />);
  expect(screen.getByText('Pool Training')).toBeInTheDocument();
});
```

Run: `npx vitest --run` → PASS. Run: `npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + Preact + TS app with Vitest"
```

---

### Task 2: Plan content and types

**Files:**
- Create: `src/plan/types.ts`, `src/plan/plan.json`, `src/plan/index.ts`
- Test: `tests/plan/plan.test.ts`

**Interfaces:**
- Produces:
  - all types from spec §4.1
  - `export const plan: Plan`
  - `getBlock(id: string): Block | undefined`
  - `getSession(id: 'am'|'pm'): Session`
  - `getDrillRef(id: string): DrillRef | undefined`
  - `getTestDef(id: TestId): TestDef`
  - `BLOCK_IDS` (as listed below)
  - `type TestId = 'straight'|'cut'|'stop'|'draw'|'fiveBall'`
  - `type ErrorCodeId = 'P'|'C'|'S'|'D'`

- [ ] **Step 1: Dump the spreadsheet text**

```bash
/Users/leon/Documents/work/Virtual_Env/venv_3.13_general/bin/python -I -c "
import openpyxl
wb=openpyxl.load_workbook('30_Day_Pool_Training_Plan_v2.xlsx')
for ws in wb:
    print('=== SHEET', ws.title)
    for r in ws.iter_rows(values_only=True):
        if any(c is not None for c in r): print(' | '.join('' if c is None else str(c) for c in r))
"
```

Use this output as the only source for every text field.

- [ ] **Step 2: Write `src/plan/types.ts`**

Copy these types exactly from spec §4.1:
- `RecordMode`
- `RecordKind`
- `Block` (including `diagramId: string`)
- `Session`
- `DrillRef`
- `TestDef` (including `diagramId`)
- `ErrorCode`
- `Plan`

Also add:

```ts
export type TestId = 'straight' | 'cut' | 'stop' | 'draw' | 'fiveBall';
export type ErrorCodeId = 'P' | 'C' | 'S' | 'D';
export type SessionId = 'am' | 'pm';
```

Use `TestId` for `TestDef.id`, `ErrorCodeId` for `ErrorCode.code` and the `focusMap` keys, and `SessionId` for `Session.id`.

- [ ] **Step 3: Write `src/plan/plan.json`**

Top-level fields:
- `version: 1`
- `title: "Daily 2-Hour Pool Training Plan"`
- `intro`: the spreadsheet's second row plus the "Important: Training vs. Testing" paragraph, verbatim

Sessions:
- `am`, title "Morning — 60 min: Fundamentals, Accuracy & Cue-Ball Technique"
- `pm`, title "Afternoon — 60 min: Cut Shots, Position, Patterns & APA Play"

Blocks, in this order, with these exact ids, `minutes`, record settings and links:

| id | timeLabel | minutes | record | recordKind | drillRefId | diagramId |
|---|---|---|---|---|---|---|
| am-straight-warmup | 0–10 min | 10 | no | null | straight-ball | am-straight-warmup |
| am-stop-ladder | 10–22 min | 12 | optional | generic | stop-shot | am-stop-ladder |
| am-draw-ladder | 22–38 min | 16 | yes | draw | draw | am-draw-ladder |
| am-follow-ladder | 38–50 min | 12 | optional | generic | follow | am-follow-ladder |
| am-precision-pocket | 50–60 min | 10 | no | null | straight-ball | am-precision-pocket |
| pm-cut-blocks | 0–12 min | 12 | no | null | cut-block | pm-cut-blocks |
| pm-one-rail | 12–27 min | 15 | optional | generic | (omit) | pm-one-rail |
| pm-3ball | 27–42 min | 15 | yes | runs | three-ball | pm-3ball |
| pm-5ball | 42–55 min | 13 | yes | runs | five-ball | pm-5ball |
| pm-review | 55–60 min | 5 | notes | notes | (omit) | pm-review |

`name`, `setup`, `volume`, `howToTrain`, `successStandard` and `purpose` come verbatim from the matching spreadsheet columns (Drill, Setup, Training Volume, How to Train, Success Standard, Purpose).

`drillRefs` come from the Drill Reference sheet, with ids:
- `straight-ball`
- `stop-shot`
- `draw`
- `follow`
- `cut-block`
- `three-ball`
- `five-ball`

Fields: `name`, `ballPlacement`, `executionCue`, `commonMistake`, `progression`, `whenToUseReducer`.

`tests` come from the Standard Test sheet. Fields: `setup` = Exact Setup, `attempts`, `scoring`, `measures`, `frequency`, `notes`.

| id | name | attempts | kind | diagramId |
|---|---|---|---|---|
| straight | Long straight pot | 10 | makeMiss | test-straight |
| cut | Cut shots | 20 | makeMissLR | test-cut |
| stop | Stop shot | 10 | makeMiss | test-stop |
| draw | Draw test | 5 | distances | test-draw |
| fiveBall | 5-ball clearance | 5 | runs | test-5ball |

`errorCodes`:
- P — "Potting / aiming error"
- C — "Cue-ball position / route error"
- S — "Spin or speed execution error"
- D — "Decision / pattern-selection error"

`focusMap`:
```json
{
  "P": { "blockIds": ["am-straight-warmup", "am-precision-pocket", "pm-cut-blocks"], "advice": "Potting errors lead. Slow down the aiming routine: straight-ball warm-up, precision pocket drill, cut-shot blocks." },
  "C": { "blockIds": ["pm-one-rail", "pm-3ball"], "advice": "Cue-ball position errors lead. Spend extra time on one-rail position zones and the 3-ball pattern drill." },
  "S": { "blockIds": ["am-stop-ladder", "am-draw-ladder", "am-follow-ladder"], "advice": "Spin/speed errors lead. Prioritise the stop, draw and follow ladders — smooth delivery over force." },
  "D": { "blockIds": ["pm-3ball", "pm-5ball"], "advice": "Decision errors lead. In 3-ball and 5-ball drills, name all shots and cue-ball zones before shooting." }
}
```

- [ ] **Step 4: `src/plan/index.ts`**

```ts
import raw from './plan.json';
import type { Block, DrillRef, Plan, Session, SessionId, TestDef, TestId } from './types';

export const plan = raw as Plan;
const blocks = plan.sessions.flatMap((s) => s.blocks);

export const BLOCK_IDS = {
  drawLadder: 'am-draw-ladder',
  threeBall: 'pm-3ball',
  fiveBall: 'pm-5ball',
} as const;

export const getSession = (id: SessionId): Session => plan.sessions.find((s) => s.id === id)!;
export const getBlock = (id: string): Block | undefined => blocks.find((b) => b.id === id);
export const getDrillRef = (id: string): DrillRef | undefined => plan.drillRefs.find((d) => d.id === id);
export const getTestDef = (id: TestId): TestDef => plan.tests.find((t) => t.id === id)!;
export const TEST_ORDER: TestId[] = ['straight', 'cut', 'stop', 'draw', 'fiveBall'];
export * from './types';
```

- [ ] **Step 5: Write the schema test**

`tests/plan/plan.test.ts`:
```ts
import { plan, getBlock, getDrillRef, TEST_ORDER } from '../../src/plan';

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

test('focusMap block ids exist', () => {
  for (const code of ['P', 'C', 'S', 'D'] as const)
    for (const id of plan.focusMap[code].blockIds) expect(getBlock(id)).toBeDefined();
});

test('five tests in canonical order', () => {
  expect(plan.tests.map((t) => t.id)).toEqual(TEST_ORDER);
});
```

Run: `npx vitest --run tests/plan` → PASS (fix the JSON until it passes).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(plan): plan content and types from spreadsheet"
```

---

### Task 3: Table geometry and diagram data

**Files:**
- Create: `src/diagram/types.ts`, `src/diagram/table.ts`, `src/diagram/geometry.ts`, `src/diagram/diagrams.ts`
- Test: `tests/diagram/geometry.test.ts`, `tests/diagram/diagrams.test.ts`

**Interfaces:**
- Consumes: `plan` from Task 2 (for the coverage test).
- Produces:
  - `TABLE`
  - `POCKETS: Record<PocketId, Pt>`
  - `DIAMONDS: Pt[]`
  - `along`
  - `lineFromPocket(pocket, toward): (d: number) => Pt`
  - `ghostBall(ob, pocket): Pt`
  - `cutCueBall(ob, pocket, angleDeg, side, dist): Pt`
  - `cutAngleDeg(cb, ob, pocket): number`
  - `dist(a, b): number`
  - `DIAGRAMS: Record<string, Diagram>`
  - `getDiagram(id): Diagram`

- [ ] **Step 1: Types**

`src/diagram/types.ts`: copy `Pt`, `PocketId`, `DiagramEl`, `Diagram` from spec §4.1a. Rect zone `at` is the top-left corner.

- [ ] **Step 2: Table constants**

`src/diagram/table.ts`:
```ts
import type { PocketId, Pt } from './types';

/** Playing surface in inches, cushion nose to cushion nose. Measure the real table and update. */
export const TABLE = { width: 78, height: 39, ball: 2.25, pocketMouth: 4.8, rail: 6 } as const;

export const POCKETS: Record<PocketId, Pt> = {
  TL: { x: 0, y: 0 }, TM: { x: TABLE.width / 2, y: 0 }, TR: { x: TABLE.width, y: 0 },
  BL: { x: 0, y: TABLE.height }, BM: { x: TABLE.width / 2, y: TABLE.height }, BR: { x: TABLE.width, y: TABLE.height },
};

/** 3 diamonds between pockets on each long rail half, 3 on each short rail. */
export const DIAMONDS: Pt[] = [
  ...[1, 2, 3, 5, 6, 7].flatMap((i) => [
    { x: (TABLE.width / 8) * i, y: -TABLE.rail / 2 },
    { x: (TABLE.width / 8) * i, y: TABLE.height + TABLE.rail / 2 },
  ]),
  ...[1, 2, 3].flatMap((i) => [
    { x: -TABLE.rail / 2, y: (TABLE.height / 4) * i },
    { x: TABLE.width + TABLE.rail / 2, y: (TABLE.height / 4) * i },
  ]),
];
```

- [ ] **Step 3: Write the failing geometry tests**

`tests/diagram/geometry.test.ts`:
```ts
import { along, lineFromPocket, ghostBall, cutCueBall, cutAngleDeg, dist } from '../../src/diagram/geometry';
import { TABLE, DIAMONDS } from '../../src/diagram/table';

test('lineFromPocket places points at exact distances from the pocket', () => {
  const p = lineFromPocket('TR', { x: 0, y: 39 });
  expect(dist(p(15), { x: 78, y: 0 })).toBeCloseTo(15, 1);
  expect(dist(p(15), p(39))).toBeCloseTo(24, 1);
});

test('ghost ball sits one ball diameter behind OB, away from pocket', () => {
  const g = ghostBall({ x: 60, y: 16 }, 'TR');
  expect(dist(g, { x: 60, y: 16 })).toBeCloseTo(TABLE.ball, 2);
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
```

Run: `npx vitest --run tests/diagram/geometry.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement `src/diagram/geometry.ts`**

```ts
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
```

Note: with rounding to 0.1", the measured angle is within about 0.5°. `toBeCloseTo(a, 0)` allows ±0.5. If it is flaky, change the test precision to `toBeLessThan(1)` on the absolute difference.

Run the geometry tests → PASS.

- [ ] **Step 5: Write the failing diagram-data tests**

`tests/diagram/diagrams.test.ts`:
```ts
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
```

Run → FAIL.

- [ ] **Step 6: Implement `src/diagram/diagrams.ts`**

Use the helpers. Ladder distances are centre-to-centre CB→OB. These are the exact positions; if a bounds test fails, nudge only the failing point by up to 2".

```ts
import { cutCueBall, ghostBall, lineFromPocket } from './geometry';
import { POCKETS, TABLE } from './table';
import type { Diagram, DiagramEl, Pt } from './types';

const S = lineFromPocket('TR', { x: 0, y: TABLE.height }); // standard straight-in line to top-right corner
const SB = lineFromPocket('BR', { x: 0, y: 0 });           // mirrored line to bottom-right corner
const OB_D = 15;                                           // object ball 15" from the pocket
const CONTACT = OB_D + TABLE.ball;                         // cue-ball centre at contact
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
      { t: 'zone', shape: 'circle', at: S(CONTACT + 6), r: 2, label: '6"' },
      { t: 'zone', shape: 'circle', at: S(CONTACT + 12), r: 2, label: '12"' },
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
  {
    id: 'pm-one-rail', title: 'One-rail position zones',
    caption: 'Pot the OB, send CB one rail into the 12–18" zone. Predict the route first.',
    panels: [[
      { t: 'pocket', id: 'BR' }, ob({ x: 66, y: 31 }, 1), cue({ x: 50, y: 24 }),
      { t: 'line', from: { x: 66, y: 31 }, to: POCKETS.BR, style: 'objPath', arrow: true },
      { t: 'line', from: { x: 50, y: 24 }, to: ghostBall({ x: 66, y: 31 }, 'BR'), style: 'aim' },
      { t: 'line', from: ghostBall({ x: 66, y: 31 }, 'BR'), to: { x: 56, y: 0 }, style: 'cuePath' },
      { t: 'line', from: { x: 56, y: 0 }, to: { x: 40, y: 16 }, style: 'cuePath', arrow: true },
      { t: 'zone', shape: 'rect', at: { x: 32.5, y: 8.5 }, w: 15, h: 15, label: 'Target zone' },
      ob({ x: 20, y: 8 }, 2), { t: 'pocket', id: 'TL', label: 'next' },
    ]],
  },
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
```

Run: `npx vitest --run tests/diagram` → PASS. Fix any coordinates the bounds or overlap test reports. The marker positions for a ladder may lie past the last CB; that is fine as long as they are inside the table.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(diagram): table geometry and setup diagrams for all drills and tests"
```

---

### Task 4: TableDiagram renderer, full-screen viewer, and review page

**Files:**
- Create: `src/diagram/TableDiagram.tsx`, `src/diagram/DiagramViewer.tsx`, `src/ui/screens/DiagramsReview.tsx`, `src/diagram/diagram.css`
- Test: `tests/diagram/TableDiagram.test.tsx`

**Interfaces:**
- Consumes: `Diagram`, `TABLE`, `POCKETS`, `DIAMONDS`, `DIAGRAMS`.
- Produces:
  - `<TableDiagram diagram={Diagram} panel?={number} rotate?={boolean} />`, rendering `<svg data-testid="table-diagram">` that contains `<g data-layer="table">` and `<g data-layer="overlay">`
  - `<DiagramCard diagramId={string} />`: a small inline diagram plus caption; tapping it opens `<DiagramViewer>`
  - `<DiagramViewer diagram onClose />`
  - `<DiagramsReview />` page

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/preact';
import { TableDiagram, DiagramCard } from '../../src/diagram/TableDiagram';
import { DIAGRAMS } from '../../src/diagram/diagrams';

test.each(Object.keys(DIAGRAMS))('renders %s with separate table and overlay layers', (id) => {
  const { container } = render(<TableDiagram diagram={DIAGRAMS[id]} />);
  expect(container.querySelector('[data-layer="table"]')).not.toBeNull();
  expect(container.querySelector('[data-layer="overlay"]')).not.toBeNull();
});

test('card shows caption and opens full-screen viewer on tap', () => {
  render(<DiagramCard diagramId="am-draw-ladder" />);
  expect(screen.getByText(/Level cue, low contact/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /open diagram/i }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('5-ball test viewer shows rail measurements', () => {
  render(<DiagramCard diagramId="test-5ball" />);
  fireEvent.click(screen.getByRole('button', { name: /open diagram/i }));
  expect(screen.getAllByText(/from (left|right|top|bottom)/i).length).toBeGreaterThan(0);
});
```

Run → FAIL.

- [ ] **Step 2: Implement `TableDiagram.tsx`**

- **SVG viewBox:** `-R -R (W+2R) (H+2R)`, where `R = TABLE.rail` and units are inches. Example: `viewBox="-6 -6 90 51"`.
- **Two-panel diagrams** render the panels side by side in an outer flex container, each as its own `<svg>`. With the `panel` prop, render only that panel.
- **Table layer** (`<g data-layer="table">`), in drawing order:
  1. `<defs>`:
     - a wood linear gradient (`#6b4426` → `#8a5a33` → `#5a3920`)
     - a wood-grain `<pattern>` of thin semi-transparent darker lines
     - a felt radial gradient (`#1b7a52` centre → `#0f5a3c` edges)
     - an `feTurbulence` filter with low opacity for cloth texture
  2. Outer rail: a rect from `-R,-R` of size `W+2R × H+2R`, with `rx=2`, wood fill and grain overlay.
  3. Cushions: a 1"-wide darker-green band just inside the rail, drawn as 6 trapezoids that stop at the pocket jaws.
  4. Felt rect `0,0,W,H`.
  5. Head string: a dashed faint line at `x = W/4`. Foot spot: a small dot at `(W*3/4, H/2)`.
  6. Diamonds: small white-pearl ellipses, 0.6" across, at `DIAMONDS`.
  7. Pockets: black circles of radius `TABLE.pocketMouth/2` at each `POCKETS` point, with leather-brown corner caps behind them.
- **Overlay layer** (`<g data-layer="overlay">`), for each element:
  - `ball`:
    - `cue`: white circle, radius 1.125, thin grey stroke, subtle radial highlight.
    - `cue6dot`: white ball plus 6 small red dots (radius 0.18) at evenly spaced offsets.
    - `object`: radius 1.125, fill colour by `num` (1 yellow `#f5c518`, 2 blue `#1f4fd1`, 3 red `#d22`, 4 purple `#5b2a86`, 5 orange `#f07c1a`), with a white number disc showing the number at font-size 1.1.
    - `ghost`: dashed white outline, no fill.
    - The optional `label` is drawn as text above the ball, font-size 1.6, white with a dark stroke (`paint-order: stroke`).
  - `line`:
    - `aim`: dashed white `stroke-dasharray="1 0.8"`.
    - `cuePath`: solid white.
    - `objPath`: solid yellow `#f2c14e`.
    - Stroke width 0.35. Draw an arrowhead marker at the end when `arrow`.
    - An optional label at the midpoint.
  - `zone`: fill `rgba(242,193,78,0.22)`, dashed `#f2c14e` stroke, with the label centred.
  - `marker`: small tick plus text, font-size 1.6, `#f2c14e`.
  - `label`: text at font-size 2, white with a dark stroke, `text-anchor: middle`.
  - `pocket`: a glowing ring (radius 3, `#f2c14e`, width 0.4) at the pocket, plus the optional label.
- **`rotate` prop:** wrap content in `<g transform="rotate(90) translate(0,-H)">` and swap the viewBox dimensions, so the table is portrait.
- **`DiagramCard`:** `<figure class="diagram-card">` containing a `<button aria-label="Open diagram">` that wraps `<TableDiagram>` and a `<figcaption>` with `diagram.caption`. Clicking opens `<DiagramViewer>`.
- **Measurements:** export a helper `railOffsets(p: Pt)` that returns the nearest x rail and nearest y rail with distance, e.g. `{ x: '16" from left', y: '9" from bottom' }`.

- [ ] **Step 3: Implement `DiagramViewer.tsx`**

- A full-screen fixed overlay with `role="dialog"`, `aria-modal="true"`, and a dark background.
- Header: title and a **Close** button (48px).
- Body:
  - Renders `<TableDiagram rotate={isPortrait}>` at full size. `isPortrait = window.innerHeight > window.innerWidth`, re-evaluated on `resize`.
  - Two-panel diagrams are stacked vertically.
- Pinch-zoom: set CSS `touch-action: pinch-zoom` on the body container and allow it to scroll (`overflow: auto`). The SVG width is controlled by `zoom` state (1–3) via +/- buttons, as a fallback when native pinch isn't available.
- Caption at the bottom.
- When `diagram.showMeasurements`:
  - list each object ball as `Ball N: 16" from left, 9" from bottom`, using `railOffsets`
  - draw a dimension line from each ball to its nearest rails in the overlay

- [ ] **Step 4: Implement `DiagramsReview.tsx`**

A page listing every diagram (`Object.values(DIAGRAMS)`) as a `DiagramCard`, with its id under it. The page is routed at `#/diagrams` in Task 10 and linked from Settings ("Review all diagrams").

- [ ] **Step 5: Run the tests, then commit**

Run: `npx vitest --run tests/diagram` → PASS. Run `npx tsc --noEmit`.

```bash
git add -A && git commit -m "feat(diagram): realistic SVG table renderer, full-screen viewer, review page"
```

---

### Task 5: Stats (pure functions)

**Files:**
- Create: `src/db/types.ts` (record types, needed here), `src/stats/dates.ts`, `src/stats/index.ts`
- Test: `tests/stats/dates.test.ts`, `tests/stats/index.test.ts`

**Interfaces:**
- Consumes: `plan`, `BLOCK_IDS`, `ErrorCodeId`, `TestId` from Task 2.
- Produces: the record types (spec §4.2) and the functions below, with these exact signatures.

- [ ] **Step 1: Record types — `src/db/types.ts`**

```ts
import type { ErrorCodeId, SessionId } from '../plan';

export interface BlockResult {
  blockId: string;
  startedAt: number; endedAt?: number;
  draw?: { bestIn: number; typicalIn: number };
  runs?: { success: number; attempts: number; failTags: ErrorCodeId[] };
  generic?: { made: number; attempts: number };
  notes?: string;
  skipped?: boolean;
}
export interface SessionRecord {
  id: string; date: string; sessionId: SessionId; planVersion: number;
  startedAt: number; endedAt: number; activeMinutes: number; blocks: BlockResult[];
}
export interface Shot { ok: boolean; tag?: ErrorCodeId; side?: 'L' | 'R' }
export interface TestRecord {
  id: string; date: string; planVersion: number; startedAt: number; endedAt: number;
  straight?: Shot[]; cut?: Shot[]; stop?: Shot[]; draw?: number[]; fiveBall?: Shot[];
}
export interface Settings { startDate?: string; soundOn: boolean; lastExportAt?: number }
export interface ActiveState { type: 'session' | 'test'; payload: unknown; updatedAt: number }
export interface Backup { app: 'pool-training'; schema: 1; exportedAt: number; sessions: SessionRecord[]; tests: TestRecord[]; settings: Settings }
```

- [ ] **Step 2: Write the failing date tests**

`tests/stats/dates.test.ts`:
```ts
import { localDate, daysBetween, addDays } from '../../src/stats/dates';

test('localDate formats local calendar date', () => {
  expect(localDate(new Date(2026, 9, 7, 23, 59).getTime())).toBe('2026-10-07');
});
test('daysBetween is DST-safe (US DST ends 2026-11-01)', () => {
  expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  expect(daysBetween('2026-10-07', '2026-11-05')).toBe(29);
  expect(daysBetween('2026-10-08', '2026-10-07')).toBe(-1);
});
test('addDays crosses month and DST', () => {
  expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  expect(addDays('2026-10-07', -7)).toBe('2026-09-30');
});
```

- [ ] **Step 3: Implement `src/stats/dates.ts`**

```ts
const pad = (n: number) => String(n).padStart(2, '0');
export const localDate = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const utc = (date: string) => { const [y, m, d] = date.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const daysBetween = (a: string, b: string): number => Math.round((utc(b) - utc(a)) / 86400000);
export const addDays = (date: string, n: number): string => {
  const d = new Date(utc(date) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
```

Run → PASS.

- [ ] **Step 4: Write the failing stats tests**

`tests/stats/index.test.ts`:
```ts
import {
  resolveStartDate, dayNumber, weekOfPlan, testScores, weeklySummary, errorTotals,
  focusSuggestion, streak, minutesByDay, testDue, dailySummaryLine, trainingRecords,
} from '../../src/stats';
import type { SessionRecord, TestRecord, Shot } from '../../src/db/types';

const shots = (made: number, total: number, tag?: 'P' | 'C' | 'S' | 'D'): Shot[] =>
  Array.from({ length: total }, (_, i) => (i < made ? { ok: true } : { ok: false, tag }));
const cutShots = (l: number, r: number): Shot[] => [
  ...shots(l, 10).map((s) => ({ ...s, side: 'L' as const })),
  ...shots(r, 10).map((s) => ({ ...s, side: 'R' as const })),
];
const test_ = (date: string, o: Partial<TestRecord> = {}): TestRecord => ({
  id: date + Math.random(), date, planVersion: 1, startedAt: 0, endedAt: 0, ...o,
});
const sess = (date: string, o: Partial<SessionRecord> = {}): SessionRecord => ({
  id: date + Math.random(), date, sessionId: 'am', planVersion: 1, startedAt: 0, endedAt: 0, activeMinutes: 60, blocks: [], ...o,
});

test('resolveStartDate prefers settings, else earliest record', () => {
  expect(resolveStartDate({ soundOn: true, startDate: '2026-10-01' }, [], [])).toBe('2026-10-01');
  expect(resolveStartDate({ soundOn: true }, [sess('2026-10-05')], [test_('2026-10-03')])).toBe('2026-10-03');
  expect(resolveStartDate({ soundOn: true }, [], [])).toBeUndefined();
});

test('dayNumber and weekOfPlan match spreadsheet buckets', () => {
  expect(dayNumber('2026-10-07', '2026-10-07')).toBe(1);
  expect(dayNumber('2026-11-05', '2026-10-07')).toBe(30);
  expect([1, 7, 8, 14, 15, 21, 22, 30, 31, 0].map(weekOfPlan)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, null, null]);
});

test('testScores derives all metrics; skipped tests undefined', () => {
  const s = testScores(test_('2026-10-07', { straight: shots(7, 10), cut: cutShots(6, 8), draw: [11, 14, 12, 9, 14] }));
  expect(s).toEqual({ straight: 7, cutL: 6, cutR: 8, cut: 14, stop: undefined, drawAvg: 12, fiveBall: undefined });
});

test('weeklySummary averages per week, ignores missing, best and avg over days 1–30', () => {
  const tests = [
    test_('2026-10-07', { straight: shots(6, 10) }),
    test_('2026-10-09', { straight: shots(8, 10), draw: [10, 10, 10, 10, 10] }),
    test_('2026-10-15', { straight: shots(9, 10) }),
    test_('2026-11-10', { straight: shots(10, 10) }), // day 35 — outside 30-day plan
  ];
  const w = weeklySummary(tests, '2026-10-07');
  expect(w.straight.weeks).toEqual([7, 9, null, null]);
  expect(w.straight.best).toBe(9);
  expect(w.straight.avg).toBeCloseTo(23 / 3);
  expect(w.drawAvg.weeks).toEqual([10, null, null, null]);
  expect(w.stop).toEqual({ weeks: [null, null, null, null], best: null, avg: null });
});

test('errorTotals counts test tags and failed-run tags in date range', () => {
  const tests = [test_('2026-10-07', { straight: shots(7, 10, 'P'), fiveBall: [{ ok: false, tag: 'C' }, { ok: false }] })];
  const sessions = [sess('2026-10-08', { blocks: [{ blockId: 'pm-5ball', startedAt: 0, runs: { success: 1, attempts: 3, failTags: ['D', 'C'] } }] })];
  expect(errorTotals(sessions, tests)).toEqual({ P: 3, C: 2, S: 0, D: 1 });
  expect(errorTotals(sessions, tests, '2026-10-08', '2026-10-08')).toEqual({ P: 0, C: 1, S: 0, D: 1 });
});

test('focusSuggestion thresholds: needs ≥10 errors and top ≥35%', () => {
  const t = (p: number, c: number) => [test_('2026-10-07', { straight: shots(10 - p, 10, 'P'), stop: shots(10 - c, 10, 'C') })];
  expect(focusSuggestion([], t(5, 4), '2026-10-07')).toBeNull();          // 9 errors
  expect(focusSuggestion([], t(6, 4), '2026-10-07')?.code).toBe('P');     // 10 errors, P 60%
  const even = [test_('2026-10-07', { straight: shots(7, 10, 'P'), stop: shots(7, 10, 'C'), cut: [...shots(17, 20, 'S')] }),
    test_('2026-10-07', { straight: shots(7, 10, 'D') })];               // 3 each = 25%
  expect(focusSuggestion([], even, '2026-10-07')).toBeNull();
  expect(focusSuggestion([], t(6, 4), '2026-10-20')).toBeNull();          // outside last 7 days
});

test('focusSuggestion returns advice and block names', () => {
  const r = focusSuggestion([], [test_('2026-10-07', { stop: shots(0, 10, 'S') })], '2026-10-07')!;
  expect(r.code).toBe('S');
  expect(r.blockNames).toContain('Draw ladder');
  expect(r.advice).toMatch(/ladders/);
});

test('streak counts consecutive days ending today or yesterday', () => {
  const s = ['2026-10-03', '2026-10-05', '2026-10-06', '2026-10-07'].map((d) => sess(d));
  expect(streak(s, '2026-10-07')).toBe(3);
  expect(streak(s, '2026-10-08')).toBe(3);
  expect(streak(s, '2026-10-09')).toBe(0);
});

test('minutesByDay sums sessions on the same day', () => {
  expect(minutesByDay([sess('2026-10-07', { activeMinutes: 55 }), sess('2026-10-07', { activeMinutes: 62 })])).toEqual({ '2026-10-07': 117 });
});

test('testDue after 3 days or when never tested', () => {
  expect(testDue([], '2026-10-07')).toEqual({ daysSinceLast: null, due: true });
  expect(testDue([test_('2026-10-05')], '2026-10-07')).toEqual({ daysSinceLast: 2, due: false });
  expect(testDue([test_('2026-10-04')], '2026-10-07')).toEqual({ daysSinceLast: 3, due: true });
});

test('dailySummaryLine uses latest test and day error totals', () => {
  const tests = [
    test_('2026-10-07', { straight: shots(5, 10), endedAt: 1 }),
    test_('2026-10-07', { straight: shots(7, 10, 'P'), cut: cutShots(7, 7), stop: shots(8, 10), draw: [12, 12, 12, 12, 12], fiveBall: shots(3, 5), endedAt: 2 }),
  ];
  expect(dailySummaryLine('2026-10-07', [], tests)).toBe('Straight 7/10 | Cut 14/20 | Stop 8/10 | Draw 12" | 5-ball 3/5 | P3 C0 S0 D0');
  expect(dailySummaryLine('2026-10-08', [], tests)).toBe('Straight – | Cut – | Stop – | Draw – | 5-ball – | P0 C0 S0 D0');
});

test('trainingRecords aggregates draw/3-ball/5-ball per day', () => {
  const s = [sess('2026-10-07', { blocks: [
    { blockId: 'am-draw-ladder', startedAt: 0, draw: { bestIn: 18, typicalIn: 10 } },
    { blockId: 'pm-3ball', startedAt: 0, runs: { success: 4, attempts: 8, failTags: [] } },
    { blockId: 'pm-5ball', startedAt: 0, skipped: true },
  ] })];
  expect(trainingRecords(s)).toEqual([{ date: '2026-10-07', drawBest: 18, drawTypical: 10, threeBallRate: 0.5, fiveBallRate: undefined }]);
});
```

Run → FAIL.

- [ ] **Step 5: Implement `src/stats/index.ts`**

```ts
import { plan, getBlock, BLOCK_IDS, type ErrorCodeId } from '../plan';
import type { SessionRecord, Settings, Shot, TestRecord } from '../db/types';
import { addDays, daysBetween } from './dates';

export type Metric = 'straight' | 'cut' | 'stop' | 'drawAvg' | 'fiveBall';
export const METRICS: Metric[] = ['straight', 'cut', 'stop', 'drawAvg', 'fiveBall'];
export type ErrorCounts = Record<ErrorCodeId, number>;
export interface TestScores { straight?: number; cutL?: number; cutR?: number; cut?: number; stop?: number; drawAvg?: number; fiveBall?: number }
export interface MetricSummary { weeks: (number | null)[]; best: number | null; avg: number | null }

const made = (s?: Shot[]) => (s ? s.filter((x) => x.ok).length : undefined);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number) => Math.round(n * 10) / 10;

export function resolveStartDate(settings: Settings, sessions: SessionRecord[], tests: TestRecord[]): string | undefined {
  if (settings.startDate) return settings.startDate;
  const dates = [...sessions, ...tests].map((r) => r.date).sort();
  return dates[0];
}
export const dayNumber = (date: string, startDate: string) => daysBetween(startDate, date) + 1;
export const weekOfPlan = (day: number): 1 | 2 | 3 | 4 | null =>
  day < 1 || day > 30 ? null : day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;

export function testScores(t: TestRecord): TestScores {
  return {
    straight: made(t.straight),
    cutL: t.cut ? made(t.cut.filter((s) => s.side === 'L')) : undefined,
    cutR: t.cut ? made(t.cut.filter((s) => s.side === 'R')) : undefined,
    cut: made(t.cut),
    stop: made(t.stop),
    drawAvg: t.draw && t.draw.length ? r1(t.draw.reduce((a, b) => a + b, 0) / t.draw.length) : undefined,
    fiveBall: made(t.fiveBall),
  };
}

export function weeklySummary(tests: TestRecord[], startDate: string): Record<Metric, MetricSummary> {
  const inPlan = tests
    .map((t) => ({ week: weekOfPlan(dayNumber(t.date, startDate)), s: testScores(t) }))
    .filter((x) => x.week !== null);
  const out = {} as Record<Metric, MetricSummary>;
  for (const m of METRICS) {
    const vals = (pred: (w: number) => boolean) =>
      inPlan.filter((x) => pred(x.week!) && x.s[m] !== undefined).map((x) => x.s[m] as number);
    const all = vals(() => true);
    out[m] = {
      weeks: [1, 2, 3, 4].map((w) => mean(vals((x) => x === w))),
      best: all.length ? Math.max(...all) : null,
      avg: mean(all),
    };
  }
  return out;
}

const inRange = (d: string, from?: string, to?: string) => (!from || d >= from) && (!to || d <= to);
export function errorTotals(sessions: SessionRecord[], tests: TestRecord[], from?: string, to?: string): ErrorCounts {
  const c: ErrorCounts = { P: 0, C: 0, S: 0, D: 0 };
  for (const t of tests) if (inRange(t.date, from, to))
    for (const s of [t.straight, t.cut, t.stop, t.fiveBall]) for (const x of s ?? []) if (!x.ok && x.tag) c[x.tag]++;
  for (const s of sessions) if (inRange(s.date, from, to))
    for (const b of s.blocks) for (const tag of b.runs?.failTags ?? []) c[tag]++;
  return c;
}

export interface FocusSuggestion { code: ErrorCodeId; share: number; advice: string; blockNames: string[] }
export function focusSuggestion(sessions: SessionRecord[], tests: TestRecord[], today: string): FocusSuggestion | null {
  const c = errorTotals(sessions, tests, addDays(today, -6), today);
  const total = c.P + c.C + c.S + c.D;
  if (total < 10) return null;
  const [code, n] = (Object.entries(c) as [ErrorCodeId, number][]).sort((a, b) => b[1] - a[1])[0];
  const share = n / total;
  if (share < 0.35) return null;
  const f = plan.focusMap[code];
  return { code, share, advice: f.advice, blockNames: f.blockIds.map((id) => getBlock(id)?.name ?? id) };
}

export function streak(sessions: SessionRecord[], today: string): number {
  const days = new Set(sessions.map((s) => s.date));
  let d = days.has(today) ? today : days.has(addDays(today, -1)) ? addDays(today, -1) : null;
  let n = 0;
  while (d && days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function minutesByDay(sessions: SessionRecord[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of sessions) m[s.date] = (m[s.date] ?? 0) + s.activeMinutes;
  return m;
}

export function testDue(tests: TestRecord[], today: string): { daysSinceLast: number | null; due: boolean } {
  if (!tests.length) return { daysSinceLast: null, due: true };
  const last = tests.map((t) => t.date).sort().at(-1)!;
  const n = daysBetween(last, today);
  return { daysSinceLast: n, due: n >= 3 };
}

export function dailySummaryLine(date: string, sessions: SessionRecord[], tests: TestRecord[]): string {
  const latest = tests.filter((t) => t.date === date).sort((a, b) => a.endedAt - b.endedAt).at(-1);
  const s = latest ? testScores(latest) : {};
  const f = (v: number | undefined, suffix: string) => (v === undefined ? '–' : `${v}${suffix}`);
  const e = errorTotals(sessions, tests, date, date);
  return `Straight ${f(s.straight, '/10')} | Cut ${f(s.cut, '/20')} | Stop ${f(s.stop, '/10')} | Draw ${f(s.drawAvg, '"')} | 5-ball ${f(s.fiveBall, '/5')} | P${e.P} C${e.C} S${e.S} D${e.D}`;
}

export interface TrainingDay { date: string; drawBest?: number; drawTypical?: number; threeBallRate?: number; fiveBallRate?: number }
export function trainingRecords(sessions: SessionRecord[]): TrainingDay[] {
  const byDate = new Map<string, { drawB: number[]; drawT: number[]; s3: number; a3: number; s5: number; a5: number }>();
  for (const s of sessions) {
    const acc = byDate.get(s.date) ?? { drawB: [], drawT: [], s3: 0, a3: 0, s5: 0, a5: 0 };
    for (const b of s.blocks) {
      if (b.skipped) continue;
      if (b.blockId === BLOCK_IDS.drawLadder && b.draw) { acc.drawB.push(b.draw.bestIn); acc.drawT.push(b.draw.typicalIn); }
      if (b.blockId === BLOCK_IDS.threeBall && b.runs) { acc.s3 += b.runs.success; acc.a3 += b.runs.attempts; }
      if (b.blockId === BLOCK_IDS.fiveBall && b.runs) { acc.s5 += b.runs.success; acc.a5 += b.runs.attempts; }
    }
    byDate.set(s.date, acc);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, a]) => ({
    date,
    drawBest: a.drawB.length ? Math.max(...a.drawB) : undefined,
    drawTypical: mean(a.drawT) ?? undefined,
    threeBallRate: a.a3 ? a.s3 / a.a3 : undefined,
    fiveBallRate: a.a5 ? a.s5 / a.a5 : undefined,
  }));
}
```

Run: `npx vitest --run tests/stats` → PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(stats): record types and pure stats functions"
```

---

### Task 6: Session runner reducer and entry validation

**Files:**
- Create: `src/runner/session.ts`
- Test: `tests/runner/session.test.ts`

**Interfaces:**
- Consumes: `Session`, `Block`, `SessionId`, `plan` (Task 2); `BlockResult`, `SessionRecord` (Task 5); `localDate` (Task 5).
- Produces:
```ts
export interface SessionRunState {
  kind: 'session'; sessionId: SessionId; startedAt: number;
  blockIndex: number; blockStartedAt: number; pausedAt: number | null;
  pausedTotalMs: number; sessionPausedMs: number; extraMs: number;
  results: Record<string, BlockResult>; finished: boolean;
}
export type EntryInput = Partial<Pick<BlockResult, 'draw' | 'runs' | 'generic' | 'notes' | 'skipped'>>;
startSession(sessionId: SessionId, now: number): SessionRunState
pause(s, now): SessionRunState
resume(s, now): SessionRunState
addTime(s, ms: number): SessionRunState
remainingMs(s, blocks: Block[], now: number): number   // negative = overtime
formatClock(ms: number): string                         // "9:05", overtime "+0:45"
next(s, blocks: Block[], now: number, entry?: EntryInput): SessionRunState
back(s, now: number): SessionRunState
toRecord(s, blocks: Block[], planVersion: number, now: number): SessionRecord
validateEntry(kind: RecordKind, raw: Record<string, string>): { ok: true; entry: EntryInput } | { ok: false; error: string }
```

- [ ] **Step 1: Write the failing tests**

```ts
import { startSession, pause, resume, addTime, remainingMs, formatClock, next, back, toRecord, validateEntry } from '../../src/runner/session';
import { getSession } from '../../src/plan';

const blocks = getSession('am').blocks; // 10,12,16,12,10 minutes
const MIN = 60000;
const T0 = new Date(2026, 9, 7, 9, 0).getTime();

test('timer counts down from block duration', () => {
  const s = startSession('am', T0);
  expect(remainingMs(s, blocks, T0)).toBe(10 * MIN);
  expect(remainingMs(s, blocks, T0 + 4 * MIN)).toBe(6 * MIN);
});

test('phone locked 25 minutes on a 10-minute block shows 15 minutes overtime', () => {
  const s = startSession('am', T0);
  expect(remainingMs(s, blocks, T0 + 25 * MIN)).toBe(-15 * MIN);
  expect(formatClock(-15 * MIN)).toBe('+15:00');
});

test('pause freezes the clock and excludes paused time', () => {
  let s = startSession('am', T0);
  s = pause(s, T0 + 2 * MIN);
  expect(remainingMs(s, blocks, T0 + 7 * MIN)).toBe(8 * MIN);
  s = resume(s, T0 + 7 * MIN);
  expect(remainingMs(s, blocks, T0 + 8 * MIN)).toBe(7 * MIN);
});

test('addTime adds two minutes to the current block only', () => {
  let s = addTime(startSession('am', T0), 2 * MIN);
  expect(remainingMs(s, blocks, T0)).toBe(12 * MIN);
  s = next(s, blocks, T0 + MIN);
  expect(remainingMs(s, blocks, T0 + MIN)).toBe(12 * MIN);
});

test('next while paused records the block and does not count paused time as active', () => {
  let s = startSession('am', T0);
  s = pause(s, T0 + 5 * MIN);
  s = next(s, blocks, T0 + 20 * MIN);
  expect(s.blockIndex).toBe(1);
  expect(s.pausedAt).toBeNull();
  for (let i = 1; i < blocks.length; i++) s = next(s, blocks, T0 + (20 + i) * MIN);
  expect(s.finished).toBe(true);
  const rec = toRecord(s, blocks, 1, T0 + 60 * MIN);
  expect(rec.activeMinutes).toBe(45);
  expect(rec.date).toBe('2026-10-07');
  expect(rec.blocks.map((b) => b.blockId)).toEqual(blocks.map((b) => b.id));
});

test('entry is stored on the block it belongs to; back allows re-recording', () => {
  let s = startSession('am', T0);
  s = next(s, blocks, T0 + MIN);
  s = next(s, blocks, T0 + 2 * MIN, { generic: { made: 7, attempts: 10 } });
  expect(s.results['am-stop-ladder'].generic).toEqual({ made: 7, attempts: 10 });
  s = back(s, T0 + 3 * MIN);
  expect(s.blockIndex).toBe(1);
  s = next(s, blocks, T0 + 4 * MIN, { skipped: true });
  expect(s.results['am-stop-ladder'].skipped).toBe(true);
  expect(s.results['am-stop-ladder'].generic).toBeUndefined();
});

test('state survives JSON round-trip (resume after reload)', () => {
  const s = pause(startSession('pm', T0), T0 + MIN);
  const r = JSON.parse(JSON.stringify(s));
  expect(remainingMs(r, getSession('pm').blocks, T0 + 9 * MIN)).toBe(11 * MIN);
});

test('formatClock', () => {
  expect(formatClock(9 * MIN + 5000)).toBe('9:05');
  expect(formatClock(0)).toBe('0:00');
  expect(formatClock(-45000)).toBe('+0:45');
  expect(formatClock(500)).toBe('0:01'); // rounds up partial seconds while counting down
});

describe('validateEntry', () => {
  test('draw: valid', () => expect(validateEntry('draw', { bestIn: '18', typicalIn: '10.5' })).toEqual({ ok: true, entry: { draw: { bestIn: 18, typicalIn: 10.5 } } }));
  test.each([['', '10'], ['-3', '10'], ['abc', '10'], ['10', '200']])('draw rejects %s/%s', (b, t) =>
    expect(validateEntry('draw', { bestIn: b, typicalIn: t }).ok).toBe(false));
  test('draw: typical cannot exceed best', () => expect(validateEntry('draw', { bestIn: '8', typicalIn: '12' }).ok).toBe(false));
  test('runs: success > attempts rejected', () => expect(validateEntry('runs', { success: '6', attempts: '5' }).ok).toBe(false));
  test('runs: valid with tags', () => expect(validateEntry('runs', { success: '3', attempts: '5', failTags: 'C,D' }))
    .toEqual({ ok: true, entry: { runs: { success: 3, attempts: 5, failTags: ['C', 'D'] } } }));
  test('runs: non-integer rejected', () => expect(validateEntry('runs', { success: '2.5', attempts: '5' }).ok).toBe(false));
  test('generic: made > attempts rejected', () => expect(validateEntry('generic', { made: '11', attempts: '10' }).ok).toBe(false));
  test('notes: trimmed, empty allowed', () => expect(validateEntry('notes', { notes: '  aim drifted  ' })).toEqual({ ok: true, entry: { notes: 'aim drifted' } }));
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/runner/session.ts`**

```ts
import type { Block, ErrorCodeId, RecordKind, SessionId } from '../plan';
import type { BlockResult, SessionRecord } from '../db/types';
import { localDate } from '../stats/dates';

export interface SessionRunState {
  kind: 'session'; sessionId: SessionId; startedAt: number;
  blockIndex: number; blockStartedAt: number; pausedAt: number | null;
  pausedTotalMs: number; sessionPausedMs: number; extraMs: number;
  results: Record<string, BlockResult>; finished: boolean;
}
export type EntryInput = Partial<Pick<BlockResult, 'draw' | 'runs' | 'generic' | 'notes' | 'skipped'>>;

export const startSession = (sessionId: SessionId, now: number): SessionRunState => ({
  kind: 'session', sessionId, startedAt: now, blockIndex: 0, blockStartedAt: now, pausedAt: null,
  pausedTotalMs: 0, sessionPausedMs: 0, extraMs: 0, results: {}, finished: false,
});

export const pause = (s: SessionRunState, now: number): SessionRunState => (s.pausedAt !== null ? s : { ...s, pausedAt: now });
export const resume = (s: SessionRunState, now: number): SessionRunState => {
  if (s.pausedAt === null) return s;
  const d = now - s.pausedAt;
  return { ...s, pausedAt: null, pausedTotalMs: s.pausedTotalMs + d, sessionPausedMs: s.sessionPausedMs + d };
};
export const addTime = (s: SessionRunState, ms: number): SessionRunState => ({ ...s, extraMs: s.extraMs + ms });

export function remainingMs(s: SessionRunState, blocks: Block[], now: number): number {
  const eff = s.pausedAt ?? now;
  return blocks[s.blockIndex].minutes * 60000 + s.extraMs - (eff - s.blockStartedAt - s.pausedTotalMs);
}

export function formatClock(ms: number): string {
  const over = ms < 0;
  const secs = over ? Math.floor(-ms / 1000) : Math.ceil(ms / 1000);
  const t = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return over ? `+${t}` : t;
}

const resetBlock = (s: SessionRunState, now: number, blockIndex: number): SessionRunState =>
  ({ ...s, blockIndex, blockStartedAt: now, pausedAt: null, pausedTotalMs: 0, extraMs: 0 });

export function next(s0: SessionRunState, blocks: Block[], now: number, entry?: EntryInput): SessionRunState {
  const s = resume(s0, now);
  const block = blocks[s.blockIndex];
  const result: BlockResult = { blockId: block.id, startedAt: s.blockStartedAt, endedAt: now, ...(entry ?? {}) };
  const results = { ...s.results, [block.id]: result };
  if (s.blockIndex === blocks.length - 1) return { ...s, results, finished: true };
  return { ...resetBlock(s, now, s.blockIndex + 1), results };
}

export function back(s0: SessionRunState, now: number): SessionRunState {
  const s = resume(s0, now);
  return { ...resetBlock(s, now, Math.max(0, s.blockIndex - 1)), finished: false };
}

export function toRecord(s0: SessionRunState, blocks: Block[], planVersion: number, now: number): SessionRecord {
  const s = resume(s0, now);
  return {
    id: crypto.randomUUID(), date: localDate(s.startedAt), sessionId: s.sessionId, planVersion,
    startedAt: s.startedAt, endedAt: now,
    activeMinutes: Math.round((now - s.startedAt - s.sessionPausedMs) / 60000),
    blocks: blocks.filter((b) => s.results[b.id]).map((b) => s.results[b.id]),
  };
}

type V = { ok: true; entry: EntryInput } | { ok: false; error: string };
const num = (v: string | undefined, max: number, integer: boolean): number | null => {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max || (integer && !Number.isInteger(n))) return null;
  return n;
};

export function validateEntry(kind: RecordKind, raw: Record<string, string>): V {
  switch (kind) {
    case 'draw': {
      const b = num(raw.bestIn, 120, false), t = num(raw.typicalIn, 120, false);
      if (b === null || t === null) return { ok: false, error: 'Enter inches between 0 and 120.' };
      if (t > b) return { ok: false, error: 'Typical cannot be more than best.' };
      return { ok: true, entry: { draw: { bestIn: b, typicalIn: t } } };
    }
    case 'runs': {
      const sc = num(raw.success, 100, true), at = num(raw.attempts, 100, true);
      if (sc === null || at === null || at === 0) return { ok: false, error: 'Enter whole numbers; attempts at least 1.' };
      if (sc > at) return { ok: false, error: 'Successes cannot exceed attempts.' };
      const failTags = (raw.failTags ?? '').split(',').filter((x): x is ErrorCodeId => ['P', 'C', 'S', 'D'].includes(x));
      return { ok: true, entry: { runs: { success: sc, attempts: at, failTags } } };
    }
    case 'generic': {
      const m = num(raw.made, 200, true), at = num(raw.attempts, 200, true);
      if (m === null || at === null || at === 0) return { ok: false, error: 'Enter whole numbers; attempts at least 1.' };
      if (m > at) return { ok: false, error: 'Makes cannot exceed attempts.' };
      return { ok: true, entry: { generic: { made: m, attempts: at } } };
    }
    case 'notes':
      return { ok: true, entry: { notes: (raw.notes ?? '').trim() } };
    default:
      return { ok: true, entry: {} };
  }
}
```

Note: in the "next while paused" test, active minutes = 60 total − 15 paused = 45. Run → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(runner): session runner reducer with timestamp timer and entry validation"
```

---

### Task 7: Test runner reducer

**Files:**
- Create: `src/runner/test.ts`
- Test: `tests/runner/test.test.ts`

**Interfaces:**
- Consumes: `TestId`, `ErrorCodeId`, `TEST_ORDER` (Task 2); `Shot`, `TestRecord` (Task 5); `localDate`.
- Produces:
```ts
export const LIMITS: Record<Exclude<TestId, 'draw'>, number> = { straight: 10, cut: 20, stop: 10, fiveBall: 5 };
export interface TestRunState {
  kind: 'test'; startedAt: number; index: number;           // index into TEST_ORDER; 5 = all done
  shots: Record<'straight' | 'cut' | 'stop' | 'fiveBall', Shot[]>;
  draw: (number | null)[];                                   // length 5
  skipped: TestId[];
}
startTest(now): TestRunState
currentTest(s): TestId | null
recordShot(s, ok: boolean): TestRunState     // ignored when the current test is full or is 'draw'
tagLast(s, tag: ErrorCodeId | null): TestRunState  // only on a miss
undo(s): TestRunState
setDraw(s, i: number, inches: number | null): TestRunState
isComplete(s, id: TestId): boolean
nextCutSide(s): 'L' | 'R'
skip(s): TestRunState                        // mark current skipped, clear its data, advance
advance(s): TestRunState                     // move to next test (index+1)
toTestRecord(s, planVersion, now): TestRecord // only complete, non-skipped tests are included
```

- [ ] **Step 1: Write the failing tests**

```ts
import { startTest, currentTest, recordShot, tagLast, undo, setDraw, isComplete, nextCutSide, skip, advance, toTestRecord } from '../../src/runner/test';

const T0 = new Date(2026, 9, 7, 18, 0).getTime();
const rep = <T,>(s: T, n: number, f: (s: T) => T) => { for (let i = 0; i < n; i++) s = f(s); return s; };

test('starts on straight', () => expect(currentTest(startTest(T0))).toBe('straight'));

test('extra taps after the test is full are ignored', () => {
  let s = rep(startTest(T0), 12, (x) => recordShot(x, true));
  expect(s.shots.straight).toHaveLength(10);
  expect(isComplete(s, 'straight')).toBe(true);
});

test('tag only applies to a miss; undo removes last shot', () => {
  let s = recordShot(startTest(T0), true);
  s = tagLast(s, 'P');
  expect(s.shots.straight[0].tag).toBeUndefined();
  s = tagLast(recordShot(s, false), 'P');
  expect(s.shots.straight[1]).toEqual({ ok: false, tag: 'P' });
  s = undo(s);
  expect(s.shots.straight).toHaveLength(1);
});

test('cut: first 10 shots are L, next 10 are R', () => {
  let s = advance(rep(startTest(T0), 10, (x) => recordShot(x, true)));
  expect(currentTest(s)).toBe('cut');
  expect(nextCutSide(s)).toBe('L');
  s = rep(s, 10, (x) => recordShot(x, false));
  expect(nextCutSide(s)).toBe('R');
  s = rep(s, 10, (x) => recordShot(x, true));
  expect(s.shots.cut.map((x) => x.side)).toEqual([...Array(10).fill('L'), ...Array(10).fill('R')]);
});

test('draw values validate range; recordShot ignored on draw', () => {
  let s = { ...startTest(T0), index: 3 };
  expect(currentTest(s)).toBe('draw');
  s = recordShot(s, true);
  s = setDraw(s, 0, 12); s = setDraw(s, 1, -1); s = setDraw(s, 7, 10);
  expect(s.draw).toEqual([12, null, null, null, null]);
  for (let i = 1; i < 5; i++) s = setDraw(s, i, 10);
  expect(isComplete(s, 'draw')).toBe(true);
});

test('skip clears data and advances; record excludes skipped and incomplete tests', () => {
  let s = rep(startTest(T0), 10, (x) => recordShot(x, true));
  s = advance(s);                               // to cut
  s = rep(s, 4, (x) => recordShot(x, true));
  s = skip(s);                                  // skip cut
  expect(currentTest(s)).toBe('stop');
  s = rep(s, 6, (x) => recordShot(x, true));    // stop incomplete
  s = advance(s); s = advance(s); s = advance(s);
  expect(currentTest(s)).toBeNull();
  const r = toTestRecord(s, 1, T0 + 1000);
  expect(r.straight).toHaveLength(10);
  expect(r.cut).toBeUndefined();
  expect(r.stop).toBeUndefined();
  expect(r.date).toBe('2026-10-07');
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/runner/test.ts`**

```ts
import { TEST_ORDER, type ErrorCodeId, type TestId } from '../plan';
import type { Shot, TestRecord } from '../db/types';
import { localDate } from '../stats/dates';

type ShotTest = 'straight' | 'cut' | 'stop' | 'fiveBall';
export const LIMITS: Record<ShotTest, number> = { straight: 10, cut: 20, stop: 10, fiveBall: 5 };
export interface TestRunState {
  kind: 'test'; startedAt: number; index: number;
  shots: Record<ShotTest, Shot[]>; draw: (number | null)[]; skipped: TestId[];
}

export const startTest = (now: number): TestRunState => ({
  kind: 'test', startedAt: now, index: 0,
  shots: { straight: [], cut: [], stop: [], fiveBall: [] }, draw: [null, null, null, null, null], skipped: [],
});
export const currentTest = (s: TestRunState): TestId | null => TEST_ORDER[s.index] ?? null;
const isShotTest = (id: TestId | null): id is ShotTest => id !== null && id !== 'draw';

export const nextCutSide = (s: TestRunState): 'L' | 'R' => (s.shots.cut.length < 10 ? 'L' : 'R');

export function recordShot(s: TestRunState, ok: boolean): TestRunState {
  const id = currentTest(s);
  if (!isShotTest(id) || s.shots[id].length >= LIMITS[id]) return s;
  const shot: Shot = id === 'cut' ? { ok, side: nextCutSide(s) } : { ok };
  return { ...s, shots: { ...s.shots, [id]: [...s.shots[id], shot] } };
}

export function tagLast(s: TestRunState, tag: ErrorCodeId | null): TestRunState {
  const id = currentTest(s);
  if (!isShotTest(id)) return s;
  const list = s.shots[id];
  const last = list.at(-1);
  if (!last || last.ok) return s;
  const updated: Shot = { ...last };
  if (tag) updated.tag = tag; else delete updated.tag;
  return { ...s, shots: { ...s.shots, [id]: [...list.slice(0, -1), updated] } };
}

export function undo(s: TestRunState): TestRunState {
  const id = currentTest(s);
  if (!isShotTest(id)) return s;
  return { ...s, shots: { ...s.shots, [id]: s.shots[id].slice(0, -1) } };
}

export function setDraw(s: TestRunState, i: number, inches: number | null): TestRunState {
  if (i < 0 || i > 4) return s;
  if (inches !== null && (!Number.isFinite(inches) || inches < 0 || inches > 120)) return s;
  const draw = [...s.draw]; draw[i] = inches;
  return { ...s, draw };
}

export const isComplete = (s: TestRunState, id: TestId): boolean =>
  id === 'draw' ? s.draw.every((x) => x !== null) : s.shots[id].length === LIMITS[id];

export const advance = (s: TestRunState): TestRunState => ({ ...s, index: Math.min(s.index + 1, TEST_ORDER.length) });

export function skip(s: TestRunState): TestRunState {
  const id = currentTest(s);
  if (!id) return s;
  const cleared = id === 'draw'
    ? { ...s, draw: [null, null, null, null, null] }
    : { ...s, shots: { ...s.shots, [id]: [] } };
  return advance({ ...cleared, skipped: [...s.skipped, id] });
}

export function toTestRecord(s: TestRunState, planVersion: number, now: number): TestRecord {
  const ok = (id: TestId) => !s.skipped.includes(id) && isComplete(s, id);
  const r: TestRecord = { id: crypto.randomUUID(), date: localDate(s.startedAt), planVersion, startedAt: s.startedAt, endedAt: now };
  for (const id of ['straight', 'cut', 'stop', 'fiveBall'] as const) if (ok(id)) r[id] = s.shots[id];
  if (ok('draw')) r.draw = s.draw as number[];
  return r;
}
```

Run → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(runner): test runner reducer with shot limits, tags, undo, skip"
```

---

### Task 8: IndexedDB store with backup export/import

**Files:**
- Create: `src/db/store.ts`
- Test: `tests/db/store.test.ts`

**Interfaces:**
- Consumes: types from `src/db/types.ts` (Task 5).
- Produces:
```ts
export class BackupError extends Error {}
export interface Store {
  listSessions(): Promise<SessionRecord[]>;
  listTests(): Promise<TestRecord[]>;
  putSession(r: SessionRecord): Promise<void>;
  putTest(r: TestRecord): Promise<void>;
  getActive(): Promise<ActiveState | undefined>;
  setActive(a: ActiveState | undefined): Promise<void>;
  getSettings(): Promise<Settings>;            // default { soundOn: true }
  saveSettings(s: Settings): Promise<void>;
  exportBackup(now: number): Promise<Backup>;  // also records lastExportAt in settings
  importBackup(data: unknown): Promise<void>;  // validate, then replace all; throws BackupError
  resetAll(): Promise<void>;
}
export function validateBackup(data: unknown): Backup   // throws BackupError
export function createStore(dbName?: string): Store     // default 'pool-training'
export async function requestPersistence(): Promise<boolean>
```

- [ ] **Step 1: Write the failing tests**

```ts
import { createStore, validateBackup, BackupError } from '../../src/db/store';
import type { SessionRecord, TestRecord } from '../../src/db/types';

let n = 0;
const fresh = () => createStore(`test-db-${++n}`);
const sess: SessionRecord = { id: 's1', date: '2026-10-07', sessionId: 'am', planVersion: 1, startedAt: 1, endedAt: 2, activeMinutes: 60, blocks: [] };
const tst: TestRecord = { id: 't1', date: '2026-10-07', planVersion: 1, startedAt: 1, endedAt: 2, straight: [{ ok: true }] };

test('put and list records', async () => {
  const s = fresh();
  await s.putSession(sess); await s.putTest(tst);
  expect(await s.listSessions()).toEqual([sess]);
  expect(await s.listTests()).toEqual([tst]);
});

test('settings default and save', async () => {
  const s = fresh();
  expect(await s.getSettings()).toEqual({ soundOn: true });
  await s.saveSettings({ soundOn: false, startDate: '2026-10-07' });
  expect(await s.getSettings()).toEqual({ soundOn: false, startDate: '2026-10-07' });
});

test('active state set and clear', async () => {
  const s = fresh();
  await s.setActive({ type: 'test', payload: { x: 1 }, updatedAt: 5 });
  expect((await s.getActive())?.payload).toEqual({ x: 1 });
  await s.setActive(undefined);
  expect(await s.getActive()).toBeUndefined();
});

test('export → reset → import round-trip restores everything', async () => {
  const s = fresh();
  await s.putSession(sess); await s.putTest(tst); await s.saveSettings({ soundOn: false });
  const b = await s.exportBackup(1000);
  expect(b.settings.lastExportAt).toBe(1000);
  await s.resetAll();
  expect(await s.listSessions()).toEqual([]);
  await s.importBackup(JSON.parse(JSON.stringify(b)));
  expect(await s.listSessions()).toEqual([sess]);
  expect(await s.listTests()).toEqual([tst]);
  expect((await s.getSettings()).soundOn).toBe(false);
});

test.each([
  ['null', null],
  ['wrong app', { app: 'other', schema: 1, exportedAt: 1, sessions: [], tests: [], settings: { soundOn: true } }],
  ['wrong schema', { app: 'pool-training', schema: 2, exportedAt: 1, sessions: [], tests: [], settings: { soundOn: true } }],
  ['bad session', { app: 'pool-training', schema: 1, exportedAt: 1, sessions: [{ id: 1 }], tests: [], settings: { soundOn: true } }],
  ['bad date', { app: 'pool-training', schema: 1, exportedAt: 1, sessions: [{ ...sess, date: '7/10/2026' }], tests: [], settings: { soundOn: true } }],
])('validateBackup rejects %s', (_, data) => {
  expect(() => validateBackup(data)).toThrow(BackupError);
});

test('failed import leaves existing data untouched', async () => {
  const s = fresh();
  await s.putSession(sess);
  await expect(s.importBackup({ app: 'nope' })).rejects.toThrow(BackupError);
  expect(await s.listSessions()).toEqual([sess]);
});
```

Run → FAIL.

- [ ] **Step 2: Implement `src/db/store.ts`**

- Use `openDB` from `idb` with version 1. In `upgrade`, create:
  - object store `sessions` (keyPath `id`, index `date`)
  - object store `tests` (keyPath `id`, index `date`)
  - object store `kv` (no keyPath; keys `'active'` and `'settings'`)
- Cache the DB promise per store instance.
- `listSessions` / `listTests` use `getAll` sorted by `startedAt`.
- `setActive(undefined)` deletes the key.
- `exportBackup(now)`:
  1. reads everything
  2. sets `settings.lastExportAt = now` and saves it
  3. returns `{ app: 'pool-training', schema: 1, exportedAt: now, sessions, tests, settings }`
- `importBackup(data)`:
  1. calls `validateBackup` first (throws before touching the DB)
  2. in one `readwrite` transaction over all three stores: clear `sessions` and `tests`, delete `kv` `'active'`, put all records, put settings
- `resetAll` clears all three stores.
- `validateBackup` checks:
  - `typeof data === 'object' && data !== null`
  - `app === 'pool-training'`, `schema === 1`, `Array.isArray(sessions/tests)`
  - each session has string `id`, `date` matching `/^\d{4}-\d{2}-\d{2}$/`, `sessionId` in `['am','pm']`, numeric `startedAt/endedAt/activeMinutes`, and an array `blocks` whose items each have a string `blockId`
  - each test has string `id`, a valid `date`, numeric `startedAt/endedAt`; any present shot arrays are arrays of objects with boolean `ok`; `draw`, if present, is an array of finite numbers
  - `settings` is an object with boolean `soundOn`

  Throw `new BackupError('<specific reason>')` on the first failure.
- `requestPersistence`: `navigator.storage?.persist ? navigator.storage.persist() : false`, wrapped in try/catch returning `false`.

Run → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(db): IndexedDB store with validated backup export/import"
```

---

### Task 9: Platform helpers (wake lock, chime)

**Files:**
- Create: `src/platform/wakeLock.ts`, `src/platform/chime.ts`
- Test: `tests/platform/platform.test.ts`

**Interfaces:**
- Produces:
  - `acquireWakeLock(): Promise<boolean>` — false when unsupported or denied
  - `releaseWakeLock(): Promise<void>`
  - `wakeLockSupported(): boolean`
  - `unlockAudio(): void` — call inside a user tap
  - `playChime(): void` — no-op when audio is unavailable
  - `setChimeEnabled(on: boolean): void`

- [ ] **Step 1: Write the failing tests**

```ts
import { acquireWakeLock, wakeLockSupported } from '../../src/platform/wakeLock';
import { playChime, unlockAudio } from '../../src/platform/chime';

test('wake lock fails soft when unsupported', async () => {
  expect(wakeLockSupported()).toBe(false); // jsdom has no navigator.wakeLock
  await expect(acquireWakeLock()).resolves.toBe(false);
});

test('chime never throws without AudioContext', () => {
  expect(() => { unlockAudio(); playChime(); }).not.toThrow();
});

test('wake lock re-acquired on visibility return', async () => {
  const request = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  await expect(acquireWakeLock()).resolves.toBe(true);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  expect(request).toHaveBeenCalledTimes(2);
  // @ts-expect-error cleanup
  delete navigator.wakeLock;
});
```

- [ ] **Step 2: Implement**

`wakeLock.ts`:
- Keep a module-level `sentinel` and `wanted` flag.
- `acquireWakeLock`:
  1. sets `wanted = true`
  2. if `!('wakeLock' in navigator)` returns false
  3. `sentinel = await navigator.wakeLock.request('screen')` inside try/catch (returns false on error)
  4. returns true
- Register a single `visibilitychange` listener (added once) that calls `acquireWakeLock()` again when `document.visibilityState === 'visible' && wanted`.
- `releaseWakeLock`: sets `wanted = false` and releases the sentinel.

`chime.ts`:
- A lazy `AudioContext` (`window.AudioContext ?? (window as any).webkitAudioContext`), plus an `enabled` flag.
- `unlockAudio()`: creates the context if absent and calls `resume()`, all in try/catch.
- `playChime()`: if enabled and a context exists, play three short sine beeps (880 Hz, 0.15 s each, 0.1 s gaps) with a gain envelope. Try/catch everything.

Run → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(platform): wake lock and audio chime helpers that fail soft"
```

---

### Task 10: App shell, data hook, Today, and Settings screens

**Files:**
- Create: `src/ui/useAppData.ts`, `src/ui/components/BigButton.tsx`, `src/ui/components/Sheet.tsx`, `src/ui/screens/Today.tsx`, `src/ui/screens/Settings.tsx`
- Modify: `src/ui/App.tsx` (replace the placeholder), `src/styles.css`, `tests/smoke.test.tsx`
- Test: `tests/ui/today.test.tsx`, `tests/ui/settings.test.tsx`

**Interfaces:**
- Consumes: `createStore`, `requestPersistence` (Task 8); stats (Task 5); `plan`.
- Produces:
  - `AppDataContext` / `useAppData()`, returning `{ store, sessions, tests, settings, active, loading, refresh(): Promise<void>, today: string }`
  - Routes:
    - `#/` → Today
    - `#/session/am`, `#/session/pm` → SessionRunner (Task 11)
    - `#/test` → TestRunner (Task 12)
    - `#/progress` → Progress (Task 13)
    - `#/settings` → Settings
    - `#/diagrams` → DiagramsReview
  - `navigate(hash: string)` helper exported from `App.tsx`
  - `<App store?={Store} now?={() => number} />`: injectable for tests; defaults are `createStore()` and `Date.now`

- [ ] **Step 1: Write the failing tests**

`tests/ui/today.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

let i = 0;
const NOW = new Date(2026, 9, 9, 8, 0).getTime();

test('Today shows day number, three cards and test due status', async () => {
  const store = createStore(`ui-${++i}`);
  await store.putTest({ id: 't', date: '2026-10-07', planVersion: 1, startedAt: 0, endedAt: 1, straight: Array(10).fill({ ok: true }) });
  location.hash = '#/';
  render(<App store={store} now={() => NOW} />);
  await waitFor(() => expect(screen.getByText('Day 3 of 30')).toBeInTheDocument());
  expect(screen.getByText('Morning Session')).toBeInTheDocument();
  expect(screen.getByText('Afternoon Session')).toBeInTheDocument();
  expect(screen.getByText('Standard Test')).toBeInTheDocument();
  expect(screen.getByText(/Last test: 2 days ago/)).toBeInTheDocument();
});

test('fresh install shows Day 1 and no backup banner', async () => {
  location.hash = '#/';
  render(<App store={createStore(`ui-${++i}`)} now={() => NOW} />);
  await waitFor(() => expect(screen.getByText('Day 1 of 30')).toBeInTheDocument());
  expect(screen.queryByText(/back up/i)).toBeNull();
});
```

`tests/ui/settings.test.tsx`:
```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

test('import of an invalid file shows an error and keeps data', async () => {
  const store = createStore('ui-settings-1');
  await store.putSession({ id: 's', date: '2026-10-07', sessionId: 'am', planVersion: 1, startedAt: 0, endedAt: 1, activeMinutes: 60, blocks: [] });
  location.hash = '#/settings';
  render(<App store={store} now={() => Date.now()} />);
  const input = await screen.findByLabelText(/import backup/i);
  const file = new File(['{"app":"nope"}'], 'bad.json', { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not a pool-training backup|invalid/i));
  expect(await store.listSessions()).toHaveLength(1);
});
```

Update `tests/smoke.test.tsx` to render `<App store={createStore('smoke')} />` and wait for `Day 1 of 30`.

Run → FAIL.

- [ ] **Step 2: Implement**

`useAppData.ts`:
- A Preact context.
- The provider loads `listSessions`, `listTests`, `getSettings` and `getActive` on mount and exposes `refresh()`.
- On mount, call `requestPersistence()` once.
- `today = localDate(now())`.

`App.tsx`:
- Wraps the app in the provider.
- Reads `location.hash` and listens to `hashchange`.
- Renders the bottom nav (Today · Progress · Settings) on all screens except the runners.
- Until Tasks 11–13 exist, `#/session/*`, `#/test` and `#/progress` render a simple "Coming soon" placeholder component (`<p>Coming soon</p>`). Each later task replaces its placeholder.
- `navigate(hash)` sets `location.hash`.

`Today.tsx`:
- `start = resolveStartDate(settings, sessions, tests) ?? today`. Header: `Day ${dayNumber(today, start)} of 30`, or `Day N` when N > 30.
- Three cards (`<button class="card">`). Status for each:
  - **Done:** a session (or test) recorded today.
  - **In progress:** `active` matches it.
  - **Not started:** otherwise.
- Card titles are exactly `Morning Session`, `Afternoon Session` and `Standard Test`. The session subtitle is the session title from the plan.
- The test card subtitle comes from `testDue`:
  - "No tests yet — due"
  - "Last test: today"
  - "Last test: 1 day ago"
  - "Last test: N days ago" (append " — due" when due)
- Tapping a card navigates to its runner. If `active` exists for a *different* runner, show a confirm sheet: "Another session is in progress. Discard it?" with **Resume it** and **Discard & start**.
- Below the cards: a `<code>` element with `dailySummaryLine(today, sessions, tests)`.
- Backup banner: shown when `(settings.lastExportAt === undefined && distinct record dates ≥ 3) || (settings.lastExportAt && now - lastExportAt > 7 days)`. Text: "Time to back up your training data." with a link to Settings.
- Wake-lock tip: if `!wakeLockSupported()` and `localStorage['wakeTipShown']` is unset (wrap the access in try/catch), show a dismissible tip: "Tip: set Auto-Lock to 'Never' in iOS Settings → Display while training."

`Settings.tsx`:
- **Start date:** `<input type="date">` bound to `settings.startDate`, with Save. Show the resolved Day 1 when no override is set.
- **Sound** toggle: saves `soundOn` and calls `setChimeEnabled`.
- **Export backup:**
  1. `const b = await store.exportBackup(now())`
  2. `Blob` → object URL → `<a download="pool-training-backup-YYYY-MM-DD.json">` click
  3. `refresh()`
  - Show "Last backup: <date>" or "Never".
- **Import backup:** `<label>Import backup<input type="file" accept="application/json,.json" /></label>`. On change:
  1. read the file text
  2. `JSON.parse` in try/catch; a parse error shows "Invalid file: not JSON"
  3. `validateBackup` (catch `BackupError` → show "Invalid file: not a pool-training backup (<reason>)" in `role="alert"`)
  4. confirm sheet: "Replace all current data with this backup (N sessions, M tests)?"
  5. `store.importBackup(data)` → `refresh()` → success message
- **Reset all data:** two-step confirm (button text changes to "Tap again to confirm" for 5 s).
- A link "Review all diagrams" to `#/diagrams`.

Components:
- `BigButton`: a large button with variants `good | bad | neutral`.
- `Sheet`: a bottom sheet modal with `role="dialog"` and a backdrop.

Add CSS for:
- `.card`: full width, surface background, 16px padding, status pill on the right
- `.nav`: fixed bottom bar with 3 equal buttons
- `.banner`: accent border
- `.sheet`

Run: `npx vitest --run` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(ui): app shell, data context, Today and Settings screens"
```

---

### Task 11: Session Runner screen with quick-entry sheets

**Files:**
- Create: `src/ui/screens/SessionRunner.tsx`, `src/ui/components/Timer.tsx`, `src/ui/components/TagPicker.tsx`, `src/ui/components/EntrySheet.tsx`
- Modify: `src/ui/App.tsx` (route), `src/styles.css`
- Test: `tests/ui/sessionRunner.test.tsx`

**Interfaces:**
- Consumes:
  - the session runner (Task 6)
  - `DiagramCard` (Task 4)
  - `getSession`, `getDrillRef`, `plan` (Task 2)
  - `useAppData` (Task 10)
  - `acquireWakeLock`, `releaseWakeLock`, `unlockAudio`, `playChime` (Task 9)
- Produces:
  - `<SessionRunner sessionId />`
  - `<TagPicker onPick={(t: ErrorCodeId | null) => void} />`, reused in Task 12
  - `<EntrySheet kind record onSubmit onSkip />`

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

let t = new Date(2026, 9, 7, 9, 0).getTime();
const now = () => t;
let n = 0;

async function open(sessionHash: string) {
  const store = createStore(`sr-${++n}`);
  location.hash = sessionHash;
  render(<App store={store} now={now} />);
  return store;
}

test('shows first block with diagram, instructions and countdown', async () => {
  await open('#/session/am');
  fireEvent.click(await screen.findByRole('button', { name: /start/i }));
  expect(screen.getByText('Straight-ball warm-up')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /open diagram/i })).toBeInTheDocument();
  expect(screen.getByText('10:00')).toBeInTheDocument();
  expect(screen.getByText(/Do sets of 5/)).toBeInTheDocument();
});

test('does not auto-advance at zero; shows overtime', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  await open('#/session/am');
  fireEvent.click(await screen.findByRole('button', { name: /start/i }));
  t += 11 * 60000;
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(screen.getByText('+1:00')).toBeInTheDocument();
  expect(screen.getByText('Straight-ball warm-up')).toBeInTheDocument();
  vi.useRealTimers();
});

test('draw ladder entry rejects invalid input and saves valid input; finishing saves session', async () => {
  const store = await open('#/session/am');
  fireEvent.click(await screen.findByRole('button', { name: /start/i }));
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // warm-up (no record)
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // stop ladder → optional sheet
  fireEvent.click(await screen.findByRole('button', { name: /skip/i }));
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // draw ladder → sheet
  fireEvent.input(await screen.findByLabelText(/best/i), { target: { value: '-2' } });
  fireEvent.input(screen.getByLabelText(/typical/i), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fireEvent.input(screen.getByLabelText(/best/i), { target: { value: '16' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // follow → optional sheet
  fireEvent.click(await screen.findByRole('button', { name: /skip/i }));
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // precision (last)
  fireEvent.click(await screen.findByRole('button', { name: /finish/i }));
  await waitFor(async () => expect(await store.listSessions()).toHaveLength(1));
  const [s] = await store.listSessions();
  expect(s.blocks.find((b) => b.blockId === 'am-draw-ladder')?.draw).toEqual({ bestIn: 16, typicalIn: 10 });
  expect(await store.getActive()).toBeUndefined();
});

test('resumes active session from store after reload', async () => {
  const store = createStore(`sr-${++n}`);
  await store.setActive({ type: 'session', updatedAt: t, payload: {
    kind: 'session', sessionId: 'pm', startedAt: t, blockIndex: 2, blockStartedAt: t, pausedAt: null,
    pausedTotalMs: 0, sessionPausedMs: 0, extraMs: 0, results: {}, finished: false } });
  location.hash = '#/session/pm';
  render(<App store={store} now={now} />);
  expect(await screen.findByText('3-ball pattern drill')).toBeInTheDocument();
});
```

Run → FAIL.

- [ ] **Step 2: Implement**

`SessionRunner.tsx`:
- **On mount:** if `active?.type === 'session'` and `payload.sessionId === sessionId`, restore it. Wrap the restore in try/catch; corrupt state → `setActive(undefined)` and a toast "Previous session couldn't be restored". Otherwise show a **pre-start screen** with:
  - the session title
  - the plan intro "Training vs testing" note, collapsed
  - the block list with minutes
  - a big **Start** button
- **Start:**
  1. `unlockAudio()`
  2. `acquireWakeLock()`
  3. `startSession(sessionId, now())`
  4. persist
- **Persist after every state change:** `store.setActive({ type: 'session', payload: state, updatedAt: now() })`.
- **Tick:** `setInterval(1000)` re-renders, using `now()` for `remainingMs`. When remaining crosses from > 0 to ≤ 0, call `playChime()` once per block (track with a ref keyed by `blockIndex`).
- **Layout, top to bottom:**
  1. `DiagramCard` for `block.diagramId`
  2. a row with `timeLabel` · "Block i/N"
  3. `<h2>{block.name}</h2>`
  4. `<Timer ms={remainingMs(...)} />` — large tabular-nums, 64px font; red and flashing (CSS animation) when ≤ 0; text from `formatClock`
  5. a definition list: Setup, Training Volume, How to Train, Success Standard, Purpose
  6. `<details>` "Drill reference" with the `DrillRef` fields, when the block has one
  7. a sticky bottom control bar: **Back** (disabled on the first block), **Pause/Resume**, **+2 min**, **Next** (always labelled "Next", including on the last block; it leads to the summary)
- **Next:**
  - If `block.record === 'no'`, call `next(...)` directly.
  - Otherwise open `<EntrySheet>` for `block.recordKind`.
    - **Save** → `validateEntry`. If invalid, show the error in `role="alert"` and stay open. If valid → `next(state, blocks, now(), entry)`.
    - **Skip** (shown for `optional` and `yes`) → `next(state, blocks, now(), { skipped: true })`.
  - When `next` returns `finished`, show the summary screen.
- **EntrySheet fields:**
  - `draw`: two `inputmode="decimal"` inputs labelled "Best draw (in)" and "Typical draw (in)"
  - `runs`: steppers (− / value / +) for "Successful runs" and "Layouts attempted", plus failure tags — a tag row where each tap appends P/C/S/D, with chips shown and removable. Serialize to a `failTags` CSV for `validateEntry`.
  - `generic`: steppers for "Made" and "Attempts"
  - `notes`: a textarea labelled "Notes"
  - Pre-fill the sheet from `state.results[block.id]` when revisiting via Back.
- **Summary screen:**
  - active minutes so far
  - each recorded block's values
  - a **Finish** button: `store.putSession(toRecord(state, blocks, plan.version, now()))` → `setActive(undefined)` → `releaseWakeLock()` → `refresh()` → `navigate('#/')`
  - a **Back** button that returns to the last block
- **Leave (×) in the header:** navigates to Today and keeps the active state, so it can be resumed.
- **TagPicker:** four big buttons — P Potting, C Cue-ball, S Spin/Speed, D Decision — plus "No tag". Calls `onPick`.

Run: `npx vitest --run` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(ui): session runner with diagrams, timer, quick-entry sheets, resume"
```

---

### Task 12: Test Runner screen

**Files:**
- Create: `src/ui/screens/TestRunner.tsx`
- Modify: `src/ui/App.tsx` (route), `src/styles.css`
- Test: `tests/ui/testRunner.test.tsx`

**Interfaces:**
- Consumes: the test runner (Task 7), `TagPicker` (Task 11), `DiagramCard` (Task 4), `getTestDef`, `TEST_ORDER`, `plan`, `useAppData`, `testScores` (Task 5).
- Produces: `<TestRunner />`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

let n = 0;
const now = () => new Date(2026, 9, 7, 18, 0).getTime();
async function openTest() {
  const store = createStore(`tr-${++n}`);
  location.hash = '#/test';
  render(<App store={store} now={now} />);
  fireEvent.click(await screen.findByRole('button', { name: /start test/i }));
  return store;
}

test('straight test: makes, miss with optional tag, progress and cap at 10', async () => {
  await openTest();
  expect(screen.getByText('Long straight pot')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /open diagram/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^make$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^miss$/i }));
  fireEvent.click(screen.getByRole('button', { name: /no tag/i }));        // tag optional
  expect(screen.getByText('2 of 10')).toBeInTheDocument();
  for (let i = 0; i < 12; i++) fireEvent.click(screen.getByRole('button', { name: /^make$/i }));
  expect(screen.getByText('10 of 10')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^make$/i })).toBeDisabled();
});

test('full test with skips saves a record', async () => {
  const store = await openTest();
  for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: /^make$/i }));
  fireEvent.click(screen.getByRole('button', { name: /next test/i }));
  expect(screen.getByText(/Cutting LEFT/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /skip test/i }));    // cut
  fireEvent.click(screen.getByRole('button', { name: /skip test/i }));    // stop
  for (const [i, v] of ['12', '10', '14', '8', '11'].entries())
    fireEvent.input(screen.getByLabelText(`Draw ${i + 1} (in)`), { target: { value: v } });
  expect(screen.getByText(/Average: 11"/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next test/i }));
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /^cleared$/i }));
  for (let i = 0; i < 2; i++) { fireEvent.click(screen.getByRole('button', { name: /^failed$/i })); fireEvent.click(screen.getByRole('button', { name: /^C/ })); }
  fireEvent.click(screen.getByRole('button', { name: /finish test/i }));
  fireEvent.click(await screen.findByRole('button', { name: /save/i }));
  await waitFor(async () => expect(await store.listTests()).toHaveLength(1));
  const [r] = await store.listTests();
  expect(r.straight).toHaveLength(10);
  expect(r.cut).toBeUndefined();
  expect(r.draw).toEqual([12, 10, 14, 8, 11]);
  expect(r.fiveBall?.filter((s) => s.tag === 'C')).toHaveLength(2);
});
```

Run → FAIL.

- [ ] **Step 2: Implement `TestRunner.tsx`**

- **Pre-start screen:**
  - title "Standard Skill Test — 20–25 minutes"
  - the Standard Test sheet intro line ("Use the same ball positions, normal pockets, same cue ball… Do not add extra attempts to the score.")
  - a list of the 5 tests
  - a **Start test** button (calls `unlockAudio`, `acquireWakeLock`, `startTest(now())`, persists)
- Restore from `active` when `type === 'test'`, with the same corrupt-state handling as Task 11.
- Persist to `kv.active` after every change.
- **Per test, top to bottom:**
  1. `DiagramCard`
  2. `<h2>` with the test name
  3. setup text
  4. reminder chip: "Normal pockets · Same setup · No extra attempts"
  5. progress "k of N"
- **Inputs by test kind:**
  - `makeMiss` (straight; stop uses Success/Fail labels): two huge buttons, **Make** (good) and **Miss** (bad), side by side, ≥ 96px tall. They are disabled when the test is full. A Miss / Fail / Failed tap opens `TagPicker` in a `Sheet`; picking calls `tagLast`, and "No tag" just closes it. Under the buttons, a dot row shows each shot (green, or red with its tag letter).
  - `makeMissLR` (cut): same as above, plus a large banner showing `Cutting LEFT` or `Cutting RIGHT` (from `nextCutSide`).
  - `distances` (draw): five inputs labelled `Draw 1 (in)` … `Draw 5 (in)`, `inputmode="decimal"`, calling `setDraw` (an invalid value leaves the field marked invalid and stores `null`), plus a live `Average: X"` (rounded to 0.1, trailing `.0` dropped).
  - `runs` (5-ball): **Cleared** / **Failed** buttons; Failed opens `TagPicker`.
- **Bottom bar:**
  - **Undo last**
  - **Skip test**
  - **Next test**, enabled when the current test is complete; on the last test it becomes **Finish test**
  - an "End test" option is available any time, showing the summary with incomplete tests marked "not counted"
- **Summary:**
  - each test's score from `testScores(toTestRecord(...))`, showing "–" for skipped or incomplete tests
  - the P/C/S/D counts for this test
  - **Save**: `putTest` → `setActive(undefined)` → `releaseWakeLock()` → `refresh()` → navigate to `#/`
  - **Discard** (confirm)
- **TagPicker button names** start with the code letter (`C Cue-ball`) so the test's `/^C/` query matches.

Run: `npx vitest --run` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(ui): standard test runner with shot-by-shot scoring and optional tags"
```

---

### Task 13: Progress screen with charts

**Files:**
- Create: `src/ui/screens/Progress.tsx`, `src/ui/components/LineChart.tsx`, `src/ui/components/BarChart.tsx`
- Modify: `src/ui/App.tsx` (route), `src/styles.css`
- Test: `tests/ui/progress.test.tsx`

**Interfaces:**
- Consumes: `weeklySummary`, `testScores`, `errorTotals`, `focusSuggestion`, `streak`, `minutesByDay`, `trainingRecords`, `resolveStartDate`, `dayNumber`, `addDays` (Task 5); `useAppData`.
- Produces:
  - `<Progress />`
  - `<LineChart labels series yMax? />`, where `series: { label: string; data: (number|null)[]; color: string }[]`
  - `<BarChart labels series stacked? />`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

vi.mock('../../src/ui/components/LineChart', () => ({ LineChart: (p: { title?: string }) => <div data-testid="line-chart">{p.title}</div> }));
vi.mock('../../src/ui/components/BarChart', () => ({ BarChart: (p: { title?: string }) => <div data-testid="bar-chart">{p.title}</div> }));

test('progress shows weekly table, error totals, focus and streak', async () => {
  const store = createStore('prog-1');
  const miss = (tag: 'C') => ({ ok: false, tag });
  await store.saveSettings({ soundOn: true, startDate: '2026-10-01' });
  await store.putTest({ id: 't1', date: '2026-10-06', planVersion: 1, startedAt: 0, endedAt: 1,
    straight: [...Array(7).fill({ ok: true }), ...Array(3).fill(miss('C'))],
    stop: [...Array(2).fill({ ok: true }), ...Array(8).fill(miss('C'))] });
  await store.putSession({ id: 's1', date: '2026-10-07', sessionId: 'am', planVersion: 1, startedAt: 0, endedAt: 1, activeMinutes: 58, blocks: [] });
  location.hash = '#/progress';
  render(<App store={store} now={() => new Date(2026, 9, 7, 20).getTime()} />);
  await waitFor(() => expect(screen.getByText('Week 1')).toBeInTheDocument());
  expect(screen.getByRole('row', { name: /Straight \/10/ })).toHaveTextContent('7');
  expect(screen.getByText(/C — Cue-ball/)).toBeInTheDocument();
  expect(screen.getByText(/Cue-ball position errors lead/)).toBeInTheDocument();
  expect(screen.getByText(/Streak: 1 day/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /all time/i }));
  expect(screen.getAllByTestId('line-chart').length).toBeGreaterThan(0);
});
```

Run → FAIL.

- [ ] **Step 2: Implement**

`LineChart.tsx` / `BarChart.tsx`:
- Register only the needed Chart.js parts: `Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, BarController, BarElement, Legend, Tooltip, Filler)`.
- Create the chart in `useEffect` on a `<canvas>` ref and destroy it on unmount or when props change.
- Dark-theme defaults: tick colour `#9fb3a9`, grid `rgba(255,255,255,0.06)`.
- Spread line charts with `spanGaps: true`.
- Optional `title` prop rendered as `<h3>` above the canvas.

`Progress.tsx`:
- **Range toggle** (two buttons): **30-day plan** (default; dates from `start` to `start+29`) and **All time**.
- **Section 1 — Test scores:**
  - Five `LineChart`s, x = test dates and y = the score:
    - Straight (yMax 10)
    - Cut (yMax 20), with three series: Total, Left, Right (Left and Right shown on a secondary 0–10 scale is unnecessary; plot all three on 0–20)
    - Stop (yMax 10)
    - Draw avg (in)
    - 5-ball (yMax 5)
  - Then a `<table>`:
    - Header row: `Metric | Week 1 | Week 2 | Week 3 | Week 4 | 30-Day Best | 30-Day Avg`
    - Rows: `Straight /10`, `Cut /20`, `Stop /10`, `Draw @24" (in)`, `5-Ball /5`
    - Values from `weeklySummary(tests, start)`, formatted to 1 decimal with trailing `.0` dropped; null → "–"
- **Section 2 — Errors:**
  - Totals list in the form `P — Potting: n`, `C — Cue-ball: n`, `S — Spin/Speed: n`, `D — Decision: n`, using `errorTotals` over the range
  - A stacked `BarChart` of weekly P/C/S/D counts, one bar per 7-day bucket from `start`
  - A focus card: `focusSuggestion(sessions, tests, today)`. Show its advice and block names, or "Not enough tagged errors in the last 7 days for a suggestion (need 10)."
- **Section 3 — Consistency:**
  - `Streak: N day(s)`
  - A calendar grid of 30 cells (or every day in All time), seven columns, with day numbers. Each cell shows three small marks: AM, PM and T, filled when done that day.
  - A `BarChart` of minutes per day
- **Section 4 — Training records:**
  - `LineChart` of draw best and typical by date
  - `LineChart` of 3-ball and 5-ball success rate (%) by date
- Empty state for each section: "No data yet."

Run: `npx vitest --run` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(ui): progress screen with test charts, weekly table, errors, consistency, training records"
```

---

### Task 14: PWA, icons, and GitHub Pages deployment

**Files:**
- Create: `scripts/make_icons.py`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png`, `.github/workflows/deploy.yml`, `README.md`
- Modify: `vite.config.ts`, `index.html`
- Test: `tests/pwa.test.ts`

**Interfaces:**
- Produces: a production build with `manifest.webmanifest` and a service worker that precaches all assets; CI that deploys to Pages.

- [ ] **Step 1: Icons**

`scripts/make_icons.py` (Pillow):
- Draw a felt-green rounded square (`#0e5a3f`) with a dark wood border.
- Add a white cue ball at the lower-left, a yellow 1-ball at the upper-right, and a dashed aim line between them.
- Export 512, 192 and 180 (`apple-touch-icon.png`) into `public/icons/`.

Run it with:
```bash
/Users/leon/Documents/work/Virtual_Env/venv_3.13_general/bin/python scripts/make_icons.py
```

- [ ] **Step 2: PWA config**

`vite.config.ts`: add
```ts
import { VitePWA } from 'vite-plugin-pwa';
// plugins: [preact(), VitePWA({ ... })]
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['icons/apple-touch-icon.png'],
  manifest: {
    name: 'Pool Training',
    short_name: 'Pool',
    description: 'Daily 2-hour pool training guide, standard test and progress log.',
    theme_color: '#0e3b2e',
    background_color: '#0b1512',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/pool-training/',
    scope: '/pool-training/',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  },
  workbox: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'] },
})
```

`index.html`: add `<link rel="apple-touch-icon" href="/pool-training/icons/apple-touch-icon.png" />`. Use `%BASE_URL%icons/apple-touch-icon.png` if Vite supports it in this version; otherwise use the literal path.

- [ ] **Step 3: Build test**

`tests/pwa.test.ts`:
```ts
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

test('production build emits manifest and service worker under /pool-training/', () => {
  execSync('npx vite build', { stdio: 'pipe' });
  expect(existsSync('dist/sw.js')).toBe(true);
  const m = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
  expect(m.start_url).toBe('/pool-training/');
  expect(readFileSync('dist/index.html', 'utf8')).toContain('/pool-training/assets/');
}, 120000);
```

Run → PASS.

- [ ] **Step 4: GitHub Actions**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx vitest --run
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: README**

Cover:
- what the app is
- `npm install`, `npm run dev`, `npm test`
- how to edit the plan (`src/plan/plan.json`) and diagrams (`src/diagram/diagrams.ts`)
- the table measurement constant in `src/diagram/table.ts`
- how to install on iPhone: open the URL in Safari → Share → Add to Home Screen
- the backup advice

- [ ] **Step 6: Run everything, then commit**

Run: `npx vitest --run && npx tsc --noEmit && npm run build` → all pass.

```bash
git add -A && git commit -m "feat(pwa): installable offline PWA, icons, GitHub Pages deploy workflow"
```

---

## Post-implementation (controller)

1. Run the whole-branch review.
2. Create the GitHub repo `pool-training` and push. Enable Pages with the source set to "GitHub Actions" (`gh api -X POST repos/{owner}/pool-training/pages -f build_type=workflow`).
3. Verify the deployed URL loads.
4. Smoke-test locally in a browser: `npm run preview`, then click through Today → Session → Test → Progress → Settings → Diagrams.
