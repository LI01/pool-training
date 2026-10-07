import { useEffect, useRef, useState } from 'preact/hooks';
import { DiagramCard } from '../../diagram/TableDiagram';
import { getTestDef, plan, TEST_ORDER, type ErrorCodeId, type TestDef, type TestId } from '../../plan';
import type { Shot } from '../../db/types';
import { fromLen, t, toLen, type Key } from '../../i18n';
import { acquireWakeLock, releaseWakeLock } from '../../platform/wakeLock';
import { unlockAudio } from '../../platform/chime';
import { speakAuto, stopSpeaking, testScript } from '../../platform/speech';
import {
  advance, currentTest, isComplete, LIMITS, nextCutSide, recordShot, setDraw, skip, startTest, tagLast,
  toTestRecord, undo, type TestRunState,
} from '../../runner/test';
import { errorTotals, testScores } from '../../stats';
import { BigButton } from '../components/BigButton';
import { ReadAloud } from '../components/ReadAloud';
import { Sheet } from '../components/Sheet';
import { TagPicker } from '../components/TagPicker';
import { navigate, type NowFn } from '../nav';
import { useAppData } from '../useAppData';

const SHOT_TESTS = ['straight', 'cut', 'stop', 'fiveBall'] as const;
const LABELS: Record<TestDef['kind'], [Key, Key] | null> = {
  makeMiss: ['test.make', 'test.miss'], makeMissLR: ['test.make', 'test.miss'], runs: ['test.cleared', 'test.failed'], distances: null,
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isShot = (s: unknown) => {
  const x = s as Shot;
  return !!x && typeof x.ok === 'boolean' && (x.tag === undefined || ['P', 'C', 'S', 'D'].includes(x.tag))
    && (x.side === undefined || x.side === 'L' || x.side === 'R');
};

/** Run state plus the id of the TestRecord once Save has started, so a retried Save overwrites instead of duplicating. */
type RunState = TestRunState & { recordId?: string };

/** Validates a persisted payload; throws if it cannot be resumed. */
function restore(payload: unknown): RunState {
  const p = payload as RunState;
  const ok = p && p.kind === 'test' && isNum(p.startedAt)
    && Number.isInteger(p.index) && p.index >= 0 && p.index <= TEST_ORDER.length
    && typeof p.shots === 'object' && p.shots !== null
    && SHOT_TESTS.every((id) => Array.isArray(p.shots[id]) && p.shots[id].length <= LIMITS[id] && p.shots[id].every(isShot))
    && Array.isArray(p.draw) && p.draw.length === 5 && p.draw.every((d) => d === null || isNum(d))
    && Array.isArray(p.skipped) && p.skipped.every((id) => TEST_ORDER.includes(id))
    && (p.recordId === undefined || typeof p.recordId === 'string');
  if (!ok) throw new Error('corrupt test state');
  return p;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Parses a draw distance; undefined = invalid text, null = empty. */
function parseDraw(text: string): number | null | undefined {
  const s = text.trim().replace(',', '.');
  if (s === '') return null;
  const v = fromLen(Number(s));
  return Number.isFinite(v) && v >= 0 && v <= 120 ? v : undefined;
}

function LeaveButton({ onLeave }: { onLeave: () => void }) {
  return <button type="button" class="runner__leave" aria-label={t('test.leave')} onClick={onLeave}>×</button>;
}

function ShotDots({ shots, limit, label }: { shots: Shot[]; limit: number; label?: string }) {
  return (
    <div class="dots-row">
      {label && <span class="dots-row__label">{label}</span>}
      <ol class="dots" aria-label={label ? t('test.sideShots', { side: label }) : t('test.shots')}>
        {Array.from({ length: limit }, (_, i) => {
          const s = shots[i];
          if (!s) return <li key={i} class="dot dot--empty" />;
          return (
            <li key={i} class={s.ok ? 'dot dot--ok' : 'dot dot--miss'} aria-label={t(s.ok ? 'test.shotMake' : s.tag ? 'test.shotMissTag' : 'test.shotMiss', { n: i + 1, tag: s.tag ?? '' })}>
              {s.ok ? '' : s.tag ?? ''}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DrawInputs({ draw, onChange }: { draw: (number | null)[]; onChange: (i: number, v: number | null) => void }) {
  const [text, setText] = useState(() => draw.map((d) => (d === null ? '' : String(toLen(d)))));
  const values = draw.filter((d): d is number => d !== null);
  const avg = values.length ? `${toLen(r1(values.reduce((a, b) => a + b, 0) / values.length))}${t('unit.len')}` : '–';
  return (
    <div class="draw-inputs">
      <p class="draw-inputs__avg">{t('test.average', { avg })}</p>
      {text.map((txt, i) => {
        const invalid = parseDraw(txt) === undefined;
        return (
          <label key={i} class="field draw-inputs__field">
            <span>{t('test.drawN', { n: i + 1 })}</span>
            <input
              type="text" inputMode="decimal" autoComplete="off" value={txt} aria-invalid={invalid ? 'true' : undefined}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value;
                setText((prev) => prev.map((p, j) => (j === i ? v : p)));
                onChange(i, parseDraw(v) ?? null);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

export function TestRunner({ now }: { now: NowFn }) {
  const { store, active, refresh } = useAppData();

  const [toast, setToast] = useState<string | null>(null);
  const [state, setState] = useState<RunState | null>(() => {
    if (active?.type !== 'test') return null;
    try { return restore(active.payload); } catch { return null; }
  });
  const [sheet, setSheet] = useState<'tag' | 'end' | 'skip' | 'discard' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  // Latest state, so taps landing before the next render (or several inputs in one task) never act on a stale copy.
  const stateRef = useRef(state);

  // Corrupt saved state: clear it and tell the user.
  useEffect(() => {
    if (state || active?.type !== 'test') return;
    void store.setActive(undefined).then(refresh);
    setToast(t('test.restoreFailed'));
  }, []);

  // Hold the wake lock while a test is in progress.
  const running = state !== null;
  useEffect(() => {
    if (!running) return;
    void acquireWakeLock();
    return () => { void releaseWakeLock(); };
  }, [running]);
  useEffect(() => () => stopSpeaking(), []);

  const update = (s: RunState) => {
    stateRef.current = s;
    setState(s);
    store.setActive({ type: 'test', payload: s, updatedAt: now() }).then(
      () => setSaveError(null),
      () => setSaveError(t('session.saveProgressError')),
    );
  };

  const leave = () => { void refresh(); navigate('#/'); };
  const modal = sheet !== null ? 'true' : undefined;

  if (!state) {
    return (
      <main class="screen runner-pre">
        <header class="runner__top">
          <span class="runner__meta">{t('test.standard')}</span>
          <LeaveButton onLeave={leave} />
        </header>
        {toast && <p class="notice notice--error" role="status">{toast}</p>}
        <h1 class="runner-pre__title">{t('test.title')}</h1>
        <p class="test-intro">{t('test.intro')}</p>
        <ol class="block-list">
          {TEST_ORDER.map((id) => {
            const def = getTestDef(id);
            return <li key={id}><span>{def.name}</span><span class="block-list__min">{def.attempts}</span></li>;
          })}
        </ol>
        <div class="runner-pre__start">
          <BigButton variant="good" onClick={() => {
            unlockAudio();
            update(startTest(now()));
            speakAuto(testScript(getTestDef(TEST_ORDER[0])));
          }}>{t('test.start')}</BigButton>
        </div>
      </main>
    );
  }

  const id = currentTest(state);

  if (id === null) {
    const record = toTestRecord(state, plan.version, now());
    const sc = testScores(record);
    const errs = errorTotals([], [record]);
    const rows: [TestId, string | undefined][] = [
      ['straight', sc.straight === undefined ? undefined : `${sc.straight}/10`],
      ['cut', sc.cut === undefined ? undefined : t('test.cutScore', { cut: sc.cut, l: sc.cutL ?? 0, r: sc.cutR ?? 0 })],
      ['stop', sc.stop === undefined ? undefined : `${sc.stop}/10`],
      ['draw', sc.drawAvg === undefined ? undefined : `${toLen(sc.drawAvg)}${t('unit.len')}`],
      ['fiveBall', sc.fiveBall === undefined ? undefined : `${sc.fiveBall}/5`],
    ];
    const save = async () => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setFinishing(true);
      setSaveError(null);
      try {
        // Persist the record id before the put, so a Save after a failed clear (or a reload) reuses it.
        const recordId = state.recordId ?? crypto.randomUUID();
        if (!state.recordId) {
          const withId = { ...state, recordId };
          await store.setActive({ type: 'test', payload: withId, updatedAt: now() });
          stateRef.current = withId;
          setState(withId);
        }
        await store.putTest({ ...toTestRecord(state, plan.version, now()), id: recordId });
      } catch {
        finishingRef.current = false;
        setFinishing(false);
        setSaveError(t('test.saveError'));
        return;
      }
      await store.setActive(undefined).catch(() => {});
      void releaseWakeLock();
      await refresh();
      navigate('#/');
    };
    const discard = async () => {
      setSheet(null);
      try {
        await store.setActive(undefined);
      } catch {
        setSaveError(t('test.discardError'));
        return;
      }
      void releaseWakeLock();
      await refresh();
      navigate('#/');
    };
    return (
      <>
        <main class="screen runner-summary" aria-hidden={modal}>
          <header class="runner__top">
            <span class="runner__meta">{t('test.summary')}</span>
            <LeaveButton onLeave={leave} />
          </header>
          <h1>{t('test.standard')}</h1>
          {saveError && <p class="notice notice--error" role="alert">{saveError}</p>}
          <dl class="summary-list">
            {rows.map(([tid, score]) => (
              <div key={tid}>
                <dt>{getTestDef(tid).name}</dt>
                <dd>
                  <span>{score ?? '–'}</span>
                  {score === undefined && (
                    <span class="summary-note">{state.skipped.includes(tid) ? t('common.skipped') : t('test.notCounted')}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p class="summary-errors">
            {(['P', 'C', 'S', 'D'] as ErrorCodeId[]).map((c) => <span key={c}><b>{c}</b> {errs[c]}</span>)}
          </p>
          <div class="controls">
            <BigButton onClick={() => setSheet('discard')}>{t('common.discard')}</BigButton>
            <BigButton variant="good" onClick={save} disabled={finishing}>{t('common.save')}</BigButton>
          </div>
        </main>
        {sheet === 'discard' && (
          <Sheet title={t('test.discardTitle')} onClose={() => setSheet(null)}>
            <p class="sheet__text">{t('test.discardText')}</p>
            <div class="sheet__actions sheet__actions--row">
              <BigButton onClick={() => setSheet(null)}>{t('common.cancel')}</BigButton>
              <BigButton variant="bad" onClick={discard}>{t('test.discardTitle')}</BigButton>
            </div>
          </Sheet>
        )}
      </>
    );
  }

  const def = getTestDef(id);
  const isLast = state.index === TEST_ORDER.length - 1;
  const shots = id === 'draw' ? [] : state.shots[id];
  const limit = id === 'draw' ? 5 : LIMITS[id];
  const done = id === 'draw' ? state.draw.filter((d) => d !== null).length : shots.length;
  const full = done >= limit;
  const side = nextCutSide(state);
  const [goodLabel, badLabel] = (id === 'stop' ? ['test.success', 'test.fail'] as const : LABELS[def.kind])?.map((k) => t(k)) ?? ['', ''];

  /** Applies an action to the latest state, only while that state is still on the test this screen shows. */
  const apply = (f: (s: TestRunState) => TestRunState) => {
    const cur = stateRef.current!;
    if (currentTest(cur) === id) update(f(cur));
  };
  /** After Next/Skip/End: reads the next test's setup, or stops reading when the test is over. */
  const announce = () => {
    const nid = currentTest(stateRef.current!);
    if (nid === id) return;
    if (nid) speakAuto(testScript(getTestDef(nid)));
    else stopSpeaking();
  };
  const miss = () => {
    const before = stateRef.current;
    apply((s) => recordShot(s, false));
    if (stateRef.current !== before) setSheet('tag');
  };
  const skipNow = () => { setSheet(null); apply(skip); announce(); };
  const pickTag = (tag: ErrorCodeId | null) => {
    setSheet(null);
    if (tag) apply((s) => tagLast(s, tag));
  };

  return (
    <>
      <main class="runner test-runner" aria-hidden={modal}>
        <div class="runner__head">
          <DiagramCard
            key={`${def.diagramId}-${id === 'cut' ? side : ''}`}
            diagramId={def.diagramId}
            panel={id === 'cut' ? (side === 'L' ? 0 : 1) : undefined}
          />
          <div class="runner__row">
            <span class="runner__meta">{t('test.indexOf', { i: state.index + 1, n: TEST_ORDER.length })}</span>
            <span class="runner__row">
              <button type="button" class="link-button" onClick={() => setSheet('end')}>{t('test.end')}</button>
              <LeaveButton onLeave={leave} />
            </span>
          </div>
        </div>
        <div class="runner__body" key={id}>
          {saveError && <p class="notice notice--error" role="status">{saveError}</p>}
          <div class="runner__row">
            <h2 class="runner__name">{def.name}</h2>
            <ReadAloud key={id} script={testScript(def)} />
          </div>
          <p class="test-setup">{def.setup}</p>
          <p class="test-chip">{t('test.chip')}</p>
          <p class="test-progress" aria-live="polite">{t('test.progress', { done, limit })}</p>
          {id === 'draw' && <DrawInputs draw={state.draw} onChange={(i, v) => apply((s) => setDraw(s, i, v))} />}
        </div>
        {id !== 'draw' && (
          <div class="score-pad">
            {id === 'cut' && (
              <p class={`cut-banner cut-banner--${side}`}>{side === 'L' ? t('test.cuttingLeft') : t('test.cuttingRight')}</p>
            )}
            <div class="score-pad__buttons">
              <BigButton variant="good" disabled={full} onClick={() => apply((s) => recordShot(s, true))}>{goodLabel}</BigButton>
              <BigButton variant="bad" disabled={full} onClick={miss}>{badLabel}</BigButton>
            </div>
            {id === 'cut' ? (
              <>
                <ShotDots shots={shots.slice(0, 10)} limit={10} label={t('test.left')} />
                <ShotDots shots={shots.slice(10)} limit={10} label={t('test.right')} />
              </>
            ) : <ShotDots shots={shots} limit={limit} />}
          </div>
        )}
        <div class="controls">
          <button type="button" class="control" disabled={id === 'draw' || shots.length === 0} onClick={() => apply(undo)}>{t('test.undo')}</button>
          <button type="button" class="control" onClick={() => (done > 0 ? setSheet('skip') : skipNow())}>{t('test.skip')}</button>
          <button type="button" class="control control--next" disabled={!isComplete(state, id)} onClick={() => { apply((s) => (isComplete(s, id) ? advance(s) : s)); announce(); }}>
            {isLast ? t('test.finish') : t('test.next')}
          </button>
        </div>
      </main>
      {sheet === 'tag' && (
        <Sheet title={t('test.whyMiss')} onClose={() => setSheet(null)}>
          <p class="sheet__text">{t('test.whyMissOptional')}</p>
          <TagPicker onPick={pickTag} />
        </Sheet>
      )}
      {sheet === 'skip' && (
        <Sheet title={t('test.skip')} onClose={() => setSheet(null)}>
          <p class="sheet__text">{t(done === 1 ? 'test.skipText1' : 'test.skipTextN', { name: def.name, n: done })}</p>
          <div class="sheet__actions sheet__actions--row">
            <BigButton onClick={() => setSheet(null)}>{t('common.keepGoing')}</BigButton>
            <BigButton variant="bad" onClick={skipNow}>{t('test.skipThis')}</BigButton>
          </div>
        </Sheet>
      )}
      {sheet === 'end' && (
        <Sheet title={t('test.end')} onClose={() => setSheet(null)}>
          <p class="sheet__text">{t('test.endText')}</p>
          <div class="sheet__actions sheet__actions--row">
            <BigButton onClick={() => setSheet(null)}>{t('common.keepGoing')}</BigButton>
            <BigButton variant="bad" onClick={() => { setSheet(null); apply((s) => ({ ...s, index: TEST_ORDER.length })); announce(); }}>{t('test.endNow')}</BigButton>
          </div>
        </Sheet>
      )}
    </>
  );
}
