import { useState } from 'preact/hooks';
import {
  dayNumber, errorTotals, focusSuggestion, minutesByDay, resolveStartDate, streak, testScores, trainingRecords,
  weeklySummary, type Metric,
} from '../../stats';
import { addDays, daysBetween } from '../../stats/dates';
import { BarChart } from '../components/BarChart';
import { ERROR_COLORS, SERIES_COLORS } from '../components/chartSetup';
import { LineChart } from '../components/LineChart';
import { useAppData } from '../useAppData';

type Range = 'plan' | 'all';
const CODES = ['P', 'C', 'S', 'D'] as const;
const CODE_NAMES = { P: 'Potting', C: 'Cue-ball', S: 'Spin/Speed', D: 'Decision' } as const;
const ROWS: [Metric, string][] = [
  ['straight', 'Straight /10'], ['cut', 'Cut /20'], ['stop', 'Stop /10'], ['drawAvg', 'Draw @24" (in)'], ['fiveBall', '5-Ball /5'],
];
const fmt = (n: number | null) => (n === null ? '–' : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''));
const short = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
const NONE = <p class="muted">No data yet.</p>;

export function Progress() {
  const { sessions, tests, settings, today } = useAppData();
  const [range, setRange] = useState<Range>('plan');
  const start = resolveStartDate(settings, sessions, tests) ?? today;
  const planEnd = addDays(start, 29);
  const from = range === 'plan' ? start : [start, ...sessions.map((s) => s.date), ...tests.map((t) => t.date)].sort()[0];
  const lastRec = [...sessions, ...tests].map((r) => r.date).sort().at(-1) ?? today;
  const to = range === 'plan' ? planEnd : [today, lastRec].sort().at(-1)!;
  const inR = (d: string) => d >= from && d <= to;

  const rTests = tests.filter((t) => inR(t.date)).sort((a, b) => a.date.localeCompare(b.date) || a.endedAt - b.endedAt);
  const rSessions = sessions.filter((s) => inR(s.date));
  const labels = rTests.map((t) => short(t.date));
  const scores = rTests.map(testScores);
  const col = (k: 'straight' | 'cutL' | 'cutR' | 'cut' | 'stop' | 'drawAvg' | 'fiveBall') => scores.map((s) => s[k] ?? null);
  const summary = weeklySummary(tests, start);

  const totals = errorTotals(sessions, tests, from, to);
  // 7-day buckets aligned to the plan start; in All time, records before start fall into earlier (negative-index) buckets.
  const b0 = Math.floor(daysBetween(start, from) / 7);
  const nBuckets = Math.max(1, Math.floor(daysBetween(start, to) / 7) - b0 + 1);
  const bStart = (i: number) => addDays(start, (b0 + i) * 7);
  const bucketLabels = Array.from({ length: nBuckets }, (_, i) => short(bStart(i)));
  const buckets = Array.from({ length: nBuckets }, (_, i) => errorTotals(sessions, tests, bStart(i), addDays(bStart(i), 6)));
  const hasErrors = CODES.some((c) => totals[c] > 0);
  const focus = focusSuggestion(sessions, tests, today);

  const days = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
  const mins = minutesByDay(rSessions);
  const done = (d: string, id: 'am' | 'pm') => rSessions.some((s) => s.date === d && s.sessionId === id);
  const n = streak(sessions, today);

  const recs = trainingRecords(rSessions);
  const rl = recs.map((r) => short(r.date));
  const pct = (v?: number) => (v === undefined ? null : Math.round(v * 100));

  return (
    <main class="screen progress">
      <h1>Progress</h1>
      <div class="seg" role="group" aria-label="Range">
        <button type="button" class={range === 'plan' ? 'seg__on' : ''} aria-pressed={range === 'plan'} onClick={() => setRange('plan')}>30-day plan</button>
        <button type="button" class={range === 'all' ? 'seg__on' : ''} aria-pressed={range === 'all'} onClick={() => setRange('all')}>All time</button>
      </div>

      <section>
        <h2>Test scores</h2>
        {rTests.length === 0 ? NONE : (
          <>
            <LineChart title="Straight /10" labels={labels} yMax={10} stepSize={2} series={[{ label: 'Straight', data: col('straight'), color: SERIES_COLORS.total }]} />
            <LineChart title="Cut /20" labels={labels} yMax={20} stepSize={5} series={[
              { label: 'Total', data: col('cut'), color: SERIES_COLORS.total },
              { label: 'Left', data: col('cutL'), color: SERIES_COLORS.left },
              { label: 'Right', data: col('cutR'), color: SERIES_COLORS.right },
            ]} />
            <LineChart title="Stop /10" labels={labels} yMax={10} stepSize={2} series={[{ label: 'Stop', data: col('stop'), color: SERIES_COLORS.total }]} />
            <LineChart title="Draw avg (in)" labels={labels} series={[{ label: 'Draw avg', data: col('drawAvg'), color: SERIES_COLORS.total }]} />
            <LineChart title="5-ball /5" labels={labels} yMax={5} stepSize={1} series={[{ label: '5-ball', data: col('fiveBall'), color: SERIES_COLORS.total }]} />
          </>
        )}
        <div class="table-wrap">
          <table class="summary">
            <thead>
              <tr><th>Metric</th><th>Week 1</th><th>Week 2</th><th>Week 3</th><th>Week 4</th><th>30-Day Best</th><th>30-Day Avg</th></tr>
            </thead>
            <tbody>
              {ROWS.map(([m, name]) => (
                <tr key={m}>
                  <th scope="row">{name}</th>
                  {summary[m].weeks.map((w, i) => <td key={i}>{fmt(w)}</td>)}
                  <td>{fmt(summary[m].best)}</td>
                  <td>{fmt(summary[m].avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Errors</h2>
        {!hasErrors ? NONE : (
          <>
            <ul class="err-list">
              {CODES.map((c) => (
                <li key={c}><span class="err-dot" style={{ background: ERROR_COLORS[c] }} />{`${c} — ${CODE_NAMES[c]}: ${totals[c]}`}</li>
              ))}
            </ul>
            <BarChart title="Errors per week" stacked labels={bucketLabels}
              series={CODES.map((c) => ({ label: c, data: buckets.map((b) => b[c]), color: ERROR_COLORS[c] }))} />
          </>
        )}
        <div class="focus-card">
          <h3>Focus</h3>
          {focus ? (
            <>
              <p>{focus.advice}</p>
              <p class="muted">{focus.blockNames.join(', ')}</p>
            </>
          ) : <p class="muted">Not enough tagged errors in the last 7 days for a suggestion (need 10).</p>}
        </div>
      </section>

      <section>
        <h2>Consistency</h2>
        <p class="streak">{`Streak: ${n} ${n === 1 ? 'day' : 'days'}`}</p>
        {rSessions.length === 0 && rTests.length === 0 ? NONE : (
          <>
            <div class="cal" aria-label="Training calendar">
              {days.map((d) => (
                <div class="cal__cell" key={d}>
                  <span class="cal__day">{dayNumber(d, start) >= 1 ? dayNumber(d, start) : short(d)}</span>
                  <span class="cal__marks">
                    <i class={done(d, 'am') ? 'on' : ''} title="AM">A</i>
                    <i class={done(d, 'pm') ? 'on' : ''} title="PM">P</i>
                    <i class={tests.some((t) => t.date === d) ? 'on' : ''} title="Test">T</i>
                  </span>
                </div>
              ))}
            </div>
            <BarChart title="Minutes per day" labels={days.map(short)} series={[{ label: 'Minutes', data: days.map((d) => mins[d] ?? 0), color: SERIES_COLORS.total }]} />
          </>
        )}
      </section>

      <section>
        <h2>Training records</h2>
        {recs.length === 0 ? NONE : (
          <>
            <LineChart title="Draw (in)" labels={rl} series={[
              { label: 'Best', data: recs.map((r) => r.drawBest ?? null), color: SERIES_COLORS.total },
              { label: 'Typical', data: recs.map((r) => (r.drawTypical === undefined ? null : Math.round(r.drawTypical * 10) / 10)), color: SERIES_COLORS.alt },
            ]} />
            <LineChart title="Success rate (%)" labels={rl} yMax={100} series={[
              { label: '3-ball', data: recs.map((r) => pct(r.threeBallRate)), color: SERIES_COLORS.left },
              { label: '5-ball', data: recs.map((r) => pct(r.fiveBallRate)), color: SERIES_COLORS.right },
            ]} />
          </>
        )}
      </section>
    </main>
  );
}
