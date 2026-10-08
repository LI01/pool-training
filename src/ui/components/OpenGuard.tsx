import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { TEST_ORDER } from '../../plan';
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

/**
 * Opening a session or test while another one is in progress: asks to resume it or discard it first.
 * Returns `open(hash)` and the sheet to render.
 */
export function useOpenGuard() {
  const { store, active, refresh } = useAppData();
  const [pending, setPending] = useState<string | null>(null);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const activeHash = activeHashOf(active);
  // Completed on the runner's summary but not yet saved: discarding loses a whole session/test.
  const activeFinished = active?.type === 'session'
    ? (active.payload as { finished?: unknown } | null)?.finished === true
    : active?.type === 'test' && ((active.payload as { index?: number } | null)?.index ?? 0) >= TEST_ORDER.length;
  const closePending = () => { setPending(null); setDiscardError(null); };
  const discardAndStart = async () => {
    const h = pending!;
    try {
      await store.setActive(undefined);
    } catch {
      setDiscardError(t('today.discardError'));
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
          : t('today.discardIt')}
      </p>
      {discardError && <p class="notice notice--error" role="alert">{discardError}</p>}
      <div class="sheet__actions">
        <BigButton onClick={() => { const h = activeHash!; closePending(); navigate(h); }}>{activeFinished ? t('today.saveIt') : t('today.resumeIt')}</BigButton>
        <BigButton variant="bad" onClick={discardAndStart}>{activeFinished ? t('common.discard') : t('today.discardStart')}</BigButton>
      </div>
    </Sheet>
  );
  return { open, sheet };
}
