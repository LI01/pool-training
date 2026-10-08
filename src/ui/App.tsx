import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { createStore, type Store } from '../db/store';
import { PLAN_DAYS } from '../plan';
import { detectLang, getLang, setLang, t } from '../i18n';
import { setChimeEnabled } from '../platform/chime';
import { setAutoSpeak } from '../platform/speech';
import { DiagramsReview } from './screens/DiagramsReview';
import { PlanOverview } from './screens/PlanOverview';
import { SessionRunner } from './screens/SessionRunner';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';
import { TestRunner } from './screens/TestRunner';
import { Today } from './screens/Today';
import { AppDataContext, useAppDataLoader } from './useAppData';
import { BigButton } from './components/BigButton';

import { navigate, type NowFn } from './nav';

export { navigate };
export type { NowFn };

const ROUTES = ['#/', '#/plan', '#/test', '#/progress', '#/settings', '#/diagrams'];
/** `#/day/<n>`: the session runner for plan day n. */
const dayOf = (hash: string): number | null => {
  const m = /^#\/day\/(\d+)$/.exec(hash);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= PLAN_DAYS ? n : null;
};

const defaultStore = () => createStore();

export function App({ store, now = Date.now }: { store?: Store; now?: NowFn }) {
  const [s] = useState(() => store ?? defaultStore());
  const data = useAppDataLoader(s, now);
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(location.hash || '#/');
    // Captured and optional: the cleanup can run after a test environment has torn the window down.
    const w = window;
    w.addEventListener('hashchange', on);
    return () => w.removeEventListener?.('hashchange', on);
  }, []);
  useEffect(() => { if (!data.loading) setChimeEnabled(data.settings.soundOn); }, [data.loading, data.settings.soundOn]);
  // Set before the screens render, which read the language through t() and the plan/diagram getters.
  const lang = data.settings.lang ?? detectLang();
  if (getLang() !== lang) setLang(lang);
  setAutoSpeak(data.settings.voiceOn !== false);
  const day = dayOf(hash);
  const known = ROUTES.includes(hash) || day !== null;
  useEffect(() => { if (!known) navigate('#/'); }, [known]);

  const isRunner = known && (day !== null || hash === '#/test');
  let screen;
  if (data.loading && data.loadError) {
    screen = (
      <main class="screen">
        <p class="notice notice--error" role="alert">{t('app.loadError', { error: data.loadError })}</p>
        <BigButton onClick={data.retry}>{t('app.retry')}</BigButton>
      </main>
    );
  } else if (data.loading) screen = <main class="screen" />;
  else if (day !== null) screen = <SessionRunner key={hash} day={day} now={now} />;
  else if (hash === '#/plan') screen = <PlanOverview />;
  else if (hash === '#/test') screen = <TestRunner now={now} />;
  else if (hash === '#/progress') screen = <Progress />;
  else if (hash === '#/settings') screen = <Settings now={now} />;
  else if (hash === '#/diagrams') screen = <DiagramsReview />;
  else screen = <Today now={now} />;

  const tabs: [string, string][] = [['#/', t('nav.today')], ['#/plan', t('nav.plan')], ['#/progress', t('nav.progress')], ['#/settings', t('nav.settings')]];
  return (
    <AppDataContext.Provider value={data}>
      {/* Keyed by language so a change remounts every screen in the new language (runner state lives in the store). */}
      <Fragment key={lang}>
        {screen}
        {!isRunner && (
          <nav class="nav" aria-label={t('nav.main')}>
            {tabs.map(([h, label]) => (
              <button type="button" key={h} class={hash === h ? 'nav__item nav__item--on' : 'nav__item'} aria-current={hash === h ? 'page' : undefined} onClick={() => navigate(h)}>
                {label}
              </button>
            ))}
          </nav>
        )}
      </Fragment>
    </AppDataContext.Provider>
  );
}
