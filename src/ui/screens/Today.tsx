import { useState } from 'preact/hooks';
import { t, type Key } from '../../i18n';
import { DAYS_PER_WEEK, getDay, PLAN_DAYS } from '../../plan';
import { dailySummaryLine, nextPlanDay, testDue } from '../../stats';
import { wakeLockSupported } from '../../platform/wakeLock';
import { type NowFn } from '../nav';
import { useOpenGuard } from '../components/OpenGuard';
import { useAppData } from '../useAppData';

type Status = 'Not started' | 'In progress' | 'Done';
const STATUS_KEY: Record<Status, Key> = { 'Not started': 'today.status.notStarted', 'In progress': 'today.status.inProgress', Done: 'today.status.done' };
const WEEK_MS = 7 * 24 * 3600 * 1000;

function tipShown(): boolean {
  try { return localStorage.getItem('wakeTipShown') !== null; } catch { return false; }
}

function StatusPill({ status }: { status: Status }) {
  const cls = status === 'Done' ? 'done' : status === 'In progress' ? 'progress' : 'idle';
  return <span class={`pill pill--${cls}`}>{t(STATUS_KEY[status])}</span>;
}

export function Today({ now }: { now: NowFn }) {
  const { store, sessions, tests, settings, active, today, refresh } = useAppData();
  const [tipHidden, setTipHidden] = useState(tipShown());

  const day = nextPlanDay(sessions, settings);
  const complete = day > PLAN_DAYS;
  const due = testDue(tests, today);
  const doneToday = [...new Set(sessions.filter((s) => s.date === today && s.dayNumber !== undefined).map((s) => s.dayNumber!))].sort((a, b) => a - b);

  const activeDay = active?.type === 'session' ? (active.payload as { dayNumber?: number } | null)?.dayNumber : undefined;
  // Six days of the week done and the next week not started: a rest or test day.
  const restDay = !complete && day > 1 && (day - 1) % DAYS_PER_WEEK === 0 && activeDay !== day;
  const testStatus: Status =
    active?.type === 'test' ? 'In progress' : tests.some((t) => t.date === today) ? 'Done' : 'Not started';

  const testSubtitle =
    due.daysSinceLast === null ? t('today.test.none')
      : (due.daysSinceLast === 0 ? t('today.test.today')
        : due.daysSinceLast === 1 ? t('today.test.oneDay')
          : t('today.test.days', { n: due.daysSinceLast })) + (due.due ? t('today.test.due') : '');

  const { open, sheet } = useOpenGuard();

  const dates = new Set([...sessions, ...tests].map((r) => r.date));
  const lastExport = settings.lastExportAt;
  const showBackup = lastExport === undefined ? dates.size >= 3 : now() - lastExport > WEEK_MS;
  const showTip = !wakeLockSupported() && !tipHidden;
  const dismissTip = () => {
    try { localStorage.setItem('wakeTipShown', '1'); } catch { /* ignore */ }
    setTipHidden(true);
  };

  const restart = async () => {
    await store.saveSettings({ ...settings, planDay: 1, planDaySetAt: now() });
    await refresh();
  };

  const cards: { hash: string; title: string; subtitle: string; status: Status }[] = [];
  if (!complete) {
    const d = getDay(day);
    cards.push({
      hash: `#/day/${day}`, title: t('plan.dayTitle', { day, week: d.week, title: d.info.title }),
      subtitle: `${d.info.focus} · ${t('session.minutes', { n: d.minutes })}`,
      status: activeDay === day ? 'In progress' : 'Not started',
    });
  }
  cards.push({ hash: '#/test', title: t('test.standard'), subtitle: testSubtitle, status: testStatus });

  return (
    <main class="screen">
      <header class="page-header">
        <h1 class="day-title">{complete ? t('today.complete') : t('today.dayOf', { day, total: PLAN_DAYS })}</h1>
      </header>
      {doneToday.length > 0 && <p class="muted today-done">{t('today.doneToday', { days: doneToday.join('、') })}</p>}
      {restDay && <div class="banner banner--tip"><span>{t('today.rest', { week: (day - 1) / DAYS_PER_WEEK })}</span></div>}
      {complete && (
        <div class="banner">
          <span>{t('today.completeText')}</span>
          <button type="button" class="link-button" onClick={restart}>{t('today.restart')}</button>
        </div>
      )}

      {showBackup && (
        <div class="banner">
          <span>{t('today.backup')}</span>
          <a href="#/settings">{t('today.openSettings')}</a>
        </div>
      )}
      {showTip && (
        <div class="banner banner--tip">
          <span>{t('today.tip')}</span>
          <button type="button" class="link-button" onClick={dismissTip}>{t('today.dismiss')}</button>
        </div>
      )}

      <div class="cards">
        {cards.map((c) => (
          <button type="button" class="card" key={c.hash} onClick={() => open(c.hash)}>
            <span class="card__text">
              <span class="card__title">{c.title}</span>
              <span class="card__sub">{c.subtitle}</span>
            </span>
            <StatusPill status={c.status} />
          </button>
        ))}
      </div>

      <code class="summary-line">{dailySummaryLine(today, tests)}</code>

      {sheet}
    </main>
  );
}
