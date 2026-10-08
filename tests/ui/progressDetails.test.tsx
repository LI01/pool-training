import { render, screen, waitFor, fireEvent, within } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';
import type { SessionRecord, TestRecord } from '../../src/db/types';

vi.mock('../../src/ui/components/LineChart', () => ({ LineChart: () => <div data-testid="line-chart" /> }));
vi.mock('../../src/ui/components/BarChart', () => ({ BarChart: () => <div data-testid="bar-chart" /> }));

const NOW = () => new Date(2026, 9, 7, 20).getTime();
const sess = (id: string, date: string): SessionRecord => ({
  id, date, sessionId: 'am', planVersion: 1, startedAt: 0, endedAt: 1, activeMinutes: 30, blocks: [],
});
const shots = (ok: number, n: number) => Array.from({ length: n }, (_, i) => ({ ok: i < ok }));
const mkTest = (id: string, date: string, straight: number, stop: number): TestRecord => ({
  id, date, planVersion: 1, startedAt: 0, endedAt: 1, straight: shots(straight, 10), stop: shots(stop, 10),
});

async function open(name: string, sessions: SessionRecord[], tests: TestRecord[]) {
  const store = createStore(name);
  await store.saveSettings({ soundOn: true, startDate: '2026-10-01' });
  for (const s of sessions) await store.putSession(s);
  for (const t of tests) await store.putTest(t);
  location.hash = '#/progress';
  render(<App store={store} now={NOW} />);
  await waitFor(() => expect(screen.getByText('Week 1')).toBeInTheDocument());
}
const cells = () => document.querySelectorAll('.cal__cell').length;

test('range toggle excludes records outside days 1-30 in plan mode and includes them in all time', async () => {
  await open('prog-range', [
    sess('before', '2026-09-28'), sess('in', '2026-10-03'), sess('after', '2026-11-05'),
    sess('y', '2026-10-06'), sess('t', '2026-10-07'),
  ], []);
  expect(cells()).toBe(30);
  fireEvent.click(screen.getByRole('button', { name: /all time/i }));
  expect(cells()).toBe(39); // 2026-09-28 .. 2026-11-05
  expect(screen.getByText('9/28')).toBeInTheDocument(); // pre-start days show a date, not day 0 or negative
});

test('weekly table formats nulls, whole averages and one decimal; streak is plural', async () => {
  await open('prog-fmt', [sess('y', '2026-10-06'), sess('t', '2026-10-07')], [
    mkTest('a', '2026-10-02', 7, 7), mkTest('b', '2026-10-03', 7, 8), mkTest('c', '2026-10-04', 7, 8),
  ]);
  const straight = within(screen.getByRole('row', { name: /Straight \/10/ })).getAllByRole('cell').map((c) => c.textContent);
  expect(straight).toEqual(['7', '–', '–', '–', '7', '7']);
  const stop = within(screen.getByRole('row', { name: /Stop \/10/ })).getAllByRole('cell').map((c) => c.textContent);
  expect(stop).toEqual(['7.7', '–', '–', '–', '8', '7.7']);
  const draw = within(screen.getByRole('row', { name: /Draw/ })).getAllByRole('cell').map((c) => c.textContent);
  expect(draw.every((t) => t === '–')).toBe(true);
  expect(screen.getByText('Streak: 2 days')).toBeInTheDocument();
});
