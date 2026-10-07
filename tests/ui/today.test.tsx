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
