import { useEffect, useRef, useState } from 'preact/hooks';
import { DiagramCard } from '../../diagram/TableDiagram';
import { getDrillRef, getSession, plan, type Block, type SessionId } from '../../plan';
import type { BlockResult } from '../../db/types';
import { t, toLen, type Key } from '../../i18n';
import { acquireWakeLock, releaseWakeLock } from '../../platform/wakeLock';
import { playChime, unlockAudio } from '../../platform/chime';
import { blockScript, speakAuto, stopSpeaking } from '../../platform/speech';
import {
  addTime, back, endSession, next, pause, remainingMs, resume, startSession, toRecord,
  type EntryInput, type SessionRunState,
} from '../../runner/session';
import { BigButton } from '../components/BigButton';
import { EntrySheet } from '../components/EntrySheet';
import { LessonCard } from '../components/Lesson';
import { ReadAloud } from '../components/ReadAloud';
import { Sheet } from '../components/Sheet';
import { Timer } from '../components/Timer';
import { navigate, type NowFn } from '../nav';
import { useAppData } from '../useAppData';

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Run state plus the id of the SessionRecord once Finish has started, so a retried Finish overwrites instead of duplicating. */
type RunState = SessionRunState & { recordId?: string };

/** Validates a persisted payload; throws if it cannot be resumed. */
function restore(payload: unknown, sessionId: SessionId, blocks: Block[]): RunState {
  const p = payload as RunState;
  const ok = p && p.kind === 'session' && p.sessionId === sessionId
    && Number.isInteger(p.blockIndex) && p.blockIndex >= 0 && p.blockIndex < blocks.length
    && isNum(p.startedAt) && isNum(p.blockStartedAt) && isNum(p.pausedTotalMs) && isNum(p.sessionPausedMs)
    && isNum(p.extraMs) && (p.pausedAt === null || isNum(p.pausedAt))
    && typeof p.results === 'object' && p.results !== null && typeof p.finished === 'boolean'
    && (p.recordId === undefined || typeof p.recordId === 'string');
  if (!ok) throw new Error('corrupt session state');
  return p;
}

function resultText(r: BlockResult | undefined): string {
  if (!r) return '—';
  if (r.skipped) return t('common.skipped');
  if (r.draw) return t('result.draw', { best: toLen(r.draw.bestIn), typical: toLen(r.draw.typicalIn) });
  if (r.runs) return `${t('result.runs', { success: r.runs.success, attempts: r.runs.attempts })}${r.runs.failTags.length ? ` · ${r.runs.failTags.join(' ')}` : ''}`;
  if (r.generic) return t('result.made', { made: r.generic.made, attempts: r.generic.attempts });
  if (r.notes !== undefined) return r.notes || '—';
  return '—';
}

function LeaveButton({ onLeave }: { onLeave: () => void }) {
  return <button type="button" class="runner__leave" aria-label={t('session.leave')} onClick={onLeave}>×</button>;
}

export function SessionRunner({ sessionId, now }: { sessionId: SessionId; now: NowFn }) {
  const { store, active, refresh } = useAppData();
  const session = getSession(sessionId);
  const blocks = session.blocks;

  const [toast, setToast] = useState<string | null>(null);
  const [state, setState] = useState<RunState | null>(() => {
    if (active?.type !== 'session' || (active.payload as { sessionId?: unknown } | null)?.sessionId !== sessionId) return null;
    try { return restore(active.payload, sessionId, blocks); } catch { return null; }
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [, setTick] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  const chimed = useRef<string | null>(null);
  const prevRemaining = useRef<number | null>(null);

  // Corrupt saved state: clear it and tell the user.
  useEffect(() => {
    if (state || active?.type !== 'session' || (active.payload as { sessionId?: unknown } | null)?.sessionId !== sessionId) return;
    void store.setActive(undefined).then(refresh);
    setToast(t('session.restoreFailed'));
  }, []);

  // Hold the wake lock while the runner is open with a session in progress.
  const running = state !== null;
  useEffect(() => {
    if (!running) return;
    void acquireWakeLock();
    return () => { void releaseWakeLock(); };
  }, [running]);

  // Tick every second; chime once when a block crosses zero.
  const finished = state?.finished ?? false;
  useEffect(() => {
    if (!running || finished) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [running, finished]);

  // Stop reading when the session finishes or the runner closes.
  useEffect(() => { if (finished) stopSpeaking(); }, [finished]);
  useEffect(() => () => stopSpeaking(), []);

  // Chime once when the clock crosses zero. Keyed by block run and added time,
  // so +2 min after zero re-arms one more chime; restoring a block already in overtime never chimes.
  useEffect(() => {
    if (!state || state.finished) { prevRemaining.current = null; return; }
    const rem = remainingMs(state, blocks, now());
    const key = `${state.blockIndex}:${state.blockStartedAt}:${state.extraMs}`;
    if (prevRemaining.current !== null && prevRemaining.current > 0 && rem <= 0 && chimed.current !== key) {
      chimed.current = key;
      playChime();
    }
    prevRemaining.current = rem;
  });

  const update = (s: RunState) => {
    setState(s);
    store.setActive({ type: 'session', payload: s, updatedAt: now() }).then(
      () => setSaveError(null),
      () => setSaveError(t('session.saveProgressError')),
    );
  };

  const leave = () => { void refresh(); navigate('#/'); };

  if (!state) {
    return (
      <main class="screen runner-pre">
        <header class="runner__top">
          <span class="runner__meta">{t(sessionId === 'am' ? 'session.am' : 'session.pm')}</span>
          <LeaveButton onLeave={leave} />
        </header>
        {toast && <p class="notice notice--error" role="status">{toast}</p>}
        <h1 class="runner-pre__title">{session.title}</h1>
        <details class="intro">
          <summary>{t('session.intro')}</summary>
          {plan.intro.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
        </details>
        <ol class="block-list">
          {blocks.map((b) => (
            <li key={b.id}><span>{b.name}</span><span class="block-list__min">{t('session.minutes', { n: b.minutes })}</span></li>
          ))}
        </ol>
        <div class="runner-pre__start">
          <BigButton variant="good" onClick={() => {
            unlockAudio();
            update(startSession(sessionId, now()));
            speakAuto(blockScript(blocks[0]));
          }}>{t('session.start')}</BigButton>
        </div>
      </main>
    );
  }

  if (state.finished) {
    const preview = toRecord(state, blocks, plan.version, now());
    const finish = async () => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setFinishing(true);
      setSaveError(null);
      try {
        // Persist the record id before the put, so a Finish after a failed clear (or a reload) reuses it.
        const recordId = state.recordId ?? crypto.randomUUID();
        if (!state.recordId) {
          const withId = { ...state, recordId };
          await store.setActive({ type: 'session', payload: withId, updatedAt: now() });
          setState(withId);
        }
        await store.putSession({ ...toRecord(state, blocks, plan.version, now()), id: recordId });
      } catch {
        finishingRef.current = false;
        setFinishing(false);
        setSaveError(t('session.saveError'));
        return;
      }
      await store.setActive(undefined).catch(() => {});
      void releaseWakeLock();
      await refresh();
      navigate('#/');
    };
    return (
      <main class="screen runner-summary">
        <header class="runner__top">
          <span class="runner__meta">{t('session.complete')}</span>
          <LeaveButton onLeave={leave} />
        </header>
        <h1>{session.title}</h1>
        {saveError && <p class="notice notice--error" role="alert">{saveError}</p>}
        <p class="runner-summary__minutes"><strong>{preview.activeMinutes}</strong> {t(preview.activeMinutes === 1 ? 'session.activeMinute' : 'session.activeMinutes')}</p>
        <dl class="summary-list">
          {blocks.filter((b) => b.record !== 'no').map((b) => (
            <div key={b.id}><dt>{b.name}</dt><dd>{resultText(state.results[b.id])}</dd></div>
          ))}
        </dl>
        <div class="controls">
          <BigButton onClick={() => update(back(state, now()))}>{t('common.back')}</BigButton>
          <BigButton variant="good" onClick={finish} disabled={finishing}>{t('session.finish')}</BigButton>
        </div>
      </main>
    );
  }

  const block = blocks[state.blockIndex];
  const rem = remainingMs(state, blocks, now());

  const ref = block.drillRefId ? getDrillRef(block.drillRefId) : undefined;
  const advance = (entry?: EntryInput) => {
    setSheetOpen(false);
    const s = next(state, blocks, now(), entry);
    update(s);
    if (!s.finished) speakAuto(blockScript(blocks[s.blockIndex]));
  };
  const paused = state.pausedAt !== null;

  const details: [Key, string][] = [
    ['session.setup', block.setup], ['session.volume', block.volume], ['session.howToTrain', block.howToTrain],
    ['session.successStandard', block.successStandard], ['session.purpose', block.purpose],
  ];

  return (
    <>
      <main class="runner" onClickCapture={unlockAudio} aria-hidden={confirmEnd ? 'true' : undefined}>
        <div class="runner__head">
          <DiagramCard key={block.diagramId} diagramId={block.diagramId} />
          <div class="runner__row">
            <span class="runner__meta">{t('session.blockOf', { time: block.timeLabel, i: state.blockIndex + 1, n: blocks.length })}</span>
            <span class="runner__row">
              <button type="button" class="link-button" onClick={() => setConfirmEnd(true)}>{t('session.end')}</button>
              <LeaveButton onLeave={leave} />
            </span>
          </div>
          <div class="runner__row">
            <h2 class="runner__name">{block.name}</h2>
            <ReadAloud key={block.id} script={blockScript(block)} />
          </div>
          <Timer ms={rem} paused={paused} />
        </div>
        <div class="runner__body" key={block.id}>
          {saveError && <p class="notice notice--error" role="status">{saveError}</p>}
          <dl class="block-info">
            {details.map(([k, v]) => <div key={k}><dt>{t(k)}</dt><dd>{v}</dd></div>)}
          </dl>
          <LessonCard item={block} />
          {ref && (
            <details class="drill-ref">
              <summary>{t('session.drillRef')}</summary>
              <dl class="block-info">
                {([
                  ['session.ballPlacement', ref.ballPlacement], ['session.executionCue', ref.executionCue], ['session.commonMistake', ref.commonMistake],
                  ['session.progression', ref.progression], ['session.whenToUseReducer', ref.whenToUseReducer],
                ] as [Key, string][]).map(([k, v]) => <div key={k}><dt>{t(k)}</dt><dd>{v}</dd></div>)}
              </dl>
            </details>
          )}
        </div>
        <div class="controls">
          <button type="button" class="control" disabled={state.blockIndex === 0} onClick={() => { stopSpeaking(); update(back(state, now())); }}>{t('common.back')}</button>
          <button type="button" class="control" onClick={() => { if (!paused) stopSpeaking(); update(paused ? resume(state, now()) : pause(state, now())); }}>{paused ? t('session.resume') : t('session.pause')}</button>
          <button type="button" class="control" onClick={() => update(addTime(state, 120000))}>{t('session.addTime')}</button>
          <button type="button" class="control control--next" onClick={() => (block.record === 'no' || !block.recordKind ? advance() : setSheetOpen(true))}>{t('session.next')}</button>
        </div>
        {sheetOpen && block.recordKind && (
          <EntrySheet
            key={block.id}
            kind={block.recordKind}
            record={block.record}
            title={block.name}
            initial={state.results[block.id]}
            onSubmit={(e) => advance(e)}
            onSkip={() => advance({ skipped: true })}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </main>
      {confirmEnd && (
        <Sheet title={t('session.end')} onClose={() => setConfirmEnd(false)}>
          <p class="sheet__text">{t('session.endText')}</p>
          <div class="sheet__actions sheet__actions--row">
            <BigButton onClick={() => setConfirmEnd(false)}>{t('common.keepGoing')}</BigButton>
            <BigButton variant="bad" onClick={() => { setConfirmEnd(false); update(endSession(state, blocks, now())); }}>{t('session.endNow')}</BigButton>
          </div>
        </Sheet>
      )}
    </>
  );
}
