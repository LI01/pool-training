import { render, screen, waitFor, fireEvent, within } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';
import type { SessionRecord, TestRecord } from '../../src/db/types';

vi.mock('../../src/ui/components/LineChart', () => ({ LineChart: () => <div data-testid="line-chart" /> }));
vi.mock('../../src/ui/components/BarChart', () => ({ BarChart: () => <div data-testid="bar-chart" /> }));

const NOW = () => new Date(2026, 9, 7, 20).getTime();
const sess = (id: string, date: string, dayNumber?: number): SessionRecord => ({
  id, date, sessionId: dayNumber ? 'day' : 'am', dayNumber, planVersion: 2, startedAt: 0, endedAt: 1, activeMinutes: 30, blocks: [],
});
const shots = (ok: number, n: number) => Array.from({ length: n }, (_, i) => ({ ok: i < ok }));
const mkTest = (id: string, date: string, straight: number, stop: number): TestRecord => ({
  id, date, planVersion: 1, startedAt: 0, endedAt: 1, straight: shots(straight, 10), stop: shots(stop, 10),
});

async function open(name: string, sessions: SessionRecord[], tests: TestRecord[]) {
  const store = createStore(name);
  for (const s of sessions) await store.putSession(s);
  for (const t of tests) await store.putTest(t);
  location.hash = '#/progress';
  render(<App store={store} now={NOW} />);
  await waitFor(() => expect(screen.getByText('Week 1')).toBeInTheDocument());
}
const cells = () => document.querySelectorAll('.cal__cell').length;

test('the plan range starts at the first plan day; all time includes older records', async () => {
  await open('prog-range', [
    sess('before', '2026-09-28'), sess('in', '2026-10-03', 1), sess('after', '2026-11-05', 2),
    sess('y', '2026-10-06', 2), sess('t', '2026-10-07', 3),
  ], []);
  expect(cells()).toBe(34); // 2026-10-03 .. 2026-11-05
  expect(document.querySelector('.cal__day')).toHaveTextContent('1'); // a trained day shows its plan day
  fireEvent.click(screen.getByRole('button', { name: /all time/i }));
  expect(cells()).toBe(39); // 2026-09-28 .. 2026-11-05
  expect(screen.getByText('9/28')).toBeInTheDocument(); // pre-start days show a date, not day 0 or negative
});

test('weekly table formats nulls, whole averages and one decimal; streak is plural', async () => {
  await open('prog-fmt', [sess('s', '2026-10-01', 1), sess('y', '2026-10-06', 2), sess('t', '2026-10-07', 3)], [
    mkTest('a', '2026-10-02', 7, 7), mkTest('b', '2026-10-03', 7, 8), mkTest('c', '2026-10-04', 7, 8),
  ]);
  const straight = within(screen.getByRole('row', { name: /Straight \/10/ })).getAllByRole('cell').map((c) => c.textContent);
  expect(straight).toEqual(['7', '–', '–', '–', '–', '–', '–', '–', '7', '7']);
  const stop = within(screen.getByRole('row', { name: /Stop \/10/ })).getAllByRole('cell').map((c) => c.textContent);
  expect(stop).toEqual(['7.7', '–', '–', '–', '–', '–', '–', '–', '8', '7.7']);
  const draw = within(screen.getByRole('row', { name: /Draw/ })).getAllByRole('cell').map((c) => c.textContent);
  expect(draw.every((t) => t === '–')).toBe(true);
  expect(screen.getByText('Streak: 2 days')).toBeInTheDocument();
});
