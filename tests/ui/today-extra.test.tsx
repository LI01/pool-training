import { render, screen, waitFor, fireEvent, within } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';
import type { SessionRecord } from '../../src/db/types';

let i = 0;
const NOW = new Date(2026, 9, 9, 8, 0).getTime();
const DAY = 24 * 3600 * 1000;
const sess = (id: string, date: string, dayNumber?: number): SessionRecord =>
  ({ id, date, sessionId: dayNumber ? 'day' : 'am', dayNumber, planVersion: 2, startedAt: 0, endedAt: 1, activeMinutes: 60, blocks: [] });
const DAY1 = 'Day 1 · Week 1 · Accuracy · the basics';
const pillOf = (title: string) => within(screen.getByText(title).closest('button')!);

beforeEach(() => { location.hash = '#/'; });

test('after a day is done the next one is shown; an active session of it is In progress', async () => {
  const store = createStore(`today-${++i}`);
  await store.putSession(sess('a', '2026-10-09', 1));
  await store.setActive({ type: 'session', payload: { sessionId: 'day', dayNumber: 2 }, updatedAt: 1 });
  render(<App store={store} now={() => NOW} />);
  await waitFor(() => expect(screen.getByText('Day 2 of 48')).toBeInTheDocument());
  expect(screen.getByText('Done today: day 1.')).toBeInTheDocument();
  expect(pillOf('Day 2 · Week 1 · Accuracy · the basics').getByText('In progress')).toBeInTheDocument();
  expect(pillOf('Standard Test').getByText('Not started')).toBeInTheDocument();
});

test('a missed calendar day is not skipped: the plan continues from the last day trained', async () => {
  const store = createStore(`today-${++i}`);
  await store.putSession(sess('a', '2026-10-01', 4));
  render(<App store={store} now={() => NOW} />);
  expect(await screen.findByText('Day 5 of 48')).toBeInTheDocument();
});

test('after the sixth day of a week: rest or test', async () => {
  const store = createStore(`today-${++i}`);
  await store.putSession(sess('a', '2026-10-08', 6));
  render(<App store={store} now={() => NOW} />);
  expect(await screen.findByText(/Week 1 is done\. Rest today, or take the standard test/)).toBeInTheDocument();
});

test('after day 48 the plan is complete and can start again', async () => {
  const store = createStore(`today-${++i}`);
  await store.putSession(sess('a', '2026-10-08', 48));
  render(<App store={store} now={() => NOW} />);
  expect(await screen.findByText('Plan complete')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start again from week 1' }));
  expect(await screen.findByText('Day 1 of 48')).toBeInTheDocument();
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
  await waitFor(() => expect(screen.getByText('Day 1 of 48')).toBeInTheDocument());
  expect(screen.queryByText(/back up/i)).toBeNull();
});

test('different-runner confirm: Resume it goes to the active runner', async () => {
  const store = createStore(`today-${++i}`);
  await store.setActive({ type: 'session', payload: { sessionId: 'day', dayNumber: 3 }, updatedAt: 1 });
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText(DAY1));
  const dlg = screen.getByRole('dialog');
  expect(dlg).toHaveTextContent('Another session is in progress. Discard it?');
  fireEvent.click(within(dlg).getByText('Resume it'));
  expect(location.hash).toBe('#/day/3');
});

test('different-runner confirm: Discard & start clears active and navigates', async () => {
  const store = createStore(`today-${++i}`);
  await store.setActive({ type: 'session', payload: { sessionId: 'day', dayNumber: 3 }, updatedAt: 1 });
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText(DAY1));
  fireEvent.click(within(screen.getByRole('dialog')).getByText('Discard & start'));
  await waitFor(() => expect(location.hash).toBe('#/day/1'));
  expect(await store.getActive()).toBeUndefined();
});

test('finished-but-unsaved session: sheet offers Save it (goes to its summary) instead of calling it in progress', async () => {
  const store = createStore(`today-${++i}`);
  await store.setActive({ type: 'session', payload: { sessionId: 'day', dayNumber: 3, finished: true }, updatedAt: 1 });
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText(DAY1));
  const dlg = screen.getByRole('dialog');
  expect(dlg).toHaveTextContent('Your session is complete but not saved.');
  expect(dlg).not.toHaveTextContent(/in progress/i);
  fireEvent.click(within(dlg).getByText('Save it'));
  expect(location.hash).toBe('#/day/3');
});

test('finished-but-unsaved session: Discard clears it and starts the chosen session', async () => {
  const store = createStore(`today-${++i}`);
  await store.setActive({ type: 'session', payload: { sessionId: 'day', dayNumber: 3, finished: true }, updatedAt: 1 });
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText(DAY1));
  fireEvent.click(within(screen.getByRole('dialog')).getByText('Discard'));
  await waitFor(() => expect(location.hash).toBe('#/day/1'));
  expect(await store.getActive()).toBeUndefined();
});

test('finished-but-unsaved test: sheet says the test is not saved', async () => {
  const store = createStore(`today-${++i}`);
  await store.setActive({ type: 'test', payload: { kind: 'test', index: 5 }, updatedAt: 1 });
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText(DAY1));
  expect(screen.getByRole('dialog')).toHaveTextContent('Your test is complete but not saved.');
});

test('discard failure shows an error and stays on Today', async () => {
  const base = createStore(`today-${++i}`);
  await base.setActive({ type: 'session', payload: { sessionId: 'day', dayNumber: 3 }, updatedAt: 1 });
  const store = { ...base, setActive: vi.fn(() => Promise.reject(new Error('locked'))) };
  render(<App store={store} now={() => NOW} />);
  fireEvent.click(await screen.findByText(DAY1));
  fireEvent.click(within(screen.getByRole('dialog')).getByText('Discard & start'));
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't discard it");
  expect(location.hash).toBe('#/');
  expect((await base.getActive())?.type).toBe('session');
});
