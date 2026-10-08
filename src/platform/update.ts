/** Routes where a session or test is running: never reload under them. */
const busy = () => /^#\/(day\/|test$)/.test(location.hash);

/**
 * When a new version's service worker takes over (autoUpdate), reload into it: the old page would otherwise keep
 * running and ask for voice clips the new version no longer caches. Waits until no session or test is open.
 * The first install (no earlier controller) does not reload.
 */
export function reloadOnUpdate(reload = () => location.reload()): void {
  const sw = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
  if (!sw?.controller) return;
  let pending = false;
  sw.addEventListener('controllerchange', () => {
    if (busy()) pending = true;
    else reload();
  });
  addEventListener('hashchange', () => { if (pending && !busy()) reload(); });
}
