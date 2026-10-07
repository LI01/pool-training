import { acquireWakeLock, wakeLockSupported } from '../../src/platform/wakeLock';
import { playChime, unlockAudio } from '../../src/platform/chime';

test('wake lock fails soft when unsupported', async () => {
  expect(wakeLockSupported()).toBe(false); // jsdom has no navigator.wakeLock
  await expect(acquireWakeLock()).resolves.toBe(false);
});

test('chime never throws without AudioContext', () => {
  expect(() => { unlockAudio(); playChime(); }).not.toThrow();
});

test('wake lock re-acquired on visibility return', async () => {
  const request = vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  await expect(acquireWakeLock()).resolves.toBe(true);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await Promise.resolve();
  expect(request).toHaveBeenCalledTimes(2);
  // @ts-expect-error cleanup
  delete navigator.wakeLock;
});
