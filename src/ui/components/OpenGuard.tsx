import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { ActiveState, SessionRecord } from '../../db/types';
import { getDay, plan, TEST_ORDER } from '../../plan';
import { toRecord, type SessionRunState } from '../../runner/session';
import { navigate } from '../nav';
import { useAppData } from '../useAppData';
import { BigButton } from './BigButton';
import { Sheet } from './Sheet';

/** Where the saved in-progress session or test lives, if it can be resumed. */
export function activeHashOf(active: { type: string; payload: unknown } | undefined): string | undefined {
  if (active?.type === 'test') return '#/test';
  const day = active?.type === 'session' ? (active.payload as { dayNumber?: unknown } | null)?.dayNumber : undefined;
  return typeof day === 'number' ? `#/day/${day}` : undefined;
}

/** A saved session as a record of the drills done so far; undefined when none were done. */
function sessionRecord(active: ActiveState): SessionRecord | undefined {
  const s = active.payload as SessionRunState & { recordId?: string };
  try {
    if (!s.results || !Object.keys(s.results).length) return undefined;
    // An unfinished session ends at its last change, not when another one is opened.
    return { ...toRecord(s, getDay(s.dayNumber).blocks, plan.version, active.updatedAt), id: s.recordId ?? crypto.randomUUID() };
  } catch {
    return undefined;
  }
}

/**
 * Opening a session or test while another one is in progress: asks to resume it, or to end it first.
 * A session's drills done so far are saved; a test is discarded.
 * Returns `open(hash)` and the sheet to render.
 */
export function useOpenGuard() {
  const { store, active, refresh } = useAppData();
  const [pending, setPending] = useState<string | null>(null);
  const [endError, setEndError] = useState<string | null>(null);
  const activeHash = activeHashOf(active);
  // Completed on the runner's summary but not yet saved.
  const activeFinished = active?.type === 'session'
    ? (active.payload as { finished?: unknown } | null)?.finished === true
    : active?.type === 'test' && ((active.payload as { index?: number } | null)?.index ?? 0) >= TEST_ORDER.length;
  const closePending = () => { setPending(null); setEndError(null); };
  const isSession = active?.type === 'session';
  const endAndStart = async () => {
    const h = pending!;
    try {
      const record = isSession ? sessionRecord(active) : undefined;
      if (record) await store.putSession(record);
      await store.setActive(undefined);
    } catch {
      setEndError(t(isSession ? 'today.saveError' : 'today.discardError'));
      return;
    }
    await refresh();
    closePending();
    navigate(h);
  };
  const open = (hash: string) => {
    if (activeHash && activeHash !== hash) setPending(hash);
    else navigate(hash);
  };
  const sheet = pending && (
    <Sheet title={activeFinished ? t('today.notSaved') : t('today.anotherInProgress')} onClose={closePending}>
      <p class="sheet__text">
        {activeFinished
          ? t(active?.type === 'test' ? 'today.testNotSaved' : 'today.sessionNotSaved')
          : t(isSession ? 'today.saveItText' : 'today.discardIt')}
      </p>
      {endError && <p class="notice notice--error" role="alert">{endError}</p>}
      <div class="sheet__actions">
        <BigButton onClick={() => { const h = activeHash!; closePending(); navigate(h); }}>{activeFinished ? t('today.saveIt') : t('today.resumeIt')}</BigButton>
        <BigButton variant={isSession ? 'good' : 'bad'} onClick={endAndStart}>{isSession ? t('today.saveStart') : activeFinished ? t('common.discard') : t('today.discardStart')}</BigButton>
      </div>
    </Sheet>
  );
  return { open, sheet };
}
