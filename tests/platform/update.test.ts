import { reloadOnUpdate } from '../../src/platform/update';

function fakeSW(controller: object | null) {
  const target = new EventTarget();
  vi.stubGlobal('navigator', { ...navigator, serviceWorker: Object.assign(target, { controller }) });
  return target;
}
afterEach(() => { vi.unstubAllGlobals(); location.hash = '#/'; });

test('a new version taking over reloads the page', () => {
  const sw = fakeSW({});
  const reload = vi.fn();
  location.hash = '#/';
  reloadOnUpdate(reload);
  sw.dispatchEvent(new Event('controllerchange'));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('during a session it waits until the session screen is left', () => {
  const sw = fakeSW({});
  const reload = vi.fn();
  location.hash = '#/day/3';
  reloadOnUpdate(reload);
  sw.dispatchEvent(new Event('controllerchange'));
  expect(reload).not.toHaveBeenCalled();
  location.hash = '#/test';
  dispatchEvent(new HashChangeEvent('hashchange'));
  expect(reload).not.toHaveBeenCalled();
  location.hash = '#/';
  dispatchEvent(new HashChangeEvent('hashchange'));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('the first install does not reload', () => {
  const sw = fakeSW(null);
  const reload = vi.fn();
  reloadOnUpdate(reload);
  sw.dispatchEvent(new Event('controllerchange'));
  expect(reload).not.toHaveBeenCalled();
});
