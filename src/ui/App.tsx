import { useEffect, useState } from 'preact/hooks';
import { createStore, type Store } from '../db/store';
import type { SessionId } from '../plan';
import { setChimeEnabled } from '../platform/chime';
import { DiagramsReview } from './screens/DiagramsReview';
import { SessionRunner } from './screens/SessionRunner';
import { Settings } from './screens/Settings';
import { TestRunner } from './screens/TestRunner';
import { Today } from './screens/Today';
import { AppDataContext, useAppDataLoader } from './useAppData';

import { navigate, type NowFn } from './nav';

export { navigate };
export type { NowFn };

function ComingSoon() {
  return <main class="screen"><p>Coming soon</p></main>;
}

const defaultStore = () => createStore();

export function App({ store, now = Date.now }: { store?: Store; now?: NowFn }) {
  const [s] = useState(() => store ?? defaultStore());
  const data = useAppDataLoader(s, now);
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (!data.loading) setChimeEnabled(data.settings.soundOn); }, [data.loading, data.settings.soundOn]);

  const isRunner = hash.startsWith('#/session/') || hash === '#/test';
  let screen;
  if (data.loading) screen = <main class="screen" />;
  else if (hash === '#/session/am' || hash === '#/session/pm') screen = <SessionRunner key={hash} sessionId={hash.slice(10) as SessionId} now={now} />;
  else if (hash === '#/test') screen = <TestRunner now={now} />;
  else if (isRunner || hash === '#/progress') screen = <ComingSoon />;
  else if (hash === '#/settings') screen = <Settings now={now} />;
  else if (hash === '#/diagrams') screen = <DiagramsReview />;
  else screen = <Today now={now} />;

  const tabs: [string, string][] = [['#/', 'Today'], ['#/progress', 'Progress'], ['#/settings', 'Settings']];
  return (
    <AppDataContext.Provider value={data}>
      {screen}
      {!isRunner && (
        <nav class="nav" aria-label="Main">
          {tabs.map(([h, label]) => (
            <button type="button" key={h} class={hash === h ? 'nav__item nav__item--on' : 'nav__item'} aria-current={hash === h ? 'page' : undefined} onClick={() => navigate(h)}>
              {label}
            </button>
          ))}
        </nav>
      )}
    </AppDataContext.Provider>
  );
}
