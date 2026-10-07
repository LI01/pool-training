import { useState } from 'preact/hooks';
import { getSession, type SessionId } from '../../plan';
import { dailySummaryLine, dayNumber, resolveStartDate, testDue } from '../../stats';
import { wakeLockSupported } from '../../platform/wakeLock';
import { navigate, type NowFn } from '../nav';
import { BigButton } from '../components/BigButton';
import { Sheet } from '../components/Sheet';
import { useAppData } from '../useAppData';

type Status = 'Not started' | 'In progress' | 'Done';
const WEEK_MS = 7 * 24 * 3600 * 1000;

function tipShown(): boolean {
  try { return localStorage.getItem('wakeTipShown') !== null; } catch { return false; }
}

function StatusPill({ status }: { status: Status }) {
  const cls = status === 'Done' ? 'done' : status === 'In progress' ? 'progress' : 'idle';
  return <span class={`pill pill--${cls}`}>{status}</span>;
}

export function Today({ now }: { now: NowFn }) {
  const { store, sessions, tests, settings, active, today, refresh } = useAppData();
  const [pending, setPending] = useState<string | null>(null);
  const [tipHidden, setTipHidden] = useState(tipShown());

  const start = resolveStartDate(settings, sessions, tests) ?? today;
  const day = dayNumber(today, start);
  const due = testDue(tests, today);

  const activeSession = active?.type === 'session' ? (active.payload as { sessionId?: SessionId } | null)?.sessionId : undefined;
  const sessionStatus = (id: SessionId): Status =>
    activeSession === id ? 'In progress' : sessions.some((s) => s.date === today && s.sessionId === id) ? 'Done' : 'Not started';
  const testStatus: Status =
    active?.type === 'test' ? 'In progress' : tests.some((t) => t.date === today) ? 'Done' : 'Not started';

  const testSubtitle =
    due.daysSinceLast === null ? 'No tests yet — due'
      : (due.daysSinceLast === 0 ? 'Last test: today'
        : due.daysSinceLast === 1 ? 'Last test: 1 day ago'
          : `Last test: ${due.daysSinceLast} days ago`) + (due.due ? ' — due' : '');

  const activeHash = active ? (active.type === 'test' ? '#/test' : `#/session/${activeSession ?? 'am'}`) : undefined;
  const open = (hash: string) => {
    if (active && activeHash !== hash) setPending(hash);
    else navigate(hash);
  };

  const dates = new Set([...sessions, ...tests].map((r) => r.date));
  const lastExport = settings.lastExportAt;
  const showBackup = lastExport === undefined ? dates.size >= 3 : now() - lastExport > WEEK_MS;
  const showTip = !wakeLockSupported() && !tipHidden;
  const dismissTip = () => {
    try { localStorage.setItem('wakeTipShown', '1'); } catch { /* ignore */ }
    setTipHidden(true);
  };

  const cards: { hash: string; title: string; subtitle: string; status: Status }[] = [
    { hash: '#/session/am', title: 'Morning Session', subtitle: getSession('am').title, status: sessionStatus('am') },
    { hash: '#/session/pm', title: 'Afternoon Session', subtitle: getSession('pm').title, status: sessionStatus('pm') },
    { hash: '#/test', title: 'Standard Test', subtitle: testSubtitle, status: testStatus },
  ];

  return (
    <main class="screen">
      <header class="page-header">
        <h1 class="day-title">{day > 30 ? `Day ${day}` : `Day ${day} of 30`}</h1>
      </header>

      {showBackup && (
        <div class="banner">
          <span>Time to back up your training data.</span>
          <a href="#/settings">Open Settings</a>
        </div>
      )}
      {showTip && (
        <div class="banner banner--tip">
          <span>Tip: set Auto-Lock to 'Never' in iOS Settings → Display while training.</span>
          <button type="button" class="link-button" onClick={dismissTip}>Dismiss</button>
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

      <code class="summary-line">{dailySummaryLine(today, sessions, tests)}</code>

      {pending && (
        <Sheet title="Another session is in progress" onClose={() => setPending(null)}>
          <p class="sheet__text">Another session is in progress. Discard it?</p>
          <div class="sheet__actions">
            <BigButton onClick={() => { const h = activeHash!; setPending(null); navigate(h); }}>Resume it</BigButton>
            <BigButton variant="bad" onClick={async () => {
              const h = pending;
              await store.setActive(undefined);
              await refresh();
              setPending(null);
              navigate(h);
            }}>Discard & start</BigButton>
          </div>
        </Sheet>
      )}
    </main>
  );
}
