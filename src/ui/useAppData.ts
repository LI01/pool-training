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
  const [state, setState] = useState<Omit<AppData, 'store' | 'refresh' | 'today'>>({
    sessions: [], tests: [], settings: { soundOn: true }, active: undefined, loading: true,
  });
  const refresh = useCallback(async () => {
    const [sessions, tests, settings, active] = await Promise.all([
      store.listSessions(), store.listTests(), store.getSettings(), store.getActive(),
    ]);
    setState({ sessions, tests, settings, active, loading: false });
  }, [store]);
  useEffect(() => {
    void refresh();
    void requestPersistence();
  }, [refresh]);
  return { store, ...state, refresh, today: localDate(now()) };
}
