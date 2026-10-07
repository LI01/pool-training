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
