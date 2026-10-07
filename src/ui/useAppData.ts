import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useState } from 'preact/hooks';
import { requestPersistence, type Store } from '../db/store';
import type { ActiveState, SessionRecord, Settings, TestRecord } from '../db/types';
import { localDate } from '../stats/dates';

export interface AppData {
  store: Store;
  sessions: SessionRecord[];
  tests: TestRecord[];
  settings: Settings;
  active: ActiveState | undefined;
  loading: boolean;
  /** Set when the first load failed; `retry` tries again. */
  loadError: string | null;
  retry(): void;
  refresh(): Promise<void>;
  today: string;
}

export const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const v = useContext(AppDataContext);
  if (!v) throw new Error('useAppData must be used inside the App provider');
  return v;
}

/** Loads everything from the store; used once by App to build the context value. */
export function useAppDataLoader(store: Store, now: () => number): AppData {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<Omit<AppData, 'store' | 'refresh' | 'today' | 'loadError' | 'retry'>>({
    sessions: [], tests: [], settings: { soundOn: true }, active: undefined, loading: true,
  });
  const refresh = useCallback(async () => {
    const [sessions, tests, settings, active] = await Promise.all([
      store.listSessions(), store.listTests(), store.getSettings(), store.getActive(),
    ]);
    setState({ sessions, tests, settings, active, loading: false });
  }, [store]);
  const retry = useCallback(() => {
    setLoadError(null);
    refresh().catch((err: unknown) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, [refresh]);
  useEffect(() => {
    retry();
    void requestPersistence();
  }, [retry]);
  return { store, ...state, loadError, retry, refresh, today: localDate(now()) };
}
