import { render, screen, fireEvent, waitFor, act } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

let t = new Date(2026, 9, 7, 9, 0).getTime();
const now = () => t;
let n = 0;

async function open(sessionHash: string) {
  const store = createStore(`sr-${++n}`);
  location.hash = sessionHash;
  render(<App store={store} now={now} />);
  return store;
}

test('shows first block with diagram, instructions and countdown', async () => {
  await open('#/session/am');
  fireEvent.click(await screen.findByRole('button', { name: /start/i }));
  expect(screen.getByText('Straight-ball warm-up')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /open diagram/i })).toBeInTheDocument();
  expect(screen.getByText('10:00')).toBeInTheDocument();
  expect(screen.getByText(/Do sets of 5/)).toBeInTheDocument();
});

test('does not auto-advance at zero; shows overtime', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  await open('#/session/am');
  fireEvent.click(await screen.findByRole('button', { name: /start/i }));
  t += 11 * 60000;
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(screen.getByText('+1:00')).toBeInTheDocument();
  expect(screen.getByText('Straight-ball warm-up')).toBeInTheDocument();
  vi.useRealTimers();
});

test('draw ladder entry rejects invalid input and saves valid input; finishing saves session', async () => {
  const store = await open('#/session/am');
  fireEvent.click(await screen.findByRole('button', { name: /start/i }));
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // warm-up (no record)
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // stop ladder → optional sheet
  fireEvent.click(await screen.findByRole('button', { name: /skip/i }));
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // draw ladder → sheet
  fireEvent.input(await screen.findByLabelText(/best/i), { target: { value: '-2' } });
  fireEvent.input(screen.getByLabelText(/typical/i), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(screen.getByRole('alert')).toBeInTheDocument();
  fireEvent.input(screen.getByLabelText(/best/i), { target: { value: '16' } });
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // follow → optional sheet
  fireEvent.click(await screen.findByRole('button', { name: /skip/i }));
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                  // precision (last)
  fireEvent.click(await screen.findByRole('button', { name: /finish/i }));
  await waitFor(async () => expect(await store.listSessions()).toHaveLength(1));
  const [s] = await store.listSessions();
  expect(s.blocks.find((b) => b.blockId === 'am-draw-ladder')?.draw).toEqual({ bestIn: 16, typicalIn: 10 });
  expect(await store.getActive()).toBeUndefined();
});

test('resumes active session from store after reload', async () => {
  const store = createStore(`sr-${++n}`);
  await store.setActive({ type: 'session', updatedAt: t, payload: {
    kind: 'session', sessionId: 'pm', startedAt: t, blockIndex: 2, blockStartedAt: t, pausedAt: null,
    pausedTotalMs: 0, sessionPausedMs: 0, extraMs: 0, results: {}, finished: false } });
  location.hash = '#/session/pm';
  render(<App store={store} now={now} />);
  expect(await screen.findByText('3-ball pattern drill')).toBeInTheDocument();
});

test('corrupt saved state is cleared with a message and the pre-start screen shows', async () => {
  const store = createStore(`sr-${++n}`);
  await store.setActive({ type: 'session', updatedAt: t, payload: { kind: 'session', sessionId: 'am', blockIndex: 99 } });
  location.hash = '#/session/am';
  render(<App store={store} now={now} />);
  expect(await screen.findByText("Previous session couldn't be restored")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  await waitFor(async () => expect(await store.getActive()).toBeUndefined());
});

test('runs sheet records fail tags; Back pre-fills; Leave keeps the active session', async () => {
  const store = createStore(`sr-${++n}`);
  await store.setActive({ type: 'session', updatedAt: t, payload: {
    kind: 'session', sessionId: 'pm', startedAt: t, blockIndex: 2, blockStartedAt: t, pausedAt: null,
    pausedTotalMs: 0, sessionPausedMs: 0, extraMs: 0, results: {}, finished: false } });
  location.hash = '#/session/pm';
  render(<App store={store} now={now} />);
  fireEvent.click(await screen.findByRole('button', { name: /^next/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Increase Layouts attempted' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Layouts attempted' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Successful runs' }));
  fireEvent.click(screen.getByRole('button', { name: /^P Potting/ }));
  fireEvent.click(screen.getByRole('button', { name: /^S Spin/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove P' }));
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  expect(await screen.findByText('5-ball clearance')).toBeInTheDocument();
  await waitFor(async () => {
    const a = await store.getActive();
    expect((a?.payload as any).results['pm-3ball'].runs).toEqual({ success: 1, attempts: 2, failTags: ['S'] });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(await screen.findByRole('button', { name: /^next/i }));
  expect(screen.getByLabelText('Layouts attempted')).toHaveTextContent('2');
  expect(screen.getByRole('button', { name: 'Remove S' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: /leave session/i }));
  expect(await screen.findByText('Afternoon Session')).toBeInTheDocument();
  expect((await store.getActive())?.type).toBe('session');
});
