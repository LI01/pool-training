import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';
import type { SessionRecord } from '../../src/db/types';

const NOW = () => new Date(2026, 9, 9, 8).getTime();
const day = (n: number): SessionRecord => ({
  id: `d${n}`, date: '2026-10-08', sessionId: 'day', dayNumber: n, planVersion: 2, startedAt: 0, endedAt: 1, activeMinutes: 70, blocks: [],
});
let i = 0;

test('the plan lists 8 weeks of 6 days, marks done and next, and a day opens its session', async () => {
  const store = createStore(`plan-${++i}`);
  await store.putSession(day(1));
  location.hash = '#/plan';
  render(<App store={store} now={NOW} />);
  expect(await screen.findByRole('heading', { name: 'Training plan' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Week 8 · Match play' })).toBeInTheDocument();
  expect(document.querySelectorAll('.plan__week .card')).toHaveLength(48);
  expect(within(screen.getByText('Day 1').closest('button')!).getByText('Done')).toBeInTheDocument();
  expect(within(screen.getByText('Day 2').closest('button')!).getByText('Next')).toBeInTheDocument();
  expect(screen.getByText(/Dry strokes and rhythm · Spot shot · Daily stop shot/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Day 40'));
  await waitFor(() => expect(location.hash).toBe('#/day/40'));
  expect(await screen.findByText(/^Day 40 · Week 7/)).toBeInTheDocument();
});

test('Settings changes the next plan day', async () => {
  const store = createStore(`plan-${++i}`);
  await store.putSession(day(5));
  location.hash = '#/settings';
  render(<App store={store} now={NOW} />);
  await waitFor(() => expect(screen.getByLabelText('Next day to train')).toHaveValue('6'));
  const field = () => screen.getByLabelText('Next day to train');
  const save = () => fireEvent.click(within(field().closest('section')!).getByRole('button', { name: 'Save' }));
  fireEvent.input(field(), { target: { value: '49' } });
  await waitFor(() => expect(field()).toHaveValue('49'));
  save();
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a day from 1 to 48.');
  fireEvent.input(field(), { target: { value: '13' } });
  await waitFor(() => expect(field()).toHaveValue('13'));
  save();
  expect(await screen.findByText('Progress saved.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Today' }));
  expect(await screen.findByText('Day 13 of 48')).toBeInTheDocument();
});
