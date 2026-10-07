import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';
import { startTest } from '../../src/runner/test';
import { acquireWakeLock, releaseWakeLock } from '../../src/platform/wakeLock';
import { unlockAudio } from '../../src/platform/chime';

vi.mock('../../src/platform/chime', () => ({ setChimeEnabled: vi.fn(), unlockAudio: vi.fn(), playChime: vi.fn() }));
vi.mock('../../src/platform/wakeLock', () => ({
  wakeLockSupported: vi.fn(() => true), acquireWakeLock: vi.fn(async () => true), releaseWakeLock: vi.fn(async () => {}),
}));
beforeEach(() => { vi.clearAllMocks(); });

let n = 0;
const now = () => new Date(2026, 9, 7, 18, 0).getTime();
async function openTest() {
  const store = createStore(`tr-${++n}`);
  location.hash = '#/test';
  render(<App store={store} now={now} />);
  fireEvent.click(await screen.findByRole('button', { name: /start test/i }));
  return store;
}

test('straight test: makes, miss with optional tag, progress and cap at 10', async () => {
  await openTest();
  expect(screen.getByText('Long straight pot')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /open diagram/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^make$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^miss$/i }));
  fireEvent.click(screen.getByRole('button', { name: /no tag/i }));        // tag optional
  expect(screen.getByText('2 of 10')).toBeInTheDocument();
  for (let i = 0; i < 12; i++) fireEvent.click(screen.getByRole('button', { name: /^make$/i }));
  expect(screen.getByText('10 of 10')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^make$/i })).toBeDisabled();
});

test('full test with skips saves a record', async () => {
  const store = await openTest();
  for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: /^make$/i }));
  fireEvent.click(screen.getByRole('button', { name: /next test/i }));
  expect(screen.getByText(/Cutting LEFT/, { selector: 'p' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /skip test/i }));    // cut
  fireEvent.click(screen.getByRole('button', { name: /skip test/i }));    // stop
  for (const [i, v] of ['12', '10', '14', '8', '11'].entries())
    fireEvent.input(screen.getByLabelText(`Draw ${i + 1} (in)`), { target: { value: v } });
  expect(screen.getByText(/Average: 11"/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next test/i }));
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /^cleared$/i }));
  for (let i = 0; i < 2; i++) { fireEvent.click(screen.getByRole('button', { name: /^failed$/i })); fireEvent.click(screen.getByRole('button', { name: /^C/ })); }
  fireEvent.click(screen.getByRole('button', { name: /finish test/i }));
  fireEvent.click(await screen.findByRole('button', { name: /save/i }));
  await waitFor(async () => expect(await store.listTests()).toHaveLength(1));
  const [r] = await store.listTests();
  expect(r.straight).toHaveLength(10);
  expect(r.cut).toBeUndefined();
  expect(r.draw).toEqual([12, 10, 14, 8, 11]);
  expect(r.fiveBall?.filter((s) => s.tag === 'C')).toHaveLength(2);
  await waitFor(() => expect(location.hash).toBe('#/'));                  // let Save finish before the next test
});

// ---- extra coverage ----

const t0 = now();
const finishedState = () => {
  const s = startTest(t0);
  return { ...s, index: 5, shots: { ...s.shots, straight: Array.from({ length: 10 }, () => ({ ok: true })) }, skipped: ['cut', 'stop', 'draw', 'fiveBall'] };
};

async function openWith(payload: unknown, storeOverride?: (s: ReturnType<typeof createStore>) => ReturnType<typeof createStore>) {
  const base = createStore(`tr-${++n}`);
  const store = storeOverride ? storeOverride(base) : base;
  await store.setActive({ type: 'test', updatedAt: t0, payload });
  location.hash = '#/test';
  render(<App store={store} now={now} />);
  return { store, base };
}

test('Start unlocks audio, takes the wake lock and persists the active test', async () => {
  const store = await openTest();
  expect(unlockAudio).toHaveBeenCalled();
  expect(acquireWakeLock).toHaveBeenCalled();
  await waitFor(async () => expect((await store.getActive())?.type).toBe('test'));
});

test('restores a test in progress from the saved active state', async () => {
  const s = startTest(t0);
  await openWith({ ...s, shots: { ...s.shots, straight: [{ ok: true }, { ok: false, tag: 'P' }, { ok: true }, { ok: true }] } });
  expect(await screen.findByText('4 of 10')).toBeInTheDocument();
  expect(screen.getByText('Long straight pot')).toBeInTheDocument();
  expect(screen.getByLabelText('Shot 2: miss, P')).toBeInTheDocument();
});

test('corrupt saved test is cleared with a message and the pre-start screen shows', async () => {
  const { store } = await openWith({ kind: 'test', index: 42 });
  expect(await screen.findByText("Previous test couldn't be restored")).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /start test/i })).toBeInTheDocument();
  await waitFor(async () => expect(await store.getActive()).toBeUndefined());
});

test('Undo removes the last shot and is persisted', async () => {
  const store = await openTest();
  fireEvent.click(screen.getByRole('button', { name: /^make$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^miss$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^S/ }));
  expect(screen.getByText('2 of 10')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /undo last/i }));
  expect(screen.getByText('1 of 10')).toBeInTheDocument();
  await waitFor(async () => expect(((await store.getActive())?.payload as any).shots.straight).toEqual([{ ok: true }]));
});

test('cut test switches from LEFT to RIGHT after 10 shots', async () => {
  const s = startTest(t0);
  await openWith({ ...s, index: 1, shots: { ...s.shots, cut: Array.from({ length: 9 }, () => ({ ok: true, side: 'L' })) } });
  expect(await screen.findByText(/Cutting LEFT/, { selector: 'p' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^make$/i }));
  expect(screen.getByText(/Cutting RIGHT/, { selector: 'p' })).toBeInTheDocument();
  expect(screen.getByText('10 of 20')).toBeInTheDocument();
});

test('stop test uses Success / Fail labels', async () => {
  const s = startTest(t0);
  await openWith({ ...s, index: 2 });
  fireEvent.click(await screen.findByRole('button', { name: /^success$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^fail$/i }));
  fireEvent.click(screen.getByRole('button', { name: /^D/ }));
  expect(screen.getByText('2 of 10')).toBeInTheDocument();
  expect(screen.getByLabelText('Shot 2: miss, D')).toBeInTheDocument();
});

test('invalid draw input is marked invalid and not counted', async () => {
  const s = startTest(t0);
  const { store } = await openWith({ ...s, index: 3 });
  const d1 = await screen.findByLabelText('Draw 1 (in)');
  fireEvent.input(d1, { target: { value: '-3' } });
  expect(d1).toHaveAttribute('aria-invalid', 'true');
  fireEvent.input(screen.getByLabelText('Draw 2 (in)'), { target: { value: 'abc' } });
  expect(screen.getByLabelText('Draw 2 (in)')).toHaveAttribute('aria-invalid', 'true');
  fireEvent.input(screen.getByLabelText('Draw 3 (in)'), { target: { value: '10.5' } });
  expect(screen.getByText(/Average: 10.5"/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /next test/i })).toBeDisabled();
  await waitFor(async () => expect(((await store.getActive())?.payload as any).draw).toEqual([null, null, 10.5, null, null]));
  fireEvent.input(d1, { target: { value: '12' } });
  expect(d1).not.toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText(/Average: 11.3"/)).toBeInTheDocument();
});

test('End test early shows the summary with incomplete tests not counted', async () => {
  const store = await openTest();
  for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: /^make$/i }));
  fireEvent.click(screen.getByRole('button', { name: /next test/i }));
  fireEvent.click(screen.getByRole('button', { name: /^make$/i }));          // cut: 1 of 20
  fireEvent.click(screen.getByRole('button', { name: /end test/i }));
  fireEvent.click(await screen.findByRole('button', { name: /end test now/i }));
  expect(await screen.findByText('10/10')).toBeInTheDocument();
  const cutRow = screen.getByText('Cut shots').closest('div')!;
  expect(cutRow).toHaveTextContent('–');
  expect(cutRow).toHaveTextContent(/not counted/i);
  fireEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(async () => expect(await store.listTests()).toHaveLength(1));
  const [r] = await store.listTests();
  expect(r.straight).toHaveLength(10);
  expect(r.cut).toBeUndefined();
  await waitFor(() => expect(location.hash).toBe('#/'));
});

test('double-tapping Save stores exactly one test', async () => {
  const { store } = await openWith(finishedState());
  const save = await screen.findByRole('button', { name: /save/i });
  fireEvent.click(save);
  fireEvent.click(save);
  await waitFor(async () => expect(await store.getActive()).toBeUndefined());
  expect(await store.listTests()).toHaveLength(1);
  expect(releaseWakeLock).toHaveBeenCalled();
  await waitFor(() => expect(location.hash).toBe('#/'));
});

test('putTest failure shows an alert, keeps the active test and re-enables Save', async () => {
  const { store, base } = await openWith(finishedState(), (b) => ({ ...b, putTest: vi.fn(() => Promise.reject(new Error('disk full'))) }));
  fireEvent.click(await screen.findByRole('button', { name: /save/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save the test/i);
  expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  expect((await store.getActive())?.type).toBe('test');
  expect(await base.listTests()).toHaveLength(0);
});

test('Discard asks to confirm, then clears the active test without saving', async () => {
  const { store } = await openWith(finishedState());
  fireEvent.click(await screen.findByRole('button', { name: /^discard$/i }));
  fireEvent.click(await screen.findByRole('button', { name: /discard test/i }));
  await waitFor(async () => expect(await store.getActive()).toBeUndefined());
  expect(await store.listTests()).toHaveLength(0);
  await waitFor(() => expect(location.hash).toBe('#/'));
});
