import { render, screen, fireEvent, cleanup, act } from '@testing-library/preact';
import { App } from '../../src/ui/App';
import { createStore } from '../../src/db/store';

vi.mock('../../src/platform/chime', () => ({ setChimeEnabled: vi.fn(), unlockAudio: vi.fn(), playChime: vi.fn() }));
vi.mock('../../src/platform/wakeLock', () => ({
  wakeLockSupported: vi.fn(() => true), acquireWakeLock: vi.fn(async () => true), releaseWakeLock: vi.fn(async () => {}),
}));

class Utterance { lang = ''; voice = null; onend: (() => void) | null = null; onerror = null; constructor(public text: string) {} }
const synth = { speaking: false, pending: false, speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn(() => []) };
// Every drill has a recorded clip; record what each play() was asked to play.
const played: string[] = [];
const pause = vi.fn();
let audio: FakeAudio;
class FakeAudio {
  src = ''; onended: (() => void) | null = null; onerror = null; pause = pause;
  constructor() { audio = this; }
  play() { played.push(this.src); return Promise.resolve(); }
}
beforeEach(() => {
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('Audio', FakeAudio);
  played.length = 0;
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const said = () => played.map((src) => src.replace(/^.*\/(\w+-\w+-[\w-]+?)(?:-[\w]{8})?\.mp3$/, '$1'));
let n = 0;
async function open(hash: string, settings?: object) {
  const store = createStore(`voice-${++n}`);
  if (settings) await store.saveSettings({ soundOn: true, ...settings });
  location.hash = hash;
  render(<App store={store} now={() => new Date(2026, 9, 7, 9).getTime()} />);
}

test('reads each block when Start/Next enter it; Pause stops; Repeat rereads from the start', async () => {
  await open('#/day/1');
  fireEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  expect(said()).toHaveLength(1);
  expect(said()[0]).toMatch(/en-block-basic-dry-stroke/);
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));
  expect(said()[1]).toMatch(/en-block-basic-spot-shot/);
  // Repeat restarts the clip even while it is still being read.
  fireEvent.click(screen.getByRole('button', { name: /^repeat$/i }));
  expect(said()[2]).toMatch(/en-block-basic-spot-shot/);
  fireEvent.click(screen.getByRole('button', { name: /stop reading/i }));
  expect(pause).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /stop reading/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^repeat$/i }));
  expect(said()[3]).toMatch(/en-block-basic-spot-shot/);
  const pauses = pause.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /^pause$/i }));
  expect(pause.mock.calls.length).toBeGreaterThan(pauses);
});

test('Listen plays the illustrated key points one after another; each finished step turns the page', async () => {
  await open('#/day/1', { voiceOn: false });
  fireEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  expect(screen.getByRole('heading', { name: 'Key points' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^listen$/i }));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('Step 1 of 3');
  expect(said()).toEqual([expect.stringMatching(/en-lesson-basic-dry-stroke-1/)]);
  act(() => audio.onended!());
  expect(dialog).toHaveTextContent('Step 2 of 3');
  expect(said()[1]).toMatch(/en-lesson-basic-dry-stroke-2/);
  act(() => audio.onended!());
  act(() => audio.onended!());
  expect(said()).toHaveLength(3);
  expect(dialog).toHaveTextContent('Step 3 of 3');
  expect(screen.getByRole('button', { name: /^next point$/i })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('a step title opens the walkthrough there without playing; Play reads that step; closing stops it', async () => {
  await open('#/test', { voiceOn: false });
  fireEvent.click(await screen.findByRole('button', { name: /start test/i }));
  const [, second] = screen.getAllByRole('button', { name: /./ }).filter((b) => b.classList.contains('lesson-card__step'));
  fireEvent.click(second);
  expect(screen.getByRole('dialog')).toHaveTextContent('Step 2 of 2');
  expect(said()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: /^previous point$/i }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Step 1 of 2');
  fireEvent.click(screen.getByRole('button', { name: /play/i }));
  expect(said()).toEqual([expect.stringMatching(/en-lesson-straight-1/)]);
  const pauses = pause.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
  expect(pause.mock.calls.length).toBeGreaterThan(pauses);
});

test('voice guidance off: nothing is read automatically, the button still works', async () => {
  await open('#/day/1', { voiceOn: false });
  fireEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  expect(said()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: /^repeat$/i }));
  expect(said()).toHaveLength(1);
});

test('test runner reads each test setup on start and on Skip', async () => {
  await open('#/test');
  fireEvent.click(await screen.findByRole('button', { name: /start test/i }));
  expect(said()[0]).toMatch(/en-test-straight/);
  fireEvent.click(screen.getByRole('button', { name: /skip test/i }));
  expect(said()[1]).toMatch(/en-test-cut/);
  fireEvent.click(screen.getByRole('button', { name: /^repeat$/i }));
  expect(said()[2]).toMatch(/en-test-cut/);
});

test('Settings switch saves voice guidance', async () => {
  await open('#/settings');
  const sw = await screen.findByRole('switch', { name: /read each drill aloud/i });
  expect(sw).toBeChecked();
  fireEvent.click(sw);
  expect(await screen.findByText('Voice guidance off.')).toBeInTheDocument();
});
