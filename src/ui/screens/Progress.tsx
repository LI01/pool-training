import { useState } from 'preact/hooks';
import {
  minutesByDay, planStartDate, streak, testScores, trainingRecords,
  weeklySummary, type Metric,
} from '../../stats';
import { addDays, daysBetween } from '../../stats/dates';
import { t, toLen, type Key } from '../../i18n';
import { PLAN_DAYS, DAYS_PER_WEEK } from '../../plan';
import { BarChart } from '../components/BarChart';
import { SERIES_COLORS } from '../components/chartSetup';
import { LineChart } from '../components/LineChart';
import { useAppData } from '../useAppData';

type Range = 'plan' | 'all';
const ROWS: [Metric, Key][] = [
  ['straight', 'progress.straight10'], ['cut', 'progress.cut20'], ['stop', 'progress.stop10'], ['drawAvg', 'progress.draw24'], ['fiveBall', 'progress.fiveBall5'],
];
const fmt = (n: number | null) => (n === null ? '–' : (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, ''));
/** Draw averages are inches; shown in the language's unit. */
const conv = (m: Metric, n: number | null) => (m === 'drawAvg' && n !== null ? toLen(n) : n);
const short = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;

export function Progress() {
  const { sessions, tests, today } = useAppData();
  const [range, setRange] = useState<Range>('plan');
  const start = planStartDate(sessions) ?? today;
  const from = range === 'plan' ? start : [start, ...sessions.map((s) => s.date), ...tests.map((t) => t.date)].sort()[0];
  const lastRec = [...sessions, ...tests].map((r) => r.date).sort().at(-1) ?? today;
  const to = [today, lastRec].sort().at(-1)!;
  const inR = (d: string) => d >= from && d <= to;

  const rTests = tests.filter((t) => inR(t.date)).sort((a, b) => a.date.localeCompare(b.date) || a.endedAt - b.endedAt);
  const rSessions = sessions.filter((s) => inR(s.date));
  const labels = rTests.map((t) => short(t.date));
  const scores = rTests.map(testScores);
  const col = (k: 'straight' | 'cutL' | 'cutR' | 'cut' | 'stop' | 'drawAvg' | 'fiveBall') => scores.map((s) => s[k] ?? null);
  const weeks = Array.from({ length: PLAN_DAYS / DAYS_PER_WEEK }, (_, i) => i + 1);
  const summary = weeklySummary(tests, sessions, weeks.length);

  const days = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
  const mins = minutesByDay(rSessions);
  const trained = (d: string) => rSessions.some((s) => s.date === d);
  /** The plan day(s) trained on a date, for the calendar label. */
  const planDays = (d: string) => [...new Set(rSessions.filter((s) => s.date === d && s.dayNumber !== undefined).map((s) => s.dayNumber!))].sort((a, b) => a - b);
  const n = streak(sessions, today);

  const recs = trainingRecords(rSessions);
  const rl = recs.map((r) => short(r.date));
  const pct = (v?: number) => (v === undefined ? null : Math.round(v * 100));
  const NONE = <p class="muted">{t('common.noData')}</p>;

  return (
    <main class="screen progress">
      <h1>{t('nav.progress')}</h1>
      <div class="seg" role="group" aria-label={t('progress.range')}>
        <button type="button" class={range === 'plan' ? 'seg__on' : ''} aria-pressed={range === 'plan'} onClick={() => setRange('plan')}>{t('progress.plan')}</button>
        <button type="button" class={range === 'all' ? 'seg__on' : ''} aria-pressed={range === 'all'} onClick={() => setRange('all')}>{t('progress.all')}</button>
      </div>

      <section>
        <h2>{t('progress.testScores')}</h2>
        {rTests.length === 0 ? NONE : (
          <>
            <LineChart title={t('progress.straight10')} labels={labels} yMax={10} stepSize={2} series={[{ label: t('progress.straight'), data: col('straight'), color: SERIES_COLORS.total }]} />
            <LineChart title={t('progress.cut20')} labels={labels} yMax={20} stepSize={5} series={[
              { label: t('progress.total'), data: col('cut'), color: SERIES_COLORS.total },
              { label: t('progress.left'), data: col('cutL'), color: SERIES_COLORS.left },
              { label: t('progress.right'), data: col('cutR'), color: SERIES_COLORS.right },
            ]} />
            <LineChart title={t('progress.stop10')} labels={labels} yMax={10} stepSize={2} series={[{ label: t('progress.stop'), data: col('stop'), color: SERIES_COLORS.total }]} />
            <LineChart title={t('progress.drawAvgIn')} labels={labels} series={[{ label: t('progress.drawAvg'), data: col('drawAvg').map((n) => (n === null ? null : toLen(n))), color: SERIES_COLORS.total }]} />
            <LineChart title={t('progress.fiveBallChart')} labels={labels} yMax={5} stepSize={1} series={[{ label: t('progress.fiveBall'), data: col('fiveBall'), color: SERIES_COLORS.total }]} />
          </>
        )}
        <div class="table-wrap">
          <table class="summary">
            <thead>
              <tr><th>{t('progress.metric')}</th>{weeks.map((w) => <th key={w}>{t('progress.week', { n: w })}</th>)}<th>{t('progress.best30')}</th><th>{t('progress.avg30')}</th></tr>
            </thead>
            <tbody>
              {ROWS.map(([m, name]) => (
                <tr key={m}>
                  <th scope="row">{t(name)}</th>
                  {summary[m].weeks.map((w, i) => <td key={i}>{fmt(conv(m, w))}</td>)}
                  <td>{fmt(conv(m, summary[m].best))}</td>
                  <td>{fmt(conv(m, summary[m].avg))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>{t('progress.consistency')}</h2>
        <p class="streak">{t(n === 1 ? 'progress.streak1' : 'progress.streakN', { n })}</p>
        {rSessions.length === 0 && rTests.length === 0 ? NONE : (
          <>
            <div class="cal" aria-label={t('progress.calendar')}>
              {days.map((d) => (
                <div class="cal__cell" key={d}>
                  <span class="cal__day">{planDays(d).length ? planDays(d).join(',') : short(d)}</span>
                  <span class="cal__marks">
                    <i class={trained(d) ? 'on' : ''} title={t('progress.train')}>{t('progress.trainShort')}</i>
                    <i class={tests.some((t) => t.date === d) ? 'on' : ''} title={t('progress.test')}>{t('progress.testShort')}</i>
                  </span>
                </div>
              ))}
            </div>
            <BarChart title={t('progress.minutesPerDay')} labels={days.map(short)} series={[{ label: t('progress.minutes'), data: days.map((d) => mins[d] ?? 0), color: SERIES_COLORS.total }]} />
          </>
        )}
      </section>

      <section>
        <h2>{t('progress.records')}</h2>
        {recs.length === 0 ? NONE : (
          <>
            <LineChart title={t('progress.drawIn')} labels={rl} series={[
              { label: t('progress.best'), data: recs.map((r) => (r.drawBest === undefined ? null : toLen(r.drawBest))), color: SERIES_COLORS.total },
              { label: t('progress.typical'), data: recs.map((r) => (r.drawTypical === undefined ? null : toLen(Math.round(r.drawTypical * 10) / 10))), color: SERIES_COLORS.alt },
            ]} />
            <LineChart title={t('progress.successRate')} labels={rl} yMax={100} series={[
              { label: t('progress.threeBall'), data: recs.map((r) => pct(r.threeBallRate)), color: SERIES_COLORS.left },
              { label: t('progress.fiveBall'), data: recs.map((r) => pct(r.fiveBallRate)), color: SERIES_COLORS.right },
            ]} />
          </>
        )}
      </section>
    </main>
  );
}
