import { render, screen, fireEvent, cleanup } from '@testing-library/preact';
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
class FakeAudio { src = ''; onended = null; onerror = null; pause = pause; play() { played.push(this.src); return Promise.resolve(); } }
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
  await open('#/session/am');
  fireEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  expect(said()).toHaveLength(1);
  expect(said()[0]).toMatch(/en-block-am-straight-warmup/);
  fireEvent.click(screen.getByRole('button', { name: /^next/i }));
  expect(said()[1]).toMatch(/en-block-am-stop-ladder/);
  // Repeat restarts the clip even while it is still being read.
  fireEvent.click(screen.getByRole('button', { name: /^repeat$/i }));
  expect(said()[2]).toMatch(/en-block-am-stop-ladder/);
  fireEvent.click(screen.getByRole('button', { name: /stop reading/i }));
  expect(pause).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /stop reading/i })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^repeat$/i }));
  expect(said()[3]).toMatch(/en-block-am-stop-ladder/);
  const pauses = pause.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /^pause$/i }));
  expect(pause.mock.calls.length).toBeGreaterThan(pauses);
});

test('voice guidance off: nothing is read automatically, the button still works', async () => {
  await open('#/session/am', { voiceOn: false });
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
