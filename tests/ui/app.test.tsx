import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

let n = 0;
const NOW = new Date(2026, 9, 7, 9, 0).getTime();

test.each(['#/session/am', '#/day/0', '#/day/49', '#/nope', '#/testx'])('unknown route %s redirects to Today', async (hash) => {
  location.hash = hash;
  render(<App store={createStore(`app-${++n}`)} now={() => NOW} />);
  expect(await screen.findByText('Day 1 of 48')).toBeInTheDocument();
  await waitFor(() => expect(location.hash).toBe('#/'));
  expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
});

test('a failed first load shows an error with Retry, and Retry loads the app', async () => {
  const base = createStore(`app-${++n}`);
  let fail = true;
  const store = { ...base, listSessions: vi.fn(() => (fail ? Promise.reject(new Error('IDB blocked')) : base.listSessions())) };
  location.hash = '#/';
  render(<App store={store} now={() => NOW} />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load your data/i);
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Day 1 of 48')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});
