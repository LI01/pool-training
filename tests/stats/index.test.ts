import {
  nextPlanDay, planWeekAt, testScores, weeklySummary,
  streak, minutesByDay, testDue, dailySummaryLine, trainingRecords,
} from '../../src/stats';
import type { SessionRecord, TestRecord, Shot } from '../../src/db/types';

const shots = (made: number, total: number): Shot[] =>
  Array.from({ length: total }, (_, i) => ({ ok: i < made }));
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

const day = (date: string, n: number, endedAt = 0) => sess(date, { sessionId: 'day', dayNumber: n, endedAt });

test('nextPlanDay follows finished days, not the calendar; repeats do not move it back', () => {
  const S = { soundOn: true };
  expect(nextPlanDay([], S)).toBe(1);
  expect(nextPlanDay([day('2026-10-01', 1), day('2026-10-05', 2)], S)).toBe(3); // days missed in between are not skipped
  expect(nextPlanDay([day('2026-10-01', 1), day('2026-10-02', 2), day('2026-10-03', 1)], S)).toBe(3);
  expect(nextPlanDay([sess('2026-10-01')], S)).toBe(1); // old AM/PM records do not count
  expect(nextPlanDay([day('2026-10-01', 48)], S)).toBe(49); // complete
});

test('progress set in Settings wins over days finished before it', () => {
  const sessions = [day('2026-10-01', 10, 100), day('2026-10-02', 11, 200)];
  expect(nextPlanDay(sessions, { soundOn: true, planDay: 1, planDaySetAt: 300 })).toBe(1);
  expect(nextPlanDay([...sessions, day('2026-10-03', 1, 400)], { soundOn: true, planDay: 1, planDaySetAt: 300 })).toBe(2);
  expect(nextPlanDay(sessions, { soundOn: true, planDay: 20, planDaySetAt: 300 })).toBe(20);
});

test('planWeekAt is the week of the furthest day trained by that date', () => {
  const sessions = [day('2026-10-01', 1), day('2026-10-08', 6), day('2026-10-09', 7)];
  expect(planWeekAt('2026-09-30', sessions)).toBe(1);
  expect(planWeekAt('2026-10-08', sessions)).toBe(1);
  expect(planWeekAt('2026-10-09', sessions)).toBe(2);
});

test('testScores derives all metrics; skipped tests undefined', () => {
  const s = testScores(test_('2026-10-07', { straight: shots(7, 10), cut: cutShots(6, 8), draw: [11, 14, 12, 9, 14] }));
  expect(s).toEqual({ straight: 7, cutL: 6, cutR: 8, cut: 14, stop: undefined, drawAvg: 12, fiveBall: undefined });
});

test('weeklySummary averages per plan week, ignores missing and tests before the plan started', () => {
  const sessions = [day('2026-10-07', 1), day('2026-10-14', 7)];
  const tests = [
    test_('2026-10-01', { straight: shots(10, 10) }), // before the plan started
    test_('2026-10-07', { straight: shots(6, 10) }),
    test_('2026-10-09', { straight: shots(8, 10), draw: [10, 10, 10, 10, 10] }),
    test_('2026-10-15', { straight: shots(9, 10) }),
  ];
  const w = weeklySummary(tests, sessions, 4);
  expect(w.straight.weeks).toEqual([7, 9, null, null]);
  expect(w.straight.best).toBe(9);
  expect(w.straight.avg).toBeCloseTo(23 / 3);
  expect(w.drawAvg.weeks).toEqual([10, null, null, null]);
  expect(w.stop).toEqual({ weeks: [null, null, null, null], best: null, avg: null });
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

test('testDue once a week or when never tested', () => {
  expect(testDue([], '2026-10-07')).toEqual({ daysSinceLast: null, due: true });
  expect(testDue([test_('2026-10-01')], '2026-10-07')).toEqual({ daysSinceLast: 6, due: false });
  expect(testDue([test_('2026-09-30')], '2026-10-07')).toEqual({ daysSinceLast: 7, due: true });
});

test('dailySummaryLine uses the latest test of the day', () => {
  const tests = [
    test_('2026-10-07', { straight: shots(5, 10), endedAt: 1 }),
    test_('2026-10-07', { straight: shots(7, 10), cut: cutShots(7, 7), stop: shots(8, 10), draw: [12, 12, 12, 12, 12], fiveBall: shots(3, 5), endedAt: 2 }),
  ];
  expect(dailySummaryLine('2026-10-07', tests)).toBe('Straight 7/10 | Cut 14/20 | Stop 8/10 | Draw 12" | 5-ball 3/5');
  expect(dailySummaryLine('2026-10-08', tests)).toBe('Straight – | Cut – | Stop – | Draw – | 5-ball –');
});

test('trainingRecords aggregates draw/3-ball/5-ball per day', () => {
  const s = [sess('2026-10-07', { blocks: [
    { blockId: 'am-draw-ladder', startedAt: 0, draw: { bestIn: 18, typicalIn: 10 } },
    { blockId: 'pm-3ball', startedAt: 0, runs: { success: 4, attempts: 8, failTags: [] } },
    { blockId: 'pm-5ball', startedAt: 0, skipped: true },
  ] })];
  expect(trainingRecords(s)).toEqual([{ date: '2026-10-07', drawBest: 18, drawTypical: 10, threeBallRate: 0.5, fiveBallRate: undefined }]);
});
