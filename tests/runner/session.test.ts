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
