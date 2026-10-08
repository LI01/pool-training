import { startTest, currentTest, recordShot, undo, setDraw, isComplete, nextCutSide, skip, advance, toTestRecord } from '../../src/runner/test';

const T0 = new Date(2026, 9, 7, 18, 0).getTime();
const rep = <T,>(s: T, n: number, f: (s: T) => T) => { for (let i = 0; i < n; i++) s = f(s); return s; };

test('starts on straight', () => expect(currentTest(startTest(T0))).toBe('straight'));

test('extra taps after the test is full are ignored', () => {
  let s = rep(startTest(T0), 12, (x) => recordShot(x, true));
  expect(s.shots.straight).toHaveLength(10);
  expect(isComplete(s, 'straight')).toBe(true);
});

test('a miss records no reason; undo removes last shot', () => {
  let s = recordShot(recordShot(startTest(T0), true), false);
  expect(s.shots.straight[1]).toEqual({ ok: false });
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

test('every action is a no-op once all tests are done', () => {
  const s = { ...startTest(T0), index: 5 };
  expect(currentTest(s)).toBeNull();
  expect(recordShot(s, true)).toBe(s);
  expect(recordShot(s, false)).toEqual(s);
  expect(undo(s)).toEqual(s);
  expect(skip(s)).toEqual(s);
  expect(advance(s)).toEqual(s);
});
