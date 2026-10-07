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
