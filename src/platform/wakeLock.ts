let sentinel: WakeLockSentinel | null = null;
let wanted = false;
let listening = false;

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

function ensureListener(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted) void acquireWakeLock();
  });
}

export async function acquireWakeLock(): Promise<boolean> {
  wanted = true;
  ensureListener();
  if (!wakeLockSupported()) return false;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    return true;
  } catch {
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  wanted = false;
  const s = sentinel;
  sentinel = null;
  try {
    await s?.release();
  } catch {
    /* ignore */
  }
}
