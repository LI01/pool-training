import { render, screen, waitFor, fireEvent, within } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';
import type { SessionRecord } from '../../src/db/types';

let i = 0;
const NOW = new Date(2026, 9, 9, 8, 0).getTime();
const DAY = 24 * 3600 * 1000;
const sess = (id: string, date: string, sessionId: 'am' | 'pm' = 'am'): SessionRecord =>
  ({ id, date, sessionId, planVersion: 1, startedAt: 0, endedAt: 1, activeMinutes: 60, blocks: [] });
const pillOf = (title: string) => within(screen.getByText(title).closest('button')!);

beforeEach(() => { location.hash = '#/'; });

test('status pills: Done for a session recorded today, In progress for active, else Not started', async () => {
  const store = createStore(`today-${++i}`);
  await store.putSession(sess('a', '2026-10-09', 'am'));
  await store.setActive({ type: 'session', payload: { sessionId: 'pm' }, updatedAt: 1 });
  render(<App store={store} now={() => NOW} />);
  await waitFor(() => expect(screen.getByText('Day 1 of 30')).toBeInTheDocument());
  expect(pillOf('Morning Session').getByText('Done')).toBeInTheDocument();
  expect(pillOf('Afternoon Session').getByText('In progress')).toBeInTheDocument();
  expect(pillOf('Standard Test').getByText('Not started')).toBeInTheDocument();
});

test('backup banner: shown when never exported with 3+ dates', async () => {
  const store = createStore(`today-${++i}`);
  for (const [n, d] of [['a', '2026-10-05'], ['b', '2026-10-06'], ['c', '2026-10-07']]) await store.putSession(sess(n, d));
  render(<App store={store} now={() => NOW} />);
  expect(await screen.findByText('Time to back up your training data.')).toBeInTheDocument();
});

test('backup banner: shown when last export over 7 days ago', async () => {
  const store = createStore(`today-${++i}`);
  await store.saveSettings({ soundOn: true, lastExportAt: NOW - 8 * DAY });
  render(<App store={store} now={() => NOW} />);
  expect(await screen.findByText('Time to back up your training data.')).toBeInTheDocument();
});

test('backup banner: hidden when exported 2 days ago', async () => {
  const store = createStore(`today-${++i}`);
  await store.saveSettings({ soundOn: true, lastExportAt: NOW - 2 * DAY });
  render(<App store={store} now={() => NOW} />);
  await waitFor(() => expect(screen.getByText('Day 1 of 30')).toBeInTheDocument());
  expect(screen.queryByText(/back up/i)).toBeNull();
});

test('different-runner confirm: Resume it goes to the active runner', async () => {
  const store = createStore(`today-${++i}`);
  await store.setActive({ type: 'session', payload: { sessionId: 'pm' }, updatedAt: 1 });
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText('Morning Session'));
  const dlg = screen.getByRole('dialog');
  expect(dlg).toHaveTextContent('Another session is in progress. Discard it?');
  fireEvent.click(within(dlg).getByText('Resume it'));
  expect(location.hash).toBe('#/session/pm');
});

test('different-runner confirm: Discard & start clears active and navigates', async () => {
  const store = createStore(`today-${++i}`);
  await store.setActive({ type: 'session', payload: { sessionId: 'pm' }, updatedAt: 1 });
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText('Morning Session'));
  fireEvent.click(within(screen.getByRole('dialog')).getByText('Discard & start'));
  await waitFor(() => expect(location.hash).toBe('#/session/am'));
  expect(await store.getActive()).toBeUndefined();
});
