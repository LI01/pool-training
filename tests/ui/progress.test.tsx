import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

vi.mock('../../src/ui/components/LineChart', () => ({ LineChart: (p: { title?: string }) => <div data-testid="line-chart">{p.title}</div> }));
vi.mock('../../src/ui/components/BarChart', () => ({ BarChart: (p: { title?: string }) => <div data-testid="bar-chart">{p.title}</div> }));

test('progress shows weekly table and streak, and no error statistics', async () => {
  const store = createStore('prog-1');
  const miss = (tag: 'C') => ({ ok: false, tag });
  await store.putTest({ id: 't1', date: '2026-10-06', planVersion: 1, startedAt: 0, endedAt: 1,
    straight: [...Array(7).fill({ ok: true }), ...Array(3).fill(miss('C'))],
    stop: [...Array(2).fill({ ok: true }), ...Array(8).fill(miss('C'))] });
  await store.putSession({ id: 's1', date: '2026-10-06', sessionId: 'day', dayNumber: 1, planVersion: 2, startedAt: 0, endedAt: 1, activeMinutes: 58, blocks: [] });
  await store.putSession({ id: 's2', date: '2026-10-07', sessionId: 'day', dayNumber: 2, planVersion: 2, startedAt: 0, endedAt: 1, activeMinutes: 70, blocks: [] });
  location.hash = '#/progress';
  render(<App store={store} now={() => new Date(2026, 9, 7, 20).getTime()} />);
  await waitFor(() => expect(screen.getByText('Week 1')).toBeInTheDocument());
  expect(screen.getByRole('row', { name: /Straight \/10/ })).toHaveTextContent('7');
  expect(screen.queryByRole('heading', { name: /errors|focus/i })).toBeNull();   // tags saved by older versions are ignored
  expect(screen.getByText(/Streak: 2 days/)).toBeInTheDocument();
  expect(screen.getByText('Week 8')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /all time/i }));
  expect(screen.getAllByTestId('line-chart').length).toBeGreaterThan(0);
});
