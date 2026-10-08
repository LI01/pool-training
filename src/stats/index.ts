import { t, toLen } from '../i18n';
import { BLOCK_IDS, DAYS_PER_WEEK } from '../plan';
import type { SessionRecord, Settings, Shot, TestRecord } from '../db/types';
import { addDays, daysBetween } from './dates';

export type Metric = 'straight' | 'cut' | 'stop' | 'drawAvg' | 'fiveBall';
export const METRICS: Metric[] = ['straight', 'cut', 'stop', 'drawAvg', 'fiveBall'];
export interface TestScores { straight?: number; cutL?: number; cutR?: number; cut?: number; stop?: number; drawAvg?: number; fiveBall?: number }
export interface MetricSummary { weeks: (number | null)[]; best: number | null; avg: number | null }

const made = (s?: Shot[]) => (s ? s.filter((x) => x.ok).length : undefined);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number) => Math.round(n * 10) / 10;

const planSessions = (sessions: SessionRecord[]) => sessions.filter((s) => s.sessionId === 'day' && s.dayNumber !== undefined);

/**
 * The next plan day to train: one past the furthest day finished since progress was last set in Settings, and never
 * before that setting. Repeating an earlier day does not move it back. Above PLAN_DAYS means the plan is complete.
 */
export function nextPlanDay(sessions: SessionRecord[], settings: Settings): number {
  const since = settings.planDaySetAt ?? -Infinity;
  const done = planSessions(sessions).filter((s) => s.endedAt > since).map((s) => s.dayNumber!);
  return Math.max(settings.planDay ?? 1, done.length ? Math.max(...done) + 1 : 1);
}

/** The furthest plan day trained on or before `date` (0 if none). */
export const planDayAt = (date: string, sessions: SessionRecord[]): number =>
  Math.max(0, ...planSessions(sessions).filter((s) => s.date <= date).map((s) => s.dayNumber!));

/** The plan week a date belongs to: the week of the furthest day trained by then (week 1 before any). */
export const planWeekAt = (date: string, sessions: SessionRecord[]): number =>
  Math.max(1, Math.ceil(planDayAt(date, sessions) / DAYS_PER_WEEK));

/** Date of the first plan-day session, if any. */
export const planStartDate = (sessions: SessionRecord[]): string | undefined => planSessions(sessions).map((s) => s.date).sort()[0];

export function testScores(t: TestRecord): TestScores {
  return {
    straight: made(t.straight),
    cutL: t.cut ? made(t.cut.filter((s) => s.side === 'L')) : undefined,
    cutR: t.cut ? made(t.cut.filter((s) => s.side === 'R')) : undefined,
    cut: made(t.cut),
    stop: made(t.stop),
    drawAvg: t.draw && t.draw.length ? r1(t.draw.reduce((a, b) => a + b, 0) / t.draw.length) : undefined,
    fiveBall: made(t.fiveBall),
  };
}

/** Test averages per plan week (1–weeks) plus best and average, for tests taken since the plan started. */
export function weeklySummary(tests: TestRecord[], sessions: SessionRecord[], weeks: number): Record<Metric, MetricSummary> {
  const start = planStartDate(sessions);
  const inPlan = tests
    .filter((t) => start !== undefined && t.date >= start)
    .map((t) => ({ week: planWeekAt(t.date, sessions), s: testScores(t) }));
  const out = {} as Record<Metric, MetricSummary>;
  for (const m of METRICS) {
    const vals = (pred: (w: number) => boolean) =>
      inPlan.filter((x) => pred(x.week!) && x.s[m] !== undefined).map((x) => x.s[m] as number);
    const all = vals(() => true);
    out[m] = {
      weeks: Array.from({ length: weeks }, (_, i) => mean(vals((x) => x === i + 1))),
      best: all.length ? Math.max(...all) : null,
      avg: mean(all),
    };
  }
  return out;
}

export function streak(sessions: SessionRecord[], today: string): number {
  const days = new Set(sessions.map((s) => s.date));
  let d = days.has(today) ? today : days.has(addDays(today, -1)) ? addDays(today, -1) : null;
  let n = 0;
  while (d && days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export function minutesByDay(sessions: SessionRecord[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of sessions) m[s.date] = (m[s.date] ?? 0) + s.activeMinutes;
  return m;
}

export function testDue(tests: TestRecord[], today: string): { daysSinceLast: number | null; due: boolean } {
  if (!tests.length) return { daysSinceLast: null, due: true };
  const last = tests.map((t) => t.date).sort().at(-1)!;
  const n = daysBetween(last, today);
  return { daysSinceLast: n, due: n >= 7 };
}

export function dailySummaryLine(date: string, tests: TestRecord[]): string {
  const latest = tests.filter((t) => t.date === date).sort((a, b) => a.endedAt - b.endedAt).at(-1);
  const s = latest ? testScores(latest) : {};
  const f = (v: number | undefined, suffix: string) => (v === undefined ? '–' : `${v}${suffix}`);
  return t('summary.line', {
    straight: f(s.straight, '/10'), cut: f(s.cut, '/20'), stop: f(s.stop, '/10'), draw: f(s.drawAvg === undefined ? undefined : toLen(s.drawAvg), t('unit.len')), fiveBall: f(s.fiveBall, '/5'),
  });
}

export interface TrainingDay { date: string; drawBest?: number; drawTypical?: number; threeBallRate?: number; fiveBallRate?: number }
export function trainingRecords(sessions: SessionRecord[]): TrainingDay[] {
  const byDate = new Map<string, { drawB: number[]; drawT: number[]; s3: number; a3: number; s5: number; a5: number }>();
  for (const s of sessions) {
    const acc = byDate.get(s.date) ?? { drawB: [], drawT: [], s3: 0, a3: 0, s5: 0, a5: 0 };
    for (const b of s.blocks) {
      if (b.skipped) continue;
      if (b.blockId === BLOCK_IDS.drawLadder && b.draw) { acc.drawB.push(b.draw.bestIn); acc.drawT.push(b.draw.typicalIn); }
      if (b.blockId === BLOCK_IDS.threeBall && b.runs) { acc.s3 += b.runs.success; acc.a3 += b.runs.attempts; }
      if (b.blockId === BLOCK_IDS.fiveBall && b.runs) { acc.s5 += b.runs.success; acc.a5 += b.runs.attempts; }
    }
    byDate.set(s.date, acc);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, a]) => ({
    date,
    drawBest: a.drawB.length ? Math.max(...a.drawB) : undefined,
    drawTypical: mean(a.drawT) ?? undefined,
    threeBallRate: a.a3 ? a.s3 / a.a3 : undefined,
    fiveBallRate: a.a5 ? a.s5 / a.a5 : undefined,
  }));
}
