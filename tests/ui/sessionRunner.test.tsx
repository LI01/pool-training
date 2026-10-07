import { render, screen, fireEvent, waitFor, act, cleanup, within } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';
import { playChime } from '../../src/platform/chime';
import { acquireWakeLock, releaseWakeLock } from '../../src/platform/wakeLock';

vi.mock('../../src/platform/chime', () => ({ setChimeEnabled: vi.fn(), unlockAudio: vi.fn(), playChime: vi.fn() }));
vi.mock('../../src/platform/wakeLock', () => ({
  wakeLockSupported: vi.fn(() => true), acquireWakeLock: vi.fn(async () => true), releaseWakeLock: vi.fn(async () => {}),
}));
beforeEach(() => { vi.clearAllMocks(); });

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

const runState = (over: Record<string, unknown> = {}) => ({
  kind: 'session', sessionId: 'pm', startedAt: t, blockIndex: 4, blockStartedAt: t, pausedAt: null,
  pausedTotalMs: 0, sessionPausedMs: 0, extraMs: 0, results: {}, finished: true, ...over });

async function openWith(payload: unknown, hash = '#/session/pm') {
  const store = createStore(`sr-${++n}`);
  await store.setActive({ type: 'session', updatedAt: t, payload });
  location.hash = hash;
  const r = render(<App store={store} now={now} />);
  return { store, ...r };
}

test('double-tapping Finish stores exactly one session', async () => {
  const { store } = await openWith(runState());
  const finish = await screen.findByRole('button', { name: /finish/i });
  fireEvent.click(finish);
  fireEvent.click(finish);
  await waitFor(async () => expect(await store.getActive()).toBeUndefined());
  expect(await store.listSessions()).toHaveLength(1);
  expect(releaseWakeLock).toHaveBeenCalled();
});

test('putSession failure shows an alert, keeps the active session and re-enables Finish', async () => {
  const base = createStore(`sr-${++n}`);
  const store = { ...base, putSession: vi.fn(() => Promise.reject(new Error('disk full'))) };
  await store.setActive({ type: 'session', updatedAt: t, payload: runState() });
  location.hash = '#/session/pm';
  render(<App store={store} now={now} />);
  fireEvent.click(await screen.findByRole('button', { name: /finish/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save the session/i);
  expect(screen.getByRole('button', { name: /finish/i })).not.toBeDisabled();
  expect((await store.getActive())?.type).toBe('session');
  expect(await base.listSessions()).toHaveLength(0);
});

test('Finish after a failed active-clear reuses the record id: exactly one session', async () => {
  const base = createStore(`sr-${++n}`);
  let failClear = true;
  const store = {
    ...base,
    setActive: vi.fn((a: Parameters<typeof base.setActive>[0]) => {
      if (a === undefined && failClear) { failClear = false; return Promise.reject(new Error('locked')); }
      return base.setActive(a);
    }),
  };
  await base.setActive({ type: 'session', updatedAt: t, payload: runState() });
  location.hash = '#/session/pm';
  render(<App store={store} now={now} />);
  fireEvent.click(await screen.findByRole('button', { name: /finish/i }));
  expect(await screen.findByText('Afternoon Session')).toBeInTheDocument(); // back on Today
  expect(await base.listSessions()).toHaveLength(1);
  expect((await base.getActive())?.type).toBe('session'); // clear failed
  location.hash = '#/session/pm';
  fireEvent.click(await screen.findByRole('button', { name: /finish/i }));
  await waitFor(async () => expect(await base.getActive()).toBeUndefined());
  expect(await base.listSessions()).toHaveLength(1);
});

test('summary Back returns to the last block', async () => {
  await openWith(runState());
  fireEvent.click(await screen.findByRole('button', { name: /^back$/i }));
  expect(await screen.findByText('Short review / replay')).toBeInTheDocument();
  expect(screen.getByText('Block 5/5', { exact: false })).toBeInTheDocument();
});

test('chime: once when crossing zero, re-armed by +2 min, never when restoring in overtime', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  try {
    await open('#/session/am');
    fireEvent.click(await screen.findByRole('button', { name: /start/i }));
    t += 10 * 60000 - 1500;
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(playChime).not.toHaveBeenCalled();
    t += 2000;
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(playChime).toHaveBeenCalledTimes(1);
    t += 5000;
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(playChime).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '+2 min' }));
    t += 2 * 60000;
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(playChime).toHaveBeenCalledTimes(2);
    cleanup();

    vi.mocked(playChime).mockClear();
    await openWith(runState({ sessionId: 'am', blockIndex: 0, blockStartedAt: t - 11 * 60000, finished: false }), '#/session/am');
    expect(await screen.findByText(/^\+1:0\d$/)).toBeInTheDocument();
    t += 3000;
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(playChime).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

test('wake lock: acquired on Start; unmount clears the tick interval and releases the lock', async () => {
  const clearSpy = vi.spyOn(window, 'clearInterval');
  const store = createStore(`sr-${++n}`);
  location.hash = '#/session/am';
  const { unmount } = render(<App store={store} now={now} />);
  fireEvent.click(await screen.findByRole('button', { name: /start/i }));
  expect(acquireWakeLock).toHaveBeenCalledTimes(1);
  expect(releaseWakeLock).not.toHaveBeenCalled();
  clearSpy.mockClear();
  act(() => { unmount(); }); // Preact 11 runs effect cleanups after paint; act flushes them.
  expect(clearSpy).toHaveBeenCalled();
  expect(releaseWakeLock).toHaveBeenCalled();
  clearSpy.mockRestore();
});

test('pause is persisted and a restore shows the paused remaining time', async () => {
  const store = createStore(`sr-${++n}`);
  location.hash = '#/session/am';
  const { unmount } = render(<App store={store} now={now} />);
  fireEvent.click(await screen.findByRole('button', { name: /start/i }));
  t += 30000;
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  const pausedAt = t;
  await waitFor(async () => expect(((await store.getActive())?.payload as any).pausedAt).toBe(pausedAt));
  act(() => { unmount(); });
  t += 5 * 60000;
  render(<App store={store} now={now} />);
  expect(await screen.findByText('9:30')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
});

test('End session: confirm jumps to the summary, records the current block as skipped and ends at that moment', async () => {
  const store = await open('#/session/am');
  const t0 = t;
  fireEvent.click(await screen.findByRole('button', { name: /start/i }));
  t += 3 * 60000;
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));                 // warm-up done at 3 min
  t += 2 * 60000;
  fireEvent.click(screen.getByRole('button', { name: 'End session' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Keep going' }));
  expect(screen.getByText('Stop shot ladder')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'End session' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'End session now' }));
  expect(await screen.findByText('Session complete')).toBeInTheDocument();
  expect(document.querySelector('.runner-summary__minutes')).toHaveTextContent('5 active minutes');
  t += 60 * 60000;                                                                   // dawdle on the summary
  fireEvent.click(screen.getByRole('button', { name: /finish/i }));
  await waitFor(async () => expect(await store.listSessions()).toHaveLength(1));
  const [rec] = await store.listSessions();
  expect(rec.endedAt).toBe(t0 + 5 * 60000);
  expect(rec.activeMinutes).toBe(5);
  expect(rec.blocks.map((b) => [b.blockId, !!b.skipped])).toEqual([['am-straight-warmup', false], ['am-stop-ladder', true]]);
});
