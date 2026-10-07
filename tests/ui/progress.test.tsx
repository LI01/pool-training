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
