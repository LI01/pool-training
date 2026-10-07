import { formatClock } from '../../runner/session';

/** Large countdown; turns red and flashes once time is up, then shows overtime ("+0:45"). */
export function Timer({ ms, paused }: { ms: number; paused?: boolean }) {
  const cls = `timer${ms <= 0 ? ' timer--over' : ''}${paused ? ' timer--paused' : ''}`;
  return <div class={cls} role="timer" aria-live="off">{formatClock(ms)}</div>;
}
