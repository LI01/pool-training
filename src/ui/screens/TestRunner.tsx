import { useEffect, useRef, useState } from 'preact/hooks';
import { DiagramCard } from '../../diagram/TableDiagram';
import { getTestDef, plan, TEST_ORDER, type ErrorCodeId, type TestDef, type TestId } from '../../plan';
import type { Shot } from '../../db/types';
import { acquireWakeLock, releaseWakeLock } from '../../platform/wakeLock';
import { unlockAudio } from '../../platform/chime';
import {
  advance, currentTest, isComplete, LIMITS, nextCutSide, recordShot, setDraw, skip, startTest, tagLast,
  toTestRecord, undo, type TestRunState,
} from '../../runner/test';
import { errorTotals, testScores } from '../../stats';
import { BigButton } from '../components/BigButton';
import { Sheet } from '../components/Sheet';
import { TagPicker } from '../components/TagPicker';
import { navigate, type NowFn } from '../nav';
import { useAppData } from '../useAppData';

/** "Standard Test" sheet, cell A2 of the plan workbook. */
const TEST_INTRO = 'Use the same ball positions, normal pockets, same cue ball, and similar table conditions each time. Do not add extra attempts to the score.';
const SHOT_TESTS = ['straight', 'cut', 'stop', 'fiveBall'] as const;
const LABELS: Record<TestDef['kind'], [string, string]> = {
  makeMiss: ['Make', 'Miss'], makeMissLR: ['Make', 'Miss'], runs: ['Cleared', 'Failed'], distances: ['', ''],
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isShot = (s: unknown) => {
  const x = s as Shot;
  return !!x && typeof x.ok === 'boolean' && (x.tag === undefined || ['P', 'C', 'S', 'D'].includes(x.tag))
    && (x.side === undefined || x.side === 'L' || x.side === 'R');
};

/** Validates a persisted payload; throws if it cannot be resumed. */
function restore(payload: unknown): TestRunState {
  const p = payload as TestRunState;
  const ok = p && p.kind === 'test' && isNum(p.startedAt)
    && Number.isInteger(p.index) && p.index >= 0 && p.index <= TEST_ORDER.length
    && typeof p.shots === 'object' && p.shots !== null
    && SHOT_TESTS.every((id) => Array.isArray(p.shots[id]) && p.shots[id].length <= LIMITS[id] && p.shots[id].every(isShot))
    && Array.isArray(p.draw) && p.draw.length === 5 && p.draw.every((d) => d === null || isNum(d))
    && Array.isArray(p.skipped) && p.skipped.every((id) => TEST_ORDER.includes(id));
  if (!ok) throw new Error('corrupt test state');
  return p;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Parses a draw distance; undefined = invalid text, null = empty. */
function parseDraw(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 && v <= 120 ? v : undefined;
}

function LeaveButton({ onLeave }: { onLeave: () => void }) {
  return <button type="button" class="runner__leave" aria-label="Leave test" onClick={onLeave}>×</button>;
}

function ShotDots({ shots, limit, label }: { shots: Shot[]; limit: number; label?: string }) {
  return (
    <div class="dots-row">
      {label && <span class="dots-row__label">{label}</span>}
      <ol class="dots" aria-label={label ? `${label} shots` : 'Shots'}>
        {Array.from({ length: limit }, (_, i) => {
          const s = shots[i];
          if (!s) return <li key={i} class="dot dot--empty" />;
          return (
            <li key={i} class={s.ok ? 'dot dot--ok' : 'dot dot--miss'} aria-label={`Shot ${i + 1}: ${s.ok ? 'make' : `miss${s.tag ? `, ${s.tag}` : ''}`}`}>
              {s.ok ? '' : s.tag ?? ''}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DrawInputs({ draw, onChange }: { draw: (number | null)[]; onChange: (i: number, v: number | null) => void }) {
  const [text, setText] = useState(() => draw.map((d) => (d === null ? '' : String(d))));
  const values = draw.filter((d): d is number => d !== null);
  const avg = values.length ? `${r1(values.reduce((a, b) => a + b, 0) / values.length)}"` : '–';
  return (
    <div class="draw-inputs">
      <p class="draw-inputs__avg">Average: {avg}</p>
      {text.map((t, i) => {
        const invalid = parseDraw(t) === undefined;
        return (
          <label key={i} class="field draw-inputs__field">
            <span>Draw {i + 1} (in)</span>
            <input
              type="text" inputMode="decimal" autoComplete="off" value={t} aria-invalid={invalid ? 'true' : undefined}
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
  const [state, setState] = useState<TestRunState | null>(() => {
    if (active?.type !== 'test') return null;
    try { return restore(active.payload); } catch { return null; }
  });
  const [sheet, setSheet] = useState<'tag' | 'end' | 'discard' | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false);
  // Latest state, so taps landing before the next render (or several inputs in one task) never act on a stale copy.
  const stateRef = useRef(state);

  // Corrupt saved state: clear it and tell the user.
  useEffect(() => {
    if (state || active?.type !== 'test') return;
    void store.setActive(undefined).then(refresh);
    setToast("Previous test couldn't be restored");
  }, []);

  // Hold the wake lock while a test is in progress.
  const running = state !== null;
  useEffect(() => {
    if (!running) return;
    void acquireWakeLock();
    return () => { void releaseWakeLock(); };
  }, [running]);

  const update = (s: TestRunState) => {
    stateRef.current = s;
    setState(s);
    store.setActive({ type: 'test', payload: s, updatedAt: now() }).then(
      () => setSaveError(null),
      () => setSaveError("Couldn't save progress on this device. Keep going; it retries on your next tap."),
    );
  };

  const leave = () => { void refresh(); navigate('#/'); };
  const modal = sheet !== null ? 'true' : undefined;

  if (!state) {
    return (
      <main class="screen runner-pre">
        <header class="runner__top">
          <span class="runner__meta">Standard Test</span>
          <LeaveButton onLeave={leave} />
        </header>
        {toast && <p class="notice notice--error" role="status">{toast}</p>}
        <h1 class="runner-pre__title">Standard Skill Test — 20–25 minutes</h1>
        <p class="test-intro">{TEST_INTRO}</p>
        <ol class="block-list">
          {TEST_ORDER.map((id) => {
            const t = getTestDef(id);
            return <li key={id}><span>{t.name}</span><span class="block-list__min">{t.attempts}</span></li>;
          })}
        </ol>
        <div class="runner-pre__start">
          <BigButton variant="good" onClick={() => {
            unlockAudio();
            update(startTest(now()));
          }}>Start test</BigButton>
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
      ['cut', sc.cut === undefined ? undefined : `${sc.cut}/20 (L ${sc.cutL} · R ${sc.cutR})`],
      ['stop', sc.stop === undefined ? undefined : `${sc.stop}/10`],
      ['draw', sc.drawAvg === undefined ? undefined : `${sc.drawAvg}"`],
      ['fiveBall', sc.fiveBall === undefined ? undefined : `${sc.fiveBall}/5`],
    ];
    const save = async () => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setFinishing(true);
      setSaveError(null);
      try {
        await store.putTest(toTestRecord(state, plan.version, now()));
      } catch {
        finishingRef.current = false;
        setFinishing(false);
        setSaveError("Couldn't save the test. Try Save again.");
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
        setSaveError("Couldn't discard the test. Try again.");
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
            <span class="runner__meta">Test summary</span>
            <LeaveButton onLeave={leave} />
          </header>
          <h1>Standard Test</h1>
          {saveError && <p class="notice notice--error" role="alert">{saveError}</p>}
          <dl class="summary-list">
            {rows.map(([tid, score]) => (
              <div key={tid}>
                <dt>{getTestDef(tid).name}</dt>
                <dd>
                  <span>{score ?? '–'}</span>
                  {score === undefined && (
                    <span class="summary-note">{state.skipped.includes(tid) ? 'Skipped' : 'not counted'}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p class="summary-errors">
            {(['P', 'C', 'S', 'D'] as ErrorCodeId[]).map((c) => <span key={c}><b>{c}</b> {errs[c]}</span>)}
          </p>
          <div class="controls">
            <BigButton onClick={() => setSheet('discard')}>Discard</BigButton>
            <BigButton variant="good" onClick={save} disabled={finishing}>Save</BigButton>
          </div>
        </main>
        {sheet === 'discard' && (
          <Sheet title="Discard test" onClose={() => setSheet(null)}>
            <p class="sheet__text">Discard this test? Nothing will be saved.</p>
            <div class="sheet__actions sheet__actions--row">
              <BigButton onClick={() => setSheet(null)}>Cancel</BigButton>
              <BigButton variant="bad" onClick={discard}>Discard test</BigButton>
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
  const [goodLabel, badLabel] = id === 'stop' ? ['Success', 'Fail'] : LABELS[def.kind];

  /** Applies an action to the latest state, only while that state is still on the test this screen shows. */
  const apply = (f: (s: TestRunState) => TestRunState) => {
    const cur = stateRef.current!;
    if (currentTest(cur) === id) update(f(cur));
  };
  const miss = () => {
    if (full) return;
    apply((s) => recordShot(s, false));
    setSheet('tag');
  };
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
            <span class="runner__meta">Test {state.index + 1}/{TEST_ORDER.length}</span>
            <span class="runner__row">
              <button type="button" class="link-button" onClick={() => setSheet('end')}>End test</button>
              <LeaveButton onLeave={leave} />
            </span>
          </div>
        </div>
        <div class="runner__body" key={id}>
          {saveError && <p class="notice notice--error" role="status">{saveError}</p>}
          <h2 class="runner__name">{def.name}</h2>
          <p class="test-setup">{def.setup}</p>
          <p class="test-chip">Normal pockets · Same setup · No extra attempts</p>
          <p class="test-progress" aria-live="polite">{done} of {limit}</p>
          {id === 'cut' && (
            <p class={`cut-banner cut-banner--${side}`}>{side === 'L' ? '← Cutting LEFT' : 'Cutting RIGHT →'}</p>
          )}
          {id === 'draw' && <DrawInputs draw={state.draw} onChange={(i, v) => apply((s) => setDraw(s, i, v))} />}
        </div>
        {id !== 'draw' && (
          <div class="score-pad">
            <div class="score-pad__buttons">
              <BigButton variant="good" disabled={full} onClick={() => apply((s) => recordShot(s, true))}>{goodLabel}</BigButton>
              <BigButton variant="bad" disabled={full} onClick={miss}>{badLabel}</BigButton>
            </div>
            {id === 'cut' ? (
              <>
                <ShotDots shots={shots.slice(0, 10)} limit={10} label="L" />
                <ShotDots shots={shots.slice(10)} limit={10} label="R" />
              </>
            ) : <ShotDots shots={shots} limit={limit} />}
          </div>
        )}
        <div class="controls">
          <button type="button" class="control" disabled={id === 'draw' || shots.length === 0} onClick={() => apply(undo)}>Undo last</button>
          <button type="button" class="control" onClick={() => apply(skip)}>Skip test</button>
          <button type="button" class="control control--next" disabled={!isComplete(state, id)} onClick={() => apply((s) => (isComplete(s, id) ? advance(s) : s))}>
            {isLast ? 'Finish test' : 'Next test'}
          </button>
        </div>
      </main>
      {sheet === 'tag' && (
        <Sheet title="Why did it miss?" onClose={() => setSheet(null)}>
          <p class="sheet__text">Why did it miss? (optional)</p>
          <TagPicker onPick={pickTag} />
        </Sheet>
      )}
      {sheet === 'end' && (
        <Sheet title="End test" onClose={() => setSheet(null)}>
          <p class="sheet__text">End the test now? Unfinished tests are not counted.</p>
          <div class="sheet__actions sheet__actions--row">
            <BigButton onClick={() => setSheet(null)}>Keep going</BigButton>
            <BigButton variant="bad" onClick={() => { setSheet(null); apply((s) => ({ ...s, index: TEST_ORDER.length })); }}>End test now</BigButton>
          </div>
        </Sheet>
      )}
    </>
  );
}
