import { t } from '../../i18n';
import { DAYS_PER_WEEK, getBlock, getDay, plan } from '../../plan';
import { nextPlanDay } from '../../stats';
import { useOpenGuard } from '../components/OpenGuard';
import { useAppData } from '../useAppData';

const names = (ids: string[]) => ids.map((id) => getBlock(id)!.name).join(' · ');

/** The whole plan: the daily basics, then each week's six days; tap a day to train it. */
export function PlanOverview() {
  const { sessions, settings } = useAppData();
  const { open, sheet } = useOpenGuard();
  const next = nextPlanDay(sessions, settings);
  const done = new Set(sessions.map((s) => s.dayNumber).filter((n) => n !== undefined));

  return (
    <main class="screen plan">
      <h1>{t('plan.title')}</h1>
      <details class="intro">
        <summary>{t('session.intro')}</summary>
        {plan.intro.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
      </details>
      <section class="panel">
        <h2>{t('plan.daily')}</h2>
        <p class="plan__daily">{t('plan.dailyText', { start: names(plan.daily.start), end: names(plan.daily.end) })}</p>
      </section>
      {plan.weeks.map((w, wi) => (
        <section key={wi} class="plan__week">
          <h2>{t('plan.week', { n: wi + 1 })} · {w.title}</h2>
          <p class="muted plan__focus">{w.focus}</p>
          <div class="cards">
            {Array.from({ length: DAYS_PER_WEEK }, (_, i) => wi * DAYS_PER_WEEK + i + 1).map((n) => {
              const d = getDay(n);
              const focus = (n - 1) % DAYS_PER_WEEK % 2 === 0 ? w.a : w.b;
              return (
                <button type="button" key={n} class={n === next ? 'card card--next' : 'card'} onClick={() => open(`#/day/${n}`)}>
                  <span class="card__text">
                    <span class="card__title">{t('plan.day', { n })}</span>
                    <span class="card__sub">{names(focus)} · {t('session.minutes', { n: d.minutes })}</span>
                  </span>
                  {n === next ? <span class="pill pill--progress">{t('plan.current')}</span>
                    : done.has(n) ? <span class="pill pill--done">{t('plan.done')}</span> : null}
                </button>
              );
            })}
          </div>
          <p class="muted plan__rest">{t('plan.restDay')}</p>
        </section>
      ))}
      {sheet}
    </main>
  );
}
