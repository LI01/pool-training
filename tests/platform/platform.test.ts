import { acquireWakeLock, releaseWakeLock, wakeLockSupported } from '../../src/platform/wakeLock';
import { playChime, setChimeEnabled, unlockAudio } from '../../src/platform/chime';

afterEach(async () => {
  await releaseWakeLock();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  delete (navigator as any).wakeLock;
  delete (window as any).AudioContext;
  setChimeEnabled(true);
});

function defineWakeLock(request: unknown) {
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
}
const mkSentinel = () => ({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() });
const becomeVisible = async () => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await new Promise((r) => setTimeout(r, 0));
};

test('wake lock fails soft when unsupported', async () => {
  expect(wakeLockSupported()).toBe(false); // jsdom has no navigator.wakeLock
  await expect(acquireWakeLock()).resolves.toBe(false);
});

test('chime never throws without AudioContext', () => {
  expect(() => { unlockAudio(); playChime(); }).not.toThrow();
});

test('wake lock re-acquired on visibility return', async () => {
  const request = vi.fn().mockResolvedValue(mkSentinel());
  defineWakeLock(request);
  await expect(acquireWakeLock()).resolves.toBe(true);
  await becomeVisible();
  expect(request).toHaveBeenCalledTimes(2);
});

test('re-acquire releases the previously held sentinel', async () => {
  const first = mkSentinel();
  const second = mkSentinel();
  const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
  defineWakeLock(request);
  await acquireWakeLock();
  await becomeVisible();
  expect(first.release).toHaveBeenCalledTimes(1);
  expect(second.release).not.toHaveBeenCalled();
});

test('no re-acquire after release', async () => {
  const request = vi.fn().mockResolvedValue(mkSentinel());
  defineWakeLock(request);
  await acquireWakeLock();
  await releaseWakeLock();
  await becomeVisible();
  expect(request).toHaveBeenCalledTimes(1);
});

test('release during in-flight request leaves no held sentinel', async () => {
  const s = mkSentinel();
  let resolve!: (v: unknown) => void;
  const request = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
  defineWakeLock(request);
  const pending = acquireWakeLock();
  await releaseWakeLock();
  resolve(s);
  await expect(pending).resolves.toBe(false);
  expect(s.release).toHaveBeenCalledTimes(1);
});

describe('chime with AudioContext', () => {
  let oscillators = 0;
  const install = () => {
    oscillators = 0;
    class FakeCtx {
      currentTime = 0;
      state = 'running';
      destination = {};
      resume = vi.fn().mockRejectedValue(new Error('no'));
      createGain() {
        const node: any = { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } };
        node.connect = (n: unknown) => n;
        return node;
      }
      createOscillator() {
        oscillators++;
        return { type: '', frequency: { value: 0 }, connect: (n: unknown) => n, start: vi.fn(), stop: vi.fn() };
      }
    }
    (window as any).AudioContext = FakeCtx;
  };

  test('schedules 3 oscillators when enabled, none when disabled', async () => {
    install();
    unlockAudio();
    await Promise.resolve();
    playChime();
    expect(oscillators).toBe(3);
    setChimeEnabled(false);
    playChime();
    expect(oscillators).toBe(3);
  });
});
